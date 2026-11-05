#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-fuente.py — la letra de la app y el motor de tipografía de Ajustes.

Mide sobre app/index.html:
  1. la opción predeterminada es la pila clásica de Mimo, con Noto Sans antes
     de Helvetica (WebKit caía en Nimbus Sans sin ese orden);
  2. «Sistema del equipo» cambia la pila y se guarda;
  3. «Otra fuente…» muestra el campo y aplica el nombre escrito;
  4. la elección sobrevive a recargar y se puede volver a la clásica;
  5. a 411 no desborda y no hay errores de consola.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def prefs(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).prefs")


def fuente(page):
    return page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--fuente').trim()")


def cuerpo(page):
    return page.evaluate("getComputedStyle(document.body).fontFamily")


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(250)

            exigir(page.locator("#pref-fuente").input_value() == "clasica",
                   f"fuente: la opción inicial es la clásica — {page.locator('#pref-fuente').input_value()}", fallas)
            exigir(page.evaluate("document.body.getAttribute('data-fuente')") == "clasica",
                   "fuente: el body declara data-fuente=clasica", fallas)
            f = fuente(page)
            exigir('"Noto Sans"' in f and f.find('"Noto Sans"') < f.find("Helvetica"),
                   f"fuente: Noto Sans antes de Helvetica en la pila — {f}", fallas)
            exigir("Noto Sans" in cuerpo(page),
                   f"fuente: el cuerpo resuelve Noto Sans en Chromium — {cuerpo(page)}", fallas)

            page.locator("#pref-fuente").select_option("sistema")
            page.wait_for_timeout(220)
            exigir(page.evaluate("document.body.getAttribute('data-fuente')") == "sistema",
                   "fuente: el sistema queda marcado", fallas)
            exigir("system-ui" in fuente(page), f"fuente: la pila del sistema — {fuente(page)}", fallas)
            exigir(prefs(page)["fuente"] == "sistema", "fuente: la elección se guarda", fallas)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#pref-fuente").input_value() == "sistema",
                   f"fuente: el sistema sobrevive a recargar — {page.locator('#pref-fuente').input_value()}", fallas)

            page.locator("#pref-fuente").select_option("personalizada")
            page.wait_for_timeout(180)
            exigir(page.locator("#fila-fuente-nombre").is_visible(),
                   "fuente: «Otra fuente» muestra el campo de nombre", fallas)
            page.locator("#pref-fuente-nombre").fill("Cantarell")
            page.locator("#pref-fuente-nombre").press("Tab")
            page.wait_for_timeout(250)
            exigir(prefs(page)["fuente"] == "personalizada" and prefs(page)["fuenteNombre"] == "Cantarell",
                   f"fuente: el nombre se guarda — {prefs(page)}", fallas)
            exigir(cuerpo(page).startswith("Cantarell"),
                   f"fuente: el nombre se aplica al cuerpo — {cuerpo(page)}", fallas)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#pref-fuente").input_value() == "personalizada" and
                   page.locator("#pref-fuente-nombre").input_value() == "Cantarell",
                   "fuente: la fuente escrita sobrevive a recargar", fallas)

            page.locator("#pref-fuente").select_option("clasica")
            page.wait_for_timeout(180)
            exigir(not page.locator("#fila-fuente-nombre").is_visible(),
                   "fuente: al volver a la clásica se oculta el campo", fallas)
            exigir(prefs(page)["fuente"] == "clasica", "fuente: vuelve a la clásica", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(250)
            exigir(desborde(page) == 0, f"411: Ajustes no desborda — {desborde(page)} px", fallas)
            exigir(not errores, f"sin errores de consola — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-fuente", fallas)


if __name__ == "__main__":
    sys.exit(main())
