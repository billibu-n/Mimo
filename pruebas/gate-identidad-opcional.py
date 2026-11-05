#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-identidad-opcional.py — el ramo puede no tener color ni icono.

Mide sobre app/index.html:
  1. la identidad ofrece «Sin color» y «Sin icono»;
  2. al guardar, el ramo conserva la cadena vacía (decisión del usuario);
  3. la lista y la malla siguen mostrando el código, sin inventar un icono;
  4. la elección sobrevive a recargar y a 411 no desborda.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def curso(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).cursos[0]")


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate("""() => {
              const k = 'mimo.shell.v1', s = JSON.parse(localStorage.getItem(k) || '{}');
              s.instalados = ['malla', 'calificaciones', 'estudio', 'tiempo'];
              s.cursos = [{ codigo: 'MA1001', nombre: 'Cálculo I', creditos: 6, nivel: 1,
                enCurso: true, cerrado: false, aprobado: false, requisitos: [], requisitos_o: [],
                enMalla: true, color: '#2563eb', icono: 'i-ramo-libro' }];
              localStorage.setItem(k, JSON.stringify(s));
            }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(500)
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(250)
            page.locator('[data-accion-calif="identidad"]').first.click()
            page.wait_for_timeout(250)
            exigir(page.locator("[data-ident-sin-color]").count() == 1 and
                   page.locator("[data-ident-sin-icono]").count() == 1,
                   "identidad: ofrece dejar el ramo sin color y sin icono", fallas)
            page.locator("[data-ident-sin-color]").click()
            page.locator("[data-ident-sin-icono]").click()
            page.wait_for_timeout(120)
            exigir(page.locator("#ident-preview .ident-sin-icono").count() == 1,
                   "identidad: la vista previa no inventa un icono", fallas)
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(350)
            c = curso(page)
            exigir(c.get("color") == "" and c.get("icono") == "",
                   f"identidad: se guardan vacíos — {c}", fallas)
            exigir(page.locator("#calif-lista .ramo-ico").count() == 0,
                   "calificaciones: sin icono no se pinta uno automático", fallas)
            exigir("MA1001" in page.locator("#calif-lista").inner_text(),
                   "calificaciones: el código sigue identificando el ramo", fallas)
            page.locator('#tabs [data-ir="malla"]').click()
            page.wait_for_timeout(250)
            exigir("MA1001" in page.locator("#malla-tablero").inner_text(),
                   "malla: el código sigue en la tarjeta", fallas)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(400)
            c = curso(page)
            exigir(c.get("color") == "" and c.get("icono") == "",
                   f"identidad: la ausencia sobrevive a recargar — {c}", fallas)
            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(250)
            exigir(desborde(page) == 0, f"411: sin desborde — {desborde(page)}px", fallas)
            exigir(not errores, f"sin errores de consola — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-identidad-opcional", fallas)


if __name__ == "__main__":
    sys.exit(main())
