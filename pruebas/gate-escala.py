#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-escala.py — la letra se lee y la escala mueve la app entera.

Mide sobre app/index.html:
  1. el cuerpo y el editor de notas se leen a 14 px o más con la escala en 100;
  2. a 140 % la letra crece un 40 % y el factor --esc lo acompaña;
  3. los huecos crecen con la letra (el relleno de una tarjeta y el alto de la
     barra superior), no solo el texto;
  4. ninguna hoja de estilos deja tamaños de letra en píxeles;
  5. con los bloques instalados, ni 100 % ni 140 % desbordan a lo ancho.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
CSS = RAIZ / "app" / "css"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

PX = re.compile(r"font-size:\s*\d+(?:\.\d+)?px")
SECCIONES = ("calendario", "tareas", "notas", "malla", "calificaciones", "tiempo", "estudio", "ajustes")

MEDIDAS = """() => {
  const px = s => parseFloat(getComputedStyle(document.querySelector(s)).fontSize);
  const pad = s => parseFloat(getComputedStyle(document.querySelector(s)).paddingTop);
  const alto = s => document.querySelector(s).getBoundingClientRect().height;
  const esc = getComputedStyle(document.documentElement).getPropertyValue('--esc').trim();
  return {
    cuerpo: px('body'),
    nota: px('#nota-cuerpo'),
    campo: px('#buscar-nota'),
    relleno: pad('.card'),
    barra: alto('.topbar'),
    esc: Number(esc) || 1,
    roto: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,
                   document.body.scrollWidth - document.body.clientWidth),
  };
}"""


def medir(page):
    return page.evaluate(MEDIDAS)


def main() -> int:
    fallas: list[str] = []

    # 4) ninguna hoja deja la letra en píxeles.
    sueltos = []
    for hoja in sorted(CSS.rglob("*.css")):
        for num, linea in enumerate(hoja.read_text(encoding="utf-8").splitlines(), 1):
            if PX.search(linea):
                sueltos.append(f"{hoja.relative_to(RAIZ)}:{num}")
    exigir(not sueltos, f"css: ningún font-size en píxeles — {sueltos[:4]}", fallas)

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP)
        page.evaluate("""() => {
          const k = "mimo.shell.v1";
          const s = JSON.parse(localStorage.getItem(k) || "{}");
          s.instalados = ["tiempo", "malla", "calificaciones", "estudio"];
          localStorage.setItem(k, JSON.stringify(s));
        }""")
        page.goto(APP.as_uri(), wait_until="load")
        page.wait_for_timeout(700)
        page.locator('#tabs [data-ir="notas"]').click()
        page.wait_for_timeout(400)
        chico = medir(page)

        exigir(chico["cuerpo"] >= 14, f"letra: el cuerpo se lee a {chico['cuerpo']} px (mínimo 14)", fallas)
        exigir(chico["nota"] >= 14, f"letra: el editor de notas se lee a {chico['nota']} px (mínimo 14)", fallas)
        exigir(chico["campo"] >= 14, f"letra: un campo de texto se lee a {chico['campo']} px (mínimo 14)", fallas)

        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(300)
        page.locator("#pref-escala").select_option("140")
        page.wait_for_timeout(400)
        page.locator('#tabs [data-ir="notas"]').click()
        page.wait_for_timeout(400)
        grande = medir(page)

        crece = grande["cuerpo"] / chico["cuerpo"]
        exigir(crece > 1.35, f"letra: a 140 % el cuerpo crece a {grande['cuerpo']} px (×{crece:.2f})", fallas)
        exigir(abs(grande["esc"] - 1.4) < 0.01, f"letra: el factor de escala vale {grande['esc']} a 140 %", fallas)
        relleno = grande["relleno"] / chico["relleno"]
        exigir(relleno > 1.25, f"escala: el relleno de la tarjeta crece ×{relleno:.2f} ({chico['relleno']} → {grande['relleno']} px)", fallas)
        barra = grande["barra"] / chico["barra"]
        exigir(barra > 1.2, f"escala: la barra superior crece ×{barra:.2f} ({chico['barra']:.0f} → {grande['barra']:.0f} px)", fallas)

        rotos = []
        for seccion in SECCIONES:
            page.locator(f'#tabs [data-ir="{seccion}"]').click()
            page.wait_for_timeout(500)
            ancho = page.evaluate(
                "Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,"
                " document.body.scrollWidth - document.body.clientWidth)")
            if ancho:
                rotos.append(f"{seccion}={ancho}px")
        exigir(not rotos, f"escala: a 140 % ninguna sección desborda a lo ancho — {rotos}", fallas)

        exigir(not errores, f"sin errores de consola ({len(errores)}): {errores[:3]}", fallas)
        ctx.close()

    return salir("gate-escala", fallas)


if __name__ == "__main__":
    raise SystemExit(main())
