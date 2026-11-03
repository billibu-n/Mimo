#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-identidad.py — cada ramo con su color y su icono, iguales en toda la app.

La ronda R102 sacó el color de cada vista y lo puso en un solo sitio
(`js/dominio/identidad.js`): el usuario elige color e icono desde Calificaciones
(en la ventana única) y esa identidad se pinta en Calificaciones, Estudio, Malla,
Tiempo, Calendario, Tareas y Notas.

Mide:
  1. una sola fuente: el módulo cargado y ninguna vista repartiendo color por índice;
  2. el botón de identidad abre `#modal-editor` con la paleta y el catálogo de iconos;
  3. elegir color e icono guarda `color` e `icono` en el ramo (id del icono, no SVG);
  4. sobrevive a recargar;
  5. la misma identidad se ve en las siete secciones, sin repetir el hex por vista;
  6. teclado: una muestra de la paleta y un icono se activan con Enter;
  7. criterio estable: el color automático no depende del orden ni de los otros ramos.

Uso:
  python3 pruebas/gate-identidad.py
  python3 pruebas/gate-identidad.py --demo
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
MODULO = RAIZ / "app" / "js" / "dominio" / "identidad.js"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

SEMILLA = """() => {
  const e = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
  e.instalados = ['tiempo', 'estudio', 'calificaciones', 'malla'];
  e.cursos = [
    { codigo: 'FI2001', nombre: 'Mecánica', creditos: 6, nivel: 2, enCurso: true, requisitos: [], requisitos_o: [] },
    { codigo: 'MA1001', nombre: 'Cálculo', creditos: 6, nivel: 1, enCurso: true, requisitos: [], requisitos_o: [] }
  ];
  e.califs = {};
  const hoy = new Date();
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  e.eventos = [{ id: 'ev1', titulo: 'Control 1', fecha: iso(hoy), hora: '10:00', contexto: 'FI2001', nota: '' }];
  e.tareas = [{ id: 't1', titulo: 'Entrega', tipo: 'tarea', padre_id: null, fecha: iso(hoy),
                prioridad: 'media', contexto: 'FI2001', nota: '', estado: 'pendiente', hecha: false,
                creada: '2026-10-01T10:00:00.000Z', orden: 0 }];
  e.sesiones = [{ id: 's1', fecha: '2026-10-02', hora: '', minutos: 90, ramo: 'FI2001', vinculo: '', tipo: 'manual' }];
  localStorage.setItem('mimo.shell.v1', JSON.stringify(e));
}"""


def datos(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}')")


def identidad(page, codigo):
    return page.evaluate("""cod => {
        const d = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
        const c = (d.cursos || []).find(x => x.codigo === cod) || {};
        return {color: c.color || null, icono: c.icono || null,
                pintado: window.MimoIdentidad ? MimoIdentidad.colorDe(c) : null,
                iconoPintado: window.MimoIdentidad ? MimoIdentidad.iconoDe(c) : null};
    }""", codigo)


def celdas(page):
    """Mide la grilla: alto de cada celda, dónde cae el icono y dónde la etiqueta."""
    return page.evaluate("""() => [...document.querySelectorAll('.ident-ico')].map(c => {
        const svg = c.querySelector('.ramo-ico'), nom = c.querySelector('.ident-ico__nom');
        if (!svg || !nom) return {sin: true};
        const rc = c.getBoundingClientRect(), rs = svg.getBoundingClientRect(), rn = nom.getBoundingClientRect();
        const r = document.createRange(); r.selectNodeContents(nom);
        return {h: +rc.height.toFixed(1), topIco: +(rs.top - rc.top).toFixed(1),
                topNom: +(rn.top - rc.top).toFixed(1), hueco: +(rn.top - rs.bottom).toFixed(1),
                lineas: r.getClientRects().length, texto: nom.textContent.trim(),
                corta: nom.scrollHeight > nom.clientHeight + 1,
                ancho: nom.scrollWidth > nom.clientWidth + 1,
                fuera: rn.bottom > rc.bottom + 0.5 || rn.right > rc.right + 0.5};
    })""")


