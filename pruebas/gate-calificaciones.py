#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-calificaciones.py — U4b: notas por categoría, examen y eximición.

Mide el motor y la interfaz sobre app/index.html:
  1. sin ramos, Calificaciones lleva a Malla;
  2. presentación = promedio ponderado de categorías;
  3. examen al 40 % y al 50 % cambia la final;
  4. una condición de eximición cumplida usa la presentación;
  5. quitar un componente recalcula;
  6. activo, disponible e historial son estados distintos; por defecto solo activos;
  7. un disponible se añade desde el modal y un activo se retira sin borrar el ramo ni sus
     notas, con confirmación y deshacer;
  8. la nota final se edita en su propia caja (sin control aparte), manda sobre el cálculo, pasa
     al Historial sin duplicar y persiste al recargar; la escala 1.0–7.0 y el umbral 4.0 se
     explican;
  9. un curso sin nota de examen se puede cerrar con la presentación y reabrir;
 10. el clic derecho abre la ficha, Malla, edición, identidad, alta/retiro, cierre y borrado;
 11. el panel Detalle muestra el resumen del ramo;
 12. 411 sin desborde y consola limpia.

Uso: python3 pruebas/gate-calificaciones.py
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import abrir_plegable, Navegador, desborde, exigir, salir  # noqa: E402


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_ramo(page, codigo="MA1001", nombre="Cálculo I", creditos="6", activo=True) -> None:
    page.locator("#btn-nuevo-ramo").click()
    page.locator("#ramo-codigo").fill(codigo)
    page.locator("#ramo-nombre").fill(nombre)
    page.locator("#ramo-creditos").fill(creditos)
    if activo:
        page.locator("#ramo-curso").check()
    else:
        page.locator("#ramo-curso").uncheck()
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(150)


def cambiar(page, selector: str, valor: str) -> None:
    el = page.locator(selector)
    el.fill(valor)
    el.blur()
    page.wait_for_timeout(280)


