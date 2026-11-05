#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-calendario-ramos.py — los ramos como categorías automáticas del calendario.

Mide sobre app/index.html:
  1. la barra lateral lista los ramos sin crear categorías a mano;
  2. un ramo sin color ni icono sigue apareciendo por su código;
  3. el interruptor del ramo oculta y muestra sus eventos;
  4. la tarea con «Mostrar en el calendario» entra como chip y abre Tareas;
  5. la descripción Markdown del evento se lee en el panel;
  6. un evento se puede guardar como tarea desde su ventana;
  7. a 411 no desborda y no hay errores de consola.
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def tarea(i: int, titulo: str, fecha: str, contexto: str) -> dict:
    return {
        "id": f"t{i}", "titulo": titulo, "tipo": "tarea", "padre_id": None,
        "estado": "pendiente", "hecha": False, "prioridad": "media",
        "fecha": fecha, "hora": "09:30", "enCalendario": True, "contexto": contexto,
        "nota": "", "recurrencia": None, "orden": i, "creada": "",
    }


def main() -> int:
    fallas: list[str] = []
    hoy = date.today().isoformat()
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate("""([hoy, manana]) => {
              const k = 'mimo.shell.v1', s = JSON.parse(localStorage.getItem(k) || '{}');
              s.instalados = ['tiempo', 'malla', 'calificaciones', 'estudio'];
              s.cursos = [
                { codigo: 'MA1001', nombre: 'Cálculo I', creditos: 6, nivel: 1,
                  enCurso: true, cerrado: false, aprobado: false, requisitos: [], requisitos_o: [],
                  enMalla: true, color: '#2563eb', icono: 'i-ramo-libro' },
                { codigo: 'FI1001', nombre: 'Física I', creditos: 6, nivel: 1,
                  enCurso: true, cerrado: false, aprobado: false, requisitos: [], requisitos_o: [],
                  enMalla: true, color: '', icono: '' }
              ];
              s.eventos = [
                { id: 'e1', titulo: 'Control 1', fecha: hoy, hora: '10:00', contexto: 'MA1001',
                  tipo: '', nota: 'Traer **calculadora**.' },
                { id: 'e2', titulo: 'Laboratorio', fecha: hoy, hora: '12:00', contexto: 'FI1001', tipo: '', nota: '' }
              ];
              s.tareas = [{
                id: 't1', titulo: 'Repasar cálculo', tipo: 'tarea', padre_id: null,
                estado: 'pendiente', hecha: false, prioridad: 'media', fecha: manana,
                hora: '09:30', enCalendario: true, contexto: 'MA1001', nota: '',
                recurrencia: null, orden: 0, creada: ''
              }];
              localStorage.setItem(k, JSON.stringify(s));
            }""", [hoy, (date.today() + timedelta(days=1)).isoformat()])
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(500)
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(300)

            ex = page.locator("#cal-ramos .cal-ramo").all_inner_texts()
            exigir(len(ex) == 2 and any("MA1001" in x for x in ex) and any("FI1001" in x for x in ex),
                   f"ramos: los dos se listan solos — {ex}", fallas)
            exigir(page.locator("#cal-ramos .cal-ramo").count() == 2, "ramos: dos categorías automáticas", fallas)
            chips = page.locator("#cal-grid .evento-chip").all_inner_texts()
            exigir(len(chips) == 3 and any("Control 1" in x for x in chips) and any("Repasar cálculo" in x for x in chips),
                   f"calendario: eventos y tarea — {chips}", fallas)
            fi = page.locator('#cal-ramos .cal-ramo', has_text="FI1001")
            exigir(fi.locator("i").count() == 1, "ramos: el ramo sin icono conserva su marca", fallas)
            exigir(any("FI1001" in x for x in chips), "calendario: el ramo sin tinte se identifica en el chip", fallas)

            fi.click()
            page.wait_for_timeout(250)
            chips = page.locator("#cal-grid .evento-chip").all_inner_texts()
            exigir(len(chips) == 2 and any("Control 1" in x for x in chips) and any("Repasar cálculo" in x for x in chips),
                   f"filtro: FI1001 se oculta — {chips}", fallas)
            fi.click()
            page.wait_for_timeout(250)
            exigir(page.locator("#cal-grid .evento-chip").count() == 3,
                   f"filtro: FI1001 vuelve — {page.locator('#cal-grid .evento-chip').count()}", fallas)

            page.locator("#cal-grid .evento-chip", has_text="Control 1").click()
            page.wait_for_timeout(250)
            panel = page.locator("#panel-cuerpo").inner_text()
            exigir("Descripción" in panel and "calculadora" in panel,
                   f"evento: la descripción Markdown se lee — {panel[:100]}", fallas)
            exigir(page.locator("#panel-cuerpo .panel__nota--md strong").count() >= 1,
                   "evento: el Markdown se renderiza", fallas)

            page.locator("#cal-grid .evento-chip", has_text="Repasar cálculo").click()
            page.wait_for_timeout(300)
            activa = page.locator("#tabs .tab.on").get_attribute("data-ir")
            exigir(activa == "tareas", f"tarea: el chip abre Tareas — {activa}", fallas)

            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(200)
            page.locator("#evento-titulo").fill("Tarea desde el calendario")
            page.locator("#evento-destino").select_option("tarea")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(300)
            tareas = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).tareas")
            exigir(any(t["titulo"] == "Tarea desde el calendario" for t in tareas),
                   "evento->tarea: la tarea se crea", fallas)
            exigir(page.locator("#cal-grid .evento-chip", has_text="Tarea desde el calendario").count() == 1,
                   "evento->tarea: la tarea entra al calendario", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(300)
            exigir(desborde(page) == 0, f"411: calendario sin desborde — {desborde(page)}px", fallas)
            exigir(not errores, f"sin errores de consola — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-calendario-ramos", fallas)


if __name__ == "__main__":
    sys.exit(main())
