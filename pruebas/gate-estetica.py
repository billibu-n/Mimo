#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-estetica.py — el sistema visual, medido.

No mide "que se vea bonito": mide que la forma sea una sola.
  1. tokens: los 10 temas declaran las mismas variables y la escala existe.
  2. tipografia: toda la letra sale de los 8 tokens y ninguna baja de 11,2 px.
  3. contraste: los pares que la app promete (texto, acento, estado) pasan.
  4. disposicion: las 9 secciones no desbordan a 1440.
  5. semantica: el anillo de Tareas existe y se puede leer.

Las unidades E-01, E-14, E-17 y E-18 agregan sus asserts a este gate. El gate no
se pone rojo por una unidad que aun no se hace: solo contiene lo ya prometido.
"""
from __future__ import annotations

import re
import sys
from datetime import date, timedelta
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, abrir_seccion, exigir, salir  # noqa: E402

TEMAS = ("clasico", "bosque", "sepia", "pinky", "deepsea", "medianoche", "negro",
         "vino", "alto-contraste", "alto-contraste-claro")
SECCIONES = ("calendario", "tareas", "notas", "tiempo", "malla",
             "calificaciones", "estudio", "progreso", "ajustes")


def estado() -> dict:
    """Un estado con las 9 secciones instaladas y sin datos.

    No es el estado real de nadie: es el mínimo para que cada sección pinte su
    vacío y el gate pueda medir el armazón sin depender de un respaldo.
    """
    return {
        "tema": "clasico",
        "instalados": list(SECCIONES),
        "kits": {"academics": ["malla", "calificaciones", "estudio"]},
        "panel": {},
        "plegables": {},
        "tareas": [], "notas": [], "eventos": [], "sesiones": [],
        "cursos": [], "califs": {},
        "carrera": {"titulo": "", "universidad": "", "pais": ""},
        "estudio": {"metaSemanal": 10, "metasRamo": {}, "metasSemana": {}},
        "progreso": {"v": 1, "categorias": [], "metas": [], "registros": []},
        "prefs": {
            "inicioSemana": "lunes", "hora": "24", "panelAncho": "320",
            "navPos": "arriba", "idioma": "es", "escala": "100",
            "notificaciones": True, "navPlegada": False, "navOculta": False,
            "temaClaro": "clasico", "temaOscuro": "deepsea",
            "fuente": "clasica", "fuenteNombre": "", "ordenTabs": [],
            "catalogoOrigen": "todos", "catalogoTag": "",
        },
    }


def variables_de_tema(ruta: Path) -> set:
    texto = ruta.read_text(encoding="utf-8")
    return set(re.findall(r"--([a-z0-9-]+):", texto))


def rgb(valor: str) -> tuple:
    m = re.match(r"rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)", valor)
    if not m:
        raise ValueError(f"color no RGB: {valor!r}")
    return tuple(float(x) for x in m.groups())


def hex_rgb(valor: str) -> tuple:
    h = valor.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def luminancia(color: tuple) -> float:
    def canal(c: float) -> float:
        c = c / 255.0
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (canal(x) for x in color)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a: tuple, b: tuple) -> float:
    l1, l2 = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def abrir_estado(page, datos: dict) -> None:
    page.evaluate("e => localStorage.setItem('mimo.shell.v1', JSON.stringify(e))", datos)
    page.goto(APP.as_uri(), wait_until="load")
    page.wait_for_timeout(300)


def desborde_total(page) -> int:
    return int(page.evaluate("""() => {
      const c = document.querySelector('#contenido');
      return Math.max(
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        document.body.scrollWidth - document.body.clientWidth,
        c ? c.scrollWidth - c.clientWidth : 0
      );
    }"""))


def color_de(page, selector: str) -> tuple:
    return tuple(page.evaluate("""sel => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const s = getComputedStyle(e);
      return [s.color, s.backgroundColor];
    }""", selector))


def ratio_texto(page, selector: str, fondo_selector: str = "body") -> float:
    color = page.evaluate("sel => getComputedStyle(document.querySelector(sel)).color", selector)
    fondo = page.evaluate("sel => getComputedStyle(document.querySelector(sel)).backgroundColor", fondo_selector)
    return contraste(rgb(color), rgb(fondo))


def ratio_badge_q(page, tema: str) -> float:
    """El badge informativo de Progreso, medido en el tema que se le pida."""
    page.evaluate("t => { document.body.style.transition = 'none'; document.body.dataset.tema = t; }", tema)
    page.wait_for_timeout(60)
    color, fondo = page.evaluate("""() => {
      let p = document.getElementById('probe-estetica');
      if (!p) {
        p = document.createElement('div');
        p.id = 'probe-estetica';
        p.style.position = 'fixed';
        p.style.left = '-9999px';
        p.style.top = '0';
        document.body.appendChild(p);
      }
      p.innerHTML = '<span class="prog-badge prog-badge--q">x</span>';
      const s = getComputedStyle(p.firstChild);
      return [s.color, s.backgroundColor];
    }""")
    return contraste(rgb(color), rgb(fondo))


def fuentes_fuera_de_escala() -> list:
    """Devuelve cada `font-size` que no sale de un token `--fs-*`.

    Recorre el CSS de la app y el bloque critico de `index.html`. Un tamano en
    `rem` o en `px` que no venga de `var(--fs-...)` es deuda: rompe la escala y,
    en el caso del `px`, el ajuste de «Tamano de letra».
    """
    objetivos = sorted((RAIZ / "app" / "css").rglob("*.css"))
    objetivos.append(RAIZ / "app" / "index.html")
    fuera = []
    patron = re.compile(r"font-size\s*:\s*([^;}{]+)")
    for ruta in objetivos:
        texto = ruta.read_text(encoding="utf-8")
        base = 0
        if ruta.suffix == ".html":
            bloque = re.search(r"<style>(.*?)</style>", texto, re.S)
            if not bloque:
                continue
            base = texto[:bloque.start(1)].count("\n")
            texto = bloque.group(1)
        for m in patron.finditer(texto):
            valor = m.group(1).strip()
            if "var(--fs-" in valor:
                continue
            if "rem" in valor or "px" in valor:
                linea = base + texto[:m.start()].count("\n") + 1
                fuera.append(f"{ruta.relative_to(RAIZ)}:{linea} {valor}")
    return fuera


def main() -> int:
    fallas: list[str] = []

    # 1. tokens: los 10 temas comparten el mismo juego de variables.
    temas = sorted((RAIZ / "app" / "css" / "temas").glob("tema-*.css"))
    exigir(len(temas) == 10, f"temas: hay 10 archivos — {len(temas)}", fallas)
    if len(temas) != 10:
        return salir("gate-estetica", fallas)
    conjuntos = {p.stem: variables_de_tema(p) for p in temas}
    base = set.intersection(*conjuntos.values())
    exigir(all(base <= s for s in conjuntos.values()),
           f"temas: las mismas variables en los 10 — {len(base)} comunes", fallas)
    tokens = variables_de_tema(RAIZ / "app" / "css" / "tokens.css")
    for nombre in ("fs-xs", "fs-sm", "fs-md", "fs-lg", "fs-xl",
                   "fs-h1", "fs-num", "fs-display",
                   "sp-1", "sp-2", "sp-3", "sp-4", "r-sm", "r-md", "r-lg", "t"):
        exigir(nombre in tokens, f"tokens: existe --{nombre}", fallas)

    # E-01: ningun `font-size` suelto. Toda la letra sale de los 8 tokens.
    fuera = fuentes_fuera_de_escala()
    exigir(not fuera, f"tokens: font-size fuera de escala — {fuera[:3] or 'ninguno'}", fallas)

    # El texto secundario, medido sobre el color del tema (sin navegador).
    for ruta in temas:
        texto = ruta.read_text(encoding="utf-8")
        vals = dict(re.findall(r"--([a-z0-9-]+):(#[0-9a-fA-F]{6})", texto))
        if "muted" in vals and "bg" in vals:
            r = contraste(hex_rgb(vals["muted"]), hex_rgb(vals["bg"]))
            exigir(r >= 4.5, f"contraste {ruta.stem[5:]}: --muted sobre --bg — {r:.2f}", fallas)

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 900)
        try:
            abrir_estado(page, estado())
            exigir(not errores, f"app: sin errores de consola — {errores[:2]}", fallas)

            # E-01: el texto mas pequeno sigue siendo legible (>= 11,2 px).
            minimos = page.evaluate("""() => {
              let p = document.getElementById('probe-tipo');
              if (!p) {
                p = document.createElement('div');
                p.id = 'probe-tipo';
                p.style.cssText = 'position:fixed;left:-9999px;top:0';
                p.innerHTML =
                  '<span class="cod">12</span>' +
                  '<span class="cod cod--tab">3</span>' +
                  '<div class="nota-preview"><h6>t</h6><code>c</code><p>p</p></div>' +
                  '<span class="tareas-anillo__etq">a</span>' +
                  '<span class="prog-badge">b</span>' +
                  '<span class="footer__btn">f</span>';
                document.body.appendChild(p);
              }
              const salida = [...p.querySelectorAll('*')].map(e =>
                [String(e.className || e.tagName), parseFloat(getComputedStyle(e).fontSize)]);
              p.remove();
              return salida;
            }""")
            for clase, px in minimos:
                exigir(px >= 11.19, f"E-01: texto minimo 11,2 px — {clase}: {px}", fallas)

            # 2. contraste: lo que la app ya promete hoy.
            for tema in TEMAS:
                page.evaluate("t => { document.body.style.transition = 'none'; document.body.dataset.tema = t; }", tema)
                page.wait_for_timeout(80)
                # Texto secundario sobre el fondo de la página.
                color, fondo = color_de(page, "body")
                exigir(contraste(rgb(color), rgb(fondo)) >= 4.5,
                       f"contraste {tema}: --fg sobre --bg", fallas)
                rq = ratio_badge_q(page, tema)
                exigir(rq >= 4.5, f"contraste {tema}: badge Desde Estudio — {rq:.2f}", fallas)

            # 3. disposicion: 9 secciones a 1440 sin desborde.
            for seccion in SECCIONES:
                abrir_seccion(page, seccion)
                page.wait_for_timeout(120)
                ancho = desborde_total(page)
                exigir(ancho <= 0, f"disposicion {seccion}: sin desborde a 1440 — {ancho} px", fallas)

            # 4. semantica: el anillo de Tareas existe y tiene sectores.
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(120)
            circulos = page.locator("#tareas-anillo circle").count()
            exigir(circulos >= 1, f"semantica: el anillo de Tareas existe — {circulos} circulo(s)", fallas)

            # E-17: el anillo llena lo cumplido, no lo pendiente.
            hoy = date.today()
            lunes = hoy - timedelta(days=hoy.weekday())
            martes = lunes + timedelta(days=1)
            datos = estado()
            datos["tareas"] = [
                {"id": "t1", "titulo": "Hecha", "tipo": "tarea", "estado": "hecha",
                 "hecha": True, "prioridad": "media", "fecha": lunes.isoformat(),
                 "hechaEn": lunes.isoformat(), "contexto": "", "nota": "", "orden": 0},
                {"id": "t2", "titulo": "Pendiente", "tipo": "tarea", "estado": "pendiente",
                 "prioridad": "media", "fecha": martes.isoformat(), "contexto": "",
                 "nota": "", "orden": 1},
            ]
            abrir_estado(page, datos)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(220)
            anillo = page.locator("#tareas-anillo circle")
            exigir(anillo.count() == 2, f"E-17: anillo con pista y un solo arco — {anillo.count()}", fallas)
            if anillo.count() == 2:
                guion = anillo.nth(1).get_attribute("stroke-dasharray") or ""
                partes = [float(x) for x in re.findall(r"[\d.]+", guion)]
                proporcion = partes[0] / partes[1] if len(partes) >= 2 and partes[1] else 0
                exigir(abs(proporcion - 0.5) < 0.02,
                       f"E-17: el arco mide lo cumplido — {proporcion:.2f}", fallas)
                pct_txt = (page.locator("#tareas-anillo .tareas-anillo__pct").text_content() or "").strip()
                etq = (page.locator("#tareas-anillo .tareas-anillo__etq").text_content() or "").strip()
                exigir(pct_txt == "50%", f"E-17: el número es el % cumplido — {pct_txt}", fallas)
                exigir(etq in ("al día", "on track", "已完成"), f"E-17: la etiqueta dice al día — {etq}", fallas)

            # E-18: KPI, columna y filtro cuentan la misma cosa.
            datos = estado()
            datos["tareas"] = [{
                "id": "r1", "titulo": "Serie de la semana", "tipo": "tarea",
                "estado": "pendiente", "hecha": False, "prioridad": "media",
                "fecha": lunes.isoformat(), "contexto": "", "nota": "", "orden": 0,
                "recurrencia": {"frecuencia": "diaria", "intervalo": 1,
                                 "dias": [1, 2, 3, 4, 5], "desde": lunes.isoformat(),
                                 "fin": "nunca", "hasta": "", "veces": 10, "hechas": {}},
            }]
            abrir_estado(page, datos)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(220)
            kpi = page.locator("#kpi-hoy").inner_text().strip()
            col = page.locator(".tablero-col").first.locator("h3 span").inner_text().strip()
            filtro = page.locator("#tar-f-hoy").inner_text().strip()
            exigir(kpi == col == filtro,
                   f"E-18: KPI, columna y filtro coinciden — {kpi}/{col}/{filtro}", fallas)
            return salir("gate-estetica", fallas)
        finally:
            ctx.close()


if __name__ == "__main__":
    sys.exit(main())