def exigir_grilla_pareja(page, etiqueta, fallas, dos_lineas=False):
    """Todas las celdas iguales: mismo alto, icono y etiqueta a la misma altura."""
    filas = celdas(page)
    if any(f.get("sin") for f in filas):
        exigir(False, f"{etiqueta}: cada celda lleva icono y etiqueta", fallas)
        return
    altos = {f["h"] for f in filas}
    arribaIco = {f["topIco"] for f in filas}
    arribaNom = {f["topNom"] for f in filas}
    huecos = {f["hueco"] for f in filas}
    exigir(len(altos) == 1, f"{etiqueta}: todas las celdas miden lo mismo — {sorted(altos)[:4]}", fallas)
    exigir(len(arribaIco) == 1, f"{etiqueta}: el icono cae a la misma altura — {sorted(arribaIco)[:4]}", fallas)
    exigir(len(arribaNom) == 1, f"{etiqueta}: la etiqueta cae a la misma altura — {sorted(arribaNom)[:4]}", fallas)
    exigir(min(huecos) >= 2, f"{etiqueta}: hay aire entre icono y etiqueta — {sorted(huecos)[:4]}", fallas)
    exigir(all(f["texto"] for f in filas), f"{etiqueta}: ninguna celda sin nombre", fallas)
    malas = [f["texto"] for f in filas if f["corta"] or f["ancho"] or f["fuera"]]
    exigir(not malas, f"{etiqueta}: ninguna etiqueta se sale — {malas[:4]}", fallas)
    if dos_lineas:
        exigir(any(f["lineas"] >= 2 for f in filas),
               f"{etiqueta}: hay etiquetas de dos líneas y la fila no se descuadra", fallas)


def ver_en(page, pestana, selector, icono):
    page.locator(f'#tabs [data-ir="{pestana}"]').click()
    page.wait_for_timeout(320)
    return page.evaluate("""sel => !!document.querySelector(sel)""", selector.replace("ICONO", icono))


