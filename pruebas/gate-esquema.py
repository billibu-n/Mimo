#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-esquema.py — contrato de datos entorno/malla/backup.

Mide con el respaldo sintético y un caso mínimo:
  1. formato 2 migra el catálogo completo, los aprobados con créditos y las sesiones;
  2. los eventos y las tareas del formato 2 no se pierden, y la ficha queda como nota;
  3. mimo.backup ida y vuelta conserva los conteos;
  4. mimo.entorno no borra la malla;
  5. mimo.malla no borra tareas ni eventos;
  6. los campos desconocidos del entorno, del curso y de la raíz se conservan;
  7. los campos desconocidos se conservan, pero una versión mayor se rechaza.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
FIXTURE = AQUI / "fixtures" / "respaldo-sintetico.json"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

MINI = {
    "formato": 2,
    "estado": {
        "activo": "2026-2",
        "catalogo": {
            "MA1001": {"nombre": "Cálculo", "creditos": 6, "nivel": 1, "requisitos": [], "en_malla": True},
            "FI1001": {"nombre": "Física", "creditos": 6, "nivel": 1, "requisitos": ["MA1001"], "en_malla": True},
        },
        "aprobados": {"MA1001": True},
        "extras": [{
            "id": "2026-2", "nombre": "Periodo", "inicio": "2026-08-03",
            "semanas": [{"lunes": "2026-08-03", "domingo": "2026-08-09", "tipo": "clases"}],
            "eventos": [{"id": "e1", "texto": "Control 1", "fecha": "2026-08-10", "detalle": "10.15hrs",
                         "ramo": "FI1001", "tipo": "control"}],
        }],
        "sem": {"2026-2": {
            "nuevas": [{"id": "n1", "texto": "Tarea uno", "fecha": "2026-08-11", "detalle": "detalle",
                        "ramo": "FI1001", "tipo": "tarea"}],
            "fichas": {"e1": {"descripcion": "desc", "temario": "temario"}},
            "hechas": {"n1": True}, "prioridades": {"n1": "alta"},
            "sesiones": [{"id": "s1", "fecha": "2026-08-12", "minutos": 90, "ramo": "FI1001", "hora": "20:00"}],
            "cats": {"FI1001": [{"nombre": "Controles", "peso": 1}]},
            "comps": {"FI1001": [{"nombre": "Control 1", "categoria": "Controles", "peso": 1, "nota": 5}]},
            "examen": {"FI1001": {"activo": True, "peso": 0.4}},
            "exim": {}, "metas_ramo": {"FI1001": {"horas": 5, "nota": 5.5}}, "metas": {"semanal": 10},
        }},
    },
}


