#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-diseno.py — gate G-DISENO de MIMO v2 (M10).

Mide la piel, no el gusto:
  1. 5 tamaños, 8 espacios, 3 radios y 1 duración en tokens.css
  2. 0 hex en base.css (los colores viven en tokens/temas)
  3. 10 temas, cada uno con la paleta completa y su foco
  4. el banco abre a 1440/1100/411 sin desborde y sin errores de consola
  5. contraste >= 4,5 en fg/bg, muted/bg, fg/sup y ac-txt/ac de cada tema
  6. "Aplicar" cambia el tema del body
  7. el recuadro del contenido: todas las secciones pintan el lienzo del tema
     (--sup2) con su borde, su radio y su relleno, en los 10 temas
  8. fixture roto: un tema con fg = bg debe salir 1

Uso:
  python3 pruebas/gate-diseno.py
  python3 pruebas/gate-diseno.py --demo
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
CSS = RAIZ / "app" / "css"
BANCO = AQUI / "banco-tokens.html"
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402

TEMAS = ["clasico", "deepsea", "medianoche", "negro", "vino", "bosque", "sepia", "pinky", "alto-contraste", "alto-contraste-claro"]
REQUERIDOS = ("--fg", "--bg", "--ac", "--ac-txt", "--ac-txt-fuerte", "--sup", "--line", "--muted", "--foco", "--sombra")
RE_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")


def rgb(texto: str):
    m = re.findall(r"[\d.]+", texto)
    if len(m) < 3:
        raise ValueError(f"color no RGB: {texto!r}")
    return tuple(float(x) for x in m[:3])


def luminancia(c):
    def canal(v):
        v /= 255.0
        return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
    r, g, b = (canal(x) for x in c)
    return .2126 * r + .7152 * g + .0722 * b


def contraste(a, b):
    la, lb = luminancia(rgb(a)), luminancia(rgb(b))
    return (max(la, lb) + .05) / (min(la, lb) + .05)


def revisar_css() -> list[str]:
    fallas: list[str] = []
    tokens = (CSS / "tokens.css").read_text(encoding="utf-8")
    base = (CSS / "base.css").read_text(encoding="utf-8")
    fs = len(re.findall(r"--fs-[a-z0-9-]+\s*:", tokens))
    sp = len(re.findall(r"--sp-[a-z0-9-]+\s*:", tokens))
    radios = len(re.findall(r"--r-(?:sm|md|lg)\s*:", tokens))
    dur = len(re.findall(r"--t\s*:", tokens))
    exigir(fs == 5, f"tokens: 5 tamaños — {fs}", fallas)
    exigir(sp == 8, f"tokens: 8 espacios — {sp}", fallas)
    exigir(radios == 3, f"tokens: 3 radios — {radios}", fallas)
    exigir(dur == 1, f"tokens: 1 duración — {dur}", fallas)
    hex_base = RE_HEX.findall(base)
    exigir(not hex_base, f"base.css: 0 hex fuera de tokens — {hex_base[:3]}", fallas)
    archivos = sorted((CSS / "temas").glob("*.css"))
    exigir(len(archivos) == 10, f"temas: 10 ficheros — {len(archivos)}", fallas)
    for tema in TEMAS:
        f = CSS / "temas" / f"tema-{tema}.css"
        if not f.exists():
            exigir(False, f"tema {tema}: falta {f.name}", fallas)
            continue
        texto = f.read_text(encoding="utf-8")
        exigir(f'[data-tema="{tema}"]' in texto, f"tema {tema}: selector [data-tema]", fallas)
        faltan = [v for v in REQUERIDOS if not re.search(rf"{re.escape(v)}\s*:", texto)]
        exigir(not faltan, f"tema {tema}: paleta completa — faltan {faltan}", fallas)
    # El recuadro del contenido: la regla no incrusta ni un color y se apoya en los
    # nombres del tema, para que funcione en los 10 sin tocar cada vista.
    regla = re.search(r"\.contenido > \.seccion\{([^}]*)\}", base)
    exigir(regla is not None, "recuadro: falta la regla .contenido > .seccion", fallas)
    if regla:
        cuerpo = re.sub(r"\s+", "", regla.group(1))
        for pieza in ("background:var(--lienzo)", "border:1pxsolidvar(--line)",
                      "border-radius:var(--r-lg)", "padding:var(--lienzo-pad)",
                      "max-width:var(--ancho-contenido)"):
            exigir(pieza in cuerpo, f"recuadro: la regla no dice «{pieza}»", fallas)
    exigir(re.search(r"--lienzo-pad\s*:", tokens) is not None,
           "recuadro: falta --lienzo-pad en tokens", fallas)
    exigir(re.search(r"\[data-tema\]\{--lienzo:var\(--sup2\)\}", re.sub(r"\s+", "", tokens)) is not None,
           "recuadro: el lienzo no sale del tema (--lienzo sale de --sup2)", fallas)
    return fallas


