#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tareas-modal.py — el modal de tareas: fecha opcional, descripción y repetición.

Mide lo que el encargo pide:
  1. la ventana de tarea abre con la fecha vacía y un editor Markdown con la
     misma barra de Notas, y la fecha se puede dejar vacía o poner con atajos;
  2. una tarea sin fecha se guarda y aparece en la tira «Sin fecha» del tablero;
  3. la descripción se guarda en Markdown, se previsualiza con títulos, negrita y
     KaTeX, se reabre con el mismo texto y el panel la pinta saneada;
  4. «Diaria + L–V» se configura en dos clics y produce ocurrencias solo de lunes
     a viernes; el caso «correr 30 minutos» se guarda con esa regla;
  5. completar una ocurrencia no cierra la serie (`hecha` sigue falso) y la serie
     se edita conservando las ocurrencias cumplidas;
  6. todo sobrevive a reabrir y a 411 sin desborde.
"""
from __future__ import annotations

import sys
from datetime import date, datetime, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def datos(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}')")


def tarea(page, titulo):
    return [t for t in datos(page).get("tareas", []) if t.get("titulo") == titulo][0]


def nueva(page):
    page.locator("#btn-nueva-tarea").click()
    page.wait_for_timeout(160)


def ocurrencias(page, titulo, desde, hasta):
    return page.evaluate(
        "([titulo, desde, hasta]) => {"
        "  const t = JSON.parse(localStorage.getItem('mimo.shell.v1')).tareas.filter(x => x.titulo === titulo)[0];"
        "  return MimoRecurrencia.ocurrenciasEntre(t.recurrencia, desde, hasta);"
        "}", [titulo, desde, hasta])


def proxima_pendiente(page, titulo, desde):
    return page.evaluate(
        "([titulo, desde]) => {"
        "  const t = JSON.parse(localStorage.getItem('mimo.shell.v1')).tareas.filter(x => x.titulo === titulo)[0];"
        "  return MimoRecurrencia.proximaPendiente(t.recurrencia, desde);"
        "}", [titulo, desde])


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    hoy_iso = hoy.isoformat()
    lunes = hoy - timedelta(days=hoy.weekday())
    domingo = lunes + timedelta(days=6)
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(200)

            # 1) La ventana nace sin fecha, con editor y recurrencia.
            nueva(page)
            exigir(page.locator("#modal-editor").get_attribute("data-editor") == "tarea",
                   "modal: abre el editor de tarea", fallas)
            exigir(page.locator("#tarea-fecha").input_value() == "",
                   f"fecha: nace vacía — {page.locator('#tarea-fecha').input_value()!r}", fallas)
            exigir(page.locator("#tarea-nota").count() == 1 and page.locator("#tarea-nota").is_visible(),
                   "descripción: el modal trae un editor, no un campo plano", fallas)
            exigir(page.locator(".editor-md [data-formato]").count() >= 10,
                   f"descripción: la barra de Notas — {page.locator('.editor-md [data-formato]').count()} botones", fallas)
            alto = page.evaluate("document.querySelector('#tarea-nota').getBoundingClientRect().height")
            ancho = page.evaluate("document.querySelector('#modal-editor .modal__caja').getBoundingClientRect().width")
            exigir(alto >= 110 and ancho >= 700,
                   f"descripción: ocupa el ancho del modal — {ancho:.0f}px de caja y {alto:.0f}px de editor", fallas)
            exigir(page.locator("[data-rec-frec]").count() == 5,
                   f"recurrencia: cinco frecuencias — {page.locator('[data-rec-frec]').count()}", fallas)
            page.locator('[data-fecha-rapida="hoy"]').click()
            exigir(page.locator("#tarea-fecha").input_value() == hoy_iso,
                   "fecha: el atajo Hoy escribe la fecha", fallas)
            page.locator('[data-fecha-rapida="sin"]').click()
            exigir(page.locator("#tarea-fecha").input_value() == "",
                   "fecha: el atajo Sin fecha la deja vacía", fallas)
            page.keyboard.press("Escape")
            page.wait_for_timeout(120)

            # 2) Una tarea sin fecha se guarda y no desaparece del tablero.
            nueva(page)
            page.locator("#tarea-titulo").fill("Comprar café")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(220)
            t = tarea(page, "Comprar café")
            exigir(t["fecha"] == "", f"sin fecha: se guarda sin fecha — {t['fecha']!r}", fallas)
            exigir(page.locator(".tablero-sin-fecha").count() == 1 and
                   "Comprar café" in page.locator(".tablero-sin-fecha").inner_text(),
                   "sin fecha: la tarea aparece en su tira del tablero", fallas)
            page.locator(".tablero-sin-fecha .tarjeta-tarea", has_text="Comprar café").click()
            page.wait_for_timeout(180)
            page.locator("#panel-cuerpo [data-editar-tarea]").click()
            page.wait_for_timeout(160)
            exigir(page.locator("#tarea-fecha").input_value() == "",
                   "sin fecha: al reabrir sigue vacía", fallas)
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(120)

            # 3) La descripción es Markdown de Notas y el panel la pinta saneada.
            nueva(page)
            page.locator("#tarea-titulo").fill("Informe semanal")
            page.locator("#tarea-nota").fill(
                "# Plan\n\nTexto **negrita** y `código`.\n\n- [ ] paso uno\n\n"
                "Energía: $E=mc^2$\n\n<script>window.__mimoXSS=1</script>")
            page.locator("[data-md-vista]").click()
            page.wait_for_timeout(500)
            exigir(page.locator(".editor-md__vista h1").count() == 1 and
                   page.locator(".editor-md__vista strong").count() == 1,
                   "descripción: la vista previa renderiza Markdown", fallas)
            exigir(page.locator(".editor-md__vista .katex").count() >= 1,
                   f"descripción: KaTeX en la vista previa — {page.locator('.editor-md__vista .katex').count()}", fallas)
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            t = tarea(page, "Informe semanal")
            exigir("**negrita**" in t["nota"] and "$E=mc^2$" in t["nota"],
                   "descripción: se guarda el Markdown tal cual", fallas)
            page.locator(".tarjeta-tarea", has_text="Informe semanal").click()
            page.wait_for_timeout(200)
            exigir(page.locator("#panel-cuerpo .panel__nota--md h1").count() == 1 and
                   page.locator("#panel-cuerpo .panel__nota--md strong").count() == 1,
                   "descripción: el panel usa el mismo renderizado", fallas)
            exigir("**negrita**" not in page.locator("#panel-cuerpo .panel__nota--md").inner_text(),
                   "descripción: el panel no muestra los asteriscos crudos", fallas)
            exigir(page.evaluate("window.__mimoXSS") is None,
                   "descripción: el HTML peligroso se sanea", fallas)
            page.locator("#panel-cuerpo [data-editar-tarea]").click()
            page.wait_for_timeout(180)
            exigir("# Plan" in page.locator("#tarea-nota").input_value(),
                   "descripción: al reabrir el modal conserva el texto", fallas)

            # La barra inserta sintaxis de Markdown sobre la selección.
            page.evaluate("""() => {
                const ta = document.querySelector('#tarea-nota');
                ta.focus(); ta.setSelectionRange(0, ta.value.length);
            }""")
            page.locator('.editor-md [data-formato="negrita"]').click()
            exigir(page.locator("#tarea-nota").input_value().startswith("**"),
                   f"descripción: la barra inserta negrita — {page.locator('#tarea-nota').input_value()[:12]!r}", fallas)
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(120)

            # 4) Diaria + L–V: el caso de correr 30 minutos.
            nueva(page)
            page.locator("#tarea-titulo").fill("Correr 30 minutos")
            page.locator('.rec [data-rec-frec="diaria"]').click()
            page.locator('[data-rec-atajo="laborables"]').click()
            page.wait_for_timeout(160)
            exigir(page.locator("#tarea-rec-resumen").inner_text().startswith("Cada día"),
                   f"recurrencia: resumen diario — {page.locator('#tarea-rec-resumen').inner_text()}", fallas)
            exigir("L–V" in page.locator("#tarea-rec-resumen").inner_text(),
                   "recurrencia: el resumen dice L–V", fallas)
            exigir("sáb" not in page.locator("#tarea-rec-proximas").inner_text().lower() and
                   "dom" not in page.locator("#tarea-rec-proximas").inner_text().lower(),
                   f"recurrencia: las próximas no caen en fin de semana — {page.locator('#tarea-rec-proximas').inner_text()}", fallas)
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            rec = tarea(page, "Correr 30 minutos")["recurrencia"]
            exigir(rec and rec["frecuencia"] == "diaria" and rec["dias"] == [1, 2, 3, 4, 5],
                   f"recurrencia: guarda diaria L–V — {rec}", fallas)
            exigir(rec["desde"] == hoy_iso and tarea(page, "Correr 30 minutos")["fecha"] == hoy_iso,
                   "recurrencia: sin fecha, el inicio es hoy", fallas)

            occ = ocurrencias(page, "Correr 30 minutos", hoy_iso,
                              (hoy + timedelta(days=30)).isoformat())
            dias = [datetime.strptime(x, "%Y-%m-%d").weekday() for x in occ]
            exigir(len(occ) >= 20 and all(d < 5 for d in dias),
                   f"recurrencia: 30 días solo de lunes a viernes — {len(occ)} ocurrencias, fines de semana {sum(1 for d in dias if d >= 5)}", fallas)
            tarjetas = page.evaluate("[...document.querySelectorAll('.tarjeta-tarea')].filter(x => x.textContent.includes('Correr 30 minutos')).map(x => x.getAttribute('data-fecha'))")
            esperadas = ocurrencias(page, "Correr 30 minutos", lunes.isoformat(), domingo.isoformat())
            exigir(sorted(tarjetas) == sorted(esperadas),
                   f"recurrencia: las tarjetas son las ocurrencias de la semana — {tarjetas} vs {esperadas}", fallas)
            if esperadas:
                exigir(page.locator(".tarjeta-tarea", has_text="Correr 30 minutos").count() >= 1,
                       "recurrencia: el tablero pinta la ocurrencia de la semana", fallas)

            # 5) Completar una ocurrencia no cierra la serie.
            page.locator('[data-vista="arbol"]').click()
            page.wait_for_timeout(180)
            fila = page.locator(".tarea-fila", has_text="Correr 30 minutos").first
            fecha_check = fila.locator("[data-check]").get_attribute("data-fecha")
            proxima_antes = proxima_pendiente(page, "Correr 30 minutos", hoy_iso)
            exigir(fecha_check == proxima_antes,
                   f"recurrencia: el árbol marca la próxima — {fecha_check} / {proxima_antes}", fallas)
            fila.locator("[data-check]").click()
            page.wait_for_timeout(220)
            t = tarea(page, "Correr 30 minutos")
            exigir(t["recurrencia"]["hechas"].get(fecha_check) is True,
                   f"recurrencia: la ocurrencia {fecha_check} queda cumplida — {t['recurrencia']['hechas']}", fallas)
            exigir(t["hecha"] is False,
                   "recurrencia: la serie no se marca hecha al completar una ocurrencia", fallas)
            proxima_despues = proxima_pendiente(page, "Correr 30 minutos", hoy_iso)
            exigir(proxima_despues != fecha_check,
                   f"recurrencia: la próxima avanza — {proxima_despues}", fallas)
            exigir("↻" in fila.inner_text() and "L–V" in fila.inner_text(),
                   f"recurrencia: el árbol muestra la regla — {fila.inner_text()[:60]}", fallas)

            # 6) Persistencia: regla, ocurrencia cumplida y descripción.
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(350)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(220)
            t = tarea(page, "Correr 30 minutos")
            exigir(t["recurrencia"]["hechas"].get(fecha_check) is True,
                   "persistencia: la ocurrencia cumplida sigue", fallas)
            exigir(page.locator(".tablero-sin-fecha").count() == 1 and
                   "Comprar café" in page.locator(".tablero-sin-fecha").inner_text(),
                   "persistencia: la tarea sin fecha sigue en su tira", fallas)
            page.locator('[data-vista="arbol"]').click()
            page.wait_for_timeout(150)
            page.locator(".tarea-fila", has_text="Correr 30 minutos").first.click()
            page.wait_for_timeout(180)
            page.locator("#panel-cuerpo [data-editar-tarea]").click()
            page.wait_for_timeout(180)
            exigir(page.locator('.rec [data-rec-frec="diaria"]').get_attribute("class").find("on") >= 0,
                   "persistencia: la regla se reabre en el modal", fallas)
            exigir(page.evaluate("[...document.querySelectorAll('#tarea-rec-dias [data-dia].on')].map(x => x.getAttribute('data-dia'))") == ["1", "2", "3", "4", "5"],
                   "persistencia: los días L–V se reabren marcados", fallas)
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(120)

            # 7) Una serie con fin por número de veces se cierra al cumplir la última.
            page.locator('[data-vista="tablero"]').click()
            page.wait_for_timeout(150)
            hechas_antes = int(page.locator("#kpi-hechas").inner_text())
            nueva(page)
            page.locator("#tarea-titulo").fill("Serie de dos")
            page.locator('.rec [data-rec-frec="diaria"]').click()
            page.locator("#tarea-rec-fin").select_option("cuenta")
            page.locator("#tarea-rec-veces").fill("2")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(250)
            page.locator('[data-vista="arbol"]').click()
            page.wait_for_timeout(180)
            for _ in range(2):
                page.locator(".tarea-fila", has_text="Serie de dos").first.locator("[data-check]").click()
                page.wait_for_timeout(180)
            fila_corta = page.locator(".tarea-fila", has_text="Serie de dos").first
            exigir("serie terminada" in fila_corta.inner_text(),
                   f"fin por veces: la serie queda terminada — {fila_corta.inner_text()[:60]}", fallas)
            exigir(fila_corta.locator("[data-check]").is_disabled(),
                   "fin por veces: ya no se marca otra ocurrencia", fallas)
            exigir(int(page.locator("#kpi-hechas").inner_text()) == hechas_antes + 1,
                   f"fin por veces: la serie pasa a hechas — {page.locator('#kpi-hechas').inner_text()}", fallas)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # 7) Serie vencida: la tarjeta muestra la ocurrencia más antigua y el
        # check no salta a hoy. La clave separa esa ocurrencia de su gemela.
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            desde = (hoy - timedelta(days=3)).isoformat()
            page.evaluate("""(d) => {
              const k = 'mimo.shell.v1';
              const s = JSON.parse(localStorage.getItem(k) || '{}');
              s.tareas = [{
                id: 'tv', titulo: 'Serie vencida', tipo: 'tarea', padre_id: null,
                estado: 'pendiente', hecha: false, prioridad: 'media', fecha: d,
                hora: '', enCalendario: false, contexto: '', nota: '', orden: 0,
                creada: '', recurrencia: {
                  frecuencia: 'diaria', intervalo: 1, dias: [], desde: d,
                  fin: 'nunca', hasta: '', veces: 10, hechas: {}
                }
              }];
              s.vistaTareas = 'tablero';
              localStorage.setItem(k, JSON.stringify(s));
            }""", desde)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(250)
            tarjeta = page.locator('.tarjeta-tarea[data-tarea="tv"]').first
            exigir(tarjeta.get_attribute("data-situacion") == "atrasada",
                   f"vencida: la serie entra como atrasada — {tarjeta.get_attribute('data-situacion')}", fallas)
            exigir(tarjeta.get_attribute("data-fecha") == desde and
                   tarjeta.get_attribute("data-clave") == "tv@" + desde,
                   f"vencida: la tarjeta es la ocurrencia más antigua — {tarjeta.get_attribute('data-fecha')} / {tarjeta.get_attribute('data-clave')}", fallas)
            tarjeta.locator("[data-check]").click()
            page.wait_for_timeout(250)
            t = datos(page)["tareas"][0]
            exigir(t["recurrencia"]["hechas"].get(desde) is True,
                   f"vencida: se cumple la ocurrencia mostrada — {t['recurrencia']['hechas']}", fallas)
            exigir(t["recurrencia"]["hechas"].get(hoy_iso) is not True,
                   "vencida: el check no se salta a hoy", fallas)
            siguiente = page.locator('.tarjeta-tarea[data-tarea="tv"]').first
            exigir(siguiente.get_attribute("data-fecha") == (hoy - timedelta(days=2)).isoformat(),
                   f"vencida: la serie avanza a la siguiente atrasada — {siguiente.get_attribute('data-fecha')}", fallas)
            exigir(not errores, f"vencida: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # 8) 411: el modal cabe y la recurrencia no desborda.
        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(200)
            nueva(page)
            exigir(page.evaluate("document.querySelector('#modal-editor .modal__caja').getBoundingClientRect().width") <= 411,
                   "411: la caja del modal cabe", fallas)
            page.locator('.rec [data-rec-frec="diaria"]').click()
            page.wait_for_timeout(150)
            d = desborde(page)
            exigir(d == 0, f"411: sin desborde con la recurrencia abierta — {d}px", fallas)
            exigir(page.locator("#tarea-fecha").is_visible() and page.locator("#tarea-nota").is_visible(),
                   "411: fecha y descripción siguen visibles", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-tareas-modal", fallas)


if __name__ == "__main__":
    sys.exit(main())
