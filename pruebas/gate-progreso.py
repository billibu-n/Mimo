#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-progreso.py — el bloque Progreso de punta a punta.

Mide lo que el bloque promete:
  1. se instala y se ve el vacío, con cuatro KPI y sin errores;
  2. una meta diaria acumulada registra rápido y el anillo/panel acompañan;
  3. una meta única de mejor marca acepta un registro exacto y muestra el avance;
  4. una meta semanal se puede alimentar de las sesiones de Estudio, y al quitar
     Academics deja de contar sin borrar la meta ni sus datos;
  5. el vínculo con Tareas es de ida y vuelta: la tarjeta muestra el número, el
     panel de la tarea lo abre y el botón Registrar vuelve a Progreso;
  6. editar, archivar, restaurar, eliminar y deshacer funcionan;
  7. el buscador encuentra la meta y la abre;
  8. a 411 px no hay desborde y el modal cabe.
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


def sembrar(page, estado: dict) -> None:
    page.evaluate("""(estado) => {
      localStorage.setItem('mimo.shell.v1', JSON.stringify(estado));
    }""", estado)
    page.goto(APP.as_uri(), wait_until="load")
    page.wait_for_timeout(250)


def ir(page, seccion: str) -> None:
    page.locator(f'#tabs [data-ir="{seccion}"]').click()
    page.wait_for_timeout(220)


def crear_meta(page, nombre: str, unidad: str, objetivo: str, *, tipo="suma",
               sentido="subir", periodo="dia", paso="1", decimales="1",
               inicio=None, fuente=None, tarea=False) -> None:
    page.locator("#prog-nueva").click()
    page.wait_for_timeout(120)
    page.locator("#prog-f-nombre").fill(nombre)
    page.locator("#prog-f-unidad").fill(unidad)
    page.locator("#prog-f-objetivo").fill(objetivo)
    page.locator("#prog-f-paso").fill(paso)
    page.locator("#prog-f-tipo").select_option(tipo)
    page.locator("#prog-f-sentido").select_option(sentido)
    page.locator("#prog-f-periodo").select_option(periodo)
    page.locator("#prog-f-decimales").select_option(decimales)
    if inicio is not None:
        page.locator("#prog-f-inicio").fill(inicio)
    if fuente:
        page.locator("#prog-f-fuente").select_option(fuente)
    if tarea:
        page.locator("#prog-f-tarea").select_option(index=1)
    page.locator("#prog-guardar").click()
    page.wait_for_timeout(260)


def tarjeta(page, nombre: str):
    return page.locator(".prog-card", has_text=nombre)