def revisar_banco(fichero: Path) -> list[str]:
    fallas: list[str] = []
    with Navegador() as nav:
        for ancho in (1440, 1100, 411):
            ctx, page, errores = nav.abrir(fichero, ancho, 900, reset=False)
            try:
                d = desborde(page)
                exigir(d == 0, f"{ancho}: banco sin desborde — {d}px", fallas)
                exigir(not errores, f"{ancho}: consola limpia — {errores[:3]}", fallas)
                if ancho == 1440:
                    exigir(page.locator(".muestra[data-tema]").count() == 10,
                           f"banco: 10 muestras de tema — {page.locator('.muestra[data-tema]').count()}", fallas)
                    for tema in TEMAS:
                        sel = f'.muestra[data-tema="{tema}"]'
                        m = page.locator(sel)
                        if m.count() != 1:
                            exigir(False, f"banco: falta la muestra {tema}", fallas)
                            continue
                        fg = m.evaluate("e => getComputedStyle(e).color")
                        bg = m.evaluate("e => getComputedStyle(e).backgroundColor")
                        muted = m.locator(".muted").first.evaluate("e => getComputedStyle(e).color")
                        card = m.locator(".card").first
                        card_fg = card.evaluate("e => getComputedStyle(e).color")
                        card_bg = card.evaluate("e => getComputedStyle(e).backgroundColor")
                        btn = m.locator(".btn-primario").first
                        btn_fg = btn.evaluate("e => getComputedStyle(e).color")
                        btn_bg = btn.evaluate("e => getComputedStyle(e).backgroundColor")
                        pares = [("fg/bg", fg, bg), ("muted/bg", muted, bg),
                                 ("fg/sup", card_fg, card_bg), ("ac-txt-fuerte/ac-fuerte", btn_fg, btn_bg)]
                        minimo = min(contraste(a, b) for _, a, b in pares)
                        exigir(minimo >= 4.5, f"contraste {tema}: mínimo {minimo:.2f} — {pares}", fallas)
                    page.locator('[data-aplicar="deepsea"]').click()
                    page.wait_for_timeout(80)
                    exigir(page.locator("body").get_attribute("data-tema") == "deepsea",
                           "banco: Aplicar cambia data-tema del body", fallas)
            finally:
                ctx.close()
    return fallas


def roto() -> list[str]:
    with tempfile.NamedTemporaryFile("w", suffix=".html", dir=AQUI, delete=False, encoding="utf-8") as fh:
        html = BANCO.read_text(encoding="utf-8")
        html = html.replace("</head>", '<style>[data-tema="clasico"]{--fg:#f8fafc}</style></head>', 1)
        fh.write(html)
        ruta = Path(fh.name)
    try:
        fallas = revisar_banco(ruta)
    finally:
        ruta.unlink(missing_ok=True)
    return fallas


