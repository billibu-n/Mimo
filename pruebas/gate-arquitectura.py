#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-arquitectura.py — comprobaciones estáticas de los límites de bloques.

No mide la UI: mide que el código conserve las reglas que sostienen el registro:
- el registro y el dominio se cargan antes del shell;
- los módulos de dominio no tocan DOM ni el estado global;
- no quedan borrados en cascada de calificaciones;
- Calificaciones ya no escribe eventos con `sincronizarEventoComp`;
- el registro declara la base fija y los bloques esperados;
- el gate de bloques está en el arnés.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
APP = RAIZ / "app"
SHELL = (APP / "js" / "shell.js").read_text(encoding="utf-8")
INDICE = (APP / "index.html").read_text(encoding="utf-8")
REGISTRO = (APP / "js" / "nucleo" / "registro.js").read_text(encoding="utf-8")
DOMINIO = [APP / "js" / "dominio" / "cursos.js", APP / "js" / "dominio" / "sesiones.js"]
FALLAS: list[str] = []


def exigir(cond: bool, mensaje: str) -> None:
    if cond:
        print(f"[OK] {mensaje}")
    else:
        print(f"[ROJO] {mensaje}")
        FALLAS.append(mensaje)


def orden_scripts() -> list[str]:
    return re.findall(r'<script src="([^"]+)"', INDICE)


def main() -> int:
    scripts = orden_scripts()
    for necesario in ("js/nucleo/registro.js", "js/dominio/cursos.js", "js/dominio/sesiones.js", "js/shell.js"):
        exigir(necesario in scripts, f"carga: {necesario}")
    if all(x in scripts for x in ("js/nucleo/registro.js", "js/dominio/cursos.js", "js/dominio/sesiones.js", "js/shell.js")):
        exigir(scripts.index("js/nucleo/registro.js") < scripts.index("js/shell.js"),
               "orden: el registro va antes que el shell")
        exigir(scripts.index("js/dominio/cursos.js") < scripts.index("js/shell.js"),
               "orden: cursos va antes que el shell")
        exigir(scripts.index("js/dominio/sesiones.js") < scripts.index("js/shell.js"),
               "orden: sesiones va antes que el shell")

    for nombre in ("registrar", "secciones", "pintar", "validar", "puedeInstalar", "puedeQuitar"):
        exigir(f"{nombre}:" in REGISTRO, f"registro: expone {nombre}")

    for archivo in DOMINIO:
        texto = archivo.read_text(encoding="utf-8")
        exigir("document." not in texto, f"{archivo.name}: no toca document")
        exigir("innerHTML" not in texto, f"{archivo.name}: no toca innerHTML")
        exigir("estado." not in texto, f"{archivo.name}: no lee el estado global")

    for i in ("calendario", "tareas", "notas", "ajustes"):
        exigir(f'id: "{i}"' in SHELL, f"manifiesto base: {i}")
    for i in ("tiempo", "malla", "calificaciones", "estudio", "evaluaciones", "academics"):
        exigir(bool(re.search(r"^\s*" + i + r":\s*\{", SHELL, re.M)), f"manifiesto opcional: {i}")

    exigir("delete estado.califs[cod]" not in SHELL, "datos: no hay borrado en cascada de calificaciones")
    exigir("sincronizarEventoComp" not in SHELL, "eventos: Calificaciones no copia eventos")
    exigir("fuenteCalificaciones" in SHELL, "eventos: fuente de Calificaciones registrada")
    exigir("registrarFuenteCalendario" in SHELL, "eventos: registro de fuentes del calendario")

    runner = (RAIZ / "pruebas" / "correr-gates.py").read_text(encoding="utf-8")
    exigir('"gate-bloques.py"' in runner, "arnés: gate-bloques incluido")
    exigir('"gate-arquitectura.py"' in runner, "arnés: gate-arquitectura incluido")
    exigir((RAIZ / "pruebas" / "gate-bloques.py").exists(), "arnés: gate-bloques existe")

    if FALLAS:
        print(f"RESUMEN gate-arquitectura: {len(FALLAS)} choque(s).")
        return 1
    print("RESUMEN gate-arquitectura: 0 choque(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
