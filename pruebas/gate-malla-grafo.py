#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-malla-grafo.py — el trazado del grafo de Malla.

Mide lo que el encargo pide, no la impresión:
  1. todas las aristas se dibujan (39 en el fixture), con tramos rectos H/V;
  2. ningún tramo cruza el interior de una tarjeta;
  3. dos tramos colineales no se solapan;
  4. los dobleces son arcos con el radio del token y no curvas bezier;
  5. el mismo contrato se cumple a 1440 y a 411 px.

El fixture `malla-grafo.json` tiene seis niveles, 30 ramos y 39 requisitos:
incluye aristas vecinas, saltos de dos y tres niveles, una arista del mismo
nivel (que rodea la columna por la derecha), un ciclo de orden y una arista que
comparte fila con su destino, que es la que producía los solapes.
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
    page.wait_for_timeout(500)


def leer_grafo(page):
    """Devuelve paths con su `d`, tarjetas y el radio del token."""
    return page.evaluate("""() => {
      const caja = document.querySelector('#malla-tablero').getBoundingClientRect();
      const radio = parseFloat(getComputedStyle(document.querySelector('#malla-tablero'))
        .getPropertyValue('--malla-radio')) || 0;
      const paths = [...document.querySelectorAll('#malla-lineas path')].map(p => ({
        d: p.getAttribute('d') || '',
        de: p.getAttribute('data-malla-de') || '',
        a: p.getAttribute('data-malla-a') || '',
        span: Number(p.getAttribute('data-malla-span') || 0),
        clase: p.getAttribute('class') || ''
      }));
      const tarjetas = [...document.querySelectorAll('.ramo-card')].map(el => {
        const r = el.getBoundingClientRect();
        return {cod: el.getAttribute('data-ramo'), x: r.left - caja.left, y: r.top - caja.top,
                w: r.width, h: r.height};
      });
      return {paths, tarjetas, radio};
    }""")


