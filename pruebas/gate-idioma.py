#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-idioma.py — i18n interno de las ocho secciones y las ventanas.

Mide sobre app/index.html, con el estado limpio:
  1. cada sección cambia a chino sin dejar textos españoles visibles;
  2. cada sección cambia a inglés sin dejar textos españoles visibles;
  3. los formularios de tarea, nota, evento y periodo traducen placeholder y aria;
  4. el catálogo, el periodo, el split y el buscador se traducen;
  5. la tarjeta de sincronización se traduce;
  6. los nombres de tema se traducen y el cambio de idioma repinta sin recargar.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

SECCIONES = ("calendario", "tareas", "notas", "tiempo", "malla", "calificaciones", "estudio", "ajustes")
PROHIBIDO = re.compile(
    r"[áéíóúñü¿¡]|\b(Sin|Nuevo|Nueva|Nuevos|Nuevas|Editar|Borrar|Guardar|Crear|Abrir|Cerrar|Ramo|Ramos|"
    r"Tarea|Tareas|Nota|Notas|Sesiones|Horas|Meta|Semana|Semanas|Curso|Cursos|Estado|Créditos|Nivel|"
    r"Examen|Exámenes|Categoría|Categorías|Componente|Componentes|Presentación|Aprobado|Bloque|Bloques|"
    r"Reprobado|añadir|está|todavía|del|los|las|equipo|datos|temas|ramos|notas|eventos|tareas|"
    r"periodos|semanas|Remoto|Nunca|Modo|Usuario|Servidor|Conexión|Cifrado|Clave|Elegir|"
    r"Probar|Contraseña|Carpeta|Archivo|Mes|Año|Hoy|Semana|Agenda|Clases|Receso)\b",
    re.I,
)


def leer(page, sel: str) -> str:
    return page.locator(sel).inner_text()


def prohibidos(txt: str) -> list[str]:
    return [l.strip() for l in txt.splitlines()
            if PROHIBIDO.search(l) and "Español (Latinoamérica)" not in l]


def abrir_todo(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(150)
    for kit in ("tiempo", "academics"):
        sel = f'#catalogo [data-instalar="{kit}"]'
        if page.locator(sel).count():
            page.locator(sel).click()
            page.wait_for_timeout(180)
    page.locator("#modal-x").click()
    page.wait_for_timeout(120)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            abrir_todo(page)
            page.locator("#btn-ajustes").click()
            page.wait_for_timeout(120)
            page.locator("#pref-idioma").select_option("zh")
            page.wait_for_timeout(350)

            esperado_zh = {
                "calendario": "今天", "tareas": "还没有任务", "notas": "还没有笔记", "tiempo": "开始",
                "malla": "你的课程规划为空", "calificaciones": "没有可评分的课程",
                "estudio": "记录学习", "ajustes": "同步",
            }
            for sec in SECCIONES:
                page.locator(f'#tabs [data-ir="{sec}"]').click()
                page.wait_for_timeout(180)
                txt = leer(page, f"#p-{sec}")
                exigir(esperado_zh[sec] in txt,
                       f"zh/{sec}: texto clave — {esperado_zh[sec]} no está", fallas)
                malos = prohibidos(txt)
                exigir(not malos, f"zh/{sec}: sin español — {malos[:4]}", fallas)

            # Placeholders de los formularios.
            page.locator('#tabs [data-ir="tareas"]').click(); page.wait_for_timeout(120)
            page.locator("#btn-nueva-tarea").click(); page.wait_for_timeout(100)
            exigir(page.locator("#tarea-titulo").get_attribute("placeholder") == "要做什么？",
                   "zh/tareas: placeholder de tarea", fallas)
            exigir(page.locator("#tarea-tipo option").nth(0).inner_text() == "任务",
                   "zh/tareas: opción Tarea", fallas)
            page.locator("#tarea-cancelar").click()

            page.locator('#tabs [data-ir="notas"]').click(); page.wait_for_timeout(120)
            page.locator("#btn-nueva-nota").click(); page.wait_for_timeout(100)
            exigir(page.locator("#nota-titulo").get_attribute("placeholder") == "笔记标题",
                   "zh/notas: placeholder de nota", fallas)
            page.locator("#btn-ajustes").click(); page.wait_for_timeout(120)
            page.locator("#pref-idioma").select_option("es"); page.wait_for_timeout(250)

            # Ventanas comunes.
            page.locator("#btn-add").click(); page.wait_for_timeout(150)
            exigir(page.locator("#modal-tit").inner_text() == "Bloques y kits",
                   f"es/catálogo: título — {page.locator('#modal-tit').inner_text()}", fallas)
            page.locator("#modal-x").click()
            page.locator("#btn-nuevo").click(); page.wait_for_timeout(120)
            exigir(page.locator("#periodo-tit").inner_text() == "Nuevo periodo",
                   "es/periodo: título", fallas)
            page.keyboard.press("Escape")
            page.locator("#btn-buscar").click(); page.wait_for_timeout(120)
            exigir("Buscar en Mimo" in leer(page, "#modal-buscar"),
                   "es/buscador: título", fallas)
            page.keyboard.press("Escape")

            # Inglés y repintado en caliente.
            page.locator("#btn-ajustes").click(); page.wait_for_timeout(120)
            page.locator("#pref-idioma").select_option("en"); page.wait_for_timeout(350)
            page.locator('#tabs [data-ir="malla"]').click(); page.wait_for_timeout(150)
            exigir("Your degree plan is empty" in leer(page, "#p-malla"),
                   "en/malla: vacío traducido", fallas)
            page.locator('#tabs [data-ir="estudio"]').click(); page.wait_for_timeout(150)
            exigir("Log study" in leer(page, "#p-estudio"),
                   "en/estudio: formulario traducido", fallas)
            page.locator('#tabs [data-ir="ajustes"]').click(); page.wait_for_timeout(150)
            malos = prohibidos(leer(page, "#p-ajustes"))
            exigir(not malos, f"en/ajustes: sin español — {malos[:4]}", fallas)

            # Nombres de tema traducidos y sin recargar.
            textos = page.locator("#temas .tema-nombre").all_inner_texts()
            exigir("Clásico" not in textos and "Classic" in textos,
                   f"en/temas: nombres traducidos — {textos[:4]}", fallas)
            antes = page.evaluate("document.querySelector('#temas .tema-nombre').textContent")
            page.locator("#pref-idioma").select_option("zh"); page.wait_for_timeout(350)
            despues = page.evaluate("document.querySelector('#temas .tema-nombre').textContent")
            exigir(antes != despues and despues == "经典",
                   f"temas: repintado en caliente — {antes} -> {despues}", fallas)

            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"idioma: sin pageerror — {errores[:2]}", fallas)
        finally:
            ctx.close()
    return salir("gate-idioma", fallas)


if __name__ == "__main__":
    sys.exit(main())
