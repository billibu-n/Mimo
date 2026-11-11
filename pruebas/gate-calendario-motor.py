#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-calendario-motor.py — el motor de mes, año y semestre.

Mide lo que el encargo pide, no la impresión:
  1. las cuatro vistas existen (Mes, Año, Semestre, Semana);
  2. el mes tiene 42 celdas, número de día, marcas de semana y chips con categoría;
  3. el año pinta los 12 meses, pone un punto por día con eventos y al pulsar un
     día vuelve al mes de ese día;
  4. el semestre pinta una tabla de semanas con 7 días, fila actual, estudio y chips;
  5. las flechas y Hoy navegan de verdad (mes, año y semestre);
  6. las categorías siguen visibles en mes, semana, semestre y detalle;
  7. el corte desde la semana actual se activa, se guarda, sobrevive a reabrir,
     conserva fila actual/chips/horas y se desactiva;
  8. a 411 px no hay desborde del documento.

El motor anterior no tenía Año ni Semestre y usaba curvas/una grilla distinta:
la compuerta falla en la primera comprobación de pestañas.
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


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def crear_periodo(page, inicio: str, nombre: str = "Semestre de prueba") -> None:
    page.locator("#btn-nuevo").click()
    page.wait_for_timeout(100)
    page.locator("#periodo-nombre").fill(nombre)
    page.locator("#periodo-inicio").fill(inicio)
    page.locator("#periodo-semanas").fill("18")
    page.locator("#periodo-receso").fill("1")
    page.locator("#periodo-examenes").fill("1")
    page.locator('#periodo-form button[type="submit"]').click()
    page.wait_for_timeout(300)


