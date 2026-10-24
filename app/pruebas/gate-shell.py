#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-shell.py — G-UI de la app M11/M12, sobre app/index.html.

No mide la maqueta: mide el armazón real.
  1. base 4 en orden y 0 errores de consola
  2. instalar Tiempo, 4 bloques dentro, quitar uno y el padre sigue
  3. instalar/quitar el kit Academics sin dejar pestañas huérfanas
  4. crear tarea, seleccionarla y ver Detalle en el panel
  5. crear nota y verla en la lista y en el panel Notas
  6. el panel recuerda la pestaña por sección
  7. 9 temas y cambio de tema
  8. 411 sin desborde

Uso: python3 app/pruebas/gate-shell.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            tabs = [t.get_attribute("title") for t in page.locator("#tabs .tab").all()]
            exigir(tabs[:3] == ["Calendario", "Tareas", "Notas"] and tabs[-1] == "Ajustes",
                   f"base 4 en orden — {tabs}", fallas)
            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)

            page.locator("#btn-nuevo").click()
            page.locator("#periodo-nombre").fill("Primavera 2026")
            page.locator("#periodo-inicio").fill("2026-08-03")
            page.locator('#periodo-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir("Primavera 2026" in page.locator("#btn-periodo").inner_text(),
                   "periodo: + Nuevo define el periodo activo", fallas)

            # U1: un evento real, en mes, semana y agenda.
            hoy = page.evaluate("() => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }")
            page.locator("#btn-nuevo-evento").click()
            page.locator("#evento-titulo").fill("Reunión de equipo")
            page.locator("#evento-fecha").fill(hoy)
            page.locator("#evento-hora").fill("10:00")
            page.locator("#evento-contexto").fill("Proyecto")
            page.locator('#evento-form button[type="submit"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".evento-chip").count() >= 1, "calendario: el evento aparece en el mes", fallas)
            exigir(page.locator("#cal-cuenta").inner_text().find("1 evento") >= 0, "calendario: la cuenta sube a 1", fallas)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle", "calendario: el evento seleccionado va a Detalle", fallas)
            page.locator('[data-cal-vista="semana"]').click()
            page.wait_for_timeout(80)
            exigir(page.locator(".cal-semana-dia").count() == 7, "calendario: la semana tiene 7 días", fallas)
            page.locator('[data-cal-vista="agenda"]').click()
            page.wait_for_timeout(80)
            exigir(page.locator(".cal-agenda__item").count() == 1, "calendario: la agenda lista el evento", fallas)
            page.locator('[data-cal-vista="mes"]').click()
            page.wait_for_timeout(80)

            page.locator("#btn-add").click()
            page.wait_for_timeout(120)
            page.locator(".bcard", has_text="Tiempo").locator("button", has_text="Instalar").click()
            page.wait_for_timeout(120)
            page.locator("#modal-x").click()
            page.wait_for_timeout(80)
            exigir("Tiempo" in [t.get_attribute("title") for t in page.locator("#tabs .tab").all()],
                   "Tiempo instalado aparece en la barra", fallas)
            exigir(page.locator(".tiempo-barra #estanteria-tiempo").count() == 1,
                   "Tiempo: la estantería de modos vive arriba", fallas)
            exigir(page.locator("#estanteria-tiempo [data-hijo]").count() == 4,
                   "Tiempo: 4 bloques dentro", fallas)
            page.locator("#btn-editar-tiempo").click()
            page.wait_for_timeout(60)
            page.locator("#estanteria-tiempo [data-quitar-hijo]").first.click()
            page.wait_for_timeout(80)
            exigir(page.locator("#estanteria-tiempo [data-hijo]").count() == 3,
                   "Tiempo: quitar un hijo deja 3", fallas)
            exigir("Tiempo" in [t.get_attribute("title") for t in page.locator("#tabs .tab").all()],
                   "Tiempo: el padre sigue tras quitar el hijo", fallas)

            page.locator("#btn-add").click()
            page.wait_for_timeout(120)
            page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
            page.wait_for_timeout(120)
            page.locator("#modal-x").click()
            page.wait_for_timeout(80)
            tabs = [t.get_attribute("title") for t in page.locator("#tabs .tab").all()]
            exigir(all(x in tabs for x in ("Malla", "Calificaciones", "Estudio")),
                   f"kit: instala Malla, Calificaciones y Estudio — {tabs}", fallas)
            page.locator("#btn-add").click()
            page.wait_for_timeout(120)
            page.locator(".bcard", has_text="Academics").locator("button", has_text="Quitar kit").click()
            page.wait_for_timeout(120)
            page.locator("#modal-x").click()
            page.wait_for_timeout(80)
            tabs = [t.get_attribute("title") for t in page.locator("#tabs .tab").all()]
            exigir(not any(x in tabs for x in ("Malla", "Calificaciones", "Estudio")),
                   f"kit: quitarlo no deja huérfanas — {tabs}", fallas)
            exigir("Tiempo" in tabs, "kit: quitar Academics no toca Tiempo", fallas)

            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            page.locator("#btn-nueva-tarea").click()
            page.locator("#tarea-titulo").fill("Preparar la reunión del lunes")
            page.locator('#tarea-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator(".tarea-fila").count() == 1, "tareas: crear una tarea", fallas)
            page.locator(".tarea-fila").first.click()
            page.wait_for_timeout(80)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "tareas: seleccionar cambia el panel a Detalle", fallas)

            # Proyecto = tarea raíz con subtareas; el progreso se deriva.
            page.locator("#btn-nueva-tarea").click()
            page.locator("#tarea-titulo").fill("Proyecto web")
            page.locator("#tarea-tipo").select_option("proyecto")
            page.locator("#tarea-fecha").fill("2026-10-30")
            page.locator('#tarea-form button[type="submit"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".tarea-fila").count() >= 2, "tareas: crear un proyecto raíz", fallas)
            exigir(page.locator('[data-vista="arbol"]').get_attribute("class").find("on") >= 0,
                   "tareas: después de crear, la vista Árbol muestra el proyecto", fallas)
            page.locator(".tarea-fila", has_text="Proyecto web").locator("[data-add-sub]").click()
            page.locator("#tarea-titulo").fill("Diseñar portada")
            page.locator('#tarea-form button[type="submit"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".tarea-fila").count() >= 3, "tareas: añadir una subtarea dentro del proyecto", fallas)
            page.locator(".tarea-fila", has_text="Diseñar portada").locator("[data-check]").click()
            page.wait_for_timeout(100)
            page.locator(".tarea-fila", has_text="Proyecto web").click()
            page.wait_for_timeout(100)
            exigir("100 %" in page.locator("#panel-cuerpo").inner_text() or "1 de 1" in page.locator("#panel-cuerpo").inner_text(),
                   "tareas: el progreso del proyecto se deriva de la subtarea", fallas)
            page.locator("#panel-cuerpo [data-editar-tarea]").click()
            page.wait_for_timeout(80)
            page.locator("#tarea-titulo").fill("Rediseño del sitio v2")
            page.locator('#tarea-form button[type="submit"]').click()
            page.wait_for_timeout(100)
            exigir("Rediseño del sitio v2" in page.locator("#tareas-lista").inner_text(),
                   "tareas: editar el proyecto conserva su lugar", fallas)
            page.locator('[data-vista="tablero"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator(".tablero-col").count() == 3, "tareas: el tablero tiene 3 columnas", fallas)
            exigir(page.locator(".tarjeta-tarea").count() >= 1, "tareas: el tablero pinta tarjetas", fallas)
            page.locator('[data-vista="arbol"]').click()
            page.wait_for_timeout(80)

            page.locator('#tabs .tab[data-ir="notas"]').click()
            page.wait_for_timeout(80)
            page.locator("#btn-nueva-nota").click()
            page.locator("#nota-titulo").fill("Idea para la demo")
            page.locator("#nota-cuerpo").fill("# Idea\n**Enseñar** la base 4 y el panel de 4.")
            page.wait_for_timeout(120)
            page.locator("#nota-modo").click()
            page.wait_for_timeout(80)
            exigir(page.locator("#nota-preview h1").count() == 1 and page.locator("#nota-preview strong").count() == 1,
                   "notas: Markdown se previsualiza", fallas)
            page.locator("#nota-modo").click()
            page.locator("#nota-contexto").fill("Proyecto web")
            page.locator("#nota-etiquetas").fill("demo, idea")
            page.locator("#nota-fijar").click()
            page.wait_for_timeout(80)
            exigir("★" in page.locator("#notas-items").inner_text(), "notas: fijar la nota", fallas)
            page.locator("#buscar-nota").fill("idea")
            page.wait_for_timeout(80)
            exigir("Idea para la demo" in page.locator("#notas-items").inner_text(), "notas: buscar por etiqueta", fallas)
            page.locator("#buscar-nota").fill("")
            page.wait_for_timeout(80)
            exigir("Idea para la demo" in page.locator("#notas-items").inner_text(),
                   "notas: la nota aparece en la lista", fallas)
            page.locator('.panel__tab[data-ptab="notas"]').click()
            page.wait_for_timeout(80)
            exigir("Idea para la demo" in page.locator("#panel-cuerpo").inner_text(),
                   "notas: el panel Notas muestra la nota abierta", fallas)

            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "panel: recuerda Detalle al volver a Tareas", fallas)

            page.locator("#btn-ajustes").click()
            page.wait_for_timeout(80)
            exigir(page.locator("#temas .tema").count() == 9, "ajustes: 9 temas", fallas)
            page.locator('#temas .tema[data-tema="deepsea"]').click()
            page.wait_for_timeout(80)
            exigir(page.locator("body").get_attribute("data-tema") == "deepsea",
                   "ajustes: el tema se aplica al body", fallas)
            exigir(page.locator(".ajustes-grid .card").count() >= 10,
                   "ajustes: 10+ tarjetas con contenido", fallas)
            page.locator("#pref-idioma").select_option("en")
            page.wait_for_timeout(80)
            exigir(page.locator('#tabs .tab[data-ir="calendario"]').get_attribute("title") == "Calendar",
                   "i18n: las pestañas cambian a inglés", fallas)
            page.locator("#pref-nav").select_option("izquierda")
            page.wait_for_timeout(80)
            exigir("nav-izq" in (page.locator("body").get_attribute("class") or ""),
                   "navegación: la barra pasa a rail izquierdo", fallas)
            page.locator("#pref-nav").select_option("arriba")
            page.locator("#pref-idioma").select_option("es")
            page.wait_for_timeout(80)
            page.locator("#btn-split").click()
            page.wait_for_timeout(80)
            exigir(page.locator("#contenido-b").is_visible(), "split: la ventana secundaria se abre", fallas)
            page.locator("#split-seccion").select_option("calendario")
            page.wait_for_timeout(80)
            exigir(page.locator("#split-cuerpo").inner_text().strip() != "",
                   "split: la sección elegida se pinta", fallas)
            page.locator("#btn-cerrar-split").click()
            page.wait_for_timeout(60)
            exigir(page.locator(".footer").is_visible(), "geometría: el pie es visible", fallas)
            page.locator("#btn-panel").click()
            page.wait_for_timeout(80)
            exigir(not page.locator(".panel").is_visible(), "geometría: el panel se oculta sin mover el pie", fallas)
            page.locator("#btn-panel").click()
            page.wait_for_timeout(80)
            exigir(page.locator(".panel").is_visible(), "geometría: el panel vuelve", fallas)
            exigir(page.locator(".footer").is_visible(), "geometría: el pie sigue visible", fallas)
            exigir(not errores, f"consola limpia al final — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            d = desborde(page)
            exigir(d == 0, f"411: sin desborde en Tareas — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-shell", fallas)


if __name__ == "__main__":
    sys.exit(main())