def main() -> int:
    fallas: list[str] = []
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            out = page.evaluate("""([fixture, mini]) => {
              const conv = MimoEsquema.convertirAcademics(fixture);
              const m = MimoEsquema.convertirAcademics(mini);
              const backup = MimoEsquema.exportarBackup(conv.estado);
              const vuelta = MimoEsquema.importar(backup, {});
              const ent = MimoEsquema.exportarEntorno(conv.estado);
              m.estado.carrera = {titulo: "Ingeniería", universidad: "Universidad", pais: "Chile"};
              const mal = MimoEsquema.exportarMalla(m.estado);
              const soloEnt = MimoEsquema.importar(ent, conv.estado);
              const soloMal = MimoEsquema.importar(mal, m.estado);
              const futuro = JSON.parse(JSON.stringify(backup));
              futuro.entorno.bloqueFuturo = {x: 1};
              futuro.entorno.cursos = conv.estado.cursos;
              futuro.extensiones.foo = "bar";
              futuro.malla.cursos[0].campoFuturo = "ok";
              const rFuturo = MimoEsquema.importar(futuro, {});
              const futuroVersion = JSON.parse(JSON.stringify(backup));
              futuroVersion.version = 99;
              const rVersion99 = MimoEsquema.importar(futuroVersion, {});
              return {
                conv: conv.resumen,
                aprobados: conv.estado.cursos.filter(c => c.aprobado).length,
                nombreAprobado: (conv.estado.cursos.find(c => c.aprobado) || {}).nombre,
                creditosAprobado: (conv.estado.cursos.find(c => c.aprobado) || {}).creditos,
                mini: m.resumen,
                miniEvento: m.estado.eventos[0] && {hora: m.estado.eventos[0].hora, nota: m.estado.eventos[0].nota},
                miniTarea: m.estado.tareas[0] && {hecha: m.estado.tareas[0].hecha, nota: m.estado.tareas[0].nota},
                vuelta: vuelta.resumen,
                entCursos: soloEnt.estado.cursos.length,
                malTareas: soloMal.estado.tareas.length,
                malEventos: soloMal.estado.eventos.length,
                carrera: mal.datos.carrera,
                carreraVuelta: soloMal.estado.carrera,
                futuro: {
                  bloque: rFuturo.estado.bloqueFuturo,
                  extension: rFuturo.estado.extensiones && rFuturo.estado.extensiones.foo,
                  curso: (rFuturo.estado.cursos[0] || {}).campoFuturo,
                  cursos: (rFuturo.estado.cursos || []).length
                },
                version99: rVersion99,
                error99: MimoEsquema.error(),
                detect: [MimoEsquema.detectar(backup), MimoEsquema.detectar(ent), MimoEsquema.detectar(mal), MimoEsquema.detectar(fixture)]
              };
            }""", [fixture, MINI])
            exigir(out["conv"]["cursos"] == 87, f"legacy: 87 cursos — {out['conv']}", fallas)
            exigir(out["aprobados"] == 18, f"legacy: 18 aprobados — {out['aprobados']}", fallas)
            exigir(out["nombreAprobado"] and out["nombreAprobado"] != "CUR001",
                   f"legacy: aprobado con nombre — {out['nombreAprobado']}", fallas)
            exigir(out["creditosAprobado"] == 7, f"legacy: aprobado con créditos — {out['creditosAprobado']}", fallas)
            exigir(out["conv"]["sesiones"] == 54, f"legacy: 54 sesiones — {out['conv']['sesiones']}", fallas)
            exigir(out["mini"]["eventos"] == 1 and out["miniEvento"]["hora"] == "10:15",
                   f"legacy: evento con hora — {out['miniEvento']}", fallas)
            exigir("temario" in (out["miniEvento"]["nota"] or ""), f"legacy: ficha del evento — {out['miniEvento']}", fallas)
            exigir(out["miniTarea"]["hecha"] is True and "detalle" in (out["miniTarea"]["nota"] or ""),
                   f"legacy: tarea hecha y con nota — {out['miniTarea']}", fallas)
            exigir(out["vuelta"]["cursos"] == 87 and out["vuelta"]["sesiones"] == 54,
                   f"backup: ida y vuelta — {out['vuelta']}", fallas)
            exigir(out["entCursos"] == 87, f"entorno: no borra malla — {out['entCursos']}", fallas)
            exigir(out["malTareas"] == 1 and out["malEventos"] == 1,
                   f"malla: no borra entorno — {out['malTareas']} tareas, {out['malEventos']} eventos", fallas)
            exigir(out["carrera"] == {"titulo": "Ingeniería", "universidad": "Universidad", "pais": "Chile"}
                   and out["carreraVuelta"].get("pais") == "Chile",
                   f"malla: ficha de carrera ida y vuelta — {out['carrera']} / {out['carreraVuelta']}", fallas)
            f = out["futuro"]
            exigir(f["bloque"] == {"x": 1} and f["extension"] == "bar" and f["curso"] == "ok",
                   f"aditivo: campos desconocidos — {f}", fallas)
            exigir(out["version99"] is None and "más nueva" in (out["error99"] or ""),
                   f"versión 99: se rechaza — {out['version99']} / {out['error99']}", fallas)
            exigir(out["detect"] == ["backup", "entorno", "malla", "legacy"],
                   f"detectar: tipos — {out['detect']}", fallas)
            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"esquema: sin pageerror — {errores[:2]}", fallas)
        finally:
            ctx.close()
    return salir("gate-esquema", fallas)


if __name__ == "__main__":
    sys.exit(main())
