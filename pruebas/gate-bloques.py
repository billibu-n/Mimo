#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-bloques.py — contrato mínimo de bloques y independencia de Calificaciones.

Mide sobre app/index.html:
1. el registro existe, valida y mantiene la base fija;
2. Calificaciones se instala sola, sin Malla;
3. desde Calificaciones se puede crear un curso cuando Malla no está;
4. al instalar Malla, el curso creado aparece en el plan;
5. al quitar Malla, Calificaciones conserva el curso y sus datos;
6. no hay errores de consola.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gatelib import Navegador, exigir, salir  # noqa: E402

APP = Path(__file__).resolve().parent.parent / "app" / "index.html"


def abrir_catalogo(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)


def instalar(page, bloque: str) -> None:
    abrir_catalogo(page)
    page.locator(f'.bcard[data-bloque="{bloque}"] [data-instalar]').click()
    page.wait_for_timeout(180)
    page.locator("#modal-x").click()
    page.wait_for_timeout(100)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            datos = page.evaluate(
                """() => ({
                    fallas: MimoRegistro.validar(),
                    base: MimoRegistro.base().map(b => b.id),
                    secciones: MimoRegistro.secciones([])
                })"""
            )
            exigir(datos["fallas"] == [], f"registro: sin fallas — {datos['fallas']}", fallas)
            exigir(datos["base"] == ["calendario", "tareas", "notas", "ajustes"],
                   f"registro: base fija — {datos['base']}", fallas)
            exigir(datos["secciones"] == ["calendario", "tareas", "notas", "ajustes"],
                   f"registro: sin opcionales solo queda la base — {datos['secciones']}", fallas)

            instalar(page, "calificaciones")
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator("#calif-vacio").is_visible(), "calif sola: muestra el vacío", fallas)
            exigir(page.locator("#calif-curso-form").is_visible(),
                   "calif sola: ofrece crear un curso sin Malla", fallas)
            exigir(not page.locator("#btn-calif-malla").is_visible(),
                   "calif sola: no ofrece un enlace a Malla inexistente", fallas)

            page.locator("#calif-curso-codigo").fill("MA1001")
            page.locator("#calif-curso-nombre").fill("Cálculo I")
            page.locator('#calif-curso-form button[type="submit"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator(".calif-item").count() == 1,
                   "calif sola: el curso creado aparece en la lista", fallas)
            exigir("MA1001" in page.locator("#calif-lista").inner_text(),
                   "calif sola: la lista muestra el código", fallas)

            instalar(page, "malla")
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(200)
            exigir("MA1001" in page.locator("#malla-cols").inner_text(),
                   "malla: ve el curso creado desde Calificaciones", fallas)

            abrir_catalogo(page)
            page.locator('.bcard[data-bloque="malla"] [data-quitar]').click()
            page.wait_for_timeout(180)
            page.locator("#modal-x").click()
            page.wait_for_timeout(100)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator(".calif-item").count() == 1,
                   "quitar Malla: Calificaciones conserva el curso", fallas)
            exigir(not page.locator("#calif-curso-form").is_visible(),
                   "quitar Malla: con cursos no muestra el formulario vacío", fallas)

            # Tiempo solo: cronómetro y sesión sin Estudio.
            instalar(page, "tiempo")
            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(120)
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(1200)
            page.locator("#btn-parar").click()
            page.wait_for_timeout(200)
            exigir(page.locator(".sesion-item").count() == 1,
                   "tiempo solo: registra una sesión sin Estudio", fallas)
            exigir(page.locator("#tiempo-sesiones").inner_text().strip() == "1",
                   "tiempo solo: el contador de sesiones sube", fallas)

            # Quitar Tiempo y usar Estudio solo: el formulario manual sigue.
            abrir_catalogo(page)
            page.locator('.bcard[data-bloque="tiempo"] [data-quitar]').click()
            page.wait_for_timeout(180)
            page.locator("#modal-x").click()
            page.wait_for_timeout(100)
            instalar(page, "estudio")
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(180)
            exigir(page.locator("#est-form").is_visible(),
                   "estudio solo: ofrece registrar una sesión manual", fallas)
            page.locator("#est-minutos").fill("0:30")
            page.locator('#est-form button[type="submit"]').click()
            page.wait_for_timeout(220)
            exigir(page.locator(".est-sesion").count() >= 1,
                   "estudio solo: la sesión manual entra", fallas)

            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-bloques", fallas)


if __name__ == "__main__":
    sys.exit(main())
