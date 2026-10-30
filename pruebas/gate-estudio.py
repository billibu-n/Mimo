#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-estudio.py — U4c: horas por ramo, semanas y meta.

Mide sobre app/index.html:
  1. sin ramos, Estudio explica que se crean en Malla;
  2. una sesión suelta suma horas y aparece en la semana del periodo;
  3. dos ramos se apilan con colores distintos;
  4. la meta semanal y la meta por ramo se reflejan;
  5. borrar una sesión descuenta;
  6. 411 sin desborde y consola limpia.

Uso: python3 pruebas/gate-estudio.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Tiempo").locator("button", has_text="Instalar").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_ramo(page, codigo: str, nombre: str) -> None:
    page.locator("#btn-nuevo-ramo").click()
    page.locator("#ramo-codigo").fill(codigo)
    page.locator("#ramo-nombre").fill(nombre)
    page.locator('#ramo-form button[type="submit"]').click()
    page.wait_for_timeout(100)


def crear_periodo(page) -> None:
    page.locator("#btn-nuevo").click()
    page.locator("#periodo-nombre").fill("Primavera 2026")
    page.locator("#periodo-inicio").fill("2026-08-03")
    page.locator("#periodo-semanas").fill("4")
    page.locator("#periodo-receso").fill("0")
    page.locator("#periodo-examenes").fill("0")
    page.locator('#periodo-form button[type="submit"]').click()
    page.wait_for_timeout(150)


def registrar(page, ramo: str, fecha: str, minutos: str) -> None:
    page.locator("#est-ramo").select_option(ramo)
    page.locator("#est-fecha").fill(fecha)
    page.locator("#est-minutos").fill(minutos)
    page.locator('#est-form button[type="submit"]').click()
    page.wait_for_timeout(280)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator("#est-k-horas").inner_text().strip() == "0 h",
                   "estudio: arranca en 0 h", fallas)
            exigir("Sin ramos" in page.locator("#est-tabla").inner_text(),
                   "estudio: sin ramos remite a Malla", fallas)

            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            crear_ramo(page, "MA1001", "Cálculo I")
            crear_ramo(page, "FI1001", "Física I")
            crear_periodo(page)
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".est-col").count() == 4, "estudio: pinta las 4 semanas del periodo", fallas)

            registrar(page, "MA1001", "2026-08-04", "60")
            exigir(page.locator("#est-k-horas").inner_text().strip() == "1 h",
                   "estudio: una sesión de 60 min suma 1 h", fallas)
            exigir(page.locator(".est-col").first.inner_text().find("1 h") >= 0,
                   "estudio: la sesión cae en la primera semana", fallas)

            registrar(page, "FI1001", "2026-08-11", "30")
            exigir(page.locator("#est-k-horas").inner_text().strip() == "1,5 h",
                   "estudio: dos ramos suman 1,5 h", fallas)
            exigir(page.locator("#est-k-sesiones").inner_text().strip() == "2",
                   "estudio: cuenta 2 sesiones", fallas)
            exigir(page.locator("#est-tabla").inner_text().count("MA1001") == 1
                   and page.locator("#est-tabla").inner_text().count("FI1001") == 1,
                   "estudio: la tabla separa por ramo", fallas)

            page.locator("#est-meta").fill("0.5")
            page.locator("#est-meta").blur()
            page.wait_for_timeout(250)
            exigir(page.locator("#est-k-semanas").inner_text().strip() == "1",
                   "estudio: una semana sobre la meta", fallas)
            page.locator('[data-est-meta-ramo="MA1001"]').fill("1")
            page.locator('[data-est-meta-ramo="MA1001"]').blur()
            page.wait_for_timeout(250)
            exigir("25 %" in page.locator("#est-tabla").inner_text(),
                   "estudio: avance del ramo contra su meta", fallas)

            page.locator("[data-borrar-estudio]").first.click()
            page.wait_for_timeout(250)
            exigir(page.locator("#est-k-sesiones").inner_text().strip() == "1",
                   "estudio: borrar una sesión descuenta", fallas)

            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(120)
            exigir("MA1001" in page.locator("#tiempo-ramo").inner_text(),
                   "estudio: Tiempo ofrece los ramos", fallas)
            page.locator("#tiempo-ramo").select_option("MA1001")
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(1100)
            page.locator("#btn-parar").click()
            page.wait_for_timeout(250)
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator("#est-k-sesiones").inner_text().strip() == "2",
                   "estudio: la sesión de Tiempo entra en Estudio", fallas)
            exigir(not errores, f"estudio: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            crear_ramo(page, "MA1001", "Cálculo I")
            crear_periodo(page)
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(150)
            registrar(page, "MA1001", "2026-08-04", "60")
            d = desborde(page)
            exigir(d == 0, f"411: estudio sin desborde — {d}px", fallas)
            exigir(page.locator(".est-col").count() == 4, "411: el gráfico se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-estudio", fallas)


if __name__ == "__main__":
    sys.exit(main())
