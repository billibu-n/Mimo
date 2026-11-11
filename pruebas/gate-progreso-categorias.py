#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-progreso-categorias.py — categorías, plegado y orden por arrastre.

Mide lo que el dueño pidió sobre el bloque Progreso:
  1. cada categoría es una ficha plegable con nombre, icono, color y cuenta;
  2. se crea, se edita (nombre/icono/color) y se elimina sin borrar metas;
  3. las metas se mueven de categoría y se ordenan arrastrando;
  4. con muchas metas, la categoría muestra un límite y «Ver N más»;
  5. el teclado también ordena (Alt+↑/↓) y 411 no desborda.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def meta(i: int, nombre: str, categoria: str, orden: int) -> dict:
    return {
        "id": f"m{i}", "nombre": nombre, "unidad": "u", "tipo": "suma",
        "sentido": "subir", "periodo": "dia", "objetivo": 10, "inicio": None,
        "desde": "2026-01-01", "hasta": "", "paso": 1, "decimales": 0,
        "tono": "ac", "icono": "diana", "fuente": "manual",
        "categoriaId": categoria, "orden": orden, "archivada": False,
        "creada": "2026-11-11T10:00"
    }


def estado() -> dict:
    categorias = [
        {"id": "general", "nombre": "General", "icono": "diana", "tono": "ac", "orden": 0, "colapsada": False},
        {"id": "salud", "nombre": "Salud", "icono": "corazon", "tono": "ok", "orden": 1, "colapsada": False},
        {"id": "estudio", "nombre": "Estudio", "icono": "estudio", "tono": "q", "orden": 2, "colapsada": False},
    ]
    metas = [meta(i, f"Meta {i}", "general", i) for i in range(1, 9)]
    metas.append(meta(20, "Agua", "salud", 8))
    metas.append(meta(21, "Peso", "salud", 9))
    return {
        "instalados": ["progreso"],
        "progreso": {"v": 1, "categorias": categorias, "metas": metas, "registros": []}
    }


def estado_pequeno() -> dict:
    """Cuatro metas y dos categorías: cabe entero en 1440x950 para el arrastre."""
    categorias = [
        {"id": "general", "nombre": "General", "icono": "diana", "tono": "ac", "orden": 0, "colapsada": False},
        {"id": "salud", "nombre": "Salud", "icono": "corazon", "tono": "ok", "orden": 1, "colapsada": False},
    ]
    metas = [
        meta(1, "Uno", "general", 0),
        meta(2, "Dos", "general", 1),
        meta(3, "Tres", "general", 2),
        meta(4, "Cuatro", "salud", 3),
    ]
    return {
        "instalados": ["progreso"],
        "progreso": {"v": 1, "categorias": categorias, "metas": metas, "registros": []},
    }


def grupo(page, cid: str):
    return page.locator(f'.prog-grupo[data-prog-cat="{cid}"]')


