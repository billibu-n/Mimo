#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""medir-tablero.py — contador del sistema visual del tablero de Mimo D1.

Barre el CSS de tablero/direcciones.html, quita los comentarios y, para cada
dirección, cuenta cuántos VALORES DISTINTOS usa de tamaños, espacios, radios,
duraciones y colores hex. Los hex solo pueden vivir en los bloques :root de
tokens: fuera de ellos el techo es 0. Sale 1 si alguna dirección pasa su techo.

Uso:
  python3 medir-tablero.py                 # mide el tablero
  python3 medir-tablero.py --autoprueba    # 5 casos; uno OBLIGADO en rojo
"""

import os
import re
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
TABLERO = os.path.join(AQUI, "direcciones.html")

# Techos declarados por el Lead (los valores de cada dirección).
TECHOS = {
    "a": {"tamanos": 5, "espacios": 8, "radios": 2, "duraciones": 2, "hex": 0},
    "b": {"tamanos": 5, "espacios": 8, "radios": 2, "duraciones": 2, "hex": 0},
    "c": {"tamanos": 5, "espacios": 8, "radios": 2, "duraciones": 3, "hex": 0},
}
NOMBRES = {"a": "A · Papel y tinta", "b": "B · Instrumento", "c": "C · Materia"}
ETIQUETAS = [
    ("tamanos", "tamaños"),
    ("espacios", "espacios"),
    ("radios", "radios"),
    ("duraciones", "duraciones"),
    ("hex", "hex"),
]

PROPS_ESPACIO = {
    "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
    "margin-block", "margin-block-start", "margin-block-end",
    "margin-inline", "margin-inline-start", "margin-inline-end",
    "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
    "padding-block", "padding-block-start", "padding-block-end",
    "padding-inline", "padding-inline-start", "padding-inline-end",
    "gap", "row-gap", "column-gap",
}
PROPS_RADIO = {
    "border-radius", "border-top-left-radius", "border-top-right-radius",
    "border-bottom-left-radius", "border-bottom-right-radius",
}
PROPS_DURACION = {"transition-duration", "animation-duration"}
RE_HEX = re.compile(r"#[0-9a-fA-F]{3,8}\b")
RE_PX = re.compile(r"^-?\d*\.?\d+px$")
RE_TIEMPO = re.compile(r"\d*\.?\d+m?s\b")


def quitar_comentarios(css):
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def reglas(css, contexto=""):
    """Devuelve (selector_con_contexto, cuerpo) para reglas normales y @media."""
    i = 0
    buf = ""
    while i < len(css):
        c = css[i]
        if c == "{":
            sel = " ".join(buf.split())
            buf = ""
            hondo = 1
            j = i + 1
            while j < len(css) and hondo:
                if css[j] == "{":
                    hondo += 1
                elif css[j] == "}":
                    hondo -= 1
                j += 1
            cuerpo = css[i + 1:j - 1]
            if sel.startswith("@"):
                yield from reglas(cuerpo, (contexto + " " + sel).strip())
            else:
                yield (contexto + " " + sel).strip(), cuerpo
            i = j
        elif c == "}":
            buf = ""
            i += 1
        else:
            buf += c
            i += 1


def declaraciones(cuerpo):
    for trozo in cuerpo.split(";"):
        if ":" not in trozo:
            continue
        prop, valor = trozo.split(":", 1)
        prop = prop.strip().lower()
        valor = valor.replace("!important", "").strip()
        if prop and valor:
            yield prop, valor


def valor_px(t):
    return t.strip() if RE_PX.match(t.strip()) else None


def normaliza_tiempo(t):
    if t.endswith("ms"):
        return int(round(float(t[:-2])))
    if t.endswith("s"):
        return int(round(float(t[:-1]) * 1000))
    return None


def analizar(css):
    """Devuelve {dir: {'tamanos': set, ...}, 'comun': {...}, 'hex_global': set}."""
    css = quitar_comentarios(css)
    cuenta = {d: {k: set() for k, _ in ETIQUETAS} for d in ("a", "b", "c")}
    cuenta["comun"] = {k: set() for k, _ in ETIQUETAS}
    hex_global = set()

    for selector, cuerpo in reglas(css):
        if selector.strip().lower() == ":root":
            continue  # el cajón de tokens no se mide
        m = re.search(r'\[data-dir="([abc])"\]', selector)
        destino = cuenta[m.group(1)] if m else cuenta["comun"]
        for prop, valor in declaraciones(cuerpo):
            for h in RE_HEX.findall(valor):
                hex_global.add(h.lower())
                destino["hex"].add(h.lower())
            if prop == "font-size":
                t = valor_px(valor)
                if t and t != "0px":
                    destino["tamanos"].add(t)
            elif prop in PROPS_ESPACIO:
                for t in re.split(r"[\s/]+", valor):
                    px = valor_px(t)
                    if px and px not in ("0px", "-0px"):
                        destino["espacios"].add(px)
            elif prop in PROPS_RADIO:
                for t in re.split(r"[\s/]+", valor):
                    if re.match(r"^-?\d*\.?\d+(px|%)$", t) and t != "0px":
                        destino["radios"].add(t)
            elif prop in PROPS_DURACION:
                for t in RE_TIEMPO.findall(valor):
                    ms = normaliza_tiempo(t)
                    if ms is not None:
                        destino["duraciones"].add(ms)
            elif prop in ("transition", "animation"):
                for t in RE_TIEMPO.findall(valor):
                    ms = normaliza_tiempo(t)
                    if ms is not None:
                        destino["duraciones"].add(ms)
    return cuenta, hex_global


def orden(conjunto):
    def clave(v):
        if isinstance(v, int):
            return (0, v)
        try:
            return (0, float(re.sub(r"[a-z%]+$", "", v)))
        except ValueError:
            return (1, str(v))

    return sorted(conjunto, key=clave)


def formatea(conjunto):
    vals = orden(conjunto)
    if not vals:
        return "—"
    return ", ".join(str(v) for v in vals)


def evaluar(css):
    """Devuelve (texto, rojo). rojo=True si se pasa algún techo."""
    cuenta, hex_global = analizar(css)
    lineas = []
    rojo = False
    for d in ("a", "b", "c"):
        lineas.append("DIRECCIÓN %s" % NOMBRES[d])
        for clave, etiqueta in ETIQUETAS:
            n = len(cuenta[d][clave])
            techo = TECHOS[d][clave]
            marca = "OK" if n <= techo else "PASA EL TECHO"
            if n > techo:
                rojo = True
            sufijo = " ms" if clave == "duraciones" and n else ""
            lineas.append("  %-10s %2d/%-2d  %-14s  [%s]%s"
                          % (etiqueta, n, techo, marca, formatea(cuenta[d][clave]), sufijo))
        lineas.append("")
    if hex_global:
        rojo = True
        lineas.append("Hex fuera de los tokens (toda la hoja): %d -> %s"
                      % (len(hex_global), ", ".join(orden(hex_global))))
    else:
        lineas.append("Hex fuera de los tokens (toda la hoja): 0")
    if cuenta["comun"]["hex"]:
        rojo = True
    return "\n".join(lineas), rojo


def css_del_fichero(ruta):
    with open(ruta, "r", encoding="utf-8") as f:
        texto = f.read()
    if ruta.endswith(".html"):
        trozos = re.findall(r"<style[^>]*>(.*?)</style>", texto, flags=re.S)
        if not trozos:
            raise SystemExit("ERROR: %s no trae ningún <style>." % ruta)
        return "\n".join(trozos)
    return texto


# ----------------------------------------------------------------- autoprueba
CASO_BASE = """
:root{ --x:#123456; --y:#abcdef; }
[data-dir="a"] .x{font-size:12px; font-size:14px; padding:4px 8px; gap:12px; border-radius:2px; transition-duration:140ms}
[data-dir="b"] .x{font-size:13px; padding:4px; border-radius:4px; transition-duration:90ms}
[data-dir="c"] .x{font-size:17px; padding:16px; border-radius:16px; transition-duration:240ms}
"""

CASOS = [
    ("AU-1 · escala dentro de techo", CASO_BASE, False),
    ("AU-2 · un tamaño de más en A",
     CASO_BASE.replace("font-size:14px;", "font-size:14px; font-size:16px; font-size:18px; font-size:22px; font-size:28px;"),
     True),
    ("AU-3 · hex fuera de los tokens",
     CASO_BASE + '[data-dir="a"] .y{color:#ffffff; background:#000}\n',
     True),
    ("AU-4 · comentarios que parecen valores",
     ''':root{--x:#123456}
       /* [data-dir="a"] .falso{font-size:99px; padding:77px; color:#ff0000} */
       [data-dir="a"] .x{font-size:12px; padding:4px; border-radius:2px; transition-duration:140ms}
     ''',
     False),
    ("AU-5 · nueve espacios en B",
     CASO_BASE + '[data-dir="b"] .y{padding:4px 8px 12px 16px 20px 24px 32px 40px 44px}\n',
     True),
]


def autoprueba():
    fallos = 0
    rojos_vistos = 0
    for nombre, css, espera_rojo in CASOS:
        _texto, rojo = evaluar(css)
        if rojo:
            rojos_vistos += 1
        bien = (rojo == espera_rojo)
        if not bien:
            fallos += 1
        print("%-38s esperado=%s  medido=%s  %s"
              % (nombre, "ROJO" if espera_rojo else "verde",
                 "ROJO" if rojo else "verde", "OK" if bien else "FALLA"))
    print("")
    print("Casos: %d · rojos vistos: %d · fallos: %d" % (len(CASOS), rojos_vistos, fallos))
    if rojos_vistos < 1:
        print("FALLA: la autoprueba no ha enseñado ningún rojo; el contador no vale.")
        return 1
    return 0 if fallos == 0 else 1


def main():
    if "--autoprueba" in sys.argv:
        return autoprueba()
    ruta = TABLERO
    for i, a in enumerate(sys.argv):
        if a in ("--fichero", "-f") and i + 1 < len(sys.argv):
            ruta = sys.argv[i + 1]
    texto, rojo = evaluar(css_del_fichero(ruta))
    print("TABLERO: %s" % ruta)
    print(texto)
    print("")
    if rojo:
        print("RESUMEN: hay una dirección por encima de su techo.")
        return 1
    print("RESUMEN: las tres direcciones dentro de su techo.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
