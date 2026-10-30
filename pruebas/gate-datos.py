#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-datos.py — gate G-DATOS de MIMO v2 (M02).

Mide el adaptador de referencia contra el respaldo real de formato 2:
  1. el respaldo abre y migra a v3
  2. conserva los 87 cursos y sus códigos
  3. conserva los 18 aprobados
  4. conserva las 54 sesiones y sus 3.838 minutos
  5. exportar v3 e importar v3 devuelve el mismo objeto (ida y vuelta)
  6. `legacy` guarda las claves del origen
  7. un respaldo roto (catálogo no objeto) sale 1, no se cuela

Uso:
  python3 pruebas/gate-datos.py
  python3 pruebas/gate-datos.py --demo
  python3 pruebas/gate-datos.py --fichero pruebas/fixtures/respaldo-sintetico.json
  python3 pruebas/gate-datos.py --fichero /ruta/al/respaldo-real.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
FIXTURE = AQUI / "fixtures" / "respaldo-sintetico.json"

sys.path.insert(0, str(AQUI))
from datos_v3 import DatosInvalidos, exportar3, importar2, importar3  # noqa: E402
from gatelib import exigir, salir  # noqa: E402

ESPERADO = {"cursos": 87, "aprobados": 18, "sesiones": 54, "minutos": 3838}


def correr(fichero: Path) -> list[str]:
    fallas: list[str] = []
    print(f"RESPALDO: {fichero}")
    try:
        doc = importar2(json.loads(fichero.read_text(encoding="utf-8")))
    except (DatosInvalidos, ValueError, OSError) as e:
        print(f"[ROJO] no migra: {e}")
        return [f"no migra: {e}"]

    datos = doc["datos"]
    exigir(doc["v"] == 3, "v3: el documento declara v=3", fallas)
    exigir(doc["meta"]["migrado_desde"] == "formato2", "v3: meta.migrado_desde=formato2", fallas)
    exigir(len(datos["cursos"]) == ESPERADO["cursos"],
           f"cursos: {len(datos['cursos'])} de {ESPERADO['cursos']}", fallas)
    exigir(len(datos["aprobados"]) == ESPERADO["aprobados"],
           f"aprobados: {len(datos['aprobados'])} de {ESPERADO['aprobados']}", fallas)
    exigir(len(datos["sesiones"]) == ESPERADO["sesiones"],
           f"sesiones: {len(datos['sesiones'])} de {ESPERADO['sesiones']}", fallas)
    minutos = sum(s["minutos"] for s in datos["sesiones"])
    exigir(minutos == ESPERADO["minutos"], f"minutos: {minutos} de {ESPERADO['minutos']}", fallas)
    codigos = {c["codigo"] for c in datos["cursos"]}
    exigir(len(codigos) == len(datos["cursos"]), "cursos: códigos únicos, sin duplicados", fallas)
    ids = {s["id"] for s in datos["sesiones"]}
    exigir(len(ids) == len(datos["sesiones"]), "sesiones: ids únicos, sin duplicados", fallas)
    exigir("estado" in doc["legacy"]["claves"] and "formato" in doc["legacy"]["claves"],
           "legacy: conserva las claves del origen", fallas)

    try:
        vuelta = importar3(exportar3(doc))
        exigir(vuelta == doc, "ida y vuelta: exportar v3 -> importar v3 conserva el objeto", fallas)
    except DatosInvalidos as e:
        exigir(False, f"ida y vuelta falla: {e}", fallas)
    return fallas


def roto() -> list[str]:
    fallas: list[str] = []
    malo = {"formato": 2, "estado": {"catalogo": "roto", "aprobados": {}}}
    try:
        importar2(malo)
        exigir(False, "roto: el catálogo no objeto debe rechazarse", fallas)
    except DatosInvalidos:
        exigir(True, "roto: el catálogo no objeto se rechaza con DatosInvalidos", fallas)
    return fallas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fichero", type=Path, default=FIXTURE)
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    fallas = correr(args.fichero)
    codigo = salir("gate-datos", fallas)
    if not args.demo:
        return codigo
    fallas_rotas = roto()
    codigo_roto = salir("gate-datos/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: el respaldo bueno no pasa.")
        return 1
    if codigo_roto != 0:
        print("ROJO: el caso roto no se detecta.")
        return 1
    print("DEMO: respaldo bueno 0, roto detectado. El gate discrimina.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
