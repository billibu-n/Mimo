#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tiempo.py — U5: cronómetro, temporizador, pomodoro y alarmas.

Mide sobre app/index.html:
  1. el cronómetro registra una sesión con ramo;
  2. el temporizador de 0,1 min termina y registra;
  3. el pomodoro de 0,1 min pasa a pausa corta y registra el trabajo;
  4. una alarma a la hora actual avisa y queda en la lista;
  5. los controles de reloj se ocultan en Alarmas;
  6. 411 sin desborde y consola limpia.

Uso: python3 pruebas/gate-tiempo.py
"""
from __future__ import annotations

import datetime
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def instalar(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Tiempo").locator("button", has_text="Instalar").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_ramo(page) -> None:
    page.locator('#tabs .tab[data-ir="malla"]').click()
    page.wait_for_timeout(100)
    page.locator("#btn-nuevo-ramo").click()
    page.locator("#ramo-codigo").fill("MA1001")
    page.locator("#ramo-nombre").fill("Cálculo I")
    page.locator('#ramo-form button[type="submit"]').click()
    page.wait_for_timeout(120)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            instalar(page)
            crear_ramo(page)
            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#estanteria-tiempo [data-hijo]").count() == 4,
                   "tiempo: los 4 modos viven arriba", fallas)

            page.locator("#tiempo-ramo").select_option("MA1001")
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(1100)
            page.locator("#btn-parar").click()
            page.wait_for_timeout(250)
            exigir(page.locator("#tiempo-sesiones").inner_text().strip() == "1",
                   "tiempo: el cronómetro registra una sesión", fallas)
            exigir("MA1001" in page.locator("#tiempo-lista-sesiones").inner_text(),
                   "tiempo: la sesión guarda el ramo", fallas)

            page.locator('#estanteria-tiempo [data-hijo="temporizador"]').click()
            page.wait_for_timeout(150)
            page.locator("#temp-min").fill("0.1")
            page.locator("#temp-min").blur()
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(6700)
            exigir(page.locator("#tiempo-sesiones").inner_text().strip() == "2",
                   "tiempo: el temporizador termina y registra", fallas)

            page.locator('#estanteria-tiempo [data-hijo="pomodoro"]').click()
            page.wait_for_timeout(150)
            page.locator("#pomo-trabajo").fill("0.1")
            page.locator("#pomo-trabajo").blur()
            page.locator("#pomo-corto").fill("0.1")
            page.locator("#pomo-corto").blur()
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(6700)
            estado = page.locator("#tiempo-estado").inner_text()
            exigir("pausa corta" in estado, "tiempo: el pomodoro pasa a pausa corta", fallas)
            exigir(page.locator("#tiempo-sesiones").inner_text().strip() == "3",
                   "tiempo: el pomodoro registra el trabajo", fallas)

            page.evaluate("""() => {
              window.__notifs = [];
              window.Notification = class {
                static permission = 'granted';
                constructor(titulo, opciones) { window.__notifs.push({titulo, opciones}); }
                static requestPermission() { return Promise.resolve('granted'); }
              };
            }""")
            page.locator('#estanteria-tiempo [data-hijo="alarmas"]').click()
            page.wait_for_timeout(150)
            exigir(not page.locator(".tiempo-caja .fila").is_visible(),
                   "tiempo: Alarmas oculta los controles del reloj", fallas)
            hora = datetime.datetime.now().strftime("%H:%M")
            page.locator("#alarma-hora").fill(hora)
            page.locator("#alarma-texto").fill("Prueba")
            page.locator('#alarma-form button[type="submit"]').click()
            page.wait_for_timeout(1800)
            exigir("Prueba" in page.locator("#alarma-lista").inner_text(),
                   "tiempo: la alarma queda en la lista", fallas)
            exigir("Alarma: Prueba" in page.locator("#toast").inner_text(),
                   "tiempo: la alarma avisa", fallas)
            exigir(page.evaluate("window.__notifs.length") >= 1,
                   "tiempo: la alarma usa notificación nativa", fallas)
            exigir(not errores, f"tiempo: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            instalar(page)
            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(150)
            page.locator('#estanteria-tiempo [data-hijo="temporizador"]').click()
            page.wait_for_timeout(100)
            d = desborde(page)
            exigir(d == 0, f"411: tiempo sin desborde — {d}px", fallas)
            exigir(page.locator("#tiempo-config").is_visible(), "411: la configuración se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-tiempo", fallas)


if __name__ == "__main__":
    sys.exit(main())
