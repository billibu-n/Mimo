#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-malla-grafo.py — el trazado compacto y la selección de Malla.

Mide lo que este encargo pide, no la impresión:
  1. las 39 aristas del fixture se dibujan con tramos rectos H/V y arcos del
     token, sin curvas bezier ni tramos inclinados;
  2. el trazado no crece hacia abajo: ningún punto baja del borde inferior de
     las tarjetas y el tablero no añade una banda inferior;
  3. las aristas reutilizan carriles y franjas: comparten el carril vertical
     de cada hueco de columna y la franja horizontal entre dos fichas, así que
     no se abre una pista nueva por arista;
  4. el trazado viaja por los huecos entre fichas y no atraviesa ninguna;
  5. al entrar por la barra el tablero arranca sin selección; al seleccionar un
     ramo solo quedan visibles sus aristas y sus ramos vinculados, el resto se
     atenúa y al deseleccionar vuelve la vista general;
  6. el mismo contrato se cumple a 1440 y 411 px y el trazado es estable al
     repintar.

El fixture `malla-grafo.json` tiene seis niveles, 30 ramos y 39 requisitos:
incluye aristas vecinas, saltos de dos y tres niveles, una arista del mismo
nivel (que rodea la columna por la derecha), un ciclo de orden y una arista que
comparte fila con su destino.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
FIXTURE = AQUI / "fixtures" / "malla-grafo.json"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402

NUM = r"-?\d+(?:\.\d+)?"


def instalar_academics(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)
    page.locator(".bcard", has_text="Academics").locator("button", has_text="Instalar kit").click()
    page.wait_for_timeout(120)
    page.locator("#modal-x").click()
    page.wait_for_timeout(80)


def cargar_malla(page) -> None:
    instalar_academics(page)
    page.locator('#tabs .tab[data-ir="malla"]').click()
    page.wait_for_timeout(100)
    page.locator("#archivo-malla").set_input_files(str(FIXTURE))
    page.wait_for_timeout(600)


def leer_grafo(page):
    """Devuelve paths, tarjetas, columnas y la caja real del tablero."""
    return page.evaluate("""() => {
      const cont = document.querySelector('#malla-tablero');
      const caja = cont.getBoundingClientRect();
      const radio = parseFloat(getComputedStyle(cont).getPropertyValue('--malla-radio')) || 0;
      const style = getComputedStyle(cont);
      const paths = [...document.querySelectorAll('#malla-lineas path')].map(p => {
        const b = p.getBBox();
        return {
          d: p.getAttribute('d') || '',
          de: p.getAttribute('data-malla-de') || '',
          a: p.getAttribute('data-malla-a') || '',
          span: Number(p.getAttribute('data-malla-span') || 0),
          corredor: Number(p.getAttribute('data-malla-corredor') || -1),
          track: p.getAttribute('data-malla-track') || '',
          maxY: b.y + b.height
        };
      });
      const tarjetas = [...document.querySelectorAll('.ramo-card')].map(el => {
        const r = el.getBoundingClientRect();
        return {cod: el.getAttribute('data-ramo'), x: r.left - caja.left, y: r.top - caja.top,
                w: r.width, h: r.height, bottom: r.bottom - caja.top};
      });
      return {
        paths, tarjetas, radio,
        cols: document.querySelectorAll('.malla-col').length,
        maxCardBottom: Math.max(...tarjetas.map(t => t.bottom)),
        maxPathY: Math.max(...paths.map(p => p.maxY), 0),
        scrollHeight: cont.scrollHeight,
        paddingBottom: parseFloat(style.paddingBottom) || 0,
        svgZ: Number(getComputedStyle(document.querySelector('#malla-lineas')).zIndex) || 0,
        colsZ: Number(getComputedStyle(document.querySelector('#malla-cols')).zIndex) || 0
      };
    }""")