def muestras_en_tarjeta(page):
    """Puntos reales del trazo (incluidos los arcos) dentro de una tarjeta."""
    return page.evaluate("""() => {
      const caja = document.querySelector('#malla-tablero').getBoundingClientRect();
      const tarjetas = [...document.querySelectorAll('.ramo-card')].map(el => {
        const r = el.getBoundingClientRect();
        return {cod: el.getAttribute('data-ramo'), x: r.left - caja.left + 2,
                y: r.top - caja.top + 2, w: r.width - 4, h: r.height - 4};
      });
      const malos = [];
      for (const p of document.querySelectorAll('#malla-lineas path')) {
        const L = p.getTotalLength();
        for (let l = 2; l < L - 2; l += 1.5) {
          const pt = p.getPointAtLength(l);
          for (const t of tarjetas) {
            if (pt.x > t.x && pt.x < t.x + t.w && pt.y > t.y && pt.y < t.y + t.h) {
              malos.push((p.getAttribute('data-malla-de') || '?') + '->' +
                (p.getAttribute('data-malla-a') || '?') + ':' + t.cod);
              break;
            }
          }
          if (malos.length >= 4) return malos;
        }
      }
      return malos;
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


def cruza_tarjeta(seg, tarjetas):
    x1, y1, x2, y2 = seg
    for t in tarjetas:
        izq, der = t["x"] + 2, t["x"] + t["w"] - 2
        arr, aba = t["y"] + 2, t["y"] + t["h"] - 2
        if abs(y1 - y2) < 0.5:  # horizontal
            if arr < y1 < aba and min(x1, x2) < der and max(x1, x2) > izq:
                return t["cod"]
        elif abs(x1 - x2) < 0.5:  # vertical
            if izq < x1 < der and min(y1, y2) < aba and max(y1, y2) > arr:
                return t["cod"]
    return None


def solape(a, b):
    """True si dos tramos rectos son colineales y comparten más de 1 px."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    av, bv = abs(ax1 - ax2) < 0.5, abs(bx1 - bx2) < 0.5
    ah, bh = abs(ay1 - ay2) < 0.5, abs(by1 - by2) < 0.5
    if av and bv and abs(ax1 - bx1) < 0.5:
        lo = max(min(ay1, ay2), min(by1, by2))
        hi = min(max(ay1, ay2), max(by1, by2))
        return hi - lo > 1
    if ah and bh and abs(ay1 - by1) < 0.5:
        lo = max(min(ax1, ax2), min(bx1, bx2))
        hi = min(max(ax1, ax2), max(bx1, bx2))
        return hi - lo > 1
    return False


def medir(page, etiqueta, fallas):
    g = leer_grafo(page)
    paths, tarjetas, radio = g["paths"], g["tarjetas"], g["radio"]
    exigir(len(paths) == 39, f"{etiqueta}: 39 aristas dibujadas — {len(paths)}", fallas)
    exigir(len(tarjetas) == 30, f"{etiqueta}: 30 ramos en el tablero — {len(tarjetas)}", fallas)
    exigir(radio > 0, f"{etiqueta}: el radio de doblez sale de un token — {radio}", fallas)

    rectos = []
    malos = []
    for p in paths:
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
            choque = cruza_tarjeta(seg, tarjetas)
            if choque:
                malos.append(f"{p['de']}->{p['a']}: pasa por {choque}")
            rectos.append((p["de"], p["a"], seg))

    exigir(not malos, f"{etiqueta}: sin bezier, sin tramos inclinados y sin pisar ramos — {malos[:4]}", fallas)
    toques = muestras_en_tarjeta(page)
    exigir(not toques, f"{etiqueta}: el trazo real (arcos incluidos) no entra en una tarjeta — {toques}", fallas)

    choques = []
    for i in range(len(rectos)):
        for j in range(i + 1, len(rectos)):
            if rectos[i][0] == rectos[j][0] and rectos[i][1] == rectos[j][1]:
                continue
            if solape(rectos[i][2], rectos[j][2]):
                choques.append(f"{rectos[i][0]}->{rectos[i][1]} / {rectos[j][0]}->{rectos[j][1]}")
                if len(choques) >= 4:
                    break
        if len(choques) >= 4:
            break
    exigir(not choques, f"{etiqueta}: dos líneas no comparten tramo — {choques}", fallas)

    largos = [p for p in paths if p["span"] > 1]
    vecinos = [p for p in paths if p["span"] == 1]
    mismo = [p for p in paths if p["span"] == 0]
    exigir(len(largos) >= 1, f"{etiqueta}: el fixture ejercita saltos de nivel — {len(largos)}", fallas)
    exigir(len(vecinos) >= 1, f"{etiqueta}: el fixture ejercita columnas vecinas — {len(vecinos)}", fallas)
    exigir(len(mismo) == 1, f"{etiqueta}: el fixture ejercita el mismo nivel — {len(mismo)}", fallas)


def paths_d(page):
    return page.evaluate("() => [...document.querySelectorAll('#malla-lineas path')].map(p => p.getAttribute('d'))")


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            cargar_malla(page)
            medir(page, "1440", fallas)
            antes = paths_d(page)
            page.locator("#malla-filtro").select_option("bloqueados")
            page.wait_for_timeout(120)
            page.locator("#malla-filtro").select_option("todos")
            page.wait_for_timeout(180)
            despues = paths_d(page)
            exigir(antes == despues, f"1440: el trazado se repite igual al repintar — {len(antes)}/{len(despues)}", fallas)
            page.locator('.ramo-card[data-ramo="G205"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#malla-lineas .malla-linea--req").count() >= 1,
                   "1440: elegir un ramo enciende lo que necesita", fallas)
            exigir(page.locator("#malla-lineas .malla-linea--des").count() >= 1,
                   "1440: elegir un ramo enciende lo que desbloquea", fallas)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        ctx, page, errores = nav.abrir(APP, 411, 900)
        page.on("dialog", lambda d: d.accept())
        try:
            cargar_malla(page)
            medir(page, "411", fallas)
            d = desborde(page)
            exigir(d == 0, f"411: malla sin desborde — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-malla-grafo", fallas)


if __name__ == "__main__":
    sys.exit(main())