def main() -> int:
    fallas: list[str] = []
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    # 1) una sola fuente
    exigir(MODULO.exists(), "identidad: existe js/dominio/identidad.js", fallas)
    indice = (RAIZ / "app" / "index.html").read_text(encoding="utf-8")
    exigir("js/dominio/identidad.js" in indice, "identidad: index.html carga el módulo", fallas)
    shell = (RAIZ / "app" / "js" / "shell.js").read_text(encoding="utf-8")
    exigir("PALETA_ESTUDIO[estado.cursos.length" not in shell,
           "identidad: ninguna vista reparte color por índice", fallas)
    exigir("Math.random" not in MODULO.read_text(encoding="utf-8"),
           "identidad: el color automático no usa azar", fallas)

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.evaluate(SEMILLA)
        page.goto(APP.as_uri(), wait_until="load")
        page.wait_for_timeout(500)
        try:
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(350)
            page.locator('[data-calif="FI2001"]').click()
            page.wait_for_timeout(250)

            # 2) la ventana única con paleta y catálogo
            boton = page.locator('[data-accion-calif="identidad"]')
            exigir(boton.count() == 1, "identidad: la ficha ofrece el botón", fallas)
            boton.click()
            page.wait_for_timeout(300)
            capa = page.locator("#modal-editor")
            exigir(capa.is_visible() and capa.get_attribute("data-editor") == "identidad",
                   "identidad: abre la ventana única", fallas)
            exigir(page.locator(".ident-color").count() == 9, "identidad: paleta de 9", fallas)
            exigir(page.locator("#ident-color").get_attribute("type") == "color",
                   "identidad: hay selector RGB", fallas)

            # 2b) el catálogo ampliado, con su buscador y su filtro
            total = page.evaluate("window.MimoIconosRamo ? MimoIconosRamo.ICONOS.length : 0")
            cats = page.evaluate("window.MimoIconosRamo ? MimoIconosRamo.CATEGORIAS.length : 0")
            exigir(total >= 100, f"catálogo: al menos 100 iconos — {total}", fallas)
            exigir(cats >= 10, f"catálogo: al menos 10 categorías — {cats}", fallas)
            exigir(page.locator(".ident-ico").count() == total,
                   f"catálogo: la grilla los pinta todos — {page.locator('.ident-ico').count()}", fallas)
            page.locator('[data-ident-cat="ingenieria"]').click()
            page.wait_for_timeout(200)
            filtrados = page.locator(".ident-ico").count()
            exigir(0 < filtrados < total, f"filtro: la categoría recorta — {filtrados}", fallas)
            page.locator('[data-ident-cat="todas"]').click()
            page.wait_for_timeout(150)
            page.locator("#ident-buscar").fill("mecánica")
            page.wait_for_timeout(300)
            buscados = page.locator(".ident-ico").count()
            exigir(0 < buscados < total, f"búsqueda: «mecánica» devuelve — {buscados}", fallas)
            exigir(page.locator("#ident-cuenta").inner_text().startswith(str(buscados)),
                   "búsqueda: la cuenta dice cuántos quedan", fallas)
            page.locator("#ident-buscar").fill("")
            page.wait_for_timeout(250)

            # 2c) la grilla, pareja en los tres idiomas y en los diez temas
            exigir_grilla_pareja(page, "grilla es", fallas, dos_lineas=True)
            for tema in ("clasico", "deepsea", "medianoche", "negro", "vino", "bosque", "sepia",
                         "pinky", "alto-contraste", "alto-contraste-claro"):
                page.evaluate("t => document.body.setAttribute('data-tema', t)", tema)
                page.wait_for_timeout(50)
                exigir_grilla_pareja(page, f"grilla {tema}", fallas)
            page.evaluate("() => document.body.setAttribute('data-tema', 'clasico')")
            for idioma, nombre in (("en", "grilla en"), ("zh", "grilla zh")):
                page.locator("#modal-cancelar").click()
                page.wait_for_timeout(150)
                page.locator('#tabs [data-ir="ajustes"]').click()
                page.wait_for_timeout(250)
                page.locator("#pref-idioma").select_option(idioma)
                page.wait_for_timeout(350)
                page.locator('#tabs [data-ir="calificaciones"]').click()
                page.wait_for_timeout(300)
                page.locator('[data-accion-calif="identidad"]').click()
                page.wait_for_timeout(350)
                exigir_grilla_pareja(page, nombre, fallas)
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(150)
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(250)
            page.locator("#pref-idioma").select_option("es")
            page.wait_for_timeout(300)
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(250)
            page.locator('[data-accion-calif="identidad"]').click()
            page.wait_for_timeout(300)

            # 6) teclado: un color de la paleta y un icono con Enter
            muestra = page.locator('[data-ident-color="#dc2626"]')
            muestra.focus()
            page.keyboard.press("Enter")
            page.wait_for_timeout(150)
            exigir(muestra.get_attribute("aria-pressed") == "true", "teclado: la muestra de color se activa", fallas)
            exigir(page.locator("#ident-color").input_value() == "#dc2626",
                   "teclado: el selector RGB toma la muestra", fallas)
            icono_btn = page.locator('[data-ident-icono="i-ramo-libro"]')
            icono_btn.focus()
            page.keyboard.press("Enter")
            page.wait_for_timeout(150)
            exigir(icono_btn.get_attribute("aria-pressed") == "true", "teclado: el icono se activa", fallas)

            # 3) guardar
            page.locator("#modal-guardar").click()
            page.wait_for_timeout(500)
            exigir(not capa.is_visible(), "identidad: al guardar se cierra", fallas)
            ident = identidad(page, "FI2001")
            exigir(ident["color"] == "#dc2626" and ident["icono"] == "i-ramo-libro",
                   f"identidad: queda guardada — {ident}", fallas)

            # 5) la misma identidad en las siete secciones
            page.locator('#tabs [data-ir="calificaciones"]').click()
            page.wait_for_timeout(350)
            exigir(page.locator('#calif-lista .ramo-ico use[href="#i-ramo-libro"]').count() == 1,
                   "calificaciones: el ramo lleva su icono en la lista", fallas)
            exigir(page.locator('#calif-detalle .calif-cab__izq .ramo-ico use[href="#i-ramo-libro"]').count() == 1,
                   "calificaciones: la cabecera lleva su icono", fallas)
            # 2d) el icono al lado del texto no se pega y queda centrado con él
            marcas = page.evaluate("""() => [...document.querySelectorAll('.calif-item__nom')].map(f => {
                const svg = f.querySelector('.ramo-ico'), b = f.querySelector('b');
                if (!svg || !b) return null;
                const rs = svg.getBoundingClientRect(), rb = b.getBoundingClientRect();
                return {hueco: +(rb.left - rs.right).toFixed(1),
                        centros: +Math.abs((rs.top + rs.bottom) / 2 - (rb.top + rb.bottom) / 2).toFixed(1)};
            }).filter(Boolean)""")
            exigir(len(marcas) >= 2, "lista: cada ramo lleva su icono", fallas)
            exigir(all(m["hueco"] >= 3 for m in marcas),
                   f"lista: el icono no se pega al código — {[m['hueco'] for m in marcas][:4]}", fallas)
            exigir(all(m["centros"] <= 2 for m in marcas),
                   f"lista: icono y código comparten centro — {[m['centros'] for m in marcas][:4]}", fallas)
            exigir(ver_en(page, "estudio", '#est-tabla .ramo-ico use[href="#ICONO"]', "i-ramo-libro"),
                   "estudio: la fila del ramo lleva su icono", fallas)
            exigir(ver_en(page, "malla", '.ramo-card .ramo-ico use[href="#ICONO"]', "i-ramo-libro"),
                   "malla: la tarjeta lleva su icono", fallas)
            exigir(ver_en(page, "tiempo", '#tiempo-lista-sesiones .plegable__tit .ramo-ico use[href="#ICONO"]', "i-ramo-libro"),
                   "tiempo: el grupo de sesiones lleva su icono", fallas)
            page.locator('#tabs [data-ir="calendario"]').click()
            page.wait_for_timeout(350)
            exigir(page.evaluate("""() => {
                const chip = document.querySelector('#cal-grid .evento-chip');
                if (!chip) return false;
                const cs = getComputedStyle(chip);
                // El chip tintado conserva el color del ramo en el borde izquierdo;
                // el fondo ya no es el color plano, sino su mezcla con la superficie.
                return cs.borderLeftColor === 'rgb(220, 38, 38)' &&
                       cs.borderLeftWidth === '3px' &&
                       (chip.getAttribute('style') || '').indexOf('--chip:#dc2626') !== -1;
            }"""), "calendario: el chip usa el color del ramo en el borde", fallas)
            page.locator("#vista-calendario [data-cal-vista='agenda']").click()
            page.wait_for_timeout(300)
            exigir(page.locator('.cal-agenda__item .ramo-ico use[href="#i-ramo-libro"]').count() >= 1,
                   "calendario: la agenda lleva el icono del ramo", fallas)
            page.locator('#tabs [data-ir="tareas"]').click()
            page.wait_for_timeout(300)
            page.locator('#vista-tareas [data-vista="tablero"]').click()
            page.wait_for_timeout(300)
            exigir(page.locator('.tarjeta-tarea .ramo-punto').count() >= 1,
                   "tareas: la tarjeta marca el color del contexto", fallas)

            # 4) sobrevive a recargar
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(600)
            ident = identidad(page, "FI2001")
            exigir(ident["color"] == "#dc2626" and ident["icono"] == "i-ramo-libro",
                   f"identidad: sobrevive a recargar — {ident}", fallas)

            # 7) criterio estable: ni el orden ni los otros ramos cambian el color
            antes = page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                return d.cursos.map(c => [c.codigo, MimoIdentidad.colorDe(c)]); }""")
            page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                d.cursos.reverse();
                d.cursos.push({ codigo: 'ZZ9999', nombre: 'Nuevo', creditos: 3, nivel: 1, requisitos: [], requisitos_o: [] });
                localStorage.setItem('mimo.shell.v1', JSON.stringify(d)); }""")
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(600)
            despues = page.evaluate("""() => { const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                return d.cursos.map(c => [c.codigo, MimoIdentidad.colorDe(c)]); }""")
            mapa_antes = dict(antes)
            for cod, color in despues:
                if cod in mapa_antes:
                    exigir(mapa_antes[cod] == color, f"estable: {cod} conserva su color ({color})", fallas)

            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

    codigo = salir("gate-identidad", fallas)
    if not args.demo:
        return codigo
    fallas_rotas = roto()
    codigo_roto = salir("gate-identidad/roto", fallas_rotas)
    if codigo != 0:
        print("ROJO: la app buena no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


def roto() -> list[str]:
    """Fixture sin el módulo: la identidad no se puede calcular; el gate lo tiene que ver."""
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.evaluate(SEMILLA)
            page.goto(APP.as_uri(), wait_until="load")
            page.wait_for_timeout(400)
            page.evaluate("() => { delete window.MimoIdentidad; window.MimoIdentidad = null; }")
            ident = page.evaluate("""() => {
                const d = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                const c = d.cursos[0];
                return !!(window.MimoIdentidad && MimoIdentidad.colorDe(c));
            }""")
            exigir(ident, "roto: la identidad se calcula sin módulo (el gate no discrimina)", fallas)
        finally:
            ctx.close()
    return fallas


if __name__ == "__main__":
    sys.exit(main())
