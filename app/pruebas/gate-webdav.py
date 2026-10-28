#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-webdav.py — sincronización WebDAV/Nextcloud, cifrado y sin conexión.

Mide sobre app/index.html y un servidor WebDAV local con ETag y CORS:
  1. sin contraseña de cifrado no se sube nada;
  2. el archivo remoto está cifrado (no aparece el texto de la nota);
  3. la primera escritura usa If-None-Match y las siguientes If-Match;
  4. un segundo equipo con la misma contraseña recibe los datos;
  5. sin red el cambio queda en la cola local y sobrevive a recargar;
  6. al volver la red se reintenta solo y el remoto recibe el cambio;
  7. el conflicto local/remoto conserva ambas salidas y deja respaldo;
  8. una contraseña incorrecta no aplica datos;
  9. un archivo remoto corrupto no destruye la copia local.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import tempfile
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
APP = RAIZ / "app" / "index.html"
RUTA = "/Mimo/mimo-sync.json.enc"
CLAVE = "clave-de-prueba-2026"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402
from webdav import ServidorWebDAV  # noqa: E402


def abrir_contexto(nav, reset=True):
    ctx = nav.browser.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errores = []
    page.on("pageerror", lambda e: errores.append(f"pageerror: {e}"))
    page.add_init_script("window.confirm = () => true;")
    url = APP.as_uri() + ("?reset=1" if reset else "")
    page.goto(url, wait_until="load")
    page.wait_for_timeout(350)
    return ctx, page, errores


def configurar(page, srv, clave=CLAVE, guardar_clave=True):
    page.locator('#tabs [data-ir="ajustes"]').click()
    page.wait_for_timeout(150)
    page.locator("#sync-proveedor").select_option("webdav")
    page.locator("#sync-webdav-url").fill(srv.url)
    page.locator("#sync-webdav-usuario").fill("mimo")
    page.locator("#sync-webdav-clave-acceso").fill("prueba")
    page.locator("#sync-webdav-carpeta").fill("Mimo")
    if clave is not None:
        page.locator("#sync-webdav-clave").fill(clave)
    if guardar_clave and clave is not None:
        page.locator("#sync-webdav-guardar-clave").click()
        page.wait_for_timeout(350)


def nota(page, titulo, cuerpo="cuerpo"):
    page.locator('#tabs [data-ir="notas"]').click()
    page.wait_for_timeout(120)
    page.locator("#btn-nueva-nota").click()
    page.locator("#nota-titulo").fill(titulo)
    page.locator("#nota-cuerpo").fill(cuerpo)
    page.wait_for_timeout(150)


def titulos(page):
    return page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).notas.map(n => n.titulo)")


def estado(page):
    return page.evaluate("MimoSync.estado()")


def sincronizar(page):
    page.locator("#btn-sync").click()


def esperar(page, condicion, limite=8.0):
    fin = time.time() + limite
    while time.time() < fin:
        if condicion():
            return True
        page.wait_for_timeout(150)
    return condicion()


