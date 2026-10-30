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
    for nombre in ("montar", "desmontar", "montado"):
        exigir(f"{nombre}: {nombre}" in REGISTRO, f"registro: expone ciclo de vida {nombre}")

    for archivo in DOMINIO:
        texto = archivo.read_text(encoding="utf-8")
        exigir("document." not in texto, f"{archivo.name}: no toca document")
        exigir("innerHTML" not in texto, f"{archivo.name}: no toca innerHTML")
        exigir("estado." not in texto, f"{archivo.name}: no lee el estado global")

    for i in ("calendario", "tareas", "notas", "ajustes"):
        exigir(f'id: "{i}"' in SHELL, f"manifiesto base: {i}")
    for i in ("tiempo", "malla", "calificaciones", "estudio", "academics"):
        exigir(bool(re.search(r"^\s*" + i + r":\s*\{", SHELL, re.M)), f"manifiesto opcional: {i}")
        if i != "academics":
            exigir((APP / "js" / "bloques" / i / "vista.js").exists(), f"bloque: {i}/vista.js")
            exigir((APP / "js" / "bloques" / i / "bloque.js").exists(), f"bloque: {i}/bloque.js")

    for i in ("calendario", "tareas", "notas", "tiempo", "malla", "calificaciones", "estudio"):
        exigir(f'id="p-{i}"' not in INDICE, f"index: {i} no vive en el HTML estático")
        exigir(f"js/bloques/{i}/vista.js" in scripts, f"carga: vista de {i}")

    exigir("delete estado.califs[cod]" not in SHELL, "datos: no hay borrado en cascada de calificaciones")
    exigir("MimoEventos.emitir" in (APP / "js" / "dominio" / "cursos.js").read_text(encoding="utf-8"),
           "dominio: cursos emite eventos")
    exigir("MimoEventos.emitir" in (APP / "js" / "dominio" / "sesiones.js").read_text(encoding="utf-8"),
           "dominio: sesiones emite eventos")
    exigir("reg.visibles()" in SHELL, "catálogo: se arma desde el registro")
    exigir(not re.search(r"^\s*evaluaciones\s*:", SHELL, re.M), "catálogo: evaluaciones no está registrada")
    exigir('"evaluaciones"' not in INDICE, "index: evaluaciones no está en el kit")
    exigir("evaluaciones" not in (RAIZ / "pruebas" / "fixtures" / "manifiestos-v1.1.json").read_text(encoding="utf-8"),
           "fixture: evaluaciones fuera del contrato")
    exigir("montarHost" in SHELL and "data-dinamica" in SHELL, "host: montaje dinámico presente")
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
