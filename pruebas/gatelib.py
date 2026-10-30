#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gatelib.py — piezas comunes de los gates de MIMO v2.

Un gate no mide "que se ve": mide lo que el encargo reclama y devuelve 0/1.
Chromium es el del sistema; Playwright solo lo conduce. Si el binario no está,
el gate sale 1 con el motivo, no se salta.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

CHROMIUM = os.environ.get("MIMO_CHROMIUM", "/usr/bin/chromium-browser")


class Falla(Exception):
    pass


class Navegador:
    def __init__(self):
        self.pw = None
        self.browser = None

    def __enter__(self):
        if not Path(CHROMIUM).exists():
            raise Falla(f"no está el Chromium del sistema: {CHROMIUM}")
        self.pw = sync_playwright().start()
        self.browser = self.pw.chromium.launch(headless=True, executable_path=CHROMIUM)
        return self

    def __exit__(self, *exc):
        if self.browser:
            self.browser.close()
        if self.pw:
            self.pw.stop()

    def abrir(self, fichero: Path, ancho: int = 1440, alto: int = 900, reset: bool = True):
        ctx = self.browser.new_context(viewport={"width": ancho, "height": alto})
        page = ctx.new_page()
        errores = []
        page.on("console", lambda m: errores.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
        url = fichero.resolve().as_uri() + ("?reset=1" if reset else "")
        page.goto(url, wait_until="load")
        page.wait_for_timeout(250)
        return ctx, page, errores


def desborde(page) -> int:
    return int(page.evaluate(
        "Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,"
        " document.body.scrollWidth - document.body.clientWidth)"
    ))


def texto_tabs(page):
    out = []
    for t in page.locator("#tabs .tab").all():
        out.append(t.get_attribute("title") or t.get_attribute("aria-label") or t.inner_text().strip())
    return out


def exigir(cond, mensaje, fallas):
    if cond:
        print(f"[OK] {mensaje}")
    else:
        print(f"[ROJO] {mensaje}")
        fallas.append(mensaje)


def salir(nombre: str, fallas: list[str]):
    if fallas:
        print(f"RESUMEN {nombre}: {len(fallas)} choque(s).")
        return 1
    print(f"RESUMEN {nombre}: 0 choque(s).")
    return 0


def cargar_json(ruta: Path):
    with ruta.open(encoding="utf-8") as f:
        return json.load(f)