def muestras_en_tarjeta(page):
    """Pares únicos arista/tarjeta que el trazo real atraviesa."""
    return page.evaluate("""() => {
      const caja = document.querySelector('#malla-tablero').getBoundingClientRect();
      const tarjetas = [...document.querySelectorAll('.ramo-card')].map(el => {
        const r = el.getBoundingClientRect();
        return {cod: el.getAttribute('data-ramo'), x: r.left - caja.left + 2,
                y: r.top - caja.top + 2, w: r.width - 4, h: r.height - 4};
      });
      const vistos = new Set(), malos = [];
      for (const p of document.querySelectorAll('#malla-lineas path')) {
        const de = p.getAttribute('data-malla-de') || '?';
        const a = p.getAttribute('data-malla-a') || '?';
        const L = p.getTotalLength();
        for (let l = 2; l < L - 2; l += 1.5) {
          const pt = p.getPointAtLength(l);
          for (const t of tarjetas) {
            if (pt.x > t.x && pt.x < t.x + t.w && pt.y > t.y && pt.y < t.y + t.h) {
              const clave = de + '->' + a + ':' + t.cod;
              if (!vistos.has(clave)) {
                vistos.add(clave);
                malos.push(clave);
              }
              break;
            }
          }
        }
      }
      return malos;
    }""")


def estado_seleccion(page):
    """Lo que ve el usuario cuando un ramo está elegido."""
    return page.evaluate("""() => {
      const tarjetas = [...document.querySelectorAll('.ramo-card')];
      const paths = [...document.querySelectorAll('#malla-lineas path')];
      const opacidad = el => parseFloat(getComputedStyle(el).opacity);
      return {
        tablero: document.querySelector('#malla-tablero').classList.contains('malla--sel'),
        sel: tarjetas.filter(t => t.classList.contains('sel')).length,
        vinculo: tarjetas.filter(t => t.classList.contains('malla-card--vinculo')).length,
        apagada: tarjetas.filter(t => t.classList.contains('malla-card--apagada')).length,
        opacidades: tarjetas.map(t => ({cod: t.getAttribute('data-ramo'), op: opacidad(t),
                                      clase: t.className})),
        total: paths.length,
        visibles: paths.filter(p => getComputedStyle(p).display !== 'none').length,
        req: paths.filter(p => p.classList.contains('malla-linea--req')).length,
        des: paths.filter(p => p.classList.contains('malla-linea--des')).length,
        tenue: paths.filter(p => p.classList.contains('malla-linea--tenue')).length,
        visiblesPares: paths.filter(p => getComputedStyle(p).display !== 'none')
          .map(p => (p.getAttribute('data-malla-de') || '') + '>' + (p.getAttribute('data-malla-a') || '')),
        pista: document.querySelector('#malla-pista').textContent
      };
    }""")


def parsear(d: str):
    """Devuelve (comandos, segmentos rectos) de un path M/L/A."""
    tokens = re.findall(r"[MLACZ]|" + NUM, d)
    i = 0
    segmentos = []
    comandos = []
    x = y = 0.0
    while i < len(tokens):
        cmd = tokens[i]
        i += 1
        if cmd in ("M", "L"):
            nx, ny = float(tokens[i]), float(tokens[i + 1])
            i += 2
            comandos.append(cmd)
            if cmd == "L":
                segmentos.append((x, y, nx, ny))
            x, y = nx, ny
        elif cmd == "A":
            rx, ry = float(tokens[i]), float(tokens[i + 1])
            rot, large, sweep = tokens[i + 2], tokens[i + 3], tokens[i + 4]
            nx, ny = float(tokens[i + 5]), float(tokens[i + 6])
            i += 7
            comandos.append("A")
            segmentos.append(("A", rx, ry, rot, large, sweep, x, y, nx, ny))
            x, y = nx, ny
        elif cmd == "C":
            i += 6
            comandos.append("C")
        elif cmd == "Z":
            comandos.append("Z")
        else:
            raise ValueError(f"comando SVG inesperado: {cmd}")
    return comandos, segmentos


