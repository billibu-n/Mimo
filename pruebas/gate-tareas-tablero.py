#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tareas-tablero.py — el tablero de Tareas de la versión anterior.

Mide lo que el encargo pide:
  1. Tablero es la vista inicial y trae los cinco filtros de la referencia;
  2. el gráfico de barras ya no existe;
  3. una tarea se completa desde la tarjeta, se tacha y pasa a Hechas;
  4. el menú contextual sube y baja la prioridad y también trae Completar;
  5. el clic derecho abre acciones en Tareas, Malla y Calendario;
  6. los filtros Todas/Pendientes/Hoy/Ramos/Personales recortan el tablero;
  7. «Al día» muestra vencidas, de hoy y sin fecha, una vez, sin futuras ni hechas;
  8. el estado sobrevive a reabrir y a 411 no desborda.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_ramo(page, codigo: str, nombre: str) -> None:
    page.locator('#tabs [data-ir="malla"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nuevo-ramo").click()
    page.wait_for_timeout(100)
    page.locator("#ramo-codigo").fill(codigo)
    page.locator("#ramo-nombre").fill(nombre)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(150)


def crear_tarea(page, titulo: str, fecha: str | None, prioridad: str, contexto: str = "") -> None:
    page.locator('#tabs [data-ir="tareas"]').click()
    page.wait_for_timeout(100)
    page.locator("#btn-nueva-tarea").click()
    page.wait_for_timeout(100)
    page.locator("#tarea-titulo").fill(titulo)
    if fecha is not None:
        page.locator("#tarea-fecha").fill(fecha)
    page.locator("#tarea-prioridad").select_option(prioridad)
    if contexto:
        page.locator("#tarea-contexto").fill(contexto)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(180)


def estado(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    manana = (hoy + timedelta(days=1)).isoformat()
    con_dias = (hoy + timedelta(days=3)).isoformat()
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            crear_ramo(page, "CAL101", "Cálculo I")
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(200)

            exigir(page.locator("#vista-tareas .on").get_attribute("data-vista") == "tablero",
                   f"tablero: es la vista inicial — {page.locator('#vista-tareas .on').inner_text()}", fallas)
            exigir(page.locator("#tareas-filtros").is_visible() and page.locator(".tareas-filtro").count() == 5,
                   f"tablero: cinco filtros visibles — {page.locator('.tareas-filtro').count()}", fallas)
            exigir(page.locator("#tareas-barra-card, .tareas-barra, .tareas-barra-dia").count() == 0,
                   "tareas: el gráfico de barras ya no está", fallas)
            if page.locator(".tareas-filtro").count() != 5 or page.locator("#vista-tareas .on").get_attribute("data-vista") != "tablero":
                return salir("gate-tareas-tablero", fallas)

            crear_tarea(page, "Preparar informe", hoy.isoformat(), "alta", "CAL101")
            crear_tarea(page, "Comprar café", hoy.isoformat(), "baja", "")
            crear_tarea(page, "Estudiar cálculo", manana, "media", "CAL101")
            crear_tarea(page, "Llamar al banco", con_dias, "media", "")
            page.wait_for_timeout(200)

            exigir(page.locator(".tablero-col").count() == 3,
                   f"tablero: tres columnas — {page.locator('.tablero-col').count()}", fallas)
            titulos_cols = [c.inner_text().split("\n")[0] for c in page.locator(".tablero-col h3").all()]
            exigir(titulos_cols == ["Hoy", "Esta semana", "Hechas esta semana"],
                   f"tablero: jerarquía de columnas — {titulos_cols}", fallas)
            exigir(page.locator(".tablero-col").nth(0).locator(".tarjeta-tarea").count() == 2,
                   "tablero: dos tareas para hoy", fallas)
            exigir(page.locator(".tablero-col").nth(1).locator(".tarjeta-tarea").count() == 2,
                   "tablero: dos tareas esta semana", fallas)
            filtros = page.locator(".tareas-filtro").all_inner_texts()
            exigir("Ramos\n2" in filtros and "Personales\n2" in filtros and "Hoy\n2" in filtros,
                   f"filtros: cuentas por contexto — {filtros}", fallas)

            # Completar desde la tarjeta: se tacha y pasa a Hechas.
            page.locator(".tablero-col").nth(0).locator(".tarjeta-tarea").first.locator("[data-check]").click()
            page.wait_for_timeout(220)
            hechas = page.locator(".tablero-col").nth(2)
            exigir(hechas.locator(".tarjeta-tarea").count() == 1,
                   f"completar: la tarea pasa a Hechas — {hechas.locator('.tarjeta-tarea').count()}", fallas)
            exigir(hechas.locator(".tarjeta-tarea").first.get_attribute("class").find("hecha") >= 0,
                   "completar: la tarjeta queda marcada", fallas)
            deco = hechas.locator(".tarjeta-tarea b").first.evaluate("e => getComputedStyle(e).textDecorationLine")
            exigir("line-through" in deco, f"completar: el título se tacha — {deco}", fallas)
            exigir(sum(1 for t in estado(page)["tareas"] if t["hecha"]) == 1,
                   "completar: el estado guarda hecha", fallas)

            # Prioridad desde el menú contextual: baja -> media -> alta -> media.
            crear_tarea(page, "Prioridad", hoy.isoformat(), "baja", "")
            page.wait_for_timeout(180)
            tarjeta = page.locator(".tarjeta-tarea", has_text="Prioridad").first
            tarjeta.click(button="right")
            page.wait_for_timeout(120)
            exigir(page.locator('#menu-ctx [data-accion="tarea-prioridad-sube"]').count() == 1,
                   "prioridad: el menú ofrece subir", fallas)
            page.locator('#menu-ctx [data-accion="tarea-prioridad-sube"]').click()
            page.wait_for_timeout(180)
            exigir([t for t in estado(page)["tareas"] if t["titulo"] == "Prioridad"][0]["prioridad"] == "media",
                   "prioridad: baja sube a media", fallas)
            page.locator(".tarjeta-tarea", has_text="Prioridad").first.click(button="right")
            page.wait_for_timeout(120)
            page.locator('#menu-ctx [data-accion="tarea-prioridad-sube"]').click()
            page.wait_for_timeout(180)
            exigir([t for t in estado(page)["tareas"] if t["titulo"] == "Prioridad"][0]["prioridad"] == "alta",
                   "prioridad: media sube a alta", fallas)
            page.locator(".tarjeta-tarea", has_text="Prioridad").first.click(button="right")
            page.wait_for_timeout(120)
            exigir(page.locator('#menu-ctx [data-accion="tarea-prioridad-sube"]').count() == 0 and
                   page.locator('#menu-ctx [data-accion="tarea-prioridad-baja"]').count() == 1,
                   "prioridad: en alta solo se puede bajar", fallas)
            page.locator('#menu-ctx [data-accion="tarea-prioridad-baja"]').click()
            page.wait_for_timeout(180)
            exigir([t for t in estado(page)["tareas"] if t["titulo"] == "Prioridad"][0]["prioridad"] == "media",
                   "prioridad: alta baja a media", fallas)

            # Completar desde el menú contextual.
            page.locator(".tarjeta-tarea", has_text="Comprar café").first.click(button="right")
            page.wait_for_timeout(120)
            exigir(page.locator('#menu-ctx [data-accion="tarea-estado"]').inner_text() == "Completar",
                   "menú: la acción se llama Completar", fallas)
            page.locator('#menu-ctx [data-accion="tarea-estado"]').click()
            page.wait_for_timeout(200)
            exigir([t for t in estado(page)["tareas"] if t["titulo"] == "Comprar café"][0]["hecha"],
                   "menú: Completar marca la tarea", fallas)

            # Filtros del tablero.
            for filtro, esperadas in (("pendientes", 3), ("hoy", 3), ("ramos", 2), ("personal", 3), ("todas", 5)):
                page.locator(f'.tareas-filtro[data-filtro="{filtro}"]').click()
                page.wait_for_timeout(120)
                n = page.locator(".tarjeta-tarea").count()
                exigir(n == esperadas, f"filtro {filtro}: {esperadas} tarjetas — {n}", fallas)

            # Clic derecho en otras secciones.
            page.locator('#tabs [data-ir="malla"]').click()
            page.wait_for_timeout(150)
            page.locator(".ramo-card").first.click(button="right")
            page.wait_for_timeout(120)
            exigir("Borrar ramo" in page.locator("#menu-ctx").inner_text(),
                   f"clic derecho: Malla — {page.locator('#menu-ctx').inner_text()[:40]}", fallas)
            page.keyboard.press("Escape")
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(120)
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(100)
            page.locator("#evento-titulo").fill("Evento de prueba")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(200)
            page.locator(".evento-chip").first.click(button="right")
            page.wait_for_timeout(120)
            exigir("Borrar evento" in page.locator("#menu-ctx").inner_text(),
                   f"clic derecho: Calendario — {page.locator('#menu-ctx').inner_text()[:40]}", fallas)
            page.keyboard.press("Escape")

            # Persistencia de la vista y del estado.
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#vista-tareas .on").get_attribute("data-vista") == "tablero",
                   "persistencia: vuelve al tablero", fallas)
            exigir(page.locator(".tarjeta-tarea").count() == 5,
                   f"persistencia: las cinco tareas siguen — {page.locator('.tarjeta-tarea').count()}", fallas)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # «Al día»: vencidas, de hoy y sin fecha, una sola vez; ni futuras ni hechas.
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(150)
            ayer = (hoy - timedelta(days=2)).isoformat()
            crear_tarea(page, "Vencida", ayer, "media")
            crear_tarea(page, "Hoy", hoy.isoformat(), "media")
            crear_tarea(page, "Sin fecha", None, "media")
            crear_tarea(page, "Futura", manana, "media")
            crear_tarea(page, "Hecha hoy", hoy.isoformat(), "media")
            page.locator('.tarjeta-tarea', has_text="Hecha hoy").first.locator("[data-check]").click()
            page.wait_for_timeout(220)
            page.locator('#vista-tareas [data-vista="hoy"]').click()
            page.wait_for_timeout(220)
            exigir(page.locator('#vista-tareas [data-vista="hoy"]').inner_text().strip() == "Al día",
                   f"al día: la etiqueta — {page.locator('#vista-tareas [data-vista="hoy"]').inner_text()}", fallas)
            filas = page.locator("#tareas-lista .tarea-fila")
            exigir(filas.count() == 3,
                   f"al día: tres accionables — {filas.count()}", fallas)
            titulos = [f.locator(".tarea-nom").inner_text().strip() for f in filas.all()]
            exigir(titulos == ["Vencida", "Hoy", "Sin fecha"],
                   f"al día: vencida, hoy y sin fecha, en orden y una vez — {titulos}", fallas)
            ids = page.evaluate("[...document.querySelectorAll('#tareas-lista .tarea-fila')].map(e => e.getAttribute('data-tarea'))")
            exigir(len(ids) == len(set(ids)) == 3,
                   f"al día: sin duplicados — {ids}", fallas)
            texto = page.locator("#tareas-lista").inner_text()
            exigir("Futura" not in texto and "Hecha hoy" not in texto,
                   f"al día: fuera futuras y hechas — {texto[:120]}", fallas)
            page.locator(".tarea-fila", has_text="Hoy").first.locator("[data-check]").click()
            page.wait_for_timeout(220)
            restantes = page.locator("#tareas-lista .tarea-fila")
            exigir(restantes.count() == 2 and "Hoy" not in page.locator("#tareas-lista .tarea-nom").all_inner_texts(),
                   f"al día: completar quita la tarea — {restantes.count()}", fallas)
            exigir(not errores, f"al día: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#vista-tareas .on").get_attribute("data-vista") == "tablero",
                   "411: tablero por defecto", fallas)
            exigir(page.locator(".tareas-filtro").count() == 5 and
                   page.locator("#tareas-barra-card, .tareas-barra").count() == 0,
                   "411: filtros sin barra", fallas)
            page.locator('#vista-tareas [data-vista="hoy"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator('#vista-tareas [data-vista="hoy"]').inner_text().strip() == "Al día",
                   "411: la etiqueta Al día se pinta", fallas)
            d = desborde(page)
            exigir(d == 0, f"411: tareas sin desborde — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-tareas-tablero", fallas)


if __name__ == "__main__":
    sys.exit(main())
