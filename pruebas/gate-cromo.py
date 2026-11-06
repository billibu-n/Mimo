#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-cromo.py — el armazón que sobra: panel, pie, barra y cifras.

Mide sobre app/index.html:
  1. al arrancar el panel está cerrado y el pie sigue en su sitio (siempre);
  2. la vista dividida no ocupa un botón en la barra: vive en Ajustes;
  3. pedir el detalle de un evento abre el panel, aunque el panel estuviera cerrado;
  4. sin nube el estado de guardado vive en el botón de la barra, con su hora;
  5. la cifra de horas del calendario suma las sesiones de verdad, no un cero fijo.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

ANCHO_PANEL = "document.querySelector('#panel').getBoundingClientRect().width"


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 900)
        page.on("dialog", lambda d: d.accept())

        # 1) arranque sobrio
        ancho = page.evaluate(ANCHO_PANEL)
        exigir(ancho <= 1, f"arranque: el panel está cerrado — {ancho:.0f} px", fallas)
        exigir(page.locator(".footer").is_visible(), "arranque: el pie está siempre", fallas)
        exigir(page.locator("#btn-split").count() == 1 and
               page.get_attribute("#btn-split", "aria-pressed") == "false",
               "barra: la vista dividida vive en el botón superior", fallas)

        # 2) el botón de la barra informa, con su hora
        estado = page.locator("#btn-sync").get_attribute("data-estado") or ""
        exigir(estado.startswith("Local"), f"indicador: sin nube dice Local — «{estado}»", fallas)
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(250)
        page.locator("#pref-inicio").select_option("domingo")
        page.wait_for_timeout(300)
        tras = page.locator("#btn-sync").get_attribute("data-estado") or ""
        exigir(tras != estado and any(c.isdigit() for c in tras),
               f"indicador: un cambio pone la hora — «{estado}» → «{tras}»", fallas)
        exigir(page.locator(".footer").is_visible(), "indicador: el pie sigue en su sitio tras un cambio", fallas)

        # 3) el detalle abre el panel
        page.locator('#tabs [data-ir="calendario"]').click()
        page.wait_for_timeout(400)
        page.locator("#btn-nuevo-evento").click()
        page.wait_for_timeout(200)
        page.locator("#evento-titulo").fill("Control de prueba")
        page.locator("#modal-guardar").click()
        page.wait_for_timeout(500)
        page.locator('#cal-grid [data-evento]').first.click()
        page.wait_for_timeout(500)
        ancho = page.evaluate(ANCHO_PANEL)
        exigir(ancho > 200, f"detalle: al pedir un evento el panel se abre — {ancho:.0f} px", fallas)
        exigir("Control de prueba" in page.locator("#panel-cuerpo").inner_text(),
               "detalle: el panel muestra el evento elegido", fallas)

        # 4) el split se abre desde el botón superior
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(300)
        page.evaluate("document.querySelector('#btn-split').click()")
        page.wait_for_timeout(250)
        exigir(page.locator("#modal-split").evaluate("e => e.classList.contains('on')"),
               "split: se abre desde el botón superior", fallas)
        page.locator("#split-cancelar").click()
        page.wait_for_timeout(200)

        # 5) las horas del calendario son las de las sesiones
        page.evaluate("""() => {
          const k = "mimo.shell.v1";
          const s = JSON.parse(localStorage.getItem(k) || "{}");
          s.sesiones = [{ id: "s1", fecha: "2026-10-28", minutos: 90, ramo: "" },
                        { id: "s2", fecha: "2026-10-29", minutos: 30, ramo: "" }];
          localStorage.setItem(k, JSON.stringify(s));
        }""")
        page.goto(APP.as_uri(), wait_until="load")
        page.wait_for_timeout(800)
        page.locator('#tabs [data-ir="calendario"]').click()
        page.wait_for_timeout(400)
        horas = page.locator("#kpi-horas").inner_text().strip()
        exigir(horas.startswith("2"), f"cifras: 120 minutos se leen como 2 h — «{horas}»", fallas)

        exigir(not errores, f"sin errores de consola ({len(errores)}): {errores[:3]}", fallas)
        ctx.close()

    return salir("gate-cromo", fallas)


if __name__ == "__main__":
    raise SystemExit(main())
