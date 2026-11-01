#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-editor.py — una sola ventana para editar, y ninguna sección con formulario.

La ronda R100 sacó los siete formularios que se abrían dentro de la sección y los
llevó a `#modal-editor` (js/nucleo/modal.js). Este gate mide ese contrato:

  1. ninguna vista de bloque lleva ya un <form>, y la ventana existe una sola vez;
  2. en la app no queda ningún <form> dentro del contenido ni los ids viejos;
  3. cada editor abre LA MISMA ventana, con su título y el foco en un campo;
  4. Escape cierra sin guardar; Cancelar cierra sin guardar;
  5. Guardar persiste y cierra; editar cambia el registro y no duplica;
  6. el foco vuelve al botón que abrió la ventana.

Uso:
  python3 pruebas/gate-editor.py
  python3 pruebas/gate-editor.py --demo
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
VISTAS = sorted((RAIZ / "app" / "js" / "bloques").glob("*/vista.js"))

sys.path.insert(0, str(AQUI))
from gatelib import abrir_plegable, Navegador, exigir, salir  # noqa: E402

VIEJOS = ["#evento-form", "#tarea-form", "#ramo-form", "#carrera-form",
          "#calif-curso-form", "#est-form", "#alarma-form", "#modal-sesion"]


def datos(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}')")


def abrir_pagina(nav, bloques=("tiempo", "malla", "calificaciones", "estudio")):
    ctx, page, errores = nav.abrir(APP, 1440, 950)
    page.evaluate("""bloques => {
        const e = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
        e.instalados = bloques;
        localStorage.setItem('mimo.shell.v1', JSON.stringify(e));
    }""", list(bloques))
    page.goto(APP.as_uri(), wait_until="load")
    page.wait_for_timeout(500)
    return ctx, page, errores


def ventana(page, editor):
    """La ventana única abierta con el editor pedido."""
    capa = page.locator("#modal-editor")
    if not capa.is_visible():
        return False
    if capa.get_attribute("data-editor") != editor:
        return False
    return bool(page.locator("#modal-editor-tit").inner_text().strip())


