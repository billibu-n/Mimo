#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-academics.py — L2: la app vieja sigue funcionando y gana panel/pie.

Mide lo que el dueño pidió: la app de Mimo Academics 1.1.2, con sus 7 secciones,
su icono y sus colores, más el panel derecho y el pie. No mide el shell universal.

  1. 7 navs y 7 secciones, sin errores de consola
  2. panel derecho con 4 pestañas y pie visible
  3. el panel navega a Malla y la sección cambia
  4. el panel se cierra y se vuelve a abrir
  5. a 411 no desborda y el panel pasa a cajón
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "academics" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            exigir(page.locator(".nav").count() == 7, f"viejo: 7 navs — {page.locator('.nav').count()}", fallas)
            exigir(page.locator(".seccion").count() == 7, f"viejo: 7 secciones — {page.locator('.seccion').count()}", fallas)
            exigir(page.locator(".mimo-panel__tab").count() == 4, "panel: 4 pestañas", fallas)
            exigir(page.locator(".mimo-pie").is_visible(), "pie: visible", fallas)
            exigir(page.locator("#mimo-panel").is_visible(), "panel: abierto por defecto a 1440", fallas)
            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)

            page.locator('[data-mptab="bloques"]').click()
            page.wait_for_timeout(80)
            page.locator('.mp-nav[data-ir="malla"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator('.seccion.on').get_attribute("data-seccion") == "malla",
                   "panel: navega a Malla", fallas)
            page.locator("#mimo-panel-cerrar").click()
            page.wait_for_timeout(80)
            exigir("mimo-panel-abierto" not in (page.locator("body").get_attribute("class") or ""),
                   "panel: se cierra", fallas)
            page.locator("#mimo-panel-btn").click()
            page.wait_for_timeout(80)
            exigir("mimo-panel-abierto" in (page.locator("body").get_attribute("class") or ""),
                   "panel: se vuelve a abrir", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            exigir(desborde(page) == 0, f"411: sin desborde — {desborde(page)}px", fallas)
            page.locator("#mimo-panel-btn").click()
            page.wait_for_timeout(100)
            exigir("mimo-panel-abierto" in (page.locator("body").get_attribute("class") or ""),
                   "411: el panel se abre", fallas)
            exigir(page.locator("#mimo-panel").is_visible(), "411: el panel es visible", fallas)
            page.locator("#mimo-panel-cerrar").click()
            page.wait_for_timeout(80)
            exigir("mimo-panel-abierto" not in (page.locator("body").get_attribute("class") or ""),
                   "411: el panel se cierra", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-academics", fallas)


if __name__ == "__main__":
    sys.exit(main())