def final_en_caja(page) -> str:
    return page.locator(".calif-caja--final [data-nota-final]").input_value()


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(100)
            exigir(page.locator("#calif-vacio").is_visible(), "calif: sin ramos muestra el vacío", fallas)
            page.locator("#calif-crear-ramo").click()
            page.wait_for_timeout(100)
            exigir(page.locator("#modal-editor").is_visible() and
                   page.locator("#modal-editor").get_attribute("data-editor") == "ramo",
                   "calif: el vacío lleva a crear el ramo", fallas)
            page.locator("#ramo-codigo").fill("MA1001")
            page.locator("#ramo-nombre").fill("Cálculo I")
            page.locator("#ramo-creditos").fill("6")
            page.locator("#ramo-curso").check()
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(150)

            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 1, "calif: el ramo aparece en la lista", fallas)
            exigir("activo" in page.locator(".calif-resumen").inner_text(),
                   "calif: sin notas el curso sigue activo", fallas)
            exigir("Escala 1.0–7.0" in page.locator("#calif-detalle").inner_text() and
                   "aprueba 4.0" in page.locator("#calif-detalle").inner_text(),
                   "calif: la escala 1.0–7.0 y el umbral 4.0 se explican", fallas)

            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            crear_ramo(page, "MA2001", "Álgebra", "6", activo=False)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator(".calif-item").count() == 1,
                   "calif: por defecto solo lista el ramo activo", fallas)

            abrir_plegable(page, '[data-accion-calif="comp-add"]')
            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nombre="0"]', "Control 1")
            cambiar(page, '[data-comp-nota="0"]', "5.0")
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.0",
                   "calif: presentación 5.0 con un control", fallas)

            page.locator('[data-accion-calif="cat-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-cat-nombre="1"]', "Tareas")
            cambiar(page, '[data-cat-peso="0"]', "50")
            cambiar(page, '[data-cat-peso="1"]', "50")
            abrir_plegable(page, '[data-accion-calif="comp-add"]')
            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nombre="1"]', "Tarea 1")
            page.locator('[data-comp-cat="1"]').select_option("Tareas")
            page.wait_for_timeout(200)
            cambiar(page, '[data-comp-nota="1"]', "6.0")
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.5",
                   "calif: presentación 5.5 con dos categorías", fallas)
            exigir("activo" in page.locator(".calif-resumen").inner_text(),
                   "calif: con examen pendiente el curso sigue activo", fallas)

            # Cerrar aunque falte la nota del examen: usa la presentación y no
            # deja el curso atrapado en abierto (R114).
            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso cerrado" in page.locator(".calif-cierre").inner_text()
                   and "APROBADO" in page.locator(".calif-cierre").inner_text(),
                   "calif: cierra sin nota de examen con la presentación", fallas)
            exigir("5.5" in page.locator(".calif-cierre").inner_text(),
                   "calif: el cierre sin examen guarda la presentación 5.5", fallas)
            page.locator('[data-accion-calif="reabrir-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso abierto" in page.locator(".calif-cierre").inner_text(),
                   "calif: el ramo reabierto se puede volver a cerrar", fallas)

            page.locator(".calif-item").first.click(button="right")
            page.wait_for_timeout(150)
            menu = page.locator("#menu-ctx").inner_text()
            exigir("Ver en Malla" in menu and "Editar ramo" in menu and "Cerrar curso" in menu,
                   "calif: el clic derecho ofrece abrir, editar y cerrar", fallas)
            page.locator('#menu-ctx [data-accion="calif-editar"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator("#modal-editor").is_visible() and
                   page.locator("#ramo-codigo").input_value() == "MA1001",
                   "calif: el menú contextual abre el ramo para editar", fallas)
            page.locator("#modal-editor-x").click()
            page.wait_for_timeout(120)

            abrir_plegable(page, "[data-exam-nota]")
            cambiar(page, "[data-exam-nota]", "6.0")
            exigir(final_en_caja(page) == "5.7",
                   "calif: final 5.7 con examen al 40 %", fallas)
            cambiar(page, "[data-exam-peso]", "50")
            exigir(final_en_caja(page) == "5.8",
                   "calif: final 5.8 con examen al 50 %", fallas)

            abrir_plegable(page, "[data-exim-activa]")
            page.locator("[data-exim-activa]").check()
            page.wait_for_timeout(200)
            page.locator('[data-accion-calif="cond-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-cond-valor="0"]', "5.5")
            exigir("ya te eximes" in page.locator(".calif-exim-estado").inner_text(),
                   "calif: la condición de eximición se cumple", fallas)
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.5",
                   "calif: eximido usa la presentación", fallas)

            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso cerrado" in page.locator(".calif-cierre").inner_text()
                   and "APROBADO" in page.locator(".calif-cierre").inner_text(),
                   "calif: cerrar con eximición deja el curso aprobado", fallas)
            exigir("5.5" in page.locator(".calif-cierre").inner_text(),
                   "calif: el cierre guarda la final 5.5", fallas)
            page.locator('[data-accion-calif="reabrir-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Curso abierto" in page.locator(".calif-cierre").inner_text(),
                   "calif: reabrir deja el curso abierto", fallas)
            page.locator("[data-exim-activa]").uncheck()
            page.wait_for_timeout(220)
            exigir(final_en_caja(page) == "5.8",
                   "calif: al desactivar la eximición vuelve el examen", fallas)

            cambiar(page, "[data-exam-nota]", "1.0")
            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("REPROBADO" in page.locator(".calif-cierre").inner_text(),
                   "calif: cerrar con final baja deja el curso reprobado", fallas)
            page.locator('[data-accion-calif="reabrir-curso"]').click()
            page.wait_for_timeout(250)
            cambiar(page, "[data-exam-nota]", "6.0")

            page.locator(".calif-item").first.click()
            page.wait_for_timeout(100)
            exigir(page.locator(".panel__tab.on").inner_text().strip() == "Detalle",
                   "calif: seleccionar el ramo abre Detalle", fallas)
            exigir("Presentación" in page.locator("#panel-cuerpo").inner_text(),
                   "calif: el panel Detalle muestra el resumen", fallas)

            page.locator('[data-accion-calif="comp-quitar"][data-i="1"]').click()
            page.wait_for_timeout(220)
            exigir(page.locator('[data-comp-nombre="1"]').count() == 0,
                   "calif: quitar un componente", fallas)
            exigir(page.locator(".calif-resumen").inner_text().split("\n")[0].strip() == "5.0",
                   "calif: al quitar el componente la presentación baja a 5.0", fallas)

            page.locator("#calif-layout").click(button="right", position={"x": 30, "y": 500})
            page.wait_for_timeout(150)
            exigir("Calificaciones" in page.locator("#menu-ctx").inner_text() and
                   "Nuevo ramo" in page.locator("#menu-ctx").inner_text(),
                   "calif: el clic derecho de la sección ofrece utilidades", fallas)
            page.keyboard.press("Escape")

            # Disponible no es activo: se distingue, se añade y se retira sin
            # borrar el ramo ni sus notas; el retiro se puede deshacer.
            page.locator('[data-calif-filtro="disponibles"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator(".calif-item").count() == 1 and
                   "disponible" in page.locator(".calif-item").first.inner_text(),
                   "calif: el ramo de la Malla sin cursar se ve como disponible", fallas)
            page.locator(".calif-item").first.click()
            page.wait_for_timeout(120)
            exigir(page.locator('[data-accion-calif="activar"]').count() == 1 and
                   not page.locator(".calif-resumen").is_visible(),
                   "calif: el disponible ofrece añadirlo, sin notas a la vista", fallas)
            page.locator('[data-accion-calif="activar"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 2,
                   "calif: añadir el disponible lo vuelve activo", fallas)
            antes_retiro = page.evaluate("""() => {
              const e = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              return {cursos: e.cursos.length, califs: Object.keys(e.califs).sort()};
            }""")
            page.locator('[data-accion-calif="retirar"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 1,
                   "calif: retirar saca el ramo de la lista", fallas)
            despues_retiro = page.evaluate("""() => {
              const e = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              const c = e.cursos.filter(x => x.codigo === 'MA2001')[0];
              return {cursos: e.cursos.length, sigue: !!c, enCurso: c && c.enCurso,
                      califs: Object.keys(e.califs).sort()};
            }""")
            exigir(despues_retiro["sigue"] and not despues_retiro["enCurso"] and
                   despues_retiro["cursos"] == antes_retiro["cursos"] and
                   despues_retiro["califs"] == antes_retiro["califs"],
                   f"calif: retirar no borra el ramo ni sus notas — {despues_retiro}", fallas)
            page.locator(".toast__accion").click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 2,
                   "calif: deshacer devuelve el ramo retirado", fallas)

            page.locator('[data-accion-calif="retirar"]').click()
            page.wait_for_timeout(250)
            page.locator("#calif-anadir").click()
            page.wait_for_timeout(150)
            exigir(page.locator("#modal-editor").is_visible() and
                   page.locator("[data-calif-add]").count() == 1,
                   "calif: el modal de añadir lista los disponibles", fallas)
            page.locator("[data-calif-add]").click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 2 and
                   not page.locator("#modal-editor").is_visible(),
                   "calif: añadir desde el modal vuelve a activar el ramo", fallas)

            # La nota final se puede fijar a mano, cerrar y ver en Historial;
            # al recargar sigue ahí y no se duplica.
            page.locator('.calif-item', has_text="MA1001").click()
            page.wait_for_timeout(120)
            editable = page.locator(".calif-caja--final [data-nota-final]")
            exigir(editable.count() == 1 and
                   page.locator(".calif-ajustes [data-nota-final]").count() == 0,
                   "calif: la final se edita en su propia caja, sin control aparte", fallas)
            editable.fill("6.5")
            editable.press("Enter")
            page.wait_for_timeout(300)
            exigir(page.locator(".calif-caja--final [data-nota-final]").input_value() == "6.5",
                   "calif: la nota final manual manda sobre el cálculo", fallas)
            page.locator('[data-accion-calif="cerrar-curso"]').click()
            page.wait_for_timeout(250)
            exigir("Final 6.5" in page.locator(".calif-cierre").inner_text() and
                   "6.5" in page.locator(".calif-item").first.inner_text(),
                   "calif: la final manual pasa al Historial", fallas)
            registro = page.evaluate("""() => {
              const e = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              const c = e.cursos.filter(x => x.codigo === 'MA1001')[0];
              return {cursos: e.cursos.length, notaCierre: c.notaCierre,
                      manual: e.califs.MA1001.notaFinalManual};
            }""")
            exigir(registro["notaCierre"] == 6.5 and registro["manual"] == 6.5 and
                   registro["cursos"] == 2,
                   f"calif: la final se guarda una sola vez — {registro}", fallas)
            limpia = page.url.split("?")[0]
            page.goto(limpia, wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(200)
            page.locator('[data-calif-filtro="historial"]').click()
            page.wait_for_timeout(180)
            exigir(page.locator(".calif-item").count() == 1 and
                   "Final 6.5" in page.locator(".calif-item").first.inner_text(),
                   "calif: Historial conserva la final al reabrir", fallas)

            # Un ramo fuera de la Malla no es un ramo activo: deja de listarse.
            page.evaluate("""() => {
              const k = 'mimo.shell.v1';
              const e = JSON.parse(localStorage.getItem(k));
              e.cursos.forEach(c => { c.enMalla = false; });
              localStorage.setItem(k, JSON.stringify(e));
            }""")
            limpia = page.url.split("?")[0]
            page.goto(limpia, wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".calif-item").count() == 0 and page.locator("#calif-vacio").is_visible(),
                   "calif: solo lista ramos activos de la Malla", fallas)
            exigir(not errores, f"calif: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            instalar_academics(page)
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(100)
            crear_ramo(page)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(200)
            abrir_plegable(page, '[data-accion-calif="comp-add"]')
            page.locator('[data-accion-calif="comp-add"]').click()
            page.wait_for_timeout(150)
            cambiar(page, '[data-comp-nota="0"]', "5.0")
            d = desborde(page)
            exigir(d == 0, f"411: calificaciones sin desborde — {d}px", fallas)
            exigir(page.locator(".calif-card").count() == 1, "411: el detalle se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-calificaciones", fallas)


if __name__ == "__main__":
    sys.exit(main())
