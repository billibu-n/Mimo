#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-panel.py — el panel derecho se arrastra y nace cerrado.

Mide sobre app/index.html:
  1. al arrancar el panel mide 0 y no hay asa visible;
  2. Ajustes ya no tiene la tarjeta «Paneles» ni sus controles;
  3. el botón superior lo abre y el asa aparece;
  4. arrastrar el asa cambia el ancho, lo guarda y sobrevive a recargar;
  5. las flechas, Inicio y el doble clic también lo gobiernan;
  6. los topes son 240 y 560 px;
  7. a 411 el asa desaparece y no hay desborde.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def ancho(page) -> float:
    return page.evaluate("document.querySelector('#panel').getBoundingClientRect().width")


def prefs(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).prefs")


def arrastrar(page, destino_x: int) -> None:
    caja = page.locator("#panel-asa").bounding_box()
    if not caja:
        raise RuntimeError("el asa no tiene caja")
    x = caja["x"] + caja["width"] / 2
    y = caja["y"] + min(240, caja["height"] / 2)
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(destino_x, y, steps=8)
    page.mouse.up()
    page.wait_for_timeout(260)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            exigir(ancho(page) <= 1, f"panel: nace cerrado — {ancho(page):.0f} px", fallas)
            exigir(page.evaluate("document.body.classList.contains('panel-oculto')"),
                   "panel: el armazón declara panel-oculto", fallas)
            exigir(not page.locator("#panel-asa").is_visible(),
                   "panel: cerrado no hay asa", fallas)

            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#p-ajustes").get_by_text("Paneles", exact=True).count() == 0,
                   "ajustes: la tarjeta Paneles ya no existe", fallas)
            exigir(page.locator("#pref-panel-ancho").count() == 0 and
                   page.locator("#pref-panel-abierto").count() == 0,
                   "ajustes: no quedan controles viejos del panel", fallas)

            page.locator("#btn-panel").click()
            page.wait_for_timeout(320)
            exigir(ancho(page) > 300, f"panel: el botón lo abre — {ancho(page):.0f} px", fallas)
            exigir(page.locator("#panel-asa").is_visible(),
                   "panel: abierto muestra el asa", fallas)

            arrastrar(page, int(page.evaluate("document.querySelector('#panel').getBoundingClientRect().left")) - 120)
            ancho_drag = ancho(page)
            exigir(abs(ancho_drag - 440) <= 8,
                   f"panel: arrastrar 120 px lo deja en ~440 — {ancho_drag:.0f} px", fallas)
            exigir(prefs(page)["panelAncho"] == str(round(ancho_drag)),
                   f"panel: el ancho se guarda — {prefs(page)['panelAncho']}", fallas)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(350)
            exigir(ancho(page) <= 1, f"panel: al recargar vuelve cerrado — {ancho(page):.0f} px", fallas)
            page.locator("#btn-panel").click()
            page.wait_for_timeout(320)
            exigir(abs(ancho(page) - ancho_drag) <= 2,
                   f"panel: el ancho guardado sobrevive — {ancho(page):.0f} px", fallas)

            page.locator("#panel-asa").focus()
            antes = ancho(page)
            page.keyboard.press("ArrowLeft")
            page.wait_for_timeout(260)
            exigir(abs(ancho(page) - (antes + 10)) <= 2,
                   f"panel: ArrowLeft suma 10 px — {antes:.0f} → {ancho(page):.0f}", fallas)
            page.keyboard.press("Home")
            page.wait_for_timeout(260)
            exigir(abs(ancho(page) - 320) <= 2,
                   f"panel: Inicio restablece 320 px — {ancho(page):.0f}", fallas)

            arrastrar(page, 0)
            exigir(ancho(page) <= 560 and ancho(page) >= 559,
                   f"panel: el tope superior es 560 px — {ancho(page):.0f}", fallas)
            arrastrar(page, 1439)
            exigir(ancho(page) >= 240 and ancho(page) <= 241,
                   f"panel: el tope inferior es 240 px — {ancho(page):.0f}", fallas)

            page.locator("#panel-asa").dblclick(position={"x": 3, "y": 200})
            page.wait_for_timeout(260)
            exigir(abs(ancho(page) - 320) <= 2,
                   f"panel: doble clic restablece 320 px — {ancho(page):.0f}", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(250)
            exigir(not page.locator("#panel-asa").is_visible(),
                   "411: el asa no ocupa la pantalla del teléfono", fallas)
            exigir(desborde(page) == 0, f"411: sin desborde — {desborde(page)} px", fallas)
            exigir(not errores, f"panel: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-panel", fallas)


if __name__ == "__main__":
    sys.exit(main())
