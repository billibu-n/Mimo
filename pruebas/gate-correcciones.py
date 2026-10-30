#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-correcciones.py — correcciones del dueño del 2026-10-28.

Mide sobre app/index.html:
  1. un respaldo de Mimo Academics (formato 2) se importa y trae ramos, tareas,
     sesiones, periodo, notas, metas e instala los bloques;
  2. el reloj de Tiempo se edita escribiendo hh:mm:ss;
  3. una sesión importada se corrige desde el modal;
  4. el clic derecho sobre una sesión ofrece Editar y Borrar;
  5. el tema claro/oscuro salta entre la pareja configurada;
  6. Ajustes queda en tres grupos y con los selectores de pareja;
  7. Notas renderiza Markdown GFM (títulos, tabla, subrayado, tareas, código),
     sanea el HTML peligroso y conserva $...$ / $$...$$ con KaTeX;
  8. la tarjeta de sincronización tiene aire (padding, columnas y campos), ofrece
     el registro de Nextcloud y no desborda en móvil;
  9. Guardar tutorial descarga `tutorial.json` y Restablecer de fábrica deja la app vacía.

Uso: python3 pruebas/gate-correcciones.py
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


def respaldo_viejo() -> Path:
    datos = {
        "formato": 2,
        "estado": {
            "v": 3,
            "activo": "2026-2",
            "ajustes": {"av": {"tema": "deepsea", "temaClaro": "clasico", "temaOscuro": "negro"}},
            "extras": [{
                "id": "2026-2", "nombre": "Primavera 2026", "inicio": "2026-08-03",
                "semanas": [
                    {"etiqueta": "S1", "lunes": "2026-08-03", "domingo": "2026-08-09", "tipo": "clases"},
                    {"etiqueta": "S2", "lunes": "2026-08-10", "domingo": "2026-08-16", "tipo": "receso"},
                ],
            }],
            "aprobados": {"MA1001": True},
            "agregados": {"2026-2": [
                {"codigo": "MA2002", "nombre": "Cálculo Avanzado", "alias": "Cálculo", "creditos": 6},
                {"codigo": "FI2001", "nombre": "Mecánica", "creditos": 6},
            ]},
            "sem": {"2026-2": {
                "cats": {"MA2002": [{"nombre": "Controles", "peso": 1}, {"nombre": "Tareas", "peso": 0.5}]},
                "comps": {"MA2002": [
                    {"nombre": "Control 1", "categoria": "Controles", "peso": 1, "nota": 5.5},
                    {"nombre": "Tarea 1", "categoria": "Tareas", "peso": 1, "nota": 6.0},
                ]},
                "examen": {"MA2002": {"activo": True, "peso": 0.4, "reemplaza": None}},
                "exim": {"MA2002": {"activa": True, "modo": "todas", "condiciones": [
                    {"tipo": "presentacion", "ref": None, "op": ">=", "valor": 5.5},
                ]}},
                "nuevas": [
                    {"id": "n1", "texto": "Tarea de cálculo", "fecha": "2026-10-09", "detalle": "Cap. 3", "ramo": "MA2002"},
                    {"id": "n2", "texto": "Trámite", "fecha": "2026-10-10", "detalle": "", "ramo": "OTROS"},
                ],
                "hechas": {"n1": True},
                "prioridades": {"n1": "alta", "n2": "baja"},
                "sesiones": [{"id": "s1", "fecha": "2026-10-01", "ramo": "MA2002", "minutos": 40, "hora": "21:35"}],
                "metas": {"semanal": 12},
                "metas_ramo": {"MA2002": {"horas": 5.5, "nota": 4.5}, "FI2001": {"horas": 3, "nota": 5}},
            }},
        },
    }
    fh = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(datos, fh, ensure_ascii=False)
    fh.close()
    return Path(fh.name)