def crear_tarea(page, titulo: str) -> None:
    ir(page, "tareas")
    page.locator("#btn-nueva-tarea").click()
    page.wait_for_timeout(120)
    page.locator("#tarea-titulo").fill(titulo)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(260)


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            # 1. instalación y vacío
            sembrar(page, {"instalados": ["progreso"]})
            exigir(page.locator('#tabs [data-ir="progreso"]').count() == 1,
                   "bloque: Progreso aparece en la barra al instalarlo", fallas)
            ir(page, "progreso")
            exigir(page.locator("#prog-vacio").is_visible(), "vacío: sin metas se ve el vacío", fallas)
            exigir(page.locator("#prog-kpis .kpi").count() == 4, "vacío: cuatro KPI", fallas)

            # 2. meta diaria acumulada + registro rápido + panel
            crear_meta(page, "Agua", "L", "2", paso="0.25", decimales="2")
            exigir(page.locator(".prog-card").count() == 1, "agua: la meta se crea", fallas)
            exigir("Agua" in tarjeta(page, "Agua").inner_text(), "agua: la tarjeta lleva el nombre", fallas)
            tarjeta(page, "Agua").locator("[data-prog-add]").first.click()
            page.wait_for_timeout(200)
            tarjeta(page, "Agua").locator("[data-prog-add]").first.click()
            page.wait_for_timeout(200)
            exigir("0,5 / 2 L" in tarjeta(page, "Agua").locator(".prog-num").inner_text(),
                   "agua: dos toques de 0,25 suman 0,5", fallas)
            exigir(tarjeta(page, "Agua").locator(".prog-ring__txt").text_content() == "25%",
                   "agua: el anillo va en 25 %", fallas)
            tarjeta(page, "Agua").locator("h3").click()
            page.wait_for_timeout(260)
            exigir(page.locator("#panel-cuerpo h3").inner_text() == "Agua",
                   "panel: el detalle muestra Agua", fallas)
            exigir("Racha" in page.locator("#panel-cuerpo").inner_text(),
                   "panel: el detalle muestra la racha", fallas)
            exigir(page.locator("#panel-cuerpo .prog-chart svg").count() == 1,
                   "panel: el detalle pinta un gráfico", fallas)

            # 3. meta única de mejor marca
            crear_meta(page, "Press banca", "kg", "50", tipo="mejor", periodo="unica",
                       paso="2.5", decimales="1", inicio="30")
            exigir(page.locator(".prog-card").count() == 2, "banca: la segunda meta se crea", fallas)
            tarjeta(page, "Press banca").locator("[data-prog-reg]").first.click()
            page.wait_for_timeout(140)
            page.locator("#prog-r-valor").fill("40")
            page.locator("#prog-registrar").click()
            page.wait_for_timeout(260)
            exigir("40 / 50 kg" in tarjeta(page, "Press banca").locator(".prog-num").inner_text(),
                   "banca: registrar 40 deja 40 / 50 kg", fallas)
            exigir("faltan 10 kg" in tarjeta(page, "Press banca").locator(".resto").inner_text(),
                   "banca: faltan 10 kg", fallas)

            # 4. vínculo con Tareas
            crear_tarea(page, "Entrenar press banca")
            ir(page, "progreso")
            page.locator(".prog-card", has_text="Press banca").locator("[data-prog-edit]").click()
            page.wait_for_timeout(140)
            page.locator("#prog-f-tarea").select_option(index=1)
            page.locator("#prog-guardar").click()
            page.wait_for_timeout(260)
            ir(page, "tareas")
            exigir("40/50" in page.locator(".tarjeta-tarea .tarea-prog").first.inner_text(),
                   "tareas: la tarjeta muestra 40/50", fallas)
            page.locator(".tarjeta-tarea .tarjeta-cuerpo b").first.click()
            page.wait_for_timeout(300)
            panel = page.locator("#panel-cuerpo").inner_text()
            exigir("Progreso" in panel and "Press banca" in panel,
                   "tareas: el detalle de la tarea muestra la meta", fallas)
            exigir(page.locator("#panel-cuerpo [data-progreso-reg]").count() == 1,
                   "tareas: el detalle ofrece Registrar", fallas)
            page.locator("#panel-cuerpo [data-progreso-reg]").click()
            page.wait_for_timeout(300)
            exigir(page.locator("#p-progreso").is_visible(), "tareas: Registrar vuelve a Progreso", fallas)
            exigir(page.locator("#prog-modal-reg").is_visible(), "tareas: Registrar abre el registro", fallas)
            page.locator('[data-prog-cerrar="prog-modal-reg"]').first.click()
            page.wait_for_timeout(150)

            # 5. fuente de Estudio y su degradación sin Academics
            sesiones = [
                {"id": "s1", "fecha": lunes.isoformat(), "minutos": 150, "ramo": "", "hora": "18:00", "tipo": "crono"},
                {"id": "s2", "fecha": (lunes + timedelta(days=1)).isoformat(), "minutos": 90, "ramo": "", "hora": "19:00", "tipo": "crono"},
                {"id": "s3", "fecha": (lunes + timedelta(days=2)).isoformat(), "minutos": 150, "ramo": "", "hora": "09:00", "tipo": "crono"},
            ]
            page.evaluate("""(sesiones) => {
              const st = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              st.instalados = ['progreso', 'estudio'];
              st.sesiones = sesiones;
              localStorage.setItem('mimo.shell.v1', JSON.stringify(st));
            }""", sesiones)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            ir(page, "progreso")
            page.locator("#prog-nueva").click()
            page.wait_for_timeout(120)
            exigir(page.locator('#prog-f-fuente option[value="sesiones"]').get_attribute("disabled") is None,
                   "estudio: con Academics la fuente está disponible", fallas)
            page.locator('[data-prog-cerrar="prog-modal-meta"]').first.click()
            page.wait_for_timeout(120)
            crear_meta(page, "Estudio", "h", "10", paso="0.5", decimales="1",
                       periodo="semana", fuente="sesiones")
            exigir("6,5 / 10 h" in tarjeta(page, "Estudio").locator(".prog-num").inner_text(),
                   "estudio: las sesiones suman 6,5 h", fallas)
            exigir("Desde Estudio" in tarjeta(page, "Estudio").inner_text(),
                   "estudio: la tarjeta declara la fuente", fallas)
            page.evaluate("""() => {
              const st = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              st.instalados = ['progreso'];
              localStorage.setItem('mimo.shell.v1', JSON.stringify(st));
            }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            ir(page, "progreso")
            exigir("Academics no está" in tarjeta(page, "Estudio").inner_text(),
                   "estudio: sin Academics la tarjeta avisa", fallas)
            exigir("— / 10 h" in tarjeta(page, "Estudio").locator(".prog-num").inner_text(),
                   "estudio: sin Academics no inventa horas", fallas)
            exigir(page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).progreso.metas.length") == 3,
                   "estudio: quitar Academics no borra la meta", fallas)

            # 6. editar, archivar, restaurar, eliminar y deshacer
            tarjeta(page, "Agua").locator("[data-prog-edit]").click()
            page.wait_for_timeout(140)
            page.locator("#prog-f-objetivo").fill("3")
            page.locator("#prog-guardar").click()
            page.wait_for_timeout(260)
            exigir("/ 3 L" in tarjeta(page, "Agua").locator(".prog-num").inner_text(),
                   "editar: el objetivo cambia a 3 L", fallas)
            tarjeta(page, "Press banca").locator("[data-prog-edit]").click()
            page.wait_for_timeout(140)
            page.locator("#prog-archivar").click()
            page.wait_for_timeout(260)
            exigir(page.locator(".prog-card", has_text="Press banca").count() == 0,
                   "archivar: la meta sale de la lista activa", fallas)
            page.locator("#prog-archivadas").click()
            page.wait_for_timeout(200)
            exigir(page.locator(".prog-card", has_text="Press banca").count() == 1,
                   "archivar: la meta aparece en archivadas", fallas)
            page.locator(".prog-card", has_text="Press banca").locator("[data-prog-edit]").click()
            page.wait_for_timeout(140)
            page.locator("#prog-archivar").click()
            page.wait_for_timeout(260)
            page.locator("#prog-archivadas").click()
            page.wait_for_timeout(200)
            exigir(page.locator(".prog-card", has_text="Press banca").count() == 1,
                   "archivar: restaurar la devuelve", fallas)
            tarjeta(page, "Estudio").locator("[data-prog-edit]").click()
            page.wait_for_timeout(140)
            page.locator("#prog-eliminar").click()
            page.wait_for_timeout(300)
            exigir(page.locator(".prog-card", has_text="Estudio").count() == 0,
                   "eliminar: la meta desaparece", fallas)
            page.locator("#toast .toast__accion").click()
            page.wait_for_timeout(300)
            exigir(page.locator(".prog-card", has_text="Estudio").count() == 1,
                   "eliminar: deshacer la restaura", fallas)

            # 7. quitar y reinstalar el bloque conserva los datos
            page.evaluate("""() => {
              const st = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              st.instalados = st.instalados.filter(x => x !== 'progreso');
              localStorage.setItem('mimo.shell.v1', JSON.stringify(st));
            }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            exigir(page.locator('#tabs [data-ir="progreso"]').count() == 0,
                   "quitar: Progreso desaparece de la barra", fallas)
            exigir(page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).progreso.metas.length") >= 1,
                   "quitar: las metas siguen guardadas", fallas)
            page.evaluate("""() => {
              const st = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              st.instalados.push('progreso');
              localStorage.setItem('mimo.shell.v1', JSON.stringify(st));
            }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(250)
            ir(page, "progreso")
            exigir(page.locator(".prog-card").count() >= 1,
                   "reinstalar: las metas vuelven a la sección", fallas)

            # 8. buscador
            page.keyboard.press("Control+k")
            page.wait_for_timeout(250)
            page.locator("#buscar-input").fill("Agua")
            page.wait_for_timeout(250)
            exigir(page.locator(".buscar-res").count() >= 1, "buscador: encuentra Agua", fallas)
            page.locator(".buscar-res").first.click()
            page.wait_for_timeout(300)
            exigir(page.locator("#p-progreso").is_visible(), "buscador: abre Progreso", fallas)

            # 9. 411
            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(300)
            if page.locator("#btn-panel-cerrar").is_visible():
                page.locator("#btn-panel-cerrar").click()
                page.wait_for_timeout(200)
            exigir(desborde(page) == 0, "411: sin desborde", fallas)
            page.locator("#prog-nueva").click()
            page.wait_for_timeout(200)
            exigir(desborde(page) == 0, "411: el modal no desborda", fallas)
            page.locator('[data-prog-cerrar="prog-modal-meta"]').first.click()

            exigir(not errores, f"consola: sin errores — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-progreso", fallas)


if __name__ == "__main__":
    sys.exit(main())