def main() -> int:
    fallas: list[str] = []
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    # 1) el formulario no vive en la vista del bloque
    for f in VISTAS:
        texto = f.read_text(encoding="utf-8")
        exigir("<form" not in texto, f"{f.name}: la vista no lleva <form> propio", fallas)
    indice = (RAIZ / "app" / "index.html").read_text(encoding="utf-8")
    exigir(indice.count('id="modal-editor"') == 1, "la ventana de edición existe una sola vez", fallas)
    exigir("js/nucleo/modal.js" in indice, "index.html carga js/nucleo/modal.js", fallas)

    with Navegador() as nav:
        ctx, page, errores = abrir_pagina(nav)
        page.on("dialog", lambda d: d.accept())
        try:
            # 2) no queda editor en línea
            dentro = page.evaluate("document.querySelectorAll('.contenido form, .contenido-b form').length")
            exigir(dentro == 0, f"ningún formulario dentro del contenido — {dentro}", fallas)
            vivos = [s for s in VIEJOS if page.locator(s).count()]
            exigir(not vivos, f"los ids de los formularios viejos no existen — {vivos}", fallas)

            # 3) cada editor abre la misma ventana
            casos = [
                ("evento", '#tabs [data-ir="calendario"]', "#btn-nuevo-evento", "#evento-titulo"),
                ("tarea", '#tabs [data-ir="tareas"]', "#btn-nueva-tarea", "#tarea-titulo"),
                ("ramo", '#tabs [data-ir="malla"]', "#btn-nuevo-ramo", "#ramo-codigo"),
                ("carrera", '#tabs [data-ir="malla"]', "#btn-editar-carrera", "#carrera-titulo"),
                ("sesion-nueva", '#tabs [data-ir="estudio"]', "#btn-registrar-sesion", "#est-ramo"),
            ]
            for editor, pestana, boton, campo in casos:
                page.locator(pestana).click()
                page.wait_for_timeout(220)
                page.locator(boton).click()
                page.wait_for_timeout(180)
                exigir(ventana(page, editor), f"{editor}: abre la ventana única", fallas)
                foco = page.evaluate("document.activeElement && document.activeElement.id")
                exigir(foco == campo.lstrip("#"), f"{editor}: el foco entra en {campo} — {foco}", fallas)
                # 4) Escape cierra sin guardar
                antes = datos(page)
                page.keyboard.press("Escape")
                page.wait_for_timeout(150)
                exigir(not page.locator("#modal-editor").is_visible(), f"{editor}: Escape cierra", fallas)
                exigir(datos(page) == antes, f"{editor}: Escape no guarda", fallas)
                # el foco vuelve a quien abrió
                exigir(page.evaluate("document.activeElement && document.activeElement.id") == boton.lstrip("#"),
                       f"{editor}: el foco vuelve al botón", fallas)

            # 5) Cancelar cierra y Guardar persiste (evento)
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(150)
            page.locator("#evento-titulo").fill("No debe quedar")
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(200)
            exigir(not page.locator("#modal-editor").is_visible(), "cancelar: cierra la ventana", fallas)
            exigir((datos(page).get("eventos") or []) == [], "cancelar: no guarda el evento", fallas)

            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(150)
            page.locator("#evento-titulo").fill("Editor único")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(300)
            exigir(not page.locator("#modal-editor").is_visible(), "guardar: cierra la ventana", fallas)
            eventos = datos(page).get("eventos") or []
            exigir(len(eventos) == 1 and eventos[0]["titulo"] == "Editor único",
                   f"guardar: el evento queda guardado — {eventos}", fallas)

            # 6) editar cambia el registro y no lo duplica
            page.locator('#cal-grid [data-evento]').first.click()
            page.wait_for_timeout(250)
            page.locator('#panel-cuerpo [data-editar-evento]').first.click()
            page.wait_for_timeout(200)
            exigir(ventana(page, "evento"), "editar: abre la ventana con el registro", fallas)
            exigir(page.locator("#evento-titulo").input_value() == "Editor único",
                   "editar: los campos vienen cargados", fallas)
            page.locator("#evento-titulo").fill("Editor único corregido")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(300)
            eventos = datos(page).get("eventos") or []
            exigir(len(eventos) == 1 and eventos[0]["titulo"] == "Editor único corregido",
                   f"editar: mismo registro corregido — {eventos}", fallas)

            # sesión: el editor lleva Borrar y corrige
            page.locator('#tabs [data-ir="estudio"]').click()
            page.wait_for_timeout(250)
            page.locator("#btn-registrar-sesion").click()
            page.wait_for_timeout(150)
            page.locator("#est-minutos").fill("0:45")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            exigir(len(datos(page).get("sesiones") or []) == 1, "sesión: queda registrada", fallas)
            abrir_plegable(page, "[data-editar-estudio]")
            page.locator("[data-editar-estudio]").first.click()
            page.wait_for_timeout(200)
            exigir(ventana(page, "sesion"), "sesión: se corrige en la ventana", fallas)
            exigir(page.locator("#modal-borrar").is_visible(), "sesión: la ventana ofrece Borrar", fallas)
            page.locator("#sesion-duracion").fill("1:30")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            sesiones = datos(page).get("sesiones") or []
            exigir(len(sesiones) == 1 and abs(sesiones[0]["minutos"] - 90) < 0.01,
                   f"sesión: corregida a 90 min — {sesiones}", fallas)

            # alarma: se crea desde la ventana de Tiempo
            page.locator('#tabs [data-ir="tiempo"]').click()
            page.wait_for_timeout(250)
            page.locator('[data-hijo="alarmas"]').click()
            page.wait_for_timeout(250)
            page.locator("#btn-nueva-alarma").click()
            page.wait_for_timeout(150)
            exigir(ventana(page, "alarma"), "alarma: se crea en la ventana", fallas)
            page.locator("#alarma-hora").fill("07:30")
            page.locator("#alarma-texto").fill("Desayuno")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            page.locator("[data-alarma-editar]").first.click()
            page.wait_for_timeout(200)
            exigir(ventana(page, "alarma"), "alarma: se corrige en la ventana", fallas)
            page.locator("#alarma-hora").fill("08:15")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            alarmas = datos(page).get("alarmas") or []
            exigir(len(alarmas) == 1 and alarmas[0]["hora"] == "08:15",
                   f"alarma: corregida a las 08:15 — {alarmas}", fallas)

            # la ventana nunca deja el foco fuera de sí misma
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(150)
            fuera = page.evaluate("""() => {
                const capa = document.querySelector('#modal-editor');
                return !capa.contains(document.activeElement);
            }""")
            exigir(not fuera, "foco: al abrir, el foco está dentro de la ventana", fallas)
            page.keyboard.press("Escape")
            page.wait_for_timeout(150)

            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

    codigo = salir("gate-editor", fallas)
    if not args.demo:
        return codigo
    # El gate tiene que discriminar: sin ventana, el editor no puede abrir.
    fallas_rotas = roto()
    codigo_roto = salir("gate-editor/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: la app buena no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


def roto() -> list[str]:
    """Fixture sin la ventana: las mismas comprobaciones TIENEN que salir 1."""
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate("() => document.querySelector('#modal-editor').remove()")
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(200)
            exigir(ventana(page, "evento"), "roto: el editor abre la ventana única", fallas)
        finally:
            ctx.close()
    return fallas


if __name__ == "__main__":
    sys.exit(main())
