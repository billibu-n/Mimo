#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tutorial.py — el tutorial aprobado que la app precarga.

Comprueba que `app/tutorial.json` y `publicacion/tutorial.json` son el mismo archivo,
que es un `mimo.backup` importable, que trae el proyecto Mimo con sus tareas y que la
nota de bienvenida conserva los ejemplos de Markdown que se publican.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "tutorial.json"
PUB = RAIZ / "publicacion" / "tutorial.json"

sys.path.insert(0, str(AQUI))
from gatelib import exigir, salir  # noqa: E402


def main() -> int:
    fallas: list[str] = []
    exigir(APP.is_file(), f"tutorial: existe {APP}", fallas)
    exigir(PUB.is_file(), f"tutorial: existe {PUB}", fallas)
    if not (APP.is_file() and PUB.is_file()):
        return salir("gate-tutorial", fallas)

    exigir(APP.read_bytes() == PUB.read_bytes(),
           "tutorial: app y publicación son el mismo archivo", fallas)
    try:
        doc = json.loads(APP.read_text(encoding="utf-8"))
    except Exception as e:
        exigir(False, f"tutorial: JSON válido — {e}", fallas)
        return salir("gate-tutorial", fallas)

    exigir(doc.get("schema") == "mimo.backup" and doc.get("version") == 1,
           "tutorial: schema mimo.backup v1", fallas)
    entorno = doc.get("entorno") or {}
    tareas = entorno.get("tareas") or []
    proyecto = next((t for t in tareas if t.get("tipo") == "proyecto"), None)
    exigir(proyecto is not None and proyecto.get("titulo") == "Mimo",
           "tutorial: proyecto Mimo", fallas)
    exigir(len(tareas) >= 11, f"tutorial: {len(tareas)} tareas (mínimo 11)", fallas)
    exigir(sum(1 for t in tareas if t.get("hecha")) >= 6,
           "tutorial: al menos 6 tareas hechas", fallas)
    nota = next((n for n in entorno.get("notas") or [] if n.get("id") == "bienvenida"), None)
    exigir(nota is not None, "tutorial: nota de bienvenida", fallas)
    cuerpo = (nota or {}).get("cuerpo", "")
    for pieza in ("# Bienvenido/a a Mimo", "## ¿Qué es Mimo?", "```json", "$E = mc^2$", "<u>", "<mark>"):
        exigir(pieza in cuerpo, f"tutorial: nota incluye {pieza!r}", fallas)
    exigir((nota or {}).get("titulo") == "Bienvenido/a a Mimo",
           "tutorial: título de la nota", fallas)
    return salir("gate-tutorial", fallas)


if __name__ == "__main__":
    sys.exit(main())
