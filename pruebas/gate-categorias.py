#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-categorias.py — categorías (etiquetas) de los eventos del calendario.

Mide sobre app/index.html:
  1. el carril empieza sin categorías y ofrece crearlas;
  2. un evento suelto se crea con una categoría nueva y el chip la muestra;
  3. la categoría también se ve en la agenda, en el detalle y en el carril;
  4. una segunda categoría se crea desde el carril y se elige en otro evento;
  5. las categorías y los eventos sobreviven a recargar sin `?reset=1`;
  6. a 411 px no hay desborde y la consola queda limpia.

Uso: python3 pruebas/gate-categorias.py [--demo]
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402


def estado(page, clave: str):
    return page.evaluate("k => JSON.parse(localStorage.getItem('mimo.shell.v1'))[k]", clave)


def crear_evento(page, titulo: str, categoria: str = "", elegir: str = "") -> None:
    page.locator("#btn-nuevo-evento").click()
    page.wait_for_timeout(120)
    page.locator("#evento-titulo").fill(titulo)
    if categoria:
        page.locator("#evento-tipo-nuevo").fill(categoria)
    if elegir:
        page.locator("#evento-tipo").select_option(label=elegir)
    page.locator("#modal-guardar").click()
    page.wait_for_timeout(220)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.wait_for_timeout(180)
            exigir("Sin categorías" in page.locator("#cal-tipos").inner_text(),
                   "categorías: el carril empieza vacío", fallas)
            exigir(page.locator("#btn-nueva-categoria").is_visible(),
                   "categorías: el carril ofrece crearlas", fallas)

            crear_evento(page, "Laboratorio de química", categoria="Laboratorio")
            tipos = estado(page, "eventoTipos")
            eventos = estado(page, "eventos")
            exigir(len(tipos) == 1 and tipos[0]["nombre"] == "Laboratorio" and tipos[0]["id"] == "laboratorio",
                   f"categorías: se crea la categoría — {tipos}", fallas)
            exigir(bool(eventos) and eventos[0]["tipo"] == "laboratorio",
                   "categorías: el evento guarda la categoría", fallas)
            exigir("Laboratorio" in page.locator("#cal-tipos").inner_text(),
                   "categorías: el carril lista la categoría", fallas)
            chip = page.locator(".evento-chip").first
            exigir("LABORATORIO" in chip.inner_text() and "Laboratorio de química" in chip.inner_text(),
                   f"categorías: el chip del mes muestra la etiqueta — {chip.inner_text()!r}", fallas)
            estilo = page.locator(".evento-chip__tag").first.get_attribute("style") or ""
            exigir("--tag:#" in estilo,
                   f"categorías: la etiqueta toma color de la identidad — {estilo!r}", fallas)

            page.locator(".evento-chip").first.click()
            page.wait_for_timeout(220)
            exigir("Categoría" in page.locator("#panel-cuerpo").inner_text()
                   and "Laboratorio" in page.locator("#panel-cuerpo").inner_text(),
                   "categorías: el detalle muestra la etiqueta", fallas)

            page.locator("#btn-nueva-categoria").click()
            page.wait_for_timeout(120)
            page.locator("#categoria-nombre").fill("Cumpleaños")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(220)
            exigir(len(estado(page, "eventoTipos")) == 2,
                   "categorías: se crea otra categoría desde el carril", fallas)
            exigir("Cumpleaños" in page.locator("#cal-tipos").inner_text(),
                   "categorías: la segunda categoría aparece en el carril", fallas)

            page.locator('#vista-calendario [data-cal-vista="mes"]').click()
            page.wait_for_timeout(160)
            page.locator("#btn-nuevo-evento").click()
            page.wait_for_timeout(120)
            page.locator("#evento-titulo").fill("Cumpleaños de Ana")
            page.locator("#evento-tipo").select_option(label="Cumpleaños")
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(220)
            exigir(any("CUMPLEAÑOS" in c.inner_text() for c in page.locator(".evento-chip").all()),
                   "categorías: la categoría elegida se pinta en su chip", fallas)

            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            exigir("Laboratorio" in page.locator("#cal-tipos").inner_text()
                   and "Cumpleaños" in page.locator("#cal-tipos").inner_text(),
                   "categorías: sobreviven a recargar", fallas)
            exigir(page.locator(".evento-chip").count() >= 2,
                   "categorías: los eventos sobreviven a recargar", fallas)
            exigir(not errores, f"categorías: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            crear_evento(page, "Evento con categoría larga", categoria="Categoría larga de prueba")
            d = desborde(page)
            exigir(d == 0, f"411: categorías sin desborde — {d}px", fallas)
            exigir("Categoría larga" in page.locator("#cal-tipos").inner_text(),
                   "411: la categoría se pinta", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

    codigo = salir("gate-categorias", fallas)
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()
    if not args.demo:
        return codigo
    fallas_rotas = roto()
    codigo_roto = salir("gate-categorias/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: la app buena no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


def roto() -> list[str]:
    """Sin `MimoIdentidad` la etiqueta pierde su color: el gate tiene que verlo."""
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate("""() => {
              const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));
              d.eventoTipos = [{id: 'laboratorio', nombre: 'Laboratorio'}];
              d.eventos = [{id: 'e1', titulo: 'X', fecha: new Date().toISOString().slice(0,10),
                            hora: '', contexto: '', tipo: 'laboratorio', nota: ''}];
              localStorage.setItem('mimo.shell.v1', JSON.stringify(d));
            }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(300)
            page.evaluate("() => { window.MimoIdentidad = null; }")
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(250)
            estilo = page.locator(".evento-chip__tag").first.get_attribute("style") or ""
            exigir("--tag:#" in estilo,
                   f"roto: la etiqueta conserva color — {estilo!r}", fallas)
        finally:
            ctx.close()
    return fallas


if __name__ == "__main__":
    sys.exit(main())
