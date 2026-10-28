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
  7. fixture roto: un tema con fg = bg debe salir 1

Uso:
  python3 app/pruebas/gate-diseno.py
  python3 app/pruebas/gate-diseno.py --demo
"""
from __future__ import annotations

import argparse
import re
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
CSS = RAIZ / "app" / "css"
BANCO = AQUI / "banco-tokens.html"

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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    fallas = revisar_css() + revisar_banco(BANCO)
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