def main() -> int:
    fallas: list[str] = []
    fixture = respaldo_viejo()
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            page.set_input_files("#archivo-importar", str(fixture))
            page.wait_for_function(
                "() => { try { const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));"
                " return d && d.cursos && d.cursos.length === 3; } catch (e) { return false; } }"
            )
            d = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")
            exigir(len(d["cursos"]) == 3, f"importar: 3 ramos — {len(d['cursos'])}", fallas)
            exigir(len(d["tareas"]) == 2, f"importar: 2 tareas — {len(d['tareas'])}", fallas)
            exigir(len(d["sesiones"]) == 1 and abs(d["sesiones"][0]["minutos"] - 40) < 0.01,
                   "importar: 1 sesión de 40 min", fallas)
            exigir(len(d["periodos"]) == 1 and len(d["periodos"][0]["semanas"]) == 2,
                   "importar: periodo con 2 semanas", fallas)
            exigir(d["califs"]["MA2002"]["examen"]["peso"] == 40,
                   f"importar: examen 40 % — {d['califs']['MA2002']['examen']['peso']}", fallas)
            exigir(abs(d["califs"]["MA2002"]["meta"] - 4.5) < 0.01, "importar: meta de nota 4,5", fallas)
            exigir(abs(d["estudio"]["metaSemanal"] - 12) < 0.01, "importar: meta semanal 12 h", fallas)
            exigir("malla" in d["instalados"] and "estudio" in d["instalados"],
                   "importar: instala Malla y Estudio para ver los datos", fallas)
            exigir(d["tareas"][0]["hecha"] is True and d["tareas"][0]["prioridad"] == "alta",
                   "importar: hecha y prioridad de la tarea", fallas)

            exigir(page.locator("body").get_attribute("data-tema") == "deepsea",
                   "tema: conserva DeepSea del respaldo", fallas)
            page.locator("#btn-tema").click(); page.wait_for_timeout(120)
            exigir(page.locator("body").get_attribute("data-tema") == "clasico",
                   "tema: el botón salta al claro de la pareja", fallas)
            page.locator("#btn-tema").click(); page.wait_for_timeout(120)
            exigir(page.locator("body").get_attribute("data-tema") == "deepsea",
                   "tema: y vuelve al oscuro de la pareja", fallas)

            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(180)
            exigir(page.locator(".ajustes-grupo").count() == 4,
                   f"ajustes: 4 grupos — {page.locator('.ajustes-grupo').count()}", fallas)
            exigir(page.locator(".badge").inner_text().strip() == "v1.2.0-beta.2",
                   f"marca: versión v1.2.0-beta.2 — {page.locator('.badge').inner_text().strip()}", fallas)
            fuente = page.locator(".wordmark").evaluate("e => getComputedStyle(e).fontFamily")
            exigir("Comfortaa" in fuente, f"marca: wordmark Comfortaa — {fuente}", fallas)
            columnas = page.locator(".ajustes-grid").first.evaluate(
                "e => getComputedStyle(e).gridTemplateColumns.split(' ').length")
            exigir(columnas == 2, f"ajustes: dos columnas — {columnas}", fallas)
            antes = page.locator("#mimo-ic").get_attribute("src")
            page.locator("#btn-mimo").click(); page.wait_for_timeout(120)
            despues = page.locator("#mimo-ic").get_attribute("src")
            exigir(antes != despues and page.locator("#mimo-menu").count() == 0,
                   "mascota: anima sin abrir menú", fallas)
            exigir(page.locator("#pref-tema-claro option").count() == 5,
                   "ajustes: 5 temas claros", fallas)
            exigir(page.locator("#pref-tema-oscuro option").count() == 5,
                   "ajustes: 5 temas oscuros", fallas)
            exigir("Español" in page.locator("#pref-idioma").inner_text(),
                   "ajustes: idioma con bandera", fallas)

            page.locator("#sync-proveedor").select_option("webdav")
            page.wait_for_timeout(250)
            reg = page.locator("#sync-webdav-registro")
            exigir(reg.is_visible() and "nextcloud.com" in (reg.get_attribute("href") or "") and
                   reg.get_attribute("target") == "_blank",
                   "sync: ofrece crear cuenta de Nextcloud en otra pestaña", fallas)
            aire = page.evaluate("""() => {
              const q = s => document.querySelector(s);
              const c = getComputedStyle(q('#sync-card'));
              const cols = getComputedStyle(q('.sync-columnas'));
              const campo = getComputedStyle(q('.sync-campo'));
              const acc = getComputedStyle(q('.sync-acciones'));
              return {
                pad: parseFloat(c.paddingTop),
                colGap: parseFloat(cols.columnGap),
                campoGap: parseFloat(campo.marginBottom),
                accGap: parseFloat(acc.rowGap),
              };
            }""")
            exigir(aire["pad"] >= 20 and aire["colGap"] >= 24 and aire["campoGap"] >= 12 and aire["accGap"] >= 12,
                   f"sync: espaciado con aire — {aire}", fallas)
            columnas_sync = page.locator(".sync-columnas").evaluate(
                "e => getComputedStyle(e).gridTemplateColumns.split(' ').length")
            exigir(columnas_sync == 2, f"sync: conexión y cifrado en dos columnas — {columnas_sync}", fallas)

            page.locator("[data-editar-periodo]").first.click(); page.wait_for_timeout(150)
            page.locator("#periodo-nombre").fill("Primavera 2026 bis")
            page.locator("#periodo-semanas").fill("3")
            page.locator("#periodo-form button[type=submit]").click(); page.wait_for_timeout(150)
            d = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")
            exigir(d["periodos"][0]["nombre"] == "Primavera 2026 bis" and len(d["periodos"][0]["semanas"]) == 3,
                   f"periodo: editado a 3 semanas — {d['periodos'][0]['nombre']}, {len(d['periodos'][0]['semanas'])}", fallas)

            page.locator('#tabs [data-ir="tiempo"]').click(); page.wait_for_timeout(180)
            page.locator('[data-hijo="temporizador"]').click(); page.wait_for_timeout(180)
            ins = page.locator("#reloj .rlj")
            exigir(ins.count() == 3, f"reloj: 3 partes editables — {ins.count()}", fallas)
            for i, v in enumerate(["00", "02", "00"]):
                ins.nth(i).fill(v); ins.nth(i).press("Tab")
            page.wait_for_timeout(150)
            vals = [page.locator("#reloj .rlj").nth(i).input_value() for i in range(3)]
            exigir(vals == ["00", "02", "00"], f"reloj: queda en 00:02:00 — {vals}", fallas)

            page.locator('[data-hijo="alarmas"]').click(); page.wait_for_timeout(180)
            page.locator("#alarma-hora").fill("07:30")
            page.locator("#alarma-texto").fill("Desayuno")
            page.locator("#alarma-form button[type=submit]").click(); page.wait_for_timeout(180)
            page.locator("[data-alarma-editar]").first.click(); page.wait_for_timeout(120)
            page.locator("#alarma-hora").fill("08:00")
            page.locator("#alarma-texto").fill("Desayuno largo")
            page.locator("#alarma-form button[type=submit]").click(); page.wait_for_timeout(180)
            d = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")
            exigir(d["alarmas"][0]["hora"] == "08:00" and d["alarmas"][0]["texto"] == "Desayuno largo",
                   f"alarma: editada a 08:00 — {d['alarmas'][0]}", fallas)

            page.locator("[data-editar-sesion]").first.click(); page.wait_for_timeout(150)
            page.locator("#sesion-duracion").fill("1:30")
            page.locator("#sesion-form button[type=submit]").click(); page.wait_for_timeout(150)
            d = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")
            exigir(abs(d["sesiones"][0]["minutos"] - 90) < 0.01,
                   f"sesión: corregida a 90 min — {d['sesiones'][0]['minutos']}", fallas)

            page.locator("#tiempo-lista-sesiones .sesion-item").first.click(button="right")
            page.wait_for_timeout(120)
            exigir(page.locator("#menu-ctx").is_visible() and "Editar sesión" in page.locator("#menu-ctx").inner_text(),
                   "sesión: clic derecho ofrece Editar y Borrar", fallas)
            page.keyboard.press("Escape")

            page.locator('#tabs [data-ir="estudio"]').click(); page.wait_for_timeout(180)
            page.locator("#est-minutos").fill("2:30:21")
            page.locator("#est-form button[type=submit]").click(); page.wait_for_timeout(180)
            d = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")
            exigir(abs(d["sesiones"][-1]["minutos"] - 150.35) < 0.01,
                   f"estudio: 2:30:21 son 150,35 min — {d['sesiones'][-1]['minutos']}", fallas)

            page.locator('#tabs [data-ir="notas"]').click(); page.wait_for_timeout(180)
            page.locator("#btn-nueva-nota").click()
            page.locator("#nota-cuerpo").fill(
                "# Título\n\n## Subtítulo\n\nTexto **negrita**, *cursiva*, <u>subrayado</u> y `código`.\n\n"
                "- [ ] pendiente\n- [x] hecha\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n"
                "```python\nprint('hola')\n```\n\n<script>window.__mimoNota=1</script>\n\n"
                "Energía: $E=mc^2$\n\n$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$")
            page.locator("#nota-modo").click(); page.wait_for_timeout(500)
            exigir(page.locator("#nota-preview h1").count() == 1 and page.locator("#nota-preview h2").count() == 1,
                   "notas: títulos H1/H2 de Markdown", fallas)
            exigir(page.locator("#nota-preview table").count() == 1,
                   "notas: tabla GFM", fallas)
            exigir(page.locator("#nota-preview u").count() == 1,
                   "notas: subrayado con <u>", fallas)
            exigir(page.locator('#nota-preview input[type="checkbox"]').count() == 2,
                   "notas: lista de tareas", fallas)
            exigir(page.locator("#nota-preview pre code").count() == 1,
                   "notas: bloque de código", fallas)
            exigir(page.evaluate("window.__mimoNota") is None,
                   "notas: el HTML peligroso se sanea", fallas)
            exigir(page.locator("#nota-preview .katex").count() >= 2,
                   f"notas: 2 fórmulas KaTeX — {page.locator('#nota-preview .katex').count()}", fallas)
            exigir(page.locator("#nota-preview .katex-error").count() == 0,
                   "notas: sin fórmulas rotas", fallas)

            page.locator("#nota-modo").click(); page.wait_for_timeout(120)
            page.locator("#nota-cuerpo").fill("hola mundo")
            page.evaluate("""() => { const t = document.querySelector('#nota-cuerpo');
              t.focus(); t.setSelectionRange(0, 4); }""")
            page.locator('#nota-formato [data-formato="negrita"]').click(); page.wait_for_timeout(100)
            exigir(page.locator("#nota-cuerpo").input_value() == "**hola** mundo",
                   f"notas: botón negrita — {page.locator('#nota-cuerpo').input_value()!r}", fallas)
            page.set_viewport_size({"width": 411, "height": 900}); page.wait_for_timeout(150)
            desborde_notas = page.evaluate(
                "Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,"
                " document.body.scrollWidth - document.body.clientWidth)")
            exigir(desborde_notas == 0, f"notas: 411 sin desborde — {desborde_notas}px", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(250)
            desborde = page.evaluate(
                "Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,"
                " document.body.scrollWidth - document.body.clientWidth)")
            exigir(desborde == 0, f"sync: 411 sin desborde — {desborde}px", fallas)
            una_col = page.locator(".sync-columnas").evaluate(
                "e => getComputedStyle(e).gridTemplateColumns.split(' ').length")
            exigir(una_col == 1, f"sync: en móvil una columna — {una_col}", fallas)
            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"consola: sin pageerror — {errores[:2]}", fallas)

            with page.expect_download() as info:
                page.locator("#btn-exportar-tutorial").click()
            exigir(info.value.suggested_filename == "tutorial.json",
                   f"tutorial: descarga con nombre — {info.value.suggested_filename}", fallas)

            page.locator("#btn-reset-fabrica").click()
            page.wait_for_timeout(600)
            fabrica = page.evaluate("""() => {
              const e = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
              return {notas: (e.notas || []).length, tareas: (e.tareas || []).length,
                      cursos: (e.cursos || []).length};
            }""")
            exigir(fabrica["notas"] == 0 and fabrica["tareas"] == 0 and fabrica["cursos"] == 0,
                   f"fábrica: datos vacíos — {fabrica}", fallas)
        finally:
            ctx.close()
    fixture.unlink(missing_ok=True)
    return salir("gate-correcciones", fallas)


if __name__ == "__main__":
    sys.exit(main())
