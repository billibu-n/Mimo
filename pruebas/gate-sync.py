#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-sync.py — sincronización manual de Mimo.

Mide sobre app/index.html:
  1. el modo Archivo manual guarda un `mimo-sync.json` con versión y estado;
  2. un segundo equipo (contexto limpio) lo carga y recibe las notas;
  3. si local y remoto cambiaron, aparece el diálogo de conflicto con las dos copias;
  4. «Usar remoto» aplica la copia remota y deja respaldo local;
  5. «Usar local» descarga una versión nueva sin perder la copia local;
  6. el estado de la cabecera y la tarjeta acompañan el resultado.

No usa la carpeta persistente porque Chromium headless no la expone; el modo
Archivo manual es el que funciona en cualquier navegador y es el que se mide.
"""
from __future__ import annotations

import json
import sys
import tempfile
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


def abrir_contexto(nav):
    ctx = nav.browser.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    page = ctx.new_page()
    errores = []
    page.on("console", lambda m: errores.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
    page.add_init_script("window.confirm = () => true;")
    page.goto(APP.as_uri() + "?reset=1", wait_until="load")
    page.wait_for_timeout(300)
    return ctx, page, errores


def ir_sync(page):
    page.locator('#tabs [data-ir="ajustes"]').click()
    page.wait_for_timeout(180)
    page.locator("#sync-proveedor").select_option("archivo")
    page.wait_for_timeout(120)


def crear_nota(page, titulo, cuerpo):
    page.locator('#tabs [data-ir="notas"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nueva-nota").click()
    page.locator("#nota-titulo").fill(titulo)
    page.locator("#nota-cuerpo").fill(cuerpo)
    page.wait_for_timeout(120)


def guardar(page, destino: Path):
    with page.expect_download() as dl:
        page.locator("#sync-guardar-archivo").click()
    dl.value.save_as(str(destino))
    return json.loads(destino.read_text(encoding="utf-8"))


def cargar(page, origen: Path):
    with page.expect_file_chooser() as fc:
        page.locator("#sync-cargar-archivo").click()
    fc.value.set_files(str(origen))
    page.wait_for_timeout(700)


def nota(nid, titulo, cuerpo):
    return {
        "id": nid, "titulo": titulo, "cuerpo": cuerpo, "contexto": "", "etiquetas": [],
        "enlaces": [], "fijada": False, "actualizado": ""
    }


def main() -> int:
    fallas: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        with Navegador() as nav:
            ctx_a, a, err_a = abrir_contexto(nav)
            try:
                crear_nota(a, "Nota A", "contenido A")
                ir_sync(a)
                exigir(a.locator("#sync-manual").is_checked(), "sync: archivo manual es solo a mano", fallas)
                v1 = guardar(a, td / "v1.json")
                exigir(v1.get("formato") == "mimo-sync" and v1.get("syncVersion") == 1,
                       f"sync: archivo con formato y versión 1 — {v1.get('formato')}/{v1.get('syncVersion')}", fallas)
                exigir(len(v1["estado"]["notas"]) == 1 and v1["estado"]["notas"][0]["titulo"] == "Nota A",
                       "sync: el archivo lleva la nota local", fallas)
                exigir("Sincronizado" in a.locator("#sync-estado").inner_text(),
                       f"sync: estado sincronizado — {a.locator('#sync-estado').inner_text()}", fallas)

                ctx_b, b, err_b = abrir_contexto(nav)
                try:
                    ir_sync(b)
                    cargar(b, td / "v1.json")
                    notas_b = b.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
                    exigir(notas_b == ["Nota A"], f"sync: el segundo equipo recibe la nota — {notas_b}", fallas)
                    exigir(b.evaluate("!!localStorage.getItem('mimo.sync.v1')"),
                           "sync: el segundo equipo guarda su estado de sincronización", fallas)
                finally:
                    ctx_b.close()

                # Conflicto: local cambia y el remoto también.
                crear_nota(a, "Local 2", "local")
                v2 = json.loads(json.dumps(v1))
                v2["syncVersion"] = 2
                v2["clientId"] = "otro-equipo"
                v2["lastModified"] = int(time.time() * 1000)
                v2["estado"]["notas"].append(nota("n-remota", "Remota 2", "remoto"))
                (td / "v2.json").write_text(json.dumps(v2, ensure_ascii=False), encoding="utf-8")
                ir_sync(a)
                cargar(a, td / "v2.json")
                exigir(a.locator("#modal-sync-conflict").evaluate("e => e.classList.contains('on')"),
                       "conflicto: aparece el diálogo", fallas)
                texto_conf = a.locator("#modal-sync-conflict").inner_text()
                exigir("Local" in texto_conf and "Remoto" in texto_conf and "notas" in texto_conf,
                       "conflicto: muestra las dos copias y sus cuentas", fallas)

                a.locator("#sync-conf-remoto").click()
                a.wait_for_timeout(500)
                notas_a = a.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")
                exigir(notas_a == ["Nota A", "Remota 2"], f"conflicto: se aplica el remoto — {notas_a}", fallas)
                exigir(a.evaluate("!!localStorage.getItem('mimo.sync.backup')"),
                       "conflicto: guarda respaldo local antes de aplicar", fallas)

                # Conflicto de nuevo, ahora gana lo local: debe descargar una versión nueva.
                crear_nota(a, "Local 3", "local")
                v3 = json.loads(json.dumps(v2))
                v3["syncVersion"] = 3
                v3["lastModified"] = int(time.time() * 1000)
                v3["estado"]["notas"].append(nota("n-remota-3", "Remota 3", "remoto"))
                (td / "v3.json").write_text(json.dumps(v3, ensure_ascii=False), encoding="utf-8")
                ir_sync(a)
                cargar(a, td / "v3.json")
                exigir(a.locator("#modal-sync-conflict").evaluate("e => e.classList.contains('on')"),
                       "conflicto: vuelve a aparecer", fallas)
                with a.expect_download() as dl:
                    a.locator("#sync-conf-local").click()
                dl.value.save_as(str(td / "local-v4.json"))
                v4 = json.loads((td / "local-v4.json").read_text(encoding="utf-8"))
                titulos_v4 = [n["titulo"] for n in v4["estado"]["notas"]]
                exigir(v4["syncVersion"] == 4 and "Local 3" in titulos_v4,
                       f"conflicto: usar local descarga v4 con la copia local — v{v4['syncVersion']} {titulos_v4}", fallas)
                exigir("Remota 3" not in titulos_v4, "conflicto: usar local no mezcla el remoto", fallas)
                exigir(not [e for e in err_a if e.startswith("pageerror")],
                       f"sync: sin pageerror — {err_a[:2]}", fallas)
            finally:
                ctx_a.close()
    return salir("gate-sync", fallas)


if __name__ == "__main__":
    sys.exit(main())
