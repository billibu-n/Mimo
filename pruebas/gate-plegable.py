#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-plegable.py — categorías plegadas, una sola implementación.

La ronda R101 agrupó por categoría las fichas que antes se veían planas (la ficha
de Calificaciones y las listas de sesiones de Estudio y Tiempo) con el patrón de
Mimo Académics: barra con título, cuenta y flecha, cuerpo que se despliega.

Mide:
  1. una sola implementación (js/nucleo/plegable.js) y ningún `.calif-bloque` plano;
  2. cada grupo: cabecera con `aria-expanded`, `aria-controls` que apunta a su cuerpo,
     y el cuerpo cerrado `inert` + `aria-hidden` (no se tabula ni se lee);
  3. el estado inicial: Categorías abierta; las otras tres barras y las sesiones, cerradas;
  4. clic abre y cierra, con `aria-expanded`, `inert` y el alto del cuerpo;
  5. teclado: Enter y Espacio alternan (la cabecera es un botón);
  6. el estado se conserva al cambiar de sección y vuelve, y queda en `estado.plegables`;
  7. con todo abierto no desborda: el layout no se rompe.

Uso:
  python3 pruebas/gate-plegable.py
  python3 pruebas/gate-plegable.py --demo
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
PLUG = RAIZ / "app" / "js" / "nucleo" / "plegable.js"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402

SEMILLA = """() => {
  const e = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
  e.instalados = ['tiempo', 'estudio', 'calificaciones'];
  e.cursos = [{ codigo: 'MA1001', nombre: 'Cálculo', creditos: 6, nivel: 1, enCurso: true, requisitos: [], requisitos_o: [] }];
  e.califs = {};
  e.sesiones = [
    { id: 's1', fecha: '2026-10-01', hora: '', minutos: 60, ramo: 'MA1001', vinculo: '', tipo: 'manual' },
    { id: 's2', fecha: '2026-10-02', hora: '', minutos: 45, ramo: 'MA1001', vinculo: '', tipo: 'manual' },
    { id: 's3', fecha: '2026-10-03', hora: '', minutos: 30, ramo: '', vinculo: '', tipo: 'manual' }
  ];
  localStorage.setItem('mimo.shell.v1', JSON.stringify(e));
}"""


def grupos(page, contenedor):
    return page.evaluate("""sel => Array.from(document.querySelectorAll(sel + ' .plegable')).map(p => {
        const cab = p.querySelector('.plegable__cab');
        const cuerpo = p.querySelector('.plegable__cuerpo');
        return {id: p.getAttribute('data-plegable'), on: p.classList.contains('on'),
                aria: cab.getAttribute('aria-expanded'), control: cab.getAttribute('aria-controls'),
                campo: !!document.getElementById(cab.getAttribute('aria-controls')),
                inert: cuerpo.hasAttribute('inert'), ariaHidden: cuerpo.getAttribute('aria-hidden'),
                alto: Math.round(cuerpo.getBoundingClientRect().height),
                titulo: p.querySelector('.plegable__tit').textContent.trim(),
                cuenta: (p.querySelector('.plegable__cuenta') || {}).textContent || ''};
    })""", contenedor)