def controles() -> list[str]:
    """Los controles nativos y del catálogo no se pierden en ningún tema."""
    fallas: list[str] = []
    oscuros = {"deepsea", "medianoche", "negro", "vino", "alto-contraste"}
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.locator("#btn-ajustes").click()
            page.wait_for_timeout(150)
            page.locator("#btn-add").click()
            page.wait_for_timeout(200)
            for tema in TEMAS:
                page.evaluate("t => document.body.setAttribute('data-tema', t)", tema)
                page.wait_for_timeout(40)
                scheme = page.evaluate("getComputedStyle(document.body).colorScheme")
                exigir(scheme == ("dark" if tema in oscuros else "light"),
                       f"controles {tema}: color-scheme {scheme}", fallas)
                vals = page.evaluate("""() => {
                  const sels = ['#pref-tema-claro', '#pref-hora', '.catalogo-buscar__campo',
                                '#catalogo .etiqueta', '#catalogo-filtros .cchip[aria-pressed="true"]'];
                  return sels.map(sel => {
                    const e = document.querySelector(sel);
                    if (!e) return null;
                    const c = getComputedStyle(e);
                    return {sel: sel, color: c.color, bg: c.backgroundColor};
                  });
                }""")
                for v in vals:
                    if not v or "rgba(0, 0, 0, 0)" in v["bg"]:
                        continue
                    ratio = contraste(v["color"], v["bg"])
                    exigir(ratio >= 4.5,
                           f"controles {tema}{v['sel']}: contraste {ratio:.2f}", fallas)
            exigir(not errores, f"controles: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return fallas


def recuadro() -> list[str]:
    """El recuadro del contenido: la capa que le daba color a Mimo Académics.

    No es decoración de una sección: TODAS pintan el lienzo del tema, con el mismo
    borde, el mismo radio y el mismo relleno. Se mide contra una sonda que lleva los
    nombres del tema, así el gate no repite ni un color a mano.
    """
    fallas: list[str] = []
    SONDA = """() => {
      const s = document.createElement('i');
      s.style.cssText = 'position:absolute;visibility:hidden;background:var(--sup2);'
        + 'border:1px solid var(--line);border-radius:var(--r-lg);padding:var(--lienzo-pad);';
      document.body.appendChild(s);
      const c = getComputedStyle(s);
      const out = {fondo: c.backgroundColor, borde: c.borderTopColor, radio: c.borderTopLeftRadius,
                   relleno: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft]};
      s.remove();
      out.pagina = getComputedStyle(document.body).backgroundColor;
      return out;
    }"""
    VISTO = """() => {
      const s = document.querySelector('.contenido > .seccion:not([hidden])');
      if (!s) return null;
      const c = getComputedStyle(s);
      return {id: s.getAttribute('data-pantalla'), fondo: c.backgroundColor,
              borde: c.borderTopColor, ancho: c.borderTopWidth, radio: c.borderTopLeftRadius,
              relleno: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft],
              maxw: c.maxWidth,
              desborde: Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth,
                                 document.body.scrollWidth - document.body.clientWidth)};
    }"""
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            secciones = page.evaluate(
                "Array.from(document.querySelectorAll('.contenido > .seccion[data-pantalla]'))"
                ".map(e => e.getAttribute('data-pantalla'))")
            exigir(len(secciones) >= 4, f"recuadro: secciones en el contenido — {secciones}", fallas)
            for tema in TEMAS:
                page.evaluate("t => document.body.setAttribute('data-tema', t)", tema)
                page.wait_for_timeout(30)
                esperado = page.evaluate(SONDA)
                for sid in secciones:
                    page.locator(f'#tabs [data-ir="{sid}"]').click()
                    page.wait_for_timeout(120)
                    visto = page.evaluate(VISTO)
                    if not visto:
                        exigir(False, f"recuadro {tema}/{sid}: no hay sección visible", fallas)
                        continue
                    nombre = f"recuadro {tema}/{visto['id']}"
                    exigir(visto["fondo"] != "rgba(0, 0, 0, 0)",
                           f"{nombre}: la sección tiene lienzo", fallas)
                    exigir(visto["fondo"] == esperado["fondo"],
                           f"{nombre}: lienzo del tema — {visto['fondo']} vs {esperado['fondo']}", fallas)
                    exigir(visto["ancho"] == "1px" and visto["borde"] == esperado["borde"],
                           f"{nombre}: borde de 1 px del tema — {visto['ancho']} {visto['borde']}", fallas)
                    exigir(visto["radio"] == esperado["radio"],
                           f"{nombre}: radio — {visto['radio']} vs {esperado['radio']}", fallas)
                    exigir(visto["relleno"] == esperado["relleno"],
                           f"{nombre}: relleno — {visto['relleno']} vs {esperado['relleno']}", fallas)
                    exigir(visto["maxw"] == "1240px", f"{nombre}: ancho máximo — {visto['maxw']}", fallas)
                    exigir(visto["desborde"] == 0, f"{nombre}: no desborda la ventana — {visto['desborde']}px", fallas)
                    # La capa se tiene que leer: en el tema de alto contraste claro el
                    # lienzo es blanco a propósito (el marco lo dibuja el borde negro).
                    if tema != "alto-contraste-claro":
                        exigir(visto["fondo"] != esperado["pagina"],
                               f"{nombre}: el lienzo se despega del fondo de la página", fallas)
            exigir(not errores, f"recuadro: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return fallas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    fallas = revisar_css() + revisar_banco(BANCO) + controles() + recuadro()
    codigo = salir("gate-diseno", fallas)
    if not args.demo:
        return codigo
    fallas_rotas = roto()
    codigo_roto = salir("gate-diseno/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: el banco bueno no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