def crear_ramo(page, codigo: str, nombre: str) -> None:
    page.locator('#tabs [data-ir="malla"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nuevo-ramo").click()
    page.wait_for_timeout(100)
    page.locator("#ramo-codigo").fill(codigo)
    page.locator("#ramo-nombre").fill(nombre)
    page.locator("#ramo-curso").check()
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(150)


def registrar_sesion(page, ramo: str, fecha: str, minutos: str) -> None:
    page.locator('#tabs [data-ir="estudio"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-registrar-sesion").click()
    page.wait_for_timeout(120)
    page.locator("#est-ramo").select_option(ramo)
    page.locator("#est-fecha").fill(fecha)
    page.locator("#est-minutos").fill(minutos)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(200)


def crear_evento(page, titulo: str, fecha: str, hora: str, categoria: str) -> None:
    page.locator('#tabs [data-ir="calendario"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nuevo-evento").click()
    page.wait_for_timeout(120)
    page.locator("#evento-titulo").fill(titulo)
    page.locator("#evento-fecha").fill(fecha)
    page.locator("#evento-hora").fill(hora)
    page.locator("#evento-tipo-nuevo").fill(categoria)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(200)


def estado(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1'))")


def main() -> int:
    fallas: list[str] = []
    hoy = date.today()
    lunes = hoy - timedelta(days=hoy.weekday())
    y, m = hoy.year, hoy.month
    inicio = lunes - timedelta(weeks=4)  # el corte deja S5 como primera semana visible
    dias = [3, 8, 12, 18]
    fechas = [f"{y}-{m:02d}-{d:02d}" for d in dias]
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            crear_periodo(page, inicio.isoformat())
            crear_ramo(page, "CAL101", "Cálculo I")
            registrar_sesion(page, "CAL101", (lunes + timedelta(days=1)).isoformat(), "90")
            registrar_sesion(page, "CAL101", (lunes + timedelta(days=8)).isoformat(), "45")

            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            vistas = page.locator("#vista-calendario button").all_inner_texts()
            exigir(vistas == ["Mes", "Año", "Semestre", "Semana"],
                   f"vistas: Mes, Año, Semestre y Semana — {vistas}", fallas)
            if "Año" not in vistas or "Semestre" not in vistas:
                return salir("gate-calendario-motor", fallas)
            exigir(page.locator("#vista-calendario .on").get_attribute("data-cal-vista") == "mes",
                   "vistas: arranca en Mes", fallas)

            # Mes: grilla de 42 celdas, semana del periodo y número de día.
            exigir(page.locator("#cal-grid .cal-dia").count() == 42,
                   f"mes: 42 celdas — {page.locator('#cal-grid .cal-dia').count()}", fallas)
            exigir(page.locator("#cal-grid .cal-num").count() == 42,
                   "mes: cada celda lleva su número", fallas)
            exigir(page.locator("#cal-grid .cal-sem-col").count() >= 4,
                   f"mes: columna de semanas del periodo — {page.locator('#cal-grid .cal-sem-col').count()}", fallas)
            exigir("Noviembre" in page.locator("#cal-mes-titulo").inner_text() or
                   "November" in page.locator("#cal-mes-titulo").inner_text() or
                   "月" in page.locator("#cal-mes-titulo").inner_text(),
                   f"mes: título del mes — {page.locator('#cal-mes-titulo').inner_text()}", fallas)

            crear_evento(page, "Control de Cálculo", fechas[0], "09:00", "Evaluaciones")
            crear_evento(page, "Entrega de ensayo", fechas[1], "18:00", "Entregas")
            crear_evento(page, "Cumpleaños de Ana", fechas[2], "", "Personal")
            crear_evento(page, "Reunión de estudio", fechas[3], "20:30", "Estudio")
            # Un evento en la semana actual: la vista Semana no depende de que
            # una de las cuatro fechas fijas caiga en esta semana.
            crear_evento(page, "Control de la semana", hoy.isoformat(), "08:00", "Evaluaciones")
            page.locator('#vista-calendario [data-cal-vista="mes"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#cal-grid .cal-dia .evento-chip").count() == 5,
                   f"mes: los cinco eventos se ven — {page.locator('#cal-grid .evento-chip').count()}", fallas)
            exigir(any("EVALUACIONES" in c.inner_text().upper() for c in page.locator("#cal-grid .evento-chip").all()),
                   "mes: el chip conserva la categoría", fallas)
            exigir(len(estado(page)["eventoTipos"]) == 4,
                   f"mes: las cuatro categorías se crean — {len(estado(page)['eventoTipos'])}", fallas)

            # Año: 12 meses, puntos y salto al mes del día.
            page.locator('#vista-calendario [data-cal-vista="anio"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator("#cal-anio").is_visible() and not page.locator("#cal-grid").is_visible(),
                   "año: se muestra la vista de 12 meses", fallas)
            exigir(page.locator("#cal-anio .cal-mes").count() == 12,
                   f"año: 12 meses — {page.locator('#cal-anio .cal-mes').count()}", fallas)
            exigir(page.locator("#cal-anio .cal-mes-tit").count() == 12,
                   "año: cada mes lleva su título", fallas)
            exigir(page.locator("#cal-anio .cal-mes-cel.con").count() >= 4,
                   f"año: los días con eventos se marcan — {page.locator('#cal-anio .cal-mes-cel.con').count()}", fallas)
            exigir(page.locator("#cal-anio .dot").count() >= 4,
                   f"año: un punto por día con eventos — {page.locator('#cal-anio .dot').count()}", fallas)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip() == str(y),
                   f"año: título del año — {page.locator('#cal-mes-titulo').inner_text()}", fallas)
            page.locator(f'#cal-anio [data-cal-dia="{fechas[0]}"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#cal-grid").is_visible() and not page.locator("#cal-anio").is_visible(),
                   "año: pulsar un día vuelve al mes", fallas)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip().startswith(
                   ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto",
                    "Septiembre", "Octubre", "Noviembre", "Diciembre"][m - 1]),
                   f"año: el mes elegido es el del día — {page.locator('#cal-mes-titulo').inner_text()}", fallas)

            page.locator('#vista-calendario [data-cal-vista="anio"]').click()
            page.wait_for_timeout(120)
            page.locator("#cal-sig").click()
            page.wait_for_timeout(180)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip() == str(y + 1),
                   f"año: la flecha avanza un año — {page.locator('#cal-mes-titulo').inner_text()}", fallas)
            page.locator("#btn-hoy").click()
            page.wait_for_timeout(180)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip() == str(y),
                   f"año: Hoy vuelve al año actual — {page.locator('#cal-mes-titulo').inner_text()}", fallas)

            # Semestre: tabla de semanas con fila actual, 7 días, estudio y categorías.
            page.locator('#vista-calendario [data-cal-vista="semestre"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator("#cal-semestre").is_visible() and page.locator(".cal-sem").count() == 1,
                   "semestre: se muestra la tabla", fallas)
            exigir(page.locator(".cal-sem tbody tr").count() == 18,
                   f"semestre: 18 semanas — {page.locator('.cal-sem tbody tr').count()}", fallas)
            exigir(page.locator(".cal-sem thead th").count() == 9,
                   f"semestre: semana + 7 días + estudio — {page.locator('.cal-sem thead th').count()}", fallas)
            exigir(page.locator(".cal-sem tr.actual").count() == 1,
                   "semestre: la fila de la semana actual está marcada", fallas)
            exigir(page.locator(".cal-sem .evento-chip").count() == 5,
                   f"semestre: los cinco eventos se ven — {page.locator('.cal-sem .evento-chip').count()}", fallas)
            horas = page.locator(".cal-sem td.cal-sem-est b").all_inner_texts()
            exigir(any(h not in ("0 h", "0,0 h") for h in horas),
                   f"semestre: la sesión registrada se mide en la columna Estudio — {horas[:3]}", fallas)
            exigir(any("EVALUACIONES" in c.inner_text().upper() for c in page.locator(".cal-sem .evento-chip").all()),
                   "semestre: el chip conserva la categoría", fallas)

            # Corte desde la semana actual: se enciende y se apaga desde el calendario.
            if page.locator("#cal-corte").count() == 0:
                exigir(False, "corte: falta el control en el calendario", fallas)
                return salir("gate-calendario-motor", fallas)
            exigir(page.locator("#cal-corte").get_attribute("aria-pressed") == "false",
                   "corte: el control nace apagado", fallas)
            page.locator("#cal-corte").click()
            page.wait_for_timeout(300)
            exigir(page.locator("#cal-corte").get_attribute("aria-pressed") == "true",
                   "corte: el control queda encendido", fallas)
            filas_corte = page.locator(".cal-sem tbody tr")
            exigir(filas_corte.count() == 14,
                   f"corte: quedan las 14 semanas desde la actual — {filas_corte.count()}", fallas)
            exigir(filas_corte.first.locator(".cal-sem-bl b").inner_text().strip() == "S5",
                   f"corte: la primera fila es la semana actual — {filas_corte.first.locator('.cal-sem-bl b').inner_text()}", fallas)
            exigir(page.locator(".cal-sem tr.actual").count() == 1,
                   "corte: la semana actual sigue marcada", fallas)
            exigir(page.locator(".cal-sem .evento-chip").count() >= 1,
                   "corte: los chips de las semanas visibles no se pierden", fallas)
            exigir(any(h not in ("0 h", "0,0 h") for h in page.locator(".cal-sem td.cal-sem-est b").all_inner_texts()),
                   "corte: las horas de la semana actual siguen", fallas)
            exigir(bool(estado(page)["periodos"][0].get("corteActual")),
                   "corte: el ajuste se guarda en el periodo", fallas)

            # El mes comparte el rango: las semanas anteriores tampoco llevan marca.
            page.locator('#vista-calendario [data-cal-vista="mes"]').click()
            page.wait_for_timeout(150)
            page.locator("#cal-ant").click()
            page.wait_for_timeout(200)
            etiquetas_mes = page.locator("#cal-grid .cal-sem-col").all_inner_texts()
            exigir("S1" not in etiquetas_mes and "S2" not in etiquetas_mes,
                   f"corte: el mes anterior ya no marca S1/S2 — {etiquetas_mes}", fallas)
            page.locator("#cal-sig").click()
            page.wait_for_timeout(150)
            page.locator('#vista-calendario [data-cal-vista="semestre"]').click()
            page.wait_for_timeout(150)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            page.locator('#vista-calendario [data-cal-vista="semestre"]').click()
            page.wait_for_timeout(250)
            exigir(page.locator(".cal-sem tbody tr").count() == 14,
                   f"corte: el ajuste sobrevive a reabrir — {page.locator('.cal-sem tbody tr').count()}", fallas)
            exigir(page.locator("#cal-corte").get_attribute("aria-pressed") == "true",
                   "corte: el botón reaparece encendido", fallas)

            page.locator("#cal-corte").click()
            page.wait_for_timeout(300)
            exigir(page.locator(".cal-sem tbody tr").count() == 18,
                   f"corte: al desactivar vuelven las 18 semanas — {page.locator('.cal-sem tbody tr').count()}", fallas)
            exigir(page.locator(".cal-sem tbody tr").first.locator(".cal-sem-bl b").inner_text().strip() == "S1",
                   "corte: al desactivar vuelve S1", fallas)
            exigir(page.locator("#cal-corte").get_attribute("aria-pressed") == "false",
                   "corte: el botón queda apagado", fallas)
            exigir(not bool(estado(page)["periodos"][0].get("corteActual")),
                   "corte: el ajuste apagado también se guarda", fallas)

            # Semestre: las flechas cambian de periodo cuando hay más de uno.
            crear_periodo(page, (lunes + timedelta(weeks=20)).isoformat(), "Segundo periodo")
            page.wait_for_timeout(250)
            page.locator('#vista-calendario [data-cal-vista="semestre"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip() == "Segundo periodo",
                   f"semestre: el periodo nuevo queda activo — {page.locator('#cal-mes-titulo').inner_text()}", fallas)
            page.locator("#cal-ant").click()
            page.wait_for_timeout(250)
            exigir(page.locator("#cal-mes-titulo").inner_text().strip() == "Semestre de prueba",
                   f"semestre: la flecha vuelve al periodo anterior — {page.locator('#cal-mes-titulo').inner_text()}", fallas)

            # La semana conserva la categoría.
            page.locator('#vista-calendario [data-cal-vista="semana"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator(".cal-semana-dia").count() == 7,
                   f"semana: 7 días — {page.locator('.cal-semana-dia').count()}", fallas)
            exigir(page.locator(".cal-semana-dia .evento-chip").count() >= 1,
                   "semana: los eventos se ven", fallas)
            exigir(any("EVALUACIONES" in c.inner_text().upper() for c in page.locator(".cal-semana-dia .evento-chip").all()),
                   "semana: el chip conserva la categoría", fallas)

            page.locator(".cal-semana-dia .evento-chip", has_text="Control de la semana").first.click()
            page.wait_for_timeout(220)
            exigir("Categoría" in page.locator("#panel-cuerpo").inner_text() and
                   "Evaluaciones" in page.locator("#panel-cuerpo").inner_text(),
                   "detalle: la categoría sigue visible", fallas)

            page.locator('#vista-calendario [data-cal-vista="mes"]').click()
            page.wait_for_timeout(150)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar_academics(page)
            crear_periodo(page, inicio.isoformat())
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(200)
            page.locator('#vista-calendario [data-cal-vista="anio"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator("#cal-anio .cal-mes").count() == 12,
                   f"411: año con 12 meses — {page.locator('#cal-anio .cal-mes').count()}", fallas)
            page.locator('#vista-calendario [data-cal-vista="semestre"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator(".cal-sem").count() == 1, "411: semestre se pinta", fallas)
            d = desborde(page)
            exigir(d == 0, f"411: calendario sin desborde — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-calendario-motor", fallas)


if __name__ == "__main__":
    sys.exit(main())
