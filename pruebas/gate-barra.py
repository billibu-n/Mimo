#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-barra.py — la barra de secciones dice su nombre y se puede plegar.

Mide sobre app/index.html:
  1. cada sección lleva su nombre visible, con su icono, y ninguna lleva el código
     de dos dígitos que se leía como «01»;
  2. el botón de plegar deja la barra en iconos, cambia de estado y se recuerda
     tras recargar;
  3. en la posición izquierda el carril pasa de 184 px con nombres a 64 px sin
     ellos, y el contenido acompaña el cambio; plegado también se puede ocultar;
  4. en una ventana angosta los nombres se esconden solos, sin tocar la
     preferencia del dueño;
  5. las secciones viven a la derecha; el ☰ de la esquina las oculta (y se
     recuerda) y el botón del panel, a la derecha, lo recoge; los dos se
     despliegan con animación y en ningún fotograma la ventana gana scroll.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

ESPERADOS = ["Calendario", "Tareas", "Notas", "Tiempo", "Malla", "Calificaciones", "Estudio", "Ajustes"]


def nombres_visibles(page) -> list[str]:
    return page.evaluate(
        "Array.from(document.querySelectorAll('.tab__nom'))"
        ".filter(e => e.getBoundingClientRect().width > 0)"
        ".map(e => e.textContent.trim())")


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 900)
        page.evaluate("""() => {
          const k = "mimo.shell.v1";
          const s = JSON.parse(localStorage.getItem(k) || "{}");
          s.instalados = ["tiempo", "malla", "calificaciones", "estudio"];
          localStorage.setItem(k, JSON.stringify(s));
        }""")
        page.goto(APP.as_uri(), wait_until="load")
        page.wait_for_timeout(700)

        # 1) nombres e iconos, sin códigos
        nombres = nombres_visibles(page)
        exigir(nombres == ESPERADOS, f"barra: las ocho secciones dicen su nombre — {nombres}", fallas)
        iconos = page.evaluate(
            "Array.from(document.querySelectorAll('#tabs .tab .icono'))"
            ".filter(e => e.getBoundingClientRect().width > 0).length")
        exigir(iconos == len(ESPERADOS), f"barra: cada pestaña lleva su icono — {iconos}", fallas)
        codigos = page.eval_on_selector_all("#tabs .cod", "els => els.map(e => e.textContent.trim())")
        exigir(not codigos, f"barra: la pestaña ya no lleva código de bloque — {codigos}", fallas)
        exigir(page.get_attribute("#btn-plegar", "aria-expanded") == "true",
               "barra: abierta, el botón anuncia que se puede plegar", fallas)

        # 2) plegar, recordar y desplegar
        page.locator("#btn-plegar").click()
        page.wait_for_timeout(300)
        exigir(not nombres_visibles(page), "barra: plegada no se lee ningún nombre", fallas)
        exigir(page.get_attribute("#btn-plegar", "aria-expanded") == "false",
               "barra: plegada, el botón anuncia que se puede desplegar", fallas)
        ancho_iconos = page.evaluate("document.querySelector('#tabs .tab').getBoundingClientRect().width")
        exigir(ancho_iconos <= 44, f"barra: plegada la pestaña mide {ancho_iconos:.0f} px", fallas)

        page.goto(APP.as_uri(), wait_until="load")  # sin reset: la preferencia debe seguir
        page.wait_for_timeout(700)
        exigir(not nombres_visibles(page), "barra: el plegado se recuerda al recargar", fallas)
        page.locator("#btn-plegar").click()
        page.wait_for_timeout(300)
        exigir(nombres_visibles(page) == ESPERADOS, "barra: se despliega y vuelven los nombres", fallas)

        # 2-bis) las secciones a la derecha; el ☰ de la esquina las oculta y el
        #        botón del panel sigue a la derecha. Los dos se despliegan con
        #        animación, y en ningún fotograma la ventana gana scroll: una barra
        #        de ventana que aparece empuja todo el armazón.
        hueco = page.evaluate("""(() => {
          const tabs = document.querySelectorAll('#tabs .tab');
          const fin = tabs[tabs.length - 1].getBoundingClientRect().right;
          const boton = document.querySelector('#btn-plegar').getBoundingClientRect().left;
          return Math.round(boton - fin);
        })()""")
        exigir(0 <= hueco < 40,
               f"barra: las secciones van pegadas a la derecha — hueco de {hueco} px", fallas)

        x_secciones = page.evaluate("document.querySelector('#btn-secciones').getBoundingClientRect().x")
        x_marca = page.evaluate("document.querySelector('.marca').getBoundingClientRect().x")
        x_panel = page.evaluate("document.querySelector('#btn-panel').getBoundingClientRect().x")
        ancho = page.evaluate("window.innerWidth")
        exigir(x_secciones < x_marca, f"secciones: el ☰ va antes de la mascota — {x_secciones:.0f} px", fallas)
        exigir(x_panel > ancho * 0.7, f"panel: su botón sigue a la derecha — {x_panel:.0f} px", fallas)

        def muestrear(selector_boton):
            """Pulsa el botón y devuelve lo que pasó en cada fotograma durante 400 ms."""
            page.evaluate("""() => {
              window.__m = [];
              const de = document.documentElement, t0 = performance.now();
              const id = setInterval(() => {
                if (!document.querySelector('#panel')) return;
                window.__m.push({
                  t: Math.round(performance.now() - t0),
                  panel: Math.round(document.querySelector('#panel').getBoundingClientRect().width),
                  barra: Math.round(document.querySelector('.navbar').getBoundingClientRect().height),
                  carril: Math.round(document.querySelector('.navbar').getBoundingClientRect().width),
                  scroll: de.scrollHeight - de.clientHeight,
                });
                if (performance.now() - t0 > 400) clearInterval(id);
              }, 16);
            }""")
            page.locator(selector_boton).click()
            page.wait_for_timeout(600)
            return page.evaluate("window.__m")

        # El panel arranca cerrado (R3): se abre antes de medir el cierre.
        if page.evaluate("document.querySelector('#panel').getBoundingClientRect().width") < 100:
            page.locator("#btn-panel").click()
            page.wait_for_timeout(400)

        # El panel se recoge con animación y sin scroll de ventana.
        m = muestrear("#btn-panel")
        intermedios = [x for x in m if 0 < x["panel"] < 320]
        exigir(len(intermedios) >= 2,
               f"panel: se recoge con animación — {len(intermedios)} fotogramas intermedios de {len(m)}", fallas)
        exigir(max(x["scroll"] for x in m) <= 1,
               f"panel: ningún fotograma gana scroll — {max(x['scroll'] for x in m)} px", fallas)
        exigir(m[-1]["panel"] <= 1, f"panel: queda recogido — {m[-1]['panel']} px", fallas)

        m = muestrear("#btn-panel")
        intermedios = [x for x in m if 0 < x["panel"] < 320]
        exigir(len(intermedios) >= 2, f"panel: se despliega con animación — {len(intermedios)} fotogramas", fallas)
        exigir(max(x["scroll"] for x in m) <= 1,
               f"panel: al desplegar tampoco hay scroll — {max(x['scroll'] for x in m)} px", fallas)
        exigir(m[-1]["panel"] > 200, f"panel: vuelve a su ancho — {m[-1]['panel']} px", fallas)

        # La barra de secciones se recoge con animación y sin scroll.
        alto_barra = page.evaluate("document.querySelector('.navbar').getBoundingClientRect().height")
        rotulo = page.get_attribute("#btn-secciones", "title")
        m = muestrear("#btn-secciones")
        intermedios = [x for x in m if 0 < x["barra"] < alto_barra - 1]
        exigir(len(intermedios) >= 2,
               f"secciones: se ocultan con animación — {len(intermedios)} fotogramas intermedios", fallas)
        exigir(max(x["scroll"] for x in m) <= 1,
               f"secciones: ningún fotograma gana scroll — {max(x['scroll'] for x in m)} px", fallas)
        tras = page.get_attribute("#btn-secciones", "title")
        exigir(m[-1]["barra"] <= 1 and tras != rotulo,
               f"secciones: quedan ocultas ({m[-1]['barra']} px) y el botón avisa («{tras}»)", fallas)

        page.goto(APP.as_uri(), wait_until="load")  # sin reset: se recuerda
        page.wait_for_timeout(700)
        exigir(page.evaluate("document.querySelector('.navbar').getBoundingClientRect().height") <= 1,
               "secciones: ocultas, siguen ocultas al recargar", fallas)
        page.locator("#btn-secciones").click()
        page.wait_for_timeout(400)
        exigir(page.evaluate("document.querySelector('.navbar').getBoundingClientRect().height") > 30,
               "secciones: el mismo ☰ las vuelve a mostrar", fallas)
        scroll = page.evaluate("document.documentElement.scrollHeight - document.documentElement.clientHeight")
        exigir(scroll <= 1, f"armazón: la ventana no scrollea — {scroll} px", fallas)

        # 3) carril izquierdo
        page.locator("#btn-ajustes").click()
        page.wait_for_timeout(300)
        page.locator("#pref-nav").select_option("izquierda")
        page.wait_for_timeout(400)
        ancho_abierto = page.evaluate("document.querySelector('.navbar').getBoundingClientRect().width")
        margen_abierto = page.evaluate("parseFloat(getComputedStyle(document.querySelector('.shell')).marginLeft)")
        exigir(ancho_abierto > 150, f"barra: a la izquierda el carril con nombres mide {ancho_abierto:.0f} px", fallas)
        exigir(nombres_visibles(page) == ESPERADOS, "barra: a la izquierda también se leen los nombres", fallas)
        page.locator("#btn-plegar").click()
        page.wait_for_timeout(300)
        ancho_plegado = page.evaluate("document.querySelector('.navbar').getBoundingClientRect().width")
        margen_plegado = page.evaluate("parseFloat(getComputedStyle(document.querySelector('.shell')).marginLeft)")
        exigir(ancho_plegado <= 70, f"barra: plegado el carril baja a {ancho_plegado:.0f} px", fallas)
        # Con el carril plegado, el ☰ tiene que poder ocultarlo igual: la regla del
        # carril plegado pesaba más que la de ocultar y el botón no hacía nada.
        page.locator("#btn-secciones").click()
        page.wait_for_timeout(400)
        ancho_oculto = page.evaluate("document.querySelector('.navbar').getBoundingClientRect().width")
        margen_oculto = page.evaluate("parseFloat(getComputedStyle(document.querySelector('.shell')).marginLeft)")
        exigir(ancho_oculto <= 1 and margen_oculto <= 1,
               f"secciones: con el carril plegado el ☰ también lo oculta — {ancho_oculto:.0f} px, margen {margen_oculto:.0f}", fallas)
        page.locator("#btn-secciones").click()
        page.wait_for_timeout(400)
        vuelta = page.evaluate("document.querySelector('.navbar').getBoundingClientRect().width")
        exigir(abs(vuelta - ancho_plegado) <= 1,
               f"secciones: al mostrarlo vuelve a su ancho plegado — {vuelta:.0f} px", fallas)

        exigir(abs(margen_abierto - ancho_abierto) <= 1 and abs(margen_plegado - ancho_plegado) <= 1,
               f"barra: el contenido acompaña el carril — carril {ancho_abierto:.0f}/{ancho_plegado:.0f} px,"
               f" margen {margen_abierto:.0f}/{margen_plegado:.0f} px", fallas)
        page.locator("#btn-plegar").click()   # vuelve a abrirla
        page.wait_for_timeout(300)
        page.locator("#pref-nav").select_option("arriba")
        page.wait_for_timeout(300)

        # 4) ventana angosta: se pliega sola, sin tocar la preferencia
        page.set_viewport_size({"width": 1000, "height": 900})
        page.wait_for_timeout(400)
        exigir(not nombres_visibles(page), "barra: en ventana angosta los nombres se esconden solos", fallas)
        guardada = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).prefs.navPlegada")
        exigir(guardada is not True, f"barra: angosta no cambia la preferencia — navPlegada={guardada}", fallas)
        page.set_viewport_size({"width": 1440, "height": 900})
        page.wait_for_timeout(400)
        exigir(nombres_visibles(page) == ESPERADOS, "barra: al ensanchar vuelven los nombres", fallas)

        exigir(not errores, f"sin errores de consola ({len(errores)}): {errores[:3]}", fallas)
        ctx.close()

    return salir("gate-barra", fallas)


if __name__ == "__main__":
    raise SystemExit(main())