def medir(page, etiqueta, fallas):
    g = leer_grafo(page)
    paths, tarjetas, radio = g["paths"], g["tarjetas"], g["radio"]
    exigir(len(paths) == 39, f"{etiqueta}: 39 aristas dibujadas — {len(paths)}", fallas)
    exigir(len(tarjetas) == 30, f"{etiqueta}: 30 ramos en el tablero — {len(tarjetas)}", fallas)
    exigir(radio > 0, f"{etiqueta}: el radio de doblez sale de un token — {radio}", fallas)

    verticales = set()
    tracks = set()
    malos = []
    for p in paths:
        if p["track"]:
            tracks.add(round(float(p["track"]), 1))
        try:
            comandos, segmentos = parsear(p["d"])
        except ValueError as e:
            malos.append(f"{p['de']}->{p['a']}: {e}")
            continue
        if "C" in comandos:
            malos.append(f"{p['de']}->{p['a']}: usa curva bezier")
            continue
        for cmd in comandos:
            if cmd not in ("M", "L", "A"):
                malos.append(f"{p['de']}->{p['a']}: comando {cmd}")
        for seg in segmentos:
            if seg[0] == "A":
                _, rx, ry, _, _, _, _, _, _, _ = seg
                if abs(rx - ry) > 0.01 or rx <= 0 or rx > radio + 0.2:
                    malos.append(f"{p['de']}->{p['a']}: arco rx={rx} ry={ry} radio={radio}")
                continue
            x1, y1, x2, y2 = seg
            if abs(x1 - x2) > 0.5 and abs(y1 - y2) > 0.5:
                malos.append(f"{p['de']}->{p['a']}: tramo inclinado")
            if abs(x1 - x2) < 0.5:
                verticales.add(round(x1, 1))

    exigir(not malos, f"{etiqueta}: sin bezier ni tramos inclinados — {malos[:4]}", fallas)

    # El trazado no crece hacia abajo: la línea más baja no pasa del borde de
    # las tarjetas y el tablero no reserva una banda inferior.
    exigir(g["maxPathY"] <= g["maxCardBottom"] + 4,
           f"{etiqueta}: el trazo no baja de las tarjetas — {g['maxPathY']:.1f} / {g['maxCardBottom']:.1f}", fallas)
    exigir(g["scrollHeight"] <= g["maxCardBottom"] + 24,
           f"{etiqueta}: el tablero no abre banda inferior — {g['scrollHeight']} / {g['maxCardBottom']:.1f}", fallas)
    exigir(g["paddingBottom"] <= 16,
           f"{etiqueta}: el relleno inferior no desperdicia espacio — {g['paddingBottom']}", fallas)

    # Un corredor por hueco y no uno por arista.
    exigir(0 < len(verticales) <= max(1, g["cols"] - 1),
           f"{etiqueta}: reutiliza corredores — {len(verticales)} carriles para {g['cols']} columnas", fallas)

    exigir(0 < len(tracks) <= 8,
           f"{etiqueta}: reutiliza franjas entre fichas — {len(tracks)} franjas para 13 saltos", fallas)

    toques = muestras_en_tarjeta(page)
    exigir(not toques, f"{etiqueta}: el trazado no entra en ninguna ficha — {toques[:4]}", fallas)
    exigir(g["svgZ"] < g["colsZ"],
           f"{etiqueta}: las líneas van por debajo de las fichas — {g['svgZ']} / {g['colsZ']}", fallas)
    exigir(not any(p["corredor"] < 0 for p in paths),
           f"{etiqueta}: cada arista declara su corredor", fallas)

    largos = [p for p in paths if p["span"] > 1]
    vecinos = [p for p in paths if p["span"] == 1]
    mismo = [p for p in paths if p["span"] == 0]
    exigir(len(largos) >= 1, f"{etiqueta}: el fixture ejercita saltos de nivel — {len(largos)}", fallas)
    exigir(len(vecinos) >= 1, f"{etiqueta}: el fixture ejercita columnas vecinas — {len(vecinos)}", fallas)
    exigir(len(mismo) == 1, f"{etiqueta}: el fixture ejercita el mismo nivel — {len(mismo)}", fallas)


def paths_d(page):
    return page.evaluate("() => [...document.querySelectorAll('#malla-lineas path')].map(p => p.getAttribute('d'))")