def main() -> int:
    fallas: list[str] = []
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        with ServidorWebDAV(exigir_auth=True) as srv, Navegador() as nav:
            ctx_a, a, err_a = abrir_contexto(nav)
            try:
                nota(a, "Nota A", "secreto A")
                configurar(a, srv, clave=None, guardar_clave=False)
                sincronizar(a)
                a.wait_for_timeout(1500)
                exigir("contraseña" in a.locator("#sync-estado").inner_text().lower(),
                       "webdav: sin clave de cifrado avisa y no sube", fallas)
                exigir("PUT" not in srv.metodos(), "webdav: sin clave no hay PUT", fallas)
                exigir(RUTA not in srv.datos, "webdav: sin clave el servidor no tiene archivo de datos", fallas)

                a.locator("#sync-webdav-clave").fill(CLAVE)
                a.locator("#sync-webdav-guardar-clave").click()
                a.wait_for_timeout(400)
                sincronizar(a)
                exigir(esperar(a, lambda: "Sincronizado" in a.locator("#sync-estado").inner_text()),
                       f"webdav: sube con clave — {a.locator('#sync-estado').inner_text()}", fallas)
                bruto = srv.texto(RUTA)
                exigir(RUTA in srv.datos, "webdav: existe mimo-sync.json.enc", fallas)
                exigir('"formato":"mimo-sync-cifrado"' in bruto.replace(" ", ""),
                       "webdav: el sobre remoto está cifrado", fallas)
                exigir("Nota A" not in bruto and '"notas"' not in bruto,
                       "webdav: el remoto no filtra el texto ni las claves del estado", fallas)
                exigir(srv.ultimo_if_none_match == "*", "webdav: la creación usa If-None-Match: *", fallas)
                exigir(bool(srv.ultima_autorizacion and srv.ultima_autorizacion.startswith("Basic ")),
                       "webdav: envía Basic auth con la contraseña de aplicación", fallas)

                ctx_b, b, err_b = abrir_contexto(nav)
                try:
                    configurar(b, srv)
                    sincronizar(b)
                    exigir(esperar(b, lambda: titulos(b) == ["Nota A"]),
                           f"webdav: el segundo equipo descifra y recibe — {titulos(b)}", fallas)
                finally:
                    ctx_b.close()

                # Sin red: el cambio queda aquí y la cola sobrevive a recargar.
                nota(a, "Nota Offline", "sin red")
                ctx_a.set_offline(True)
                sincronizar(a)
                a.wait_for_timeout(1200)
                est = estado(a)
                exigir(est["cola"]["pendiente"], "offline: la cola queda pendiente", fallas)
                exigir(not est["online"], "offline: el navegador se declara sin red", fallas)
                exigir("sin conexión" in a.locator("#sync-estado").inner_text().lower(),
                       f"offline: el estado lo dice — {a.locator('#sync-estado').inner_text()}", fallas)

                a.goto(APP.as_uri(), wait_until="load")  # sin reset: conserva datos y cola
                a.wait_for_timeout(900)
                exigir("Nota Offline" in titulos(a), "offline: el dato sobrevive a recargar", fallas)
                exigir(estado(a)["cola"]["pendiente"], "offline: la cola sobrevive a recargar", fallas)

                ctx_a.set_offline(False)
                exigir(esperar(a, lambda: not estado(a)["cola"]["pendiente"], 8),
                       f"offline: al volver la red se reintenta solo — {estado(a)['cola']}", fallas)
                exigir(esperar(a, lambda: "Sincronizado" in a.locator("#sync-estado").inner_text()),
                       "offline: el estado vuelve a sincronizado", fallas)
                exigir(srv.ultimo_if_match and srv.ultimo_if_match.startswith('"'),
                       f"webdav: la actualización usa If-Match — {srv.ultimo_if_match}", fallas)

                ctx_b, b, err_b = abrir_contexto(nav)
                try:
                    configurar(b, srv)
                    sincronizar(b)
                    exigir(esperar(b, lambda: titulos(b) == ["Nota Offline", "Nota A"]),
                           f"offline: el segundo equipo recibe lo escrito sin red — {titulos(b)}", fallas)
                finally:
                    ctx_b.close()

                # Conflicto: cambian las dos copias; cada salida se mide.
                ctx_b, b, err_b = abrir_contexto(nav)
                try:
                    configurar(b, srv)
                    sincronizar(b)
                    esperar(b, lambda: "Sincronizado" in b.locator("#sync-estado").inner_text())

                    nota(a, "Local conflicto")
                    nota(b, "Remota conflicto")
                    sincronizar(b)
                    esperar(b, lambda: "Sincronizado" in b.locator("#sync-estado").inner_text())
                    sincronizar(a)
                    a.wait_for_timeout(1800)
                    abierto = a.locator("#modal-sync-conflict").evaluate("e => e.classList.contains('on')")
                    exigir(abierto, "conflicto: aparece el diálogo local/remoto", fallas)
                    texto = a.locator("#modal-sync-conflict").inner_text()
                    exigir("Local" in texto and "Remoto" in texto and "notas" in texto,
                           "conflicto: muestra las dos copias y sus cuentas", fallas)
                    if abierto:
                        a.locator("#sync-conf-remoto").click()
                        a.wait_for_timeout(900)
                    exigir("Remota conflicto" in titulos(a),
                           f"conflicto: usar remoto aplica la copia remota — {titulos(a)}", fallas)
                    exigir(a.evaluate("!!localStorage.getItem('mimo.sync.backup')"),
                           "conflicto: deja respaldo local antes de aplicar", fallas)

                    nota(a, "Local gana")
                    nota(b, "Remota pierde")
                    sincronizar(b)
                    esperar(b, lambda: "Sincronizado" in b.locator("#sync-estado").inner_text())
                    sincronizar(a)
                    a.wait_for_timeout(1800)
                    if a.locator("#modal-sync-conflict").evaluate("e => e.classList.contains('on')"):
                        a.locator("#sync-conf-local").click()
                        a.wait_for_timeout(1200)
                    exigir(esperar(a, lambda: "Sincronizado" in a.locator("#sync-estado").inner_text()),
                           "conflicto: usar local termina de subir", fallas)
                    sincronizar(b)
                    exigir(esperar(b, lambda: "Local gana" in titulos(b)),
                           f"conflicto: usar local llega al otro equipo — {titulos(b)}", fallas)
                finally:
                    ctx_b.close()

                # Contraseña incorrecta: no aplica nada.
                ctx_c, c, err_c = abrir_contexto(nav)
                try:
                    configurar(c, srv, clave="clave-equivocada-999")
                    sincronizar(c)
                    c.wait_for_timeout(1800)
                    exigir("contraseña" in c.locator("#sync-estado").inner_text().lower(),
                           f"clave mala: avisa — {c.locator('#sync-estado').inner_text()}", fallas)
                    exigir(titulos(c) == [], f"clave mala: no aplica datos — {titulos(c)}", fallas)
                finally:
                    ctx_c.close()

                # Archivo remoto corrupto: no destruye la copia local.
                sobre_roto = {
                    "formato": "mimo-sync-cifrado", "version": 1, "kdf": "PBKDF2-SHA256",
                    "iteraciones": 250000,
                    "sal": base64.b64encode(os.urandom(16)).decode(),
                    "iv": base64.b64encode(os.urandom(12)).decode(),
                    "datos": base64.b64encode(os.urandom(32)).decode(),
                }
                srv.poner(RUTA, json.dumps(sobre_roto).encode("utf-8"))
                ctx_d, d, err_d = abrir_contexto(nav)
                try:
                    configurar(d, srv)
                    sincronizar(d)
                    d.wait_for_timeout(1800)
                    exigir("corrupto" in d.locator("#sync-estado").inner_text().lower(),
                           f"corrupto: avisa — {d.locator('#sync-estado').inner_text()}", fallas)
                    exigir(titulos(d) == [], f"corrupto: la copia local no se toca — {titulos(d)}", fallas)
                finally:
                    ctx_d.close()

                exigir(not err_a and not err_b and not err_c and not err_d,
                       f"webdav: sin pageerror — {err_a[:1]}{err_b[:1]}{err_c[:1]}{err_d[:1]}", fallas)
            finally:
                ctx_a.close()
    return salir("gate-webdav", fallas)


if __name__ == "__main__":
    sys.exit(main())
