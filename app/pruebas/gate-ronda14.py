#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-ronda14.py — correcciones de la ronda 2026-10-28 (segunda parte).

Mide sobre app/index.html:
  1. el calendario muestra la semana del periodo activo (S1, S2, REC, EX);
  2. el periodo se refresca al crearlo, sin recargar;
  3. existe un alto contraste claro con blanco/negro/azul;
  4. el idioma chino simplificado cambia navegación, encabezados y bandera;
  5. la bandera de español es la genérica de Sudamérica;
  6. la vista dividida se abre eligiendo dos secciones;
  7. una pestaña se puede arrastrar al panel derecho;
  8. las pestañas se reordenan con arrastre;
  9. borrar una nota se puede deshacer desde el aviso;
 10. un componente de Calificaciones con fecha pasa al calendario;
 11. la meta de Estudio se puede fijar por semana del periodo;
 12. el mapa de semanas permite receso/exámenes arbitrarios y el calendario los cambia;
 13. ESC cierra la ventana de periodo;
 14. Ctrl+1..4 sigue el orden actual de las pestañas, incluso tras reordenar;
 15. la pantalla de carga se retira al terminar el arranque;
 16. el calendario se traduce a inglés y chino (mes, días, vacío y formulario).
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

DRAG = """([srcSel, dstSel]) => {
  const src = document.querySelector(srcSel), dst = document.querySelector(dstSel);
  if (!src || !dst) return false;
  const dt = new DataTransfer();
  src.dispatchEvent(new DragEvent('dragstart', {bubbles:true, cancelable:true, dataTransfer:dt}));
  dst.dispatchEvent(new DragEvent('dragover', {bubbles:true, cancelable:true, dataTransfer:dt}));
  dst.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer:dt}));
  src.dispatchEvent(new DragEvent('dragend', {bubbles:true, dataTransfer:dt}));
  return true;
}"""


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    primero = hoy.replace(day=1)
    lunes = primero - timedelta(days=primero.weekday())
    inicio = lunes.isoformat()
    viernes = (lunes + timedelta(days=4)).isoformat()
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            # Periodo actual: 2 clases, 1 receso, 1 exámenes.
            page.locator("#btn-nuevo").click(); page.wait_for_timeout(150)
            page.locator("#periodo-nombre").fill("Periodo de prueba")
            page.locator("#periodo-inicio").fill(inicio)
            page.locator("#periodo-semanas").fill("4")
            page.locator("#periodo-receso").fill("1")
            page.locator("#periodo-examenes").fill("1")
            page.locator("#periodo-form button[type=submit]").click(); page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="calendario"]').click(); page.wait_for_timeout(200)

            etiquetas = page.locator(".cal-sem-col").all_inner_texts()
            exigir("SEM" in page.locator(".cal-dow--sem").inner_text(),
                   f"calendario: columna de semana — {page.locator('.cal-dow--sem').all_inner_texts()}", fallas)
            exigir("S1" in etiquetas and "S2" in etiquetas and "REC" in etiquetas and "EX" in etiquetas,
                   f"calendario: S1/S2/REC/EX en el mes — {etiquetas}", fallas)

            # Las semanas también se cambian desde el calendario.
            page.locator(".cal-sem-col.tipo-clases").first.click(); page.wait_for_timeout(250)
            tipos = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).periodos[0].semanas.map(w => w.tipo)")
            exigir(tipos[0] == "receso",
                   f"calendario: clic en SEM cambia el tipo — {tipos}", fallas)

            # ESC cierra la ventana de periodo y Ctrl+1..4 sigue el orden de las pestañas.
            page.locator("#btn-nuevo").click(); page.wait_for_timeout(120)
            page.keyboard.press("Escape"); page.wait_for_timeout(150)
            exigir(not page.locator("#modal-periodo").evaluate("e => e.classList.contains('on')"),
                   "teclado: ESC cierra el periodo", fallas)
            page.keyboard.press("Control+2"); page.wait_for_timeout(100)
            exigir(page.locator("#tabs .tab.on").get_attribute("data-ir") == "tareas",
                   "teclado: Ctrl+2 va a la segunda pestaña", fallas)
            page.keyboard.press("Control+4"); page.wait_for_timeout(100)
            exigir(page.locator("#tabs .tab.on").get_attribute("data-ir") == "ajustes",
                   "teclado: Ctrl+4 va a Ajustes", fallas)
            exigir(not page.locator("body").evaluate("e => e.classList.contains('cargando')") and
                   page.locator("#carga").count() == 0,
                   "carga: la pantalla de carga se retiró al terminar", fallas)

            # Tiles de tema simétricos y alto contraste claro.
            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(150)
            medidas = page.locator("#temas .tema").evaluate_all(
                "els => els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })")
            exigir(len(set(w for w, _ in medidas)) == 1 and len(set(h for _, h in medidas)) == 1,
                   f"temas: todos los tiles miden igual — {medidas[:3]}", fallas)
            page.locator('#temas .tema[data-tema="alto-contraste-claro"]').click(); page.wait_for_timeout(150)
            colores = page.evaluate("""() => {
              const b = getComputedStyle(document.body);
              return {tema: document.body.dataset.tema, bg: b.backgroundColor, fg: b.color};
            }""")
            exigir(colores["tema"] == "alto-contraste-claro" and colores["bg"] == "rgb(255, 255, 255)" and
                   colores["fg"] == "rgb(0, 0, 0)",
                   f"tema: alto contraste claro — {colores}", fallas)

            # Chino simplificado y banderas.
            page.locator("#pref-idioma").select_option("zh"); page.wait_for_timeout(200)
            exigir(page.evaluate("document.documentElement.lang") == "zh-CN",
                   "idioma: html lang zh-CN", fallas)
            exigir(page.locator('#tabs .tab[data-ir="calendario"]').get_attribute("title") == "日历",
                   f"idioma: pestaña 日历 — {page.locator('#tabs .tab[data-ir=\"calendario\"]').get_attribute('title')}", fallas)
            exigir("🇨🇳" in page.locator("#idioma-bandera").inner_text(),
                   "idioma: bandera china", fallas)
            page.locator('#tabs [data-ir="calendario"]').click(); page.wait_for_timeout(250)
            mes_zh = page.locator("#cal-mes-titulo").inner_text()
            exigir("年" in mes_zh and "月" in mes_zh,
                   f"idioma: mes del calendario en chino — {mes_zh}", fallas)
            exigir(page.locator("#btn-hoy").inner_text() == "今天",
                   f"idioma: botón Hoy en chino — {page.locator('#btn-hoy').inner_text()}", fallas)
            dias_zh = page.locator("#cal-grid .cal-dow:not(.cal-dow--sem)").evaluate_all("els => els.map(e => e.textContent.trim())")
            exigir(dias_zh[0] == "周一",
                   f"idioma: días de la semana en chino — {dias_zh[:7]}", fallas)
            exigir("没有事件" in page.locator("#cal-vacio").inner_text(),
                   f"idioma: vacío del calendario en chino — {page.locator('#cal-vacio').inner_text()}", fallas)
            exigir(page.locator("#btn-periodo").inner_text() != "Sin periodo",
                   f"idioma: periodo sin texto español — {page.locator('#btn-periodo').inner_text()}", fallas)
            page.locator("#btn-nuevo-evento").click(); page.wait_for_timeout(150)
            exigir(page.locator("#evento-titulo").get_attribute("placeholder") == "事件标题",
                   f"idioma: placeholder del evento en chino — {page.locator('#evento-titulo').get_attribute('placeholder')}", fallas)
            page.locator("#evento-cancelar").click(); page.wait_for_timeout(100)

            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(150)
            page.locator("#pref-idioma").select_option("en"); page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="calendario"]').click(); page.wait_for_timeout(250)
            mes_en = page.locator("#cal-mes-titulo").inner_text()
            exigir("October" in mes_en or "November" in mes_en or "September" in mes_en,
                   f"idioma: mes del calendario en inglés — {mes_en}", fallas)
            exigir(page.locator("#btn-hoy").inner_text() == "Today",
                   f"idioma: botón Hoy en inglés — {page.locator('#btn-hoy').inner_text()}", fallas)
            dias_en = page.locator("#cal-grid .cal-dow:not(.cal-dow--sem)").evaluate_all("els => els.map(e => e.textContent.trim())")
            exigir(dias_en[0] == "Mon",
                   f"idioma: días de la semana en inglés — {dias_en[:7]}", fallas)
            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(150)
            page.locator("#pref-idioma").select_option("es"); page.wait_for_timeout(200)
            bandera = page.locator("#idioma-bandera img").get_attribute("src") or ""
            exigir("bandera-sudamerica.webp" in bandera,
                   f"idioma: bandera genérica de Sudamérica — {bandera}", fallas)

            # Dos secciones y arrastre.
            page.locator("#btn-split").click(); page.wait_for_timeout(150)
            exigir(page.locator("#modal-split").evaluate("e => e.classList.contains('on')"),
                   "split: abre el diálogo de dos secciones", fallas)
            page.locator("#split-izq").select_option("tareas")
            page.locator("#split-der").select_option("calendario")
            page.locator("#split-abrir").click(); page.wait_for_timeout(200)
            exigir(page.locator("#contenido-b").is_visible() and
                   page.locator("#contenido #p-tareas").is_visible() and
                   page.locator("#contenido-b #p-calendario").is_visible() and
                   page.locator("#split-seccion").input_value() == "calendario",
                   f"split: dos secciones completas — {page.locator('#split-seccion').input_value()}", fallas)
            page.evaluate(DRAG, ['#tabs .tab[data-ir="notas"]', '#contenido-b'])
            page.wait_for_timeout(250)
            exigir(page.locator("#split-seccion").input_value() == "notas" and
                   page.locator("#contenido-b #p-notas").is_visible(),
                   f"split: arrastrar pestaña al panel — {page.locator('#split-seccion').input_value()}", fallas)
            page.evaluate(DRAG, ['#tabs .tab[data-ir="tareas"]', '#tabs .tab[data-ir="notas"]'])
            page.wait_for_timeout(250)
            orden = page.locator("#tabs .tab").evaluate_all("els => els.map(e => e.dataset.ir)")
            exigir(orden.index("tareas") > orden.index("notas"),
                   f"split: reordenar pestañas — {orden}", fallas)
            page.locator("#btn-cerrar-split").click(); page.wait_for_timeout(100)
            page.keyboard.press("Control+2"); page.wait_for_timeout(100)
            exigir(page.locator("#tabs .tab.on").get_attribute("data-ir") == "notas",
                   "teclado: Ctrl+2 respeta el orden reordenado", fallas)

            # Deshacer un borrado.
            page.locator('#tabs [data-ir="notas"]').click(); page.wait_for_timeout(120)
            page.locator("#btn-nueva-nota").click(); page.wait_for_timeout(120)
            page.locator("#nota-titulo").fill("Nota para deshacer")
            page.wait_for_timeout(200)
            page.locator("#btn-borrar-nota").click(); page.wait_for_timeout(300)
            exigir(page.locator("#notas-items .nota-item").count() == 0,
                   "deshacer: la nota se borra", fallas)
            page.locator(".toast__accion").click(); page.wait_for_timeout(300)
            titulos = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
            exigir("Nota para deshacer" in titulos, f"deshacer: restaura — {titulos}", fallas)

            # Componente de Calificaciones -> calendario.
            page.evaluate("""(fecha) => {
              const s = MimoHost.snapshot();
              s.instalados = Array.from(new Set([...(s.instalados || []), "calificaciones", "estudio"]));
              s.cursos = [{codigo:"T1", nombre:"Curso de prueba", creditos:6, nivel:1, requisitos:[]}];
              s.califs = {T1:{categorias:[{nombre:"General",peso:100}],
                componentes:[{nombre:"Control",categoria:"General",nota:null,fecha:fecha,peso:1}],
                examen:{activo:false,peso:0,nota:null,reemplaza:null},
                eximicion:{activa:false,modo:"todas",condiciones:[]}, notaMin:4, meta:5, cerrado:false}};
              MimoHost.reemplazar(s);
            }""", viernes)
            page.locator('#tabs [data-ir="calificaciones"]').click(); page.wait_for_timeout(250)
            page.locator('[data-calif="T1"]').click(); page.wait_for_timeout(150)
            page.locator('[data-accion-calif="comp-cal"]').click(); page.wait_for_timeout(250)
            evs = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).eventos")
            exigir(any(e.get("id") == "calif-T1-0" and e.get("fecha") == viernes for e in evs),
                   f"calificaciones: componente al calendario — {[(e.get('id'), e.get('fecha')) for e in evs]}", fallas)

            # Meta por semana.
            page.locator('#tabs [data-ir="estudio"]').click(); page.wait_for_timeout(250)
            metas = page.locator("#est-metas-semana input")
            exigir(metas.count() == 4, f"estudio: una meta por semana — {metas.count()}", fallas)
            metas.first.fill("3"); metas.first.dispatch_event("change"); page.wait_for_timeout(200)
            guardadas = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).estudio.metasSemana")
            exigir(len(guardadas) >= 1 and 3 in [float(x) for x in guardadas.values()],
                   f"estudio: meta semanal guardada — {guardadas}", fallas)

            # Enlace recíproco nota -> tarea.
            page.locator('#tabs [data-ir="tareas"]').click(); page.wait_for_timeout(120)
            page.locator("#btn-nueva-tarea").click()
            page.locator("#tarea-titulo").fill("Tarea enlazada")
            page.locator("#tarea-form button[type=submit]").click(); page.wait_for_timeout(200)
            page.locator('#tabs [data-ir="notas"]').click(); page.wait_for_timeout(120)
            page.locator("#btn-nueva-nota").click()
            page.locator("#nota-titulo").fill("Nota enlazada"); page.wait_for_timeout(150)
            opcion = page.locator("#nota-vinculo option").filter(has_text="Tarea enlazada").first
            page.locator("#nota-vinculo").select_option(opcion.get_attribute("value")); page.wait_for_timeout(200)
            page.locator('#tabs [data-ir="tareas"]').click(); page.wait_for_timeout(120)
            page.locator("[data-tarea]").first.click(); page.wait_for_timeout(200)
            exigir("Notas enlazadas" in page.locator("#panel-cuerpo").inner_text() and
                   page.locator("#panel-cuerpo [data-abrir-enlace]").count() >= 1,
                   "enlaces: la tarea muestra la nota enlazada", fallas)

            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"ronda: sin pageerror — {errores[:2]}", fallas)
        finally:
            ctx.close()
    return salir("gate-ronda14", fallas)


if __name__ == "__main__":
    sys.exit(main())
