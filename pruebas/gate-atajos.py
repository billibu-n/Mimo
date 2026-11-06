#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-atajos.py — Ctrl+Z / Ctrl+Y no secuestran el deshacer de un campo.

Mide sobre app/index.html:
  1. escribir en el título de una nota y pulsar Ctrl+Z deshace el texto, no la
     creación de la nota, y no muestra el aviso de la app;
  2. en un campo multílínea pasa lo mismo;
  3. fuera de un campo, Ctrl+Z sí deshace el último cambio de la app y avisa;
  4. Ctrl+Y rehace y avisa;
  5. en un campo, Ctrl+Y no cambia el estado de la app.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


def datos(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}')")


def toast(page) -> str:
    return page.locator("#toast").inner_text()


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.locator('#tabs [data-ir="notas"]').click()
            page.wait_for_timeout(120)
            page.locator("#btn-nueva-nota").click()
            page.wait_for_timeout(180)
            exigir(len(datos(page).get("notas") or []) == 1,
                   "atajos: la nota de prueba existe antes de escribir", fallas)

            titulo = page.locator("#nota-titulo")
            titulo.click()
            page.keyboard.press("End")
            page.keyboard.type(" abc")
            antes = titulo.input_value()
            page.keyboard.press("Control+z")
            page.wait_for_timeout(120)
            despues = titulo.input_value()
            exigir(despues != antes and len(despues) == len(antes) - 1,
                   f"atajos: Ctrl+Z en el título deshace una letra — {antes!r} → {despues!r}", fallas)
            exigir(len(datos(page).get("notas") or []) == 1,
                   "atajos: Ctrl+Z en el título no borra la nota", fallas)
            exigir("Deshecho" not in toast(page),
                   f"atajos: el campo no dispara el aviso de la app — {toast(page)!r}", fallas)

            cuerpo = page.locator("#nota-cuerpo")
            cuerpo.click()
            page.keyboard.type(" texto")
            antes = cuerpo.input_value()
            page.keyboard.press("Control+z")
            page.wait_for_timeout(120)
            exigir(cuerpo.input_value() != antes and len(cuerpo.input_value()) == len(antes) - 1,
                   "atajos: Ctrl+Z en el cuerpo deshace una letra", fallas)
            exigir(len(datos(page).get("notas") or []) == 1,
                   "atajos: Ctrl+Z en el cuerpo no borra la nota", fallas)

            # Fuera de un campo, el historial de la app sigue vivo y avisa.
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(150)
            tema0 = page.evaluate("document.body.getAttribute('data-tema')")
            page.locator("#btn-tema").click()
            page.wait_for_timeout(120)
            tema1 = page.evaluate("document.body.getAttribute('data-tema')")
            exigir(tema1 != tema0, f"atajos: el tema cambia — {tema0} → {tema1}", fallas)
            page.locator("#btn-tema").focus()
            page.keyboard.press("Control+z")
            page.wait_for_timeout(200)
            tema2 = page.evaluate("document.body.getAttribute('data-tema')")
            exigir(tema2 == tema0, f"atajos: Ctrl+Z fuera del campo deshace la app — {tema2}", fallas)
            exigir("Deshecho" in toast(page), f"atajos: la app avisa del deshacer — {toast(page)!r}", fallas)

            page.keyboard.press("Control+y")
            page.wait_for_timeout(200)
            tema3 = page.evaluate("document.body.getAttribute('data-tema')")
            exigir(tema3 == tema1, f"atajos: Ctrl+Y rehace la app — {tema3}", fallas)
            exigir("Rehecho" in toast(page), f"atajos: la app avisa del rehacer — {toast(page)!r}", fallas)

            page.locator('#tabs [data-ir="notas"]').click()
            page.wait_for_timeout(120)
            cuerpo = page.locator("#nota-cuerpo")
            cuerpo.click()
            page.keyboard.press("Control+y")
            page.wait_for_timeout(120)
            exigir(page.evaluate("document.body.getAttribute('data-tema')") == tema3,
                   "atajos: Ctrl+Y dentro del campo no cambia el tema de la app", fallas)
            exigir(not errores, f"atajos: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-atajos", fallas)


if __name__ == "__main__":
    sys.exit(main())
