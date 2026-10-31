#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-respaldo.py — respaldo y cuota de Mimo.

Mide:
  1. exportar todo declara mimo.backup v1 y la versión beta.4;
  2. importar crea una copia previa (descarga en navegador) antes de reemplazar;
  3. un backup con versión 99 no se aplica y avisa;
  4. si localStorage falla, aparece el banner persistente y la nota no se guarda;
  5. al recuperar el almacenamiento, el banner se retira.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


def abrir(nav):
    ctx = nav.browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    errores = []
    page.on("console", lambda m: errores.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
    page.add_init_script("window.confirm = () => true;")
    page.goto(APP.as_uri() + "?reset=1", wait_until="load")
    page.wait_for_timeout(350)
    return ctx, page, errores


def ajustes(page):
    page.locator('#tabs [data-ir="ajustes"]').click()
    page.wait_for_timeout(250)


def nota(page, titulo):
    page.locator('#tabs [data-ir="notas"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nueva-nota").click()
    page.locator("#nota-titulo").fill(titulo)
    page.locator("#nota-cuerpo").fill("cuerpo")
    page.wait_for_timeout(350)


def backup(nota_titulo):
    return {
        "schema": "mimo.backup", "version": 1, "app": "Mimo", "appVersion": "1.2.0-beta.5",
        "entorno": {"notas": [{"id": "n-imp", "titulo": nota_titulo, "cuerpo": "x", "contexto": "",
                               "etiquetas": [], "enlaces": [], "fijada": False, "actualizado": ""}],
                    "tareas": [], "eventos": [], "periodos": [], "sesiones": []},
        "malla": {"cursos": [], "calificaciones": {}, "carrera": {"titulo": "", "universidad": "", "pais": ""}},
        "extensiones": {}
    }


def main() -> int:
    fallas = []
    with tempfile.TemporaryDirectory() as td, Navegador() as nav:
        td = Path(td)
        ctx, page, errores = abrir(nav)
        try:
            nota(page, "Nota local")
            ajustes(page)
            with page.expect_download() as dl:
                page.locator("#btn-exportar-todo").click()
            exportado = td / "mimo-backup.json"
            dl.value.save_as(str(exportado))
            doc = json.loads(exportado.read_text(encoding="utf-8"))
            exigir(doc.get("schema") == "mimo.backup" and doc.get("version") == 1,
                   f"backup: schema v1 — {doc.get('schema')}/{doc.get('version')}", fallas)
            exigir(doc.get("appVersion") == "1.2.0-beta.5",
                   f"backup: appVersion beta.4 — {doc.get('appVersion')}", fallas)

            # Importación válida: el respaldo previo se descarga antes de reemplazar.
            valido = td / "valido.json"
            valido.write_text(json.dumps(backup("Nota importada"), ensure_ascii=False), encoding="utf-8")
            with page.expect_download() as previo:
                with page.expect_file_chooser() as fc:
                    page.locator("#btn-importar").click()
                fc.value.set_files(str(valido))
            previo.value.save_as(str(td / "previo.json"))
            page.wait_for_timeout(900)
            notas = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
            exigir(notas == ["Nota importada"], f"backup: importa el archivo — {notas}", fallas)
            exigir((td / "previo.json").exists(), "backup: hay copia previa antes de importar", fallas)
            previo_doc = json.loads((td / "previo.json").read_text(encoding="utf-8"))
            exigir(previo_doc.get("schema") == "mimo.backup", "backup: la copia previa es mimo.backup", fallas)

            # Versión futura: no se aplica y se explica.
            futuro = backup("No debe entrar")
            futuro["version"] = 99
            f = td / "futuro.json"
            f.write_text(json.dumps(futuro, ensure_ascii=False), encoding="utf-8")
            ajustes(page)
            with page.expect_file_chooser() as fc:
                page.locator("#btn-importar").click()
            fc.value.set_files(str(f))
            page.wait_for_timeout(700)
            notas = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
            exigir("No debe entrar" not in notas, f"backup: versión 99 no se aplica — {notas}", fallas)
            exigir("más nueva" in page.locator("#toast").inner_text(),
                   f"backup: avisa versión nueva — {page.locator('#toast').inner_text()}", fallas)

            # Cuota: el guardado falla y el banner aparece; la nota no queda guardada.
            page.evaluate("""() => {
              window.__setItemOriginal = Storage.prototype.setItem;
              window.__cuotaFalsa = true;
              Storage.prototype.setItem = function (k, v) {
                if (window.__cuotaFalsa && k === 'mimo.shell.v1') throw new DOMException('quota', 'QuotaExceededError');
                return window.__setItemOriginal.call(localStorage, k, v);
              };
            }""")
            nota(page, "Nota que no cabe")
            banner = page.locator("#banner-almacen")
            exigir(not banner.evaluate("e => e.hidden"), "cuota: aparece el banner", fallas)
            exigir("lleno" in banner.inner_text().lower(), f"cuota: explica el fallo — {banner.inner_text()}", fallas)
            guardadas = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
            exigir("Nota que no cabe" not in guardadas, f"cuota: la nota no se guarda — {guardadas}", fallas)

            page.evaluate("window.__cuotaFalsa = false")
            nota(page, "Nota que sí cabe")
            page.wait_for_timeout(500)
            exigir(banner.evaluate("e => e.hidden"), "cuota: el banner se retira al guardar", fallas)
            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"respaldo: sin pageerror — {errores[:2]}", fallas)
        finally:
            ctx.close()
    return salir("gate-respaldo", fallas)


if __name__ == "__main__":
    sys.exit(main())