def main() -> int:
    fallas: list[str] = []
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    # 1) una sola implementación, y la ficha ya no es una lista plana
    exigir(PLUG.exists(), "plegable: existe js/nucleo/plegable.js", fallas)
    indice = (RAIZ / "app" / "index.html").read_text(encoding="utf-8")
    exigir("js/nucleo/plegable.js" in indice, "plegable: index.html carga el módulo", fallas)
    shell = (RAIZ / "app" / "js" / "shell.js").read_text(encoding="utf-8")
    exigir("calif-bloque" not in shell, "plegable: la ficha de Calificaciones no usa el patrón plano", fallas)

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.evaluate(SEMILLA)
        page.goto(APP.as_uri(), wait_until="load")
        page.wait_for_timeout(500)
        try:
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(350)

            # 2) estructura y estado inicial
            gs = grupos(page, "#calif-detalle")
            exigir(len(gs) == 4, f"calif: cuatro barras — {len(gs)}", fallas)
            esperado = {"cats": True, "comps": False, "examen": False, "exim": False}
            for g in gs:
                fin = g["id"].split(":")[-1]
                exigir(g["control"] and g["campo"], f"{g['id']}: aria-controls apunta a su cuerpo", fallas)
                exigir(g["aria"] == ("true" if g["on"] else "false"), f"{g['id']}: aria-expanded coherente", fallas)
                exigir(g["inert"] == (not g["on"]), f"{g['id']}: cerrado queda inert — inert={g['inert']} on={g['on']}", fallas)
                exigir(g["ariaHidden"] == ("false" if g["on"] else "true"),
                       f"{g['id']}: aria-hidden coherente — {g['ariaHidden']}", fallas)
                exigir(g["titulo"], f"{g['id']}: la cabecera tiene título", fallas)
                if fin in esperado:
                    exigir(g["on"] == esperado[fin], f"{g['id']}: estado inicial — on={g['on']}", fallas)

            # 4) clic abre y cierra
            cab = page.locator("#calif-detalle .plegable[data-plegable$=':comps'] .plegable__cab")
            cab.click()
            page.wait_for_timeout(260)
            abierto = grupos(page, "#calif-detalle")
            comps = [g for g in abierto if g["id"].endswith(":comps")][0]
            exigir(comps["on"] and comps["aria"] == "true" and not comps["inert"],
                   f"clic: la barra abre — {comps}", fallas)
            exigir(comps["alto"] > 20, f"clic: el cuerpo se despliega — alto {comps['alto']}", fallas)
            cab.click()
            page.wait_for_timeout(260)
            cerrado = [g for g in grupos(page, "#calif-detalle") if g["id"].endswith(":comps")][0]
            exigir(not cerrado["on"] and cerrado["aria"] == "false" and cerrado["inert"],
                   f"clic: la barra cierra — {cerrado}", fallas)
            exigir(cerrado["alto"] < 2, f"clic: el cuerpo queda plegado — alto {cerrado['alto']}", fallas)

            # 5) teclado: Enter y Espacio
            cab.focus()
            page.keyboard.press("Enter")
            page.wait_for_timeout(240)
            exigir([g for g in grupos(page, "#calif-detalle") if g["id"].endswith(":comps")][0]["on"],
                   "teclado: Enter abre", fallas)
            page.keyboard.press(" ")
            page.wait_for_timeout(240)
            exigir(not [g for g in grupos(page, "#calif-detalle") if g["id"].endswith(":comps")][0]["on"],
                   "teclado: Espacio cierra", fallas)

            # 3) Estudio: sesiones agrupadas por ramo, cerradas
            page.locator('#tabs [data-ir="estudio"]').click()
            page.wait_for_timeout(400)
            gs = grupos(page, "#est-sesiones")
            exigir(len(gs) >= 2, f"estudio: sesiones agrupadas por ramo — {len(gs)}", fallas)
            exigir(all(not g["on"] for g in gs), "estudio: las sesiones nacen plegadas", fallas)
            exigir(all(g["cuenta"] for g in gs), "estudio: cada grupo dice cuántas sesiones y horas", fallas)
            exigir(page.locator("#est-sesiones .est-sesion").count() >= 2,
                   "estudio: las sesiones siguen en el documento (no se pierden)", fallas)

            # 6) el estado se conserva al navegar
            page.locator("#est-sesiones .plegable__cab").first.click()
            page.wait_for_timeout(240)
            guardado = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).plegables || {}")
            exigir(len(guardado) >= 1 and any(guardado.values()), f"estado: queda en el estado — {guardado}", fallas)
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(250)
            page.locator('#tabs [data-ir="estudio"]').click()
            page.wait_for_timeout(400)
            exigir(grupos(page, "#est-sesiones")[0]["on"], "estado: al volver sigue abierto", fallas)

            # 7) con todo abierto no desborda
            page.evaluate("""() => document.querySelectorAll('.plegable__cab').forEach(b => {
                const p = b.closest('.plegable'); if (!p.classList.contains('on')) b.click();
            })""")
            page.wait_for_timeout(400)
            d = desborde(page)
            exigir(d == 0, f"layout: con todo abierto no desborda — {d}px", fallas)

            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

    codigo = salir("gate-plegable", fallas)
    if not args.demo:
        return codigo
    fallas_rotas = roto()
    codigo_roto = salir("gate-plegable/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: la app buena no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


def roto() -> list[str]:
    """Fixture sin el módulo: las barras no pueden abrir; el gate lo tiene que ver."""
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate(SEMILLA)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(400)
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(300)
            # se rompe el grupo a propósito: sin `data-plegable` el botón ya no sabe qué abrir
            page.evaluate("() => { document.querySelectorAll('#calif-detalle .plegable').forEach(p => p.removeAttribute('data-plegable')); }")
            page.locator("#calif-detalle .plegable__cab").nth(1).click()
            page.wait_for_timeout(250)
            comps = [g for g in grupos(page, "#calif-detalle") if "Componentes" in g["titulo"]][0]
            exigir(comps["on"], "roto: la barra cerrada abre al pulsarla (el gate no discrimina)", fallas)
        finally:
            ctx.close()
    return fallas


if __name__ == "__main__":
    sys.exit(main())
