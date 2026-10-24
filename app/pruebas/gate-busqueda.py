#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-busqueda.py — U6a: buscador global Ctrl+K.

Mide sobre app/index.html:
  1. Ctrl+K y el botón Buscar abren el buscador;
  2. encuentra tareas y notas por texto;
  3. abre la tarea/nota elegida y cierra el buscador;
  4. encuentra un ramo y navega a Malla;
  5. Escape cierra;
  6. a 411 no desborda y la consola queda limpia.

Uso: python3 app/pruebas/gate-busqueda.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def instalar(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_tarea(page, titulo: str) -> None:
    page.locator('#tabs .tab[data-ir="tareas"]').click()
    page.wait_for_timeout(80)
    page.locator("#btn-nueva-tarea").click()
    page.locator("#tarea-titulo").fill(titulo)
    page.locator('#tarea-form button[type="submit"]').click()
    page.wait_for_timeout(100)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            instalar(page)
            crear_tarea(page, "Preparar informe mensual")
            page.locator('#tabs .tab[data-ir="notas"]').click()
            page.wait_for_timeout(80)
            page.locator("#btn-nueva-nota").click()
            page.locator("#nota-titulo").fill("Idea para el informe")
            page.locator("#nota-cuerpo").fill("Revisar ventas del mes")
            page.wait_for_timeout(100)

            page.keyboard.press("Control+k")
            page.wait_for_timeout(120)
            exigir(page.locator("#modal-buscar").is_visible(), "buscador: Ctrl+K abre", fallas)
            page.locator("#buscar-input").fill("informe")
            page.wait_for_timeout(150)
            exigir(page.locator('.buscar-res[data-tipo="Tarea"]').count() >= 1
                   and page.locator('.buscar-res[data-tipo="Nota"]').count() >= 1,
                   "buscador: encuentra tarea y nota", fallas)
            page.locator('.buscar-res[data-tipo="Tarea"]').first.click()
            page.wait_for_timeout(180)
            exigir(not page.locator("#modal-buscar").is_visible(), "buscador: abre el resultado y se cierra", fallas)
            exigir("Preparar informe mensual" in page.locator("#tareas-lista").inner_text(),
                   "buscador: la tarea queda abierta", fallas)

            page.locator("#btn-buscar").click()
            page.wait_for_timeout(100)
            page.locator("#buscar-input").fill("informe")
            page.wait_for_timeout(100)
            page.locator('.buscar-res[data-tipo="Nota"]').first.click()
            page.wait_for_timeout(180)
            exigir(page.locator("#nota-titulo").input_value() == "Idea para el informe",
                   "buscador: la nota elegida se abre", fallas)

            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            page.locator("#btn-nuevo-ramo").click()
            page.locator("#ramo-codigo").fill("MA1001")
            page.locator("#ramo-nombre").fill("Cálculo I")
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            page.keyboard.press("Control+k")
            page.wait_for_timeout(100)
            page.locator("#buscar-input").fill("MA1001")
            page.wait_for_timeout(100)
            exigir(page.locator('.buscar-res[data-tipo="Ramo"]').count() == 1,
                   "buscador: encuentra el ramo", fallas)
            page.locator('.buscar-res[data-tipo="Ramo"]').click()
            page.wait_for_timeout(180)
            exigir(page.locator("#p-malla").is_visible(), "buscador: el ramo lleva a Malla", fallas)

            page.keyboard.press("Control+k")
            page.wait_for_timeout(100)
            page.keyboard.press("Escape")
            page.wait_for_timeout(80)
            exigir(not page.locator("#modal-buscar").is_visible(), "buscador: Escape cierra", fallas)
            exigir(not errores, f"buscador: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            page.keyboard.press("Control+k")
            page.wait_for_timeout(100)
            caja = page.locator(".buscar-caja").bounding_box()
            d = desborde(page)
            exigir(d == 0, f"411: buscador sin desborde — {d}px", fallas)
            exigir(bool(caja) and caja["x"] >= 0 and caja["x"] + caja["width"] <= 411,
                   f"411: el buscador cabe — {caja}", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-busqueda", fallas)


if __name__ == "__main__":
    sys.exit(main())