def probar_seleccion(page, etiqueta, fallas):
    page.locator('.ramo-card[data-ramo="G401"]').click()
    page.wait_for_timeout(220)
    e = estado_seleccion(page)
    exigir(e["tablero"], f"{etiqueta}: el tablero entra en modo selección", fallas)
    exigir(e["sel"] == 1, f"{etiqueta}: un ramo queda seleccionado — {e['sel']}", fallas)
    exigir(e["vinculo"] == 3, f"{etiqueta}: los tres ramos vinculados quedan visibles — {e['vinculo']}", fallas)
    exigir(e["apagada"] == 26, f"{etiqueta}: el resto de los ramos se atenúa — {e['apagada']}", fallas)
    exigir(e["total"] == 39 and e["visibles"] == 3,
           f"{etiqueta}: solo quedan sus tres aristas — {e['visibles']} de {e['total']}", fallas)
    exigir(e["req"] == 2 and e["des"] == 1,
           f"{etiqueta}: dos líneas de requisito y una de desbloqueo — {e['req']}/{e['des']}", fallas)
    exigir(e["tenue"] == 36, f"{etiqueta}: las otras 36 aristas quedan ocultas — {e['tenue']}", fallas)
    exigir(set(e["visiblesPares"]) == {"G101>G401", "G302>G401", "G401>G505"},
           f"{etiqueta}: las aristas visibles son las del ramo — {sorted(e['visiblesPares'])}", fallas)
    apagadas = [x for x in e["opacidades"] if "malla-card--apagada" in x["clase"]]
    vinc = [x for x in e["opacidades"] if "malla-card--vinculo" in x["clase"]]
    exigir(all(x["op"] <= 0.25 for x in apagadas),
           f"{etiqueta}: los ramos sin vínculo se atenúan — {[x['op'] for x in apagadas[:3]]}", fallas)
    exigir(all(x["op"] >= 0.95 for x in vinc),
           f"{etiqueta}: los ramos vinculados no se atenúan — {[x['op'] for x in vinc[:3]]}", fallas)
    exigir("resto" in e["pista"].lower(), f"{etiqueta}: la pista explica que el resto se atenúa", fallas)


def probar_entrada_limpia(page, etiqueta, fallas):
    """Entrar a Malla por la barra no arrastra la selección de otra sección."""
    page.locator('.ramo-card[data-ramo="G401"]').click()
    page.wait_for_timeout(180)
    e = estado_seleccion(page)
    exigir(e["sel"] == 1, f"{etiqueta}: la ficha se selecciona al pulsarla", fallas)
    page.locator('#tabs .tab[data-ir="calificaciones"]').click()
    page.wait_for_timeout(250)
    page.locator('#tabs .tab[data-ir="malla"]').click()
    page.wait_for_timeout(300)
    e = estado_seleccion(page)
    exigir(not e["tablero"] and e["sel"] == 0 and e["vinculo"] == 0 and
           e["apagada"] == 0 and e["tenue"] == 0,
           f"{etiqueta}: al entrar a Malla no queda ninguna selección", fallas)
    exigir(e["visibles"] == 39,
           f"{etiqueta}: al entrar a Malla vuelven las 39 aristas — {e['visibles']}", fallas)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            cargar_malla(page)
            probar_entrada_limpia(page, "1440", fallas)
            medir(page, "1440", fallas)
            antes = paths_d(page)
            page.locator("#malla-filtro").select_option("bloqueados")
            page.wait_for_timeout(120)
            page.locator("#malla-filtro").select_option("todos")
            page.wait_for_timeout(180)
            despues = paths_d(page)
            exigir(antes == despues, f"1440: el trazado se repite igual al repintar — {len(antes)}/{len(despues)}", fallas)

            probar_seleccion(page, "1440", fallas)
            page.locator("#malla-quitar-sel").click()
            page.wait_for_timeout(220)
            e = estado_seleccion(page)
            exigir(not e["tablero"] and e["sel"] == 0 and e["apagada"] == 0,
                   "1440: al deseleccionar vuelve la vista general", fallas)
            exigir(e["visibles"] == 39 and e["tenue"] == 0,
                   f"1440: vuelven las 39 aristas — {e['visibles']}", fallas)
            exigir(all(x["op"] >= 0.8 for x in e["opacidades"]),
                   "1440: ningún ramo queda atenuado sin selección", fallas)
            exigir("Las líneas muestran" in e["pista"], "1440: la pista vuelve a la vista general", fallas)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        page.on("dialog", lambda d: d.accept())
        try:
            cargar_malla(page)
            probar_entrada_limpia(page, "411", fallas)
            medir(page, "411", fallas)
            probar_seleccion(page, "411", fallas)
            d = desborde(page)
            exigir(d == 0, f"411: malla sin desborde — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-malla-grafo", fallas)


if __name__ == "__main__":
    sys.exit(main())
