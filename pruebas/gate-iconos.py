#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-iconos.py — paquetes de iconos, selector único y color de las metas.

Mide lo que el encargo promete:
  1. el pack nativo y el de KDE existen, declaran procedencia y licencia, y el
     selector cambia de uno a otro;
  2. una carpeta de SVG se importa como pack de usuario y sobrevive a recargar;
  3. un icono de un pack que ya no está cae en el nativo, conserva el id y deja
     `data-fallback="1"`;
  4. el mismo selector se usa en la identidad de un ramo y en la meta de Progreso;
  5. el color de la meta se elige por RGB y por la paleta, con vista previa, y
     queda pintado en la tarjeta.

No mide el gusto: mide que el contrato de packs y el respaldo funcionen.
"""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

CORAZON = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
           '<path d="M12 21s-7-4.4-7-9.5A4.5 4.5 0 0 1 12 8a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21Z" fill="currentColor"/>'
           '</svg>')
ESTRELLA = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">'
            '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" fill="currentColor"/>'
            '</svg>')

PREFS = {
    "inicioSemana": "lunes", "hora": "24", "panelAncho": "320", "navPos": "arriba",
    "idioma": "es", "escala": "100", "notificaciones": True, "navPlegada": False,
    "navOculta": False, "temaClaro": "clasico", "temaOscuro": "deepsea",
    "fuente": "clasica", "fuenteNombre": "", "ordenTabs": [],
    "catalogoOrigen": "todos", "catalogoTag": "",
}
ESTADO = {
    "tema": "clasico", "instalados": ["calendario", "malla", "progreso"],
    "kits": {}, "panel": {}, "plegables": {},
    "tareas": [], "notas": [], "eventos": [], "sesiones": [],
    "cursos": [{"codigo": "FI2001", "nombre": "Mecánica", "creditos": 6, "nivel": 2,
                "enCurso": True, "requisitos": [], "requisitos_o": [], "enMalla": True}],
    "califs": {}, "carrera": {"titulo": "", "universidad": "", "pais": ""},
    "estudio": {"metaSemanal": 10, "metasRamo": {}, "metasSemana": {}},
    "progreso": {"v": 1, "categorias": [], "metas": [], "registros": []},
    "iconos": {"v": 1, "activo": "nativo", "packs": []},
    "prefs": PREFS,
}


def abrir(page):
    page.evaluate("e => localStorage.setItem('mimo.shell.v1', JSON.stringify(e))", ESTADO)
    page.goto(APP.as_uri(), wait_until="load")
    page.wait_for_timeout(500)


def icono_tarjeta(page):
    return page.evaluate("""() => {
      const s = document.querySelector('.prog-card [data-icono]');
      return s ? {ref: s.getAttribute('data-icono'), fallback: s.getAttribute('data-fallback'),
                  use: s.querySelector('use') ? s.querySelector('use').getAttribute('href') : null} : null;
    }""")


def main() -> int:
    fallas: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        carpeta = Path(tmp) / "Prueba"
        carpeta.mkdir()
        (carpeta / "corazon.svg").write_text(CORAZON, encoding="utf-8")
        (carpeta / "estrella.svg").write_text(ESTRELLA, encoding="utf-8")

        with Navegador() as nav:
            ctx, page, errores = nav.abrir(APP, 1440, 950)
            try:
                abrir(page)
                exigir(not errores, f"app: sin errores de consola — {errores[:2]}", fallas)

                # 1) el selector de ramo usa el mismo componente y los packs
                page.locator('#tabs [data-ir="malla"]').click(); page.wait_for_timeout(250)
                page.locator('.ramo-card[data-ramo="FI2001"]').click(); page.wait_for_timeout(200)
                page.locator("#malla-detalle [data-malla-identidad]").click(); page.wait_for_timeout(250)
                exigir(page.locator("#ident-panel #ident-pack").count() == 1,
                       "ramos: la identidad usa el selector con paquetes", fallas)
                opciones = page.eval_on_selector_all("#ident-pack option", "els => els.map(e => e.value)")
                exigir("nativo" in opciones and "kde" in opciones,
                       f"packs: nativo y KDE disponibles — {opciones}", fallas)
                page.locator("#ident-pack").select_option("kde"); page.wait_for_timeout(250)
                exigir(page.locator("#ident-iconos .ident-ico").count() == 8,
                       f"KDE: ocho iconos — {page.locator('#ident-iconos .ident-ico').count()}", fallas)
                credito = page.locator("#ident-credito").inner_text()
                exigir("KDE Breeze" in credito and "LGPL" in credito,
                       f"KDE: procedencia y licencia visibles — {credito}", fallas)
                page.locator('#ident-iconos [data-ident-icono="kde:chronometer"]').click()
                page.locator("#modal-guardar").click(); page.wait_for_timeout(250)
                guardado = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).cursos[0].icono")
                exigir(guardado == "kde:chronometer", f"ramos: guarda el icono del pack — {guardado}", fallas)
                page.reload(wait_until="load"); page.wait_for_timeout(400)
                page.locator('#tabs [data-ir="malla"]').click(); page.wait_for_timeout(250)
                pintado = page.locator('.ramo-card[data-ramo="FI2001"] [data-icono]').get_attribute("data-icono")
                exigir(pintado == "kde:chronometer", f"ramos: el icono sobrevive a recargar — {pintado}", fallas)

                # 2) meta de Progreso: selector compacto, elige KDE y guarda
                page.locator('#tabs [data-ir="progreso"]').click(); page.wait_for_timeout(250)
                page.locator("#prog-nueva").click(); page.wait_for_timeout(250)
                page.locator("#prog-f-icono-campo [data-sel-abrir]").click(); page.wait_for_timeout(200)
                exigir(page.locator("#sel-ico-overlay").is_visible(),
                       "meta: el icono abre la ventana del selector", fallas)
                page.locator("#selico-pack").select_option("kde"); page.wait_for_timeout(200)
                page.locator('#selico-iconos [data-ident-icono="kde:office-chart-bar"]').click()
                page.wait_for_timeout(150)
                oculto = page.locator("#prog-f-icono").input_value()
                exigir(oculto == "kde:office-chart-bar", f"meta: guarda el icono KDE — {oculto}", fallas)
                page.locator("#prog-f-nombre").fill("Horas")
                page.locator("#prog-f-objetivo").fill("10")
                page.locator("#prog-guardar").click(); page.wait_for_timeout(250)
                tarjeta = icono_tarjeta(page)
                exigir(tarjeta and tarjeta["ref"] == "kde:office-chart-bar" and not tarjeta["fallback"],
                       f"meta: la tarjeta pinta el icono elegido — {tarjeta}", fallas)
                page.reload(wait_until="load"); page.wait_for_timeout(400)
                page.locator('#tabs [data-ir="progreso"]').click(); page.wait_for_timeout(250)
                tarjeta = icono_tarjeta(page)
                exigir(tarjeta and tarjeta["ref"] == "kde:office-chart-bar",
                       f"meta: el pack sobrevive a recargar — {tarjeta}", fallas)

                # 3) carpeta de usuario: importar y usar un icono
                page.locator('.prog-card [data-prog-edit]').first.click(); page.wait_for_timeout(200)
                page.locator("#prog-f-icono-campo [data-sel-abrir]").click(); page.wait_for_timeout(200)
                page.locator("#selico-nombre").fill("Prueba")
                page.locator("#selico-file").set_input_files(str(carpeta))
                page.wait_for_timeout(700)
                exigir("usuario-prueba" in page.eval_on_selector_all("#selico-pack option", "els => els.map(e => e.value)"),
                       "usuario: el pack importado aparece en la lista", fallas)
                exigir(page.locator("#selico-iconos .ident-ico").count() == 2,
                       f"usuario: dos iconos — {page.locator('#selico-iconos .ident-ico').count()}", fallas)
                credito = page.locator("#selico-credito").inner_text()
                exigir("Carpeta local" in credito, f"usuario: la procedencia se muestra — {credito}", fallas)
                page.locator('#selico-iconos [data-ident-icono="usuario-prueba:corazon"]').click()
                page.wait_for_timeout(150)
                page.locator("#prog-guardar").click(); page.wait_for_timeout(250)
                tarjeta = icono_tarjeta(page)
                exigir(tarjeta and tarjeta["ref"] == "usuario-prueba:corazon" and not tarjeta["fallback"],
                       f"usuario: el icono se pinta — {tarjeta}", fallas)
                page.reload(wait_until="load"); page.wait_for_timeout(400)
                page.locator('#tabs [data-ir="progreso"]').click(); page.wait_for_timeout(250)
                tarjeta = icono_tarjeta(page)
                exigir(tarjeta and tarjeta["ref"] == "usuario-prueba:corazon" and not tarjeta["fallback"],
                       f"usuario: el pack persiste con el icono — {tarjeta}", fallas)

                # 4) icono faltante: fallback al nativo, id conservado
                page.evaluate("""() => {
                  const s = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                  s.iconos = {v: 1, activo: 'nativo', packs: []};
                  s.progreso.metas[0].icono = 'usuario-inexistente:fantasma';
                  localStorage.setItem('mimo.shell.v1', JSON.stringify(s));
                }""")
                page.reload(wait_until="load"); page.wait_for_timeout(400)
                page.locator('#tabs [data-ir="progreso"]').click(); page.wait_for_timeout(250)
                tarjeta = icono_tarjeta(page)
                exigir(tarjeta and tarjeta["ref"] == "usuario-inexistente:fantasma" and tarjeta["fallback"] == "1",
                       f"fallback: conserva el id y marca el respaldo — {tarjeta}", fallas)
                exigir(tarjeta and tarjeta["use"] == "#i-ramo-estrella",
                       f"fallback: usa el nativo — {tarjeta}", fallas)

                # 5) color de la meta: RGB y paleta, con vista previa
                page.locator('.prog-card [data-prog-edit]').first.click(); page.wait_for_timeout(200)
                page.locator("#prog-f-color-campo [data-r]").fill("10")
                page.locator("#prog-f-color-campo [data-g]").fill("20")
                page.locator("#prog-f-color-campo [data-b]").fill("30")
                page.wait_for_timeout(150)
                color = page.locator("#prog-f-color").input_value()
                exigir(color == "#0a141e", f"color: RGB compone el hex — {color}", fallas)
                prev = page.locator("#prog-f-color-campo [data-prev]").get_attribute("style") or ""
                exigir("--sel" in prev, f"color: la vista previa sigue al RGB — {prev}", fallas)
                page.locator("#prog-f-color-campo [data-paleta]").click(); page.wait_for_timeout(150)
                exigir(page.locator("#prog-f-color-campo [data-pop]").is_visible(),
                       "color: la paleta se abre", fallas)
                exigir(page.locator("#prog-f-color-campo [data-color]").count() >= 5,
                       f"color: hay colores predefinidos — {page.locator('#prog-f-color-campo [data-color]').count()}", fallas)
                page.locator("#prog-f-color-campo [data-color]").nth(1).click(); page.wait_for_timeout(150)
                otro = page.locator("#prog-f-color").input_value()
                exigir(otro != "#0a141e", f"color: la paleta cambia el color — {otro}", fallas)
                page.locator("#prog-guardar").click(); page.wait_for_timeout(250)
                estilo = page.locator(".prog-card").first.get_attribute("style") or ""
                clase = page.locator(".prog-card").first.get_attribute("class") or ""
                exigir("--prog-color" in estilo and "prog-color--propia" in clase,
                       f"color: la tarjeta pinta el color propio — {clase} / {estilo}", fallas)
                page.reload(wait_until="load"); page.wait_for_timeout(400)
                page.locator('#tabs [data-ir="progreso"]').click(); page.wait_for_timeout(250)
                estilo = page.locator(".prog-card").first.get_attribute("style") or ""
                exigir(otro in estilo, f"color: sobrevive a recargar — {estilo}", fallas)

                exigir(not errores, f"app: consola limpia al final — {errores[:3]}", fallas)
                return salir("gate-iconos", fallas)
            finally:
                ctx.close()


if __name__ == "__main__":
    sys.exit(main())
