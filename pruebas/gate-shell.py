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
  7. 10 temas y cambio de tema
  8. 411 sin desborde

Uso: python3 pruebas/gate-shell.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
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
            columnas_cal = page.evaluate(
                "getComputedStyle(document.querySelector('.cal-layout')).gridTemplateColumns.split(' ').length")
            exigir(columnas_cal >= 2,
                   f"calendario: rail y calendario en dos columnas — {columnas_cal}", fallas)
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

            # Acciones universales: clic derecho y borrado.
            exigir(page.locator("#btn-borrar-nota").is_enabled(),
                   "acciones: la nota abierta ofrece Borrar en el editor", fallas)
            page.locator("#notas-items .nota-item").first.click(button="right")
            page.wait_for_timeout(80)
            exigir(page.locator("#menu-ctx").is_visible() and "Borrar nota" in page.locator("#menu-ctx").inner_text(),
                   "acciones: clic derecho en la nota abre su menú", fallas)
            page.once("dialog", lambda d: d.accept())
            page.locator('#menu-ctx [data-accion="nota-borrar"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#notas-items .nota-item").count() == 0,
                   "notas: borrar quita la nota de la lista", fallas)
            exigir(page.locator("#notas-vacio").is_visible() and not page.locator("#btn-borrar-nota").is_enabled(),
                   "notas: sin nota, vuelve el vacío y Borrar se deshabilita", fallas)

            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "panel: recuerda Detalle al volver a Tareas", fallas)

            page.locator("#btn-ajustes").click()
            page.wait_for_timeout(80)
            exigir(page.locator("#temas .tema").count() == 10, "ajustes: 10 temas", fallas)
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
            exigir(page.locator("#modal-split").evaluate("e => e.classList.contains('on')"),
                   "split: el diálogo de dos secciones se abre", fallas)
            page.locator("#split-izq").select_option("notas")
            page.locator("#split-der").select_option("tareas")
            page.locator("#split-abrir").click()
            page.wait_for_timeout(150)
            exigir(page.locator("#contenido-b").is_visible(), "split: la ventana secundaria se abre", fallas)
            exigir(page.locator("#contenido-b #p-tareas").is_visible() and
                   page.locator("#contenido #p-notas").is_visible(),
                   "split: dos secciones completas, una en cada ventana", fallas)
            page.locator("#split-seccion").select_option("calendario")
            page.wait_for_timeout(100)
            exigir(page.locator("#contenido-b #p-calendario").is_visible(),
                   "split: la sección elegida se pinta completa", fallas)
            page.locator("#split-seccion").select_option("tareas")
            page.wait_for_timeout(100)
            exigir(page.locator("#contenido-b #p-tareas [data-tarea]").count() >= 1,
                   "split: la sección secundaria es interactiva", fallas)
            page.locator("#contenido-b #p-tareas [data-tarea]").first.click()
            page.wait_for_timeout(100)
            exigir("Tarea" in page.locator("#panel-cuerpo").inner_text(),
                   "split: la interacción de la derecha abre su detalle", fallas)
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

            # Lo que se añade también se quita: evento, tarea y periodo.
            page.locator('#tabs .tab[data-ir="calendario"]').click()
            page.wait_for_timeout(80)
            page.locator(".evento-chip").first.click(button="right")
            page.wait_for_timeout(80)
            exigir("Borrar evento" in page.locator("#menu-ctx").inner_text(),
                   "acciones: el evento ofrece borrar", fallas)
            page.once("dialog", lambda d: d.accept())
            page.locator('#menu-ctx [data-accion="evento-borrar"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".evento-chip").count() == 0, "eventos: borrar quita el evento", fallas)

            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            page.locator(".tarea-fila", has_text="Preparar la reunión del lunes").click(button="right")
            page.wait_for_timeout(80)
            exigir("Borrar tarea" in page.locator("#menu-ctx").inner_text(),
                   "acciones: la tarea ofrece borrar", fallas)
            page.once("dialog", lambda d: d.accept())
            page.locator('#menu-ctx [data-accion="tarea-borrar"]').click()
            page.wait_for_timeout(120)
            exigir("Preparar la reunión del lunes" not in page.locator("#tareas-lista").inner_text(),
                   "tareas: borrar quita la tarea", fallas)

            page.locator("#btn-periodo").click()
            page.wait_for_timeout(80)
            page.locator("#periodos-lista .periodo-item").first.click(button="right")
            page.wait_for_timeout(80)
            exigir("Borrar periodo" in page.locator("#menu-ctx").inner_text(),
                   "acciones: el periodo ofrece borrar", fallas)
            page.once("dialog", lambda d: d.accept())
            page.locator('#menu-ctx [data-accion="periodo-borrar"]').click()
            page.wait_for_timeout(120)
            exigir("Todavía no hay periodos" in page.locator("#periodos-lista").inner_text()
                   and "Sin periodo" in page.locator("#btn-periodo").inner_text(),
                   "periodos: borrar deja la app sin periodo activo", fallas)
            page.locator("#periodo-x").click()

            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(80)
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(1100)
            page.locator("#btn-parar").click()
            page.wait_for_timeout(120)
            exigir(page.locator(".sesion-item").count() == 1,
                   "tiempo: la sesión registrada se lista y se puede quitar", fallas)
            page.locator(".sesion-item").first.click(button="right")
            page.wait_for_timeout(80)
            page.once("dialog", lambda d: d.accept())
            page.locator('#menu-ctx [data-accion="sesion-borrar"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator(".sesion-item").count() == 0, "tiempo: borrar quita la sesión", fallas)
            exigir(not errores, f"consola limpia al final — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            page.locator('#tabs .tab[data-ir="tareas"]').click()
            page.wait_for_timeout(80)
            d = desborde(page)
            exigir(d == 0, f"411: sin desborde en Tareas — {d}px", fallas)
            page.locator('#tabs .tab[data-ir="notas"]').click()
            page.locator("#btn-nueva-nota").click()
            page.locator("#nota-titulo").fill("Nota móvil")
            page.wait_for_timeout(100)
            page.locator("#notas-items .nota-item").first.click(button="right")
            page.wait_for_timeout(80)
            caja = page.locator("#menu-ctx").bounding_box()
            exigir(bool(caja) and caja["x"] >= 0 and caja["x"] + caja["width"] <= 411,
                   f"411: el menú de acciones cabe en la ventana — {caja}", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-shell", fallas)


if __name__ == "__main__":
    sys.exit(main())
