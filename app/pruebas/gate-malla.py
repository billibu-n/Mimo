#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-malla.py — U4a: malla de cursos real, sobre app/index.html.

Mide lo que el encargo pide, no lo que se ve:
  1. sin ramos, la sección explica cómo empezar;
  2. un ramo se crea, se edita y se borra;
  3. los créditos y el porcentaje se derivan;
  4. un prerrequisito bloquea y, al aprobarlo, el ramo queda disponible;
  5. el modo rápido marca aprobado con un clic;
  6. un respaldo v3 (87 cursos) se importa y cuadra 96 / 464;
  7. el buscador y el filtro reducen la malla;
  8. a 411 px no hay desborde.

Uso: python3 app/pruebas/gate-malla.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "index.html"
FIXTURE = AQUI / "fixtures" / "respaldo-sintetico.json"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator("#malla-vacio").is_visible(), "malla: vacía al entrar", fallas)

            page.locator("#btn-nuevo-ramo").click()
            page.locator("#ramo-codigo").fill("MA1001")
            page.locator("#ramo-nombre").fill("Cálculo I")
            page.locator("#ramo-creditos").fill("6")
            page.locator("#ramo-nivel").fill("1")
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator(".ramo-card").count() == 1, "malla: crear el primer ramo", fallas)
            exigir(page.locator("#malla-k-creditos").inner_text().strip() == "0 / 6",
                   "malla: los créditos totales se derivan", fallas)

            page.locator("#btn-nuevo-ramo").click()
            page.locator("#ramo-codigo").fill("MA2001")
            page.locator("#ramo-nombre").fill("Cálculo II")
            page.locator("#ramo-creditos").fill("7")
            page.locator("#ramo-nivel").fill("2")
            page.locator("#ramo-requisitos").fill("MA1001")
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator(".ramo-card").count() == 2, "malla: crear un ramo con prerrequisito", fallas)
            exigir("bloqueado" in page.locator('.ramo-card[data-ramo="MA2001"]').inner_text().lower(),
                   "malla: el prerrequisito pendiente bloquea", fallas)
            exigir(page.locator(".malla-col").count() == 2, "malla: una columna por nivel", fallas)
            exigir(page.locator("#malla-lineas path").count() >= 1, "malla: el grafo dibuja los prerrequisitos", fallas)

            page.locator('.ramo-card[data-ramo="MA1001"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "malla: seleccionar el ramo abre Detalle", fallas)
            page.locator("#panel-cuerpo [data-toggle-ramo]").click()
            page.wait_for_timeout(100)
            exigir("disponible" in page.locator('.ramo-card[data-ramo="MA2001"]').inner_text().lower(),
                   "malla: aprobar el prerrequisito desbloquea", fallas)
            exigir(page.locator("#malla-k-creditos").inner_text().strip() == "6 / 13",
                   "malla: créditos aprobados / total", fallas)
            exigir(page.locator("#malla-k-pct").inner_text().strip() == "46 %",
                   "malla: el porcentaje de la carrera se deriva", fallas)
            exigir(page.locator(".malla-linea--des").count() >= 1,
                   "malla: el ramo seleccionado enciende lo que desbloquea", fallas)
            exigir("ANTES NECESITAS" in page.locator("#malla-detalle").inner_text().upper(),
                   "malla: el detalle muestra los prerrequisitos", fallas)

            page.locator("#malla-rapido").check()
            page.locator('.ramo-card[data-ramo="MA2001"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator("#malla-k-creditos").inner_text().strip() == "13 / 13",
                   "malla: modo rápido marca aprobado con un clic", fallas)
            page.locator('.ramo-card[data-ramo="MA2001"]').click()
            page.wait_for_timeout(100)
            page.locator("#malla-rapido").uncheck()
            page.wait_for_timeout(200)

            page.locator('.ramo-card[data-ramo="MA2001"]').click(button="right")
            page.wait_for_timeout(160)
            exigir("Editar" in page.locator("#menu-ctx").inner_text(),
                   "malla: el clic derecho ofrece editar", fallas)
            page.locator('#menu-ctx [data-accion="ramo-editar"]').click()
            page.wait_for_timeout(80)
            page.locator("#ramo-creditos").fill("8")
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator("#malla-k-creditos").inner_text().strip() == "6 / 14",
                   "malla: editar créditos recalcula", fallas)

            page.locator("#malla-filtro").select_option("bloqueados")
            page.wait_for_timeout(80)
            exigir("Ningún ramo coincide" in page.locator("#malla-tablero").inner_text(),
                   "malla: el filtro de bloqueados no inventa ramos", fallas)
            page.locator("#malla-filtro").select_option("todos")
            page.wait_for_timeout(80)

            page.locator('.ramo-card[data-ramo="MA2001"]').click(button="right")
            page.wait_for_timeout(80)
            page.locator('#menu-ctx [data-accion="ramo-borrar"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".ramo-card").count() == 1, "malla: borrar un ramo", fallas)
            exigir("MA1001" in page.locator("#malla-tablero").inner_text(),
                   "malla: borrar no se lleva el otro ramo", fallas)

            page.locator("#archivo-malla").set_input_files(str(FIXTURE))
            page.wait_for_timeout(350)
            exigir(page.locator(".ramo-card").count() == 87,
                   f"malla: importa el respaldo v3 — {page.locator('.ramo-card').count()} ramos", fallas)
            exigir(page.locator(".malla-col").count() >= 5, "malla: la importación arma las columnas", fallas)
            exigir(page.locator("#malla-k-creditos").inner_text().strip() == "96 / 464",
                   "malla: créditos importados 96 / 464", fallas)
            page.locator("#malla-buscar").fill("CUR087")
            page.wait_for_timeout(100)
            exigir(page.locator(".ramo-card").count() == 1,
                   "malla: el buscador filtra por código", fallas)
            page.locator("#malla-buscar").fill("")
            page.wait_for_timeout(80)
            exigir(not errores, f"malla: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            page.locator("#archivo-malla").set_input_files(str(FIXTURE))
            page.wait_for_timeout(300)
            d = desborde(page)
            exigir(d == 0, f"411: malla sin desborde — {d}px", fallas)
            exigir(page.locator(".ramo-card").count() == 87, "411: la malla importada se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-malla", fallas)


if __name__ == "__main__":
    sys.exit(main())