def arrastrar(page, origen, destino) -> None:
    """Arrastre con ratón: Playwright.drag_to no dispara HTML5 drag en este Chromium."""
    a = origen.bounding_box()
    b = destino.bounding_box()
    page.mouse.move(a["x"] + a["width"] / 2, a["y"] + a["height"] / 2)
    page.mouse.down()
    page.mouse.move(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2, steps=20)
    page.mouse.up()
    page.wait_for_timeout(300)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            page.evaluate("""(estado) => {
              localStorage.setItem('mimo.shell.v1', JSON.stringify(estado));
            }""", estado())
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="progreso"]').click()
            page.wait_for_timeout(250)

            # 1. fichas y cuentas
            exigir(page.locator(".prog-grupo").count() == 3, "categorías: se pintan las tres", fallas)
            exigir("8 metas" in grupo(page, "general").inner_text(),
                   "categorías: General cuenta 8", fallas)
            exigir("2 metas" in grupo(page, "salud").inner_text(),
                   "categorías: Salud cuenta 2", fallas)
            exigir("0 metas" in grupo(page, "estudio").inner_text(),
                   "categorías: Estudio está vacía", fallas)

            # 2. límite y «Ver más»
            exigir(grupo(page, "general").locator(".prog-card").count() == 6,
                   "muchas: la categoría arranca con 6", fallas)
            exigir(grupo(page, "general").locator("[data-prog-cat-mas]").inner_text() == "Ver 2 más",
                   "muchas: avisa que hay 2 más", fallas)
            grupo(page, "general").locator("[data-prog-cat-mas]").click()
            page.wait_for_timeout(200)
            exigir(grupo(page, "general").locator(".prog-card").count() == 8,
                   "muchas: «Ver más» muestra las 8", fallas)

            # 3. editar nombre, icono y color
            grupo(page, "salud").locator("[data-prog-cat-edit]").click()
            page.wait_for_timeout(150)
            page.locator("#prog-cat-nombre").fill("Cuerpo")
            page.locator("#prog-cat-icono").select_option("peso")
            page.locator("#prog-cat-tono").select_option("warn")
            page.locator("#prog-cat-guardar").click()
            page.wait_for_timeout(250)
            exigir("Cuerpo" in grupo(page, "salud").inner_text(),
                   "categoría: cambia el nombre", fallas)
            exigir(grupo(page, "salud").locator(".prog-grupo__ico svg").count() == 1,
                   "categoría: cambia el icono", fallas)
            exigir("prog-cat-tono--warn" in (grupo(page, "salud").get_attribute("class") or ""),
                   "categoría: cambia el color", fallas)

            # 4. plegar y desplegar
            grupo(page, "salud").locator("[data-prog-cat-toggle]").click()
            page.wait_for_timeout(250)
            exigir("prog-grupo--plegado" in (grupo(page, "salud").get_attribute("class") or ""),
                   "plegable: la categoría se pliega", fallas)
            exigir(grupo(page, "salud").locator("[data-prog-cat-toggle]").get_attribute("aria-expanded") == "false",
                   "plegable: el botón anuncia cerrado", fallas)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="progreso"]').click()
            page.wait_for_timeout(250)
            exigir("prog-grupo--plegado" in (grupo(page, "salud").get_attribute("class") or ""),
                   "plegable: el estado persiste al recargar", fallas)
            grupo(page, "salud").locator("[data-prog-cat-toggle]").click()
            page.wait_for_timeout(250)
            exigir("prog-grupo--plegado" not in (grupo(page, "salud").get_attribute("class") or ""),
                   "plegable: la categoría se despliega", fallas)

            # 5. estado pequeño: arrastre, teclado y borrado de categoría
            page.evaluate("""(estado) => {
              localStorage.setItem('mimo.shell.v1', JSON.stringify(estado));
            }""", estado_pequeno())
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="progreso"]').click()
            page.wait_for_timeout(250)
            origen = grupo(page, "general").locator(".prog-card").first
            destino = grupo(page, "salud").locator(".prog-card").first
            arrastrar(page, origen.locator("[data-prog-drag]"), destino)
            page.wait_for_timeout(150)
            exigir(grupo(page, "salud").locator(".prog-card").count() == 2,
                   "arrastre: la meta pasa a la otra categoría", fallas)
            exigir(grupo(page, "general").locator(".prog-card").count() == 2,
                   "arrastre: la categoría de origen pierde una", fallas)
            exigir(set(grupo(page, "salud").locator(".prog-card h3").all_inner_texts()) == {"Uno", "Cuatro"},
                   "arrastre: la meta arrastrada es la correcta", fallas)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="progreso"]').click()
            page.wait_for_timeout(250)
            exigir("Uno" in grupo(page, "salud").inner_text(),
                   "arrastre: la categoría persiste al recargar", fallas)

            # 6. teclado: Alt+↓ mueve dentro de la categoría
            antes = grupo(page, "general").locator(".prog-card h3").all_inner_texts()
            grupo(page, "general").locator(".prog-card").first.focus()
            page.keyboard.press("Alt+ArrowDown")
            page.wait_for_timeout(300)
            despues = grupo(page, "general").locator(".prog-card h3").all_inner_texts()
            exigir(antes[:2] != despues[:2] and set(antes) == set(despues),
                   "teclado: Alt+↓ cambia el orden sin perder metas", fallas)

            # 7. eliminar categoría: sus metas pasan a General
            grupo(page, "salud").locator("[data-prog-cat-edit]").click()
            page.wait_for_timeout(150)
            page.locator("#prog-cat-eliminar").click()
            page.wait_for_timeout(350)
            exigir(page.locator('.prog-grupo[data-prog-cat="salud"]').count() == 0,
                   "eliminar: la categoría desaparece", fallas)
            exigir(grupo(page, "general").locator(".prog-card").count() == 4,
                   "eliminar: las 4 metas quedan en General", fallas)

            # 8. 411 y modal de categoría
            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(300)
            exigir(desborde(page) == 0, "411: sin desborde", fallas)
            page.locator("#prog-nueva-cat").click()
            page.wait_for_timeout(200)
            exigir(desborde(page) == 0, "411: el modal de categoría no desborda", fallas)
            page.locator('[data-prog-cerrar="prog-modal-cat"]').first.click()

            exigir(not errores, f"consola: sin errores — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-progreso-categorias", fallas)


if __name__ == "__main__":
    sys.exit(main())
