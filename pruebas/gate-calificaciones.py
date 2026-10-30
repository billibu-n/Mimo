#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-calificaciones.py — U4b: notas por categoría, examen y eximición.

Mide el motor y la interfaz sobre app/index.html:
  1. sin ramos, Calificaciones lleva a Malla;
  2. presentación = promedio ponderado de categorías;
  3. examen al 40 % y al 50 % cambia la final;
  4. una condición de eximición cumplida usa la presentación;
  5. quitar un componente recalcula;
  6. el panel Detalle muestra el resumen del ramo;
  7. 411 sin desborde y consola limpia.

Uso: python3 pruebas/gate-calificaciones.py
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
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_ramo(page, codigo="MA1001", nombre="Cálculo I", creditos="6") -> None:
    page.locator("#btn-nuevo-ramo").click()
    page.locator("#ramo-codigo").fill(codigo)
    page.locator("#ramo-nombre").fill(nombre)
    page.locator("#ramo-creditos").fill(creditos)
    page.locator("#ramo-curso").check()
    page.locator('#ramo-form button[type="submit"]').click()
    page.wait_for_timeout(150)


def cambiar(page, selector: str, valor: str) -> None:
    el = page.locator(selector)
    el.fill(valor)
    el.blur()
    page.wait_for_timeout(280)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator("#calif-vacio").is_visible(), "calif: sin ramos muestra el vacío", fallas)
            page.locator("#calif-crear-ramo").click()
            page.wait_for_timeout(100)
            exigir(page.locator("#ramo-form").is_visible(), "calif: el vacío lleva a crear el ramo", fallas)
            page.locator("#ramo-codigo").fill("MA1001")
            page.locator("#ramo-nombre").fill("Cálculo I")
            page.locator("#ramo-creditos").fill("6")
            page.locator("#ramo-curso").check()
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(150)

            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 1, "calif: el ramo aparece en la lista", fallas)
            exigir("en curso" in page.locator(".calif-resumen").inner_text(),
                   "calif: sin notas el curso sigue en curso", fallas)

            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nombre="0"]', "Control 1")
            cambiar(page, '[data-comp-nota="0"]', "5.0")
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.0",
                   "calif: presentación 5.0 con un control", fallas)

            page.locator('[data-accion-calif="cat-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-cat-nombre="1"]', "Tareas")
            cambiar(page, '[data-cat-peso="0"]', "50")
            cambiar(page, '[data-cat-peso="1"]', "50")
            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nombre="1"]', "Tarea 1")
            page.locator('[data-comp-cat="1"]').select_option("Tareas")
            page.wait_for_timeout(200)
            cambiar(page, '[data-comp-nota="1"]', "6.0")
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.5",
                   "calif: presentación 5.5 con dos categorías", fallas)
            exigir("en curso" in page.locator(".calif-resumen").inner_text(),
                   "calif: con examen pendiente el curso sigue en curso", fallas)

            cambiar(page, "[data-exam-nota]", "6.0")
            exigir("5.7" in page.locator(".calif-resumen").inner_text(),
                   "calif: final 5.7 con examen al 40 %", fallas)
            cambiar(page, "[data-exam-peso]", "50")
            exigir("5.8" in page.locator(".calif-resumen").inner_text(),
                   "calif: final 5.8 con examen al 50 %", fallas)

            page.locator("[data-exim-activa]").check()
            page.wait_for_timeout(200)
            page.locator('[data-accion-calif="cond-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-cond-valor="0"]', "5.5")
            exigir("ya te eximes" in page.locator(".calif-exim-estado").inner_text(),
                   "calif: la condición de eximición se cumple", fallas)
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.5",
                   "calif: eximido usa la presentación", fallas)

            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso cerrado" in page.locator(".calif-cierre").inner_text()
                   and "APROBADO" in page.locator(".calif-cierre").inner_text(),
                   "calif: cerrar con eximición deja el curso aprobado", fallas)
            exigir("5.5" in page.locator(".calif-cierre").inner_text(),
                   "calif: el cierre guarda la final 5.5", fallas)
            page.locator('[data-accion-calif="reabrir-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso abierto" in page.locator(".calif-cierre").inner_text(),
                   "calif: reabrir deja el curso abierto", fallas)
            page.locator("[data-exim-activa]").uncheck()
            page.wait_for_timeout(220)
            exigir("5.8" in page.locator(".calif-resumen").inner_text(),
                   "calif: al desactivar la eximición vuelve el examen", fallas)

            cambiar(page, "[data-exam-nota]", "1.0")
            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("REPROBADO" in page.locator(".calif-cierre").inner_text(),
                   "calif: cerrar con final baja deja el curso reprobado", fallas)
            page.locator('[data-accion-calif="reabrir-curso"]').click()
            page.wait_for_timeout(250)
            cambiar(page, "[data-exam-nota]", "6.0")

            page.locator(".calif-item").first.click()
            page.wait_for_timeout(100)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "calif: seleccionar el ramo abre Detalle", fallas)
            exigir("Presentación" in page.locator("#panel-cuerpo").inner_text(),
                   "calif: el panel Detalle muestra el resumen", fallas)

            page.locator('[data-accion-calif="comp-quitar"][data-i="1"]').click()
            page.wait_for_timeout(220)
            exigir(page.locator('[data-comp-nombre="1"]').count() == 0,
                   "calif: quitar un componente", fallas)
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.0",
                   "calif: al quitar el componente la presentación baja a 5.0", fallas)
            exigir(not errores, f"calif: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            crear_ramo(page)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(200)
            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nota="0"]', "5.0")
            d = desborde(page)
            exigir(d == 0, f"411: calificaciones sin desborde — {d}px", fallas)
            exigir(page.locator(".calif-card").count() == 1, "411: el detalle se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-calificaciones", fallas)


if __name__ == "__main__":
    sys.exit(main())
