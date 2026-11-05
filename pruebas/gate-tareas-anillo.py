#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tareas-anillo.py — el anillo semanal de Tareas.

Mide sobre app/index.html:
  1. el anillo aparece en Tareas y cuenta las ocurrencias de la semana;
  2. el centro muestra el porcentaje pendiente y la leyenda los tres totales;
  3. completar una tarea mueve el anillo y la leyenda sin recargar;
  4. el anillo sigue visible en «Al día» y en la vista de 411 sin desbordar;
  5. sin tareas queda en 0 % y no rompe.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def sembrar(page, tareas) -> None:
    page.evaluate("""(tareas) => {
      const k = 'mimo.shell.v1';
      const s = JSON.parse(localStorage.getItem(k) || '{}');
      s.tareas = tareas;
      localStorage.setItem(k, JSON.stringify(s));
    }""", tareas)


def tarea(i: int, titulo: str, fecha: str, hecha: bool) -> dict:
    return {
        "id": f"t{i}", "titulo": titulo, "tipo": "tarea", "padre_id": None,
        "estado": "hecha" if hecha else "pendiente", "hecha": hecha,
        "prioridad": "media", "fecha": fecha, "contexto": "", "nota": "",
        "recurrencia": None, "orden": i, "creada": "",
    }


def leyenda(page):
    return tuple(page.locator(f"#tareas-ley-{k}").inner_text() for k in ("hechas", "pend", "total"))


def centro(page):
    return page.evaluate("document.querySelector('#tareas-anillo text').textContent")


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            sembrar(page, [
                tarea(1, "Hecha del lunes", lunes.isoformat(), True),
                tarea(2, "Hecha de hoy", hoy.isoformat(), True),
                tarea(3, "Pendiente de hoy", hoy.isoformat(), False),
            ])
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(400)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(300)

            exigir(page.locator(".tareas-anillo").is_visible() and page.locator("#tareas-anillo").count() == 1,
                   "anillo: visible en Tareas", fallas)
            exigir(leyenda(page) == ("2", "1", "3"), f"anillo: leyenda 2/1/3 — {leyenda(page)}", fallas)
            exigir(centro(page) == "33%", f"anillo: centro 33 % pendiente — {centro(page)}", fallas)
            exigir(page.locator("#tareas-anillo circle").count() == 3,
                   f"anillo: pista + hechas + pendientes — {page.locator('#tareas-anillo circle').count()}", fallas)
            aria = page.locator("#tareas-anillo").get_attribute("aria-label") or ""
            exigir("2" in aria and "1" in aria and "3" in aria,
                   f"anillo: la etiqueta accesible cuenta — {aria}", fallas)

            page.locator('[data-check="t3"]').click()
            page.wait_for_timeout(300)
            exigir(leyenda(page) == ("3", "0", "3"), f"anillo: completar mueve la leyenda — {leyenda(page)}", fallas)
            exigir(centro(page) == "0%", f"anillo: sin pendientes el centro es 0 % — {centro(page)}", fallas)
            exigir(page.locator("#tareas-anillo circle").count() == 2,
                   f"anillo: sin pendientes queda pista + hechas — {page.locator('#tareas-anillo circle').count()}", fallas)

            page.locator('#vista-tareas [data-vista="hoy"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".tareas-anillo").is_visible(), "anillo: sigue en «Al día»", fallas)
            exigir(leyenda(page) == ("3", "0", "3"), f"anillo: «Al día» conserva la semana — {leyenda(page)}", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(300)
            exigir(desborde(page) == 0, f"411: Tareas no desborda — {desborde(page)} px", fallas)
            exigir(page.locator(".tareas-anillo").is_visible(), "411: el anillo sigue visible", fallas)
            exigir(not errores, f"sin errores de consola — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # Estado limpio: el anillo no inventa datos.
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(250)
            exigir(leyenda(page) == ("0", "0", "0"), f"vacío: leyenda en cero — {leyenda(page)}", fallas)
            exigir(centro(page) == "0%", f"vacío: centro 0 % — {centro(page)}", fallas)
            exigir(page.locator("#tareas-anillo circle").count() == 1,
                   f"vacío: solo la pista — {page.locator('#tareas-anillo circle').count()}", fallas)
            exigir(not errores, f"vacío: sin errores de consola — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-tareas-anillo", fallas)


if __name__ == "__main__":
    sys.exit(main())
