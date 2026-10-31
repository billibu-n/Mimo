#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-senal.py — la señal del pie: cuándo se guardó y cuándo se sincronizó.

Mide sobre app/index.html:
  1. sin cambios, el pie dice el destino y no inventa una hora;
  2. un cambio real pone la hora del último guardado y el título lo explica;
  3. con destino en la nube y todo subido, el pie dice Nube y la hora de la sync;
  4. con cambios pendientes, dice Sin subir y el punto cambia de color;
  5. el comprobante aparece tras una sincronización y se puede leer en Ajustes;
  6. «Ver la copia» solo se ofrece cuando hay destino;
  7. en inglés el pie no deja español.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402

HORA = re.compile(r"\d{2}:\d{2}")


def abrir(nav, reset=True):
    ctx = nav.browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errores = []
    page.on("console", lambda m: errores.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
    page.add_init_script("window.confirm = () => true;")
    page.goto(APP.as_uri() + ("?reset=1" if reset else ""), wait_until="load")
    page.wait_for_timeout(400)
    return ctx, page, errores


def pie(page):
    return page.locator("#pie-sync-texto").inner_text().strip()


def punto(page):
    return page.locator("#pie-sync .footer__punto").get_attribute("class") or ""


def meta_con(page, **extra):
    return page.evaluate(
        """async (extra) => {
             const base = JSON.parse(localStorage.getItem('mimo.sync.v1') || '{}');
             const estado = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
             const hash = await MimoSync._hash(JSON.stringify(estado));
             const meta = Object.assign({
               version: 1, provider: 'webdav', manualOnly: true, clientId: 'equipo-de-prueba',
               lastRemoteRev: 'r1', lastRemoteVersion: 1,
               lastLocalHash: hash, lastSyncAt: new Date().toISOString(),
               folderName: '', ultimoCambio: '',
               webdav: { url: 'https://nube.example/dav', usuario: 'ana', clave: '', carpeta: 'Mimo' },
               cifrado: { sal: '', activo: false }
             }, base, extra);
             localStorage.setItem('mimo.sync.v1', JSON.stringify(meta));
             return meta;
           }""",
        extra,
    )


def cargar(page):
    # Sin ?reset=1: el reinicio borra el estado y falsearía la medida.
    page.goto(APP.as_uri(), wait_until="load")
    page.wait_for_timeout(700)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = abrir(nav)

        # 1. sin cambios
        exigir(pie(page) == "Local", f"sin cambios el pie dice Local (dice «{pie(page)}»)", fallas)
        exigir(not HORA.search(pie(page)), "sin cambios no se inventa una hora", fallas)
        exigir("--gris" in punto(page), "sin destino el punto es neutro", fallas)

        # 2. un cambio real
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(200)
        page.locator("#pref-inicio").select_option("domingo")
        page.wait_for_timeout(250)
        texto = pie(page)
        exigir(bool(HORA.search(texto)) and texto.startswith("Local"), f"un cambio pone la hora: «{texto}»", fallas)
        titulo = page.locator("#pie-sync").get_attribute("title") or ""
        exigir("Último cambio guardado" in titulo, "el título explica cuándo se guardó", fallas)
        exigir("nunca" in titulo, "sin sincronización el título dice que nunca se sincronizó", fallas)

        # 6. sin destino no hay «Ver la copia»
        exigir(not page.locator("#sync-ver-copia").is_visible(), "sin destino no se ofrece «Ver la copia»", fallas)

        # 3. destino al día
        meta_con(page)
        cargar(page)
        texto = pie(page)
        exigir(texto.startswith("Nube · ") and bool(HORA.search(texto)), f"con destino al día dice Nube y la hora: «{texto}»", fallas)
        exigir("--ok" in punto(page), "al día el punto es verde", fallas)
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(250)
        exigir(page.locator("#sync-ver-copia").is_visible(), "con destino se ofrece «Ver la copia»", fallas)

        # 5. comprobante
        meta_con(page, ultimaPrueba={
            "fecha": "2026-10-30T23:40:00.000Z", "peso": "41.2 KB", "sentido": "subida",
            "version": 3, "cuentas": {"tareas": 28, "notas": 12, "eventos": 78, "ramos": 5, "sesiones": 74},
            "clientId": "equipo-de-prueba"[:8],
        })
        cargar(page)
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(250)
        prueba = page.locator("#sync-prueba").inner_text().strip()
        exigir(prueba.startswith("Comprobante:"), f"el comprobante se lee en Ajustes: «{prueba[:56]}…»", fallas)
        exigir("41.2 KB" in prueba and "28 tareas" in prueba, "el comprobante dice peso y cuentas", fallas)

        # 4. cambios pendientes
        meta_con(page, lastLocalHash="desfasado-a-proposito", ultimaPrueba=None)
        cargar(page)
        texto = pie(page)
        exigir(texto.startswith("Sin subir"), f"con cambios pendientes dice Sin subir: «{texto}»", fallas)
        exigir("--warn" in punto(page), "pendiente el punto avisa", fallas)
        page.locator('#tabs [data-ir="ajustes"]').click()
        page.wait_for_timeout(200)
        page.locator("#pref-inicio").select_option("lunes")
        page.wait_for_timeout(250)
        texto = pie(page)
        exigir(texto.startswith("Sin subir · ") and bool(HORA.search(texto)), f"un cambio pendiente deja su hora: «{texto}»", fallas)

        # 7. inglés
        page.evaluate(
            """() => {
                 const st = JSON.parse(localStorage.getItem('mimo.shell.v1'));
                 st.prefs.idioma = 'en';
                 localStorage.setItem('mimo.shell.v1', JSON.stringify(st));
               }"""
        )
        cargar(page)
        texto = pie(page)
        exigir(texto.startswith("Not uploaded") or texto.startswith("Cloud"), f"en inglés el pie se traduce: «{texto}»", fallas)
        exigir("Nube" not in texto and "Sin subir" not in texto, "en inglés no queda español en el pie", fallas)

        exigir(not errores, f"sin errores de consola ({len(errores)}): {errores[:3]}", fallas)
        ctx.close()

    return salir("gate-senal", fallas)


if __name__ == "__main__":
    raise SystemExit(main())
