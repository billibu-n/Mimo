#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""correr-gates.py — corre los gates de MIMO v2 y resume.

Sale 0 solo si todos salen 0. No oculta la salida: cada gate imprime sus
medidas y este resumen cita el código de cada uno.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
GATES = ("gate-shell.py", "gate-bloques.py", "gate-arquitectura.py", "gate-malla.py", "gate-malla-grafo.py", "gate-calificaciones.py", "gate-estudio.py", "gate-tiempo.py", "gate-busqueda.py", "gate-sync.py", "gate-webdav.py", "gate-correcciones.py", "gate-ronda14.py", "gate-atajos.py", "gate-diseno.py", "gate-datos.py", "gate-idioma.py", "gate-esquema.py", "gate-tutorial.py", "gate-respaldo.py", "gate-actualizacion.py", "gate-senal.py", "gate-escala.py", "gate-barra.py", "gate-cromo.py", "gate-panel.py", "gate-editor.py", "gate-plegable.py", "gate-identidad.py", "gate-categorias.py", "gate-calendario-motor.py", "gate-calendario-ramos.py", "gate-tareas-tablero.py", "gate-tareas-anillo.py", "gate-tareas-modal.py", "gate-sync-enlace.py", "gate-fuente.py", "gate-identidad-opcional.py")


def main() -> int:
    resultados = []
    for nombre in GATES:
        print(f"\n=== {nombre} ===", flush=True)
        p = subprocess.run([sys.executable, str(AQUI / nombre), "--demo"])
        resultados.append((nombre, p.returncode))
    print("\n=== RESUMEN GATES ===", flush=True)
    for nombre, codigo in resultados:
        print(f"{nombre}: {'VERDE' if codigo == 0 else 'ROJO'} ({codigo})")
    return 0 if all(c == 0 for _, c in resultados) else 1


if __name__ == "__main__":
    sys.exit(main())
