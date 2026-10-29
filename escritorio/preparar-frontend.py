#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Prepara el frontend que consume Tauri copiando SOLO la app universal.

La fuente de verdad es ``app/`` en la raiz del proyecto. No se apunta Tauri a esa
carpeta directamente porque empaquetaria ``pruebas/``. Aqui se copia con LISTA
BLANCA: index.html, tutorial.json, css/, js/, img/ y vendor/.

``escritorio/app/`` es GENERADO y esta en .gitignore. Este script es el mismo en
Linux, Windows y macOS: no usa shell ni rutas POSIX.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PROYECTO = AQUI.parent
ORIGEN = PROYECTO / "app"
DESTINO = AQUI / "app"

ARCHIVOS = ("index.html", "tutorial.json")
CARPETAS = ("css", "js", "img", "vendor")

# Si falta uno de estos, el binario saldria vacio o sin cifrado/LaTeX.
IMPRESCINDIBLES = (
    "index.html",
    "tutorial.json",
    "js/shell.js",
    "js/sync.js",
    "css/base.css",
    "css/shell.css",
    "vendor/katex/katex.min.js",
    "vendor/katex/katex.min.css",
    "vendor/marked/marked.min.js",
    "vendor/dompurify/purify.min.js",
    "vendor/fonts/comfortaa-semibold.woff2",
    "img/icon-64.png",
)


def alto(mensaje: str) -> None:
    print()
    print(f"ALTO: {mensaje}")
    print(f"Este script vive en {AQUI} y espera la app universal en {ORIGEN}.")
    raise SystemExit(1)


def main() -> int:
    print(f"origen : {ORIGEN}")
    print(f"destino: {DESTINO}")

    for relativo in IMPRESCINDIBLES:
        if not (ORIGEN / relativo).is_file():
            alto(f"no encuentro {relativo} en {ORIGEN}")

    if DESTINO.exists():
        shutil.rmtree(DESTINO)
    DESTINO.mkdir(parents=True)

    for nombre in ARCHIVOS:
        shutil.copy2(ORIGEN / nombre, DESTINO / nombre)

    for nombre in CARPETAS:
        origen = ORIGEN / nombre
        if not origen.is_dir():
            alto(f"falta la carpeta {nombre} en {ORIGEN}")
        shutil.copytree(origen, DESTINO / nombre)

    for prohibido in ("pruebas",):
        if (DESTINO / prohibido).exists():
            alto(f"{prohibido}/ entro en el frontend empaquetado.")

    total = sum(1 for p in DESTINO.rglob("*") if p.is_file())
    print(f"frontend listo: {total} archivos")
    if total < 25:
        alto(f"solo {total} archivos. El frontend esta INCOMPLETO.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
