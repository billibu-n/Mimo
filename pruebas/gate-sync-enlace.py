#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-sync-enlace.py — el enlace de sincronización por QR o texto.

Mide lo que el encargo pide:
  1. la sección de sincronización abre la ventana única (`modal.js`) con cuatro
     paneles desplegables y el formulario manual como respaldo;
  2. el texto completo pegado (con prosa alrededor) se desarma en servidor,
     usuario, contraseña de aplicación y ruta WebDAV;
  3. el QR local (jsQR) se decodifica desde una imagen y muestra el resultado
     antes de confirmar;
  4. al confirmar se guardan los campos que ya usa el motor (`provider`,
     `nc`, `ncUrl`, `webdav.url`, `webdav.usuario`, `webdav.carpeta`);
  5. el enlace resultante se puede ver, ocultar/mostrar y copiar, con sus partes;
  6. una URL con esquema peligroso no se acepta y el texto pegado no queda en el
     formulario al cerrar;
  7. el modal cabe a 411 sin desbordar.
"""
from __future__ import annotations

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
FIXTURE = AQUI / "fixtures" / "qr-sync-prueba.png"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402

PAYLOAD = "nc://onetime-login/user:prueba@example.test&password:ABCD-EFGH-IJKL-MNOP&server:https://nube.example.test"
CLAVE = "ABCD-EFGH-IJKL-MNOP"
SERVIDOR = "https://nube.example.test"
DAV = "https://nube.example.test/remote.php/dav/files/prueba%40example.test"


def abrir_modal(page) -> None:
    page.locator('#tabs [data-ir="ajustes"]').click()
    page.wait_for_timeout(220)
    page.locator("#sync-abrir").click()
    page.wait_for_timeout(250)


def estado(page):
    return page.evaluate("MimoSync.estado()")


def main() -> int:
    fallas: list[str] = []

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            abrir_modal(page)
            exigir(page.locator("#modal-editor").get_attribute("data-editor") == "sync",
                   "modal: la sección abre la ventana única", fallas)
            exigir(page.evaluate("document.querySelector('#sync-formulario').parentElement.id") == "sync-modal-host",
                   "modal: el formulario se mueve dentro de la ventana", fallas)
            exigir(page.locator("#sync-formulario .sync-panel").count() == 4,
                   f"modal: cuatro paneles — {page.locator('#sync-formulario .sync-panel').count()}", fallas)
            exigir(page.locator("#sync-panel-entrada").evaluate("e => e.open"),
                   "modal: el panel de entrada nace abierto", fallas)
            exigir(page.locator("#sync-entrada-texto").is_visible(), "entrada: el texto está a la vista", fallas)
            exigir(page.evaluate("typeof window.jsQR") == "function",
                   "qr: jsQR está cargado en local", fallas)

            # 2) Texto completo con prosa alrededor.
            page.locator("#sync-entrada-texto").fill(
                "Abre este enlace y vuelve a Mimo:\n" + PAYLOAD + "\nNo lo compartas.")
            page.locator("#sync-detectar").click()
            page.wait_for_timeout(200)
            exigir(page.locator("#sync-detectado").is_visible(),
                   "texto: el enlace se detecta sin limpiarlo a mano", fallas)
            datos = page.locator("#sync-detectado-datos").inner_text()
            exigir(SERVIDOR in datos and "prueba@example.test" in datos and "remote.php/dav/files" in datos,
                   f"texto: servidor, usuario y ruta — {datos[:90]}", fallas)
            exigir(CLAVE not in datos, "texto: la contraseña se muestra enmascarada", fallas)
            exigir(page.locator("#sync-detectado-origen").inner_text() == "Desde el texto",
                   "texto: el origen dice texto", fallas)

            page.locator("#sync-usar").click()
            page.wait_for_timeout(250)
            meta = estado(page)["meta"]
            exigir(meta["provider"] == "webdav" and meta["nc"] is True,
                   f"guardar: provider webdav y nc — {meta['provider']} / {meta['nc']}", fallas)
            exigir(meta["ncUrl"] == SERVIDOR and meta["webdav"]["usuario"] == "prueba@example.test",
                   f"guardar: servidor y usuario — {meta['ncUrl']} / {meta['webdav']['usuario']}", fallas)
            exigir(meta["webdav"]["url"] == DAV and meta["webdav"]["carpeta"] == "Mimo",
                   f"guardar: ruta WebDAV y carpeta — {meta['webdav']}", fallas)
            exigir(page.locator("#sync-webdav-url").input_value() == DAV,
                   "guardar: el campo manual refleja la ruta", fallas)

            enlace = page.locator("#sync-enlace-completo").inner_text()
            exigir(enlace.startswith("nc://onetime-login/") and CLAVE not in enlace,
                   f"enlace: se ve el enlace resuelto con la clave enmascarada — {enlace}", fallas)
            partes = page.locator("#sync-enlace-partes").inner_text()
            exigir("nube.example.test" in partes and "prueba@example.test" in partes and
                   "Mimo" in partes and "mimo-sync.json.enc" in partes,
                   f"enlace: las partes se descomponen — {partes[:120]}", fallas)
            page.locator("#sync-enlace-ver").click()
            page.wait_for_timeout(100)
            exigir(CLAVE in page.locator("#sync-enlace-completo").inner_text(),
                   "enlace: «Mostrar contraseña» la revela", fallas)
            page.locator("#sync-enlace-ver").click()
            page.wait_for_timeout(100)
            exigir(CLAVE not in page.locator("#sync-enlace-completo").inner_text(),
                   "enlace: se puede volver a ocultar", fallas)

            # Copiar el enlace completo: se intercepta el portapapeles.
            page.evaluate("""() => {
                window.__copiado = "";
                const cp = { writeText: (t) => { window.__copiado = t; return Promise.resolve(); } };
                try { Object.defineProperty(navigator, "clipboard", { value: cp, configurable: true }); }
                catch (e) { navigator.clipboard = cp; }
            }""")
            page.locator("#sync-enlace-copiar").click()
            page.wait_for_timeout(150)
            copiado = page.evaluate("window.__copiado")
            exigir(copiado.startswith("nc://onetime-login/") and CLAVE in copiado,
                   f"enlace: copiar entrega el enlace completo — {copiado[:48]}…", fallas)

            # 3) Acordeón y respaldo manual.
            antes = page.locator("#sync-panel-manual").evaluate("e => e.open")
            page.locator("#sync-panel-manual > summary").click()
            page.wait_for_timeout(120)
            despues = page.locator("#sync-panel-manual").evaluate("e => e.open")
            exigir(antes != despues, "acordeón: el panel manual se pliega y despliega", fallas)
            if not despues:
                page.locator("#sync-panel-manual > summary").click()
                page.wait_for_timeout(120)
            exigir(page.locator("#sync-proveedor").is_visible() and page.locator("#sync-webdav").count() == 1,
                   "manual: el respaldo sigue dentro del modal", fallas)

            # 4) Cerrar devuelve el formulario y limpia el texto con la clave.
            page.locator("#modal-cancelar").click()
            page.wait_for_timeout(220)
            exigir(not page.locator("#modal-editor").is_visible(), "cerrar: la ventana se cierra", fallas)
            exigir(page.evaluate("document.querySelector('#sync-formulario').parentElement.id") == "sync-hueco",
                   "cerrar: el formulario vuelve a Ajustes", fallas)
            exigir(page.locator("#sync-entrada-texto").input_value() == "",
                   "cerrar: el texto pegado no se queda en el formulario", fallas)
            exigir(page.locator("#sync-detectado").is_hidden(),
                   "cerrar: la vista previa queda oculta", fallas)

            # La tarjeta misma es la entrada: se pulsa el título, no un botón.
            page.locator("#sync-card h2").click()
            page.wait_for_timeout(220)
            exigir(page.locator("#modal-editor").get_attribute("data-editor") == "sync",
                   "tarjeta: pulsar la sección abre la ventana", fallas)
            page.keyboard.press("Escape")
            page.wait_for_timeout(180)
            exigir(not page.locator("#modal-editor").is_visible(),
                   "tarjeta: Escape cierra y devuelve el formulario", fallas)
            exigir(not errores, f"1440: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # 5) QR local: la imagen del fixture se decodifica y se confirma.
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            abrir_modal(page)
            page.locator("#sync-qr-archivo").set_input_files(str(FIXTURE))
            page.wait_for_timeout(800)
            exigir(page.locator("#sync-detectado").is_visible(),
                   "qr: la imagen se decodifica en el cliente", fallas)
            exigir(page.locator("#sync-detectado-origen").inner_text() == "Desde la imagen",
                   "qr: el origen dice imagen", fallas)
            datos = page.locator("#sync-detectado-datos").inner_text()
            exigir(SERVIDOR in datos and "prueba@example.test" in datos,
                   f"qr: el resultado se muestra antes de confirmar — {datos[:80]}", fallas)
            exigir(CLAVE not in datos, "qr: la contraseña no se pinta en claro", fallas)
            page.locator("#sync-usar").click()
            page.wait_for_timeout(220)
            meta = estado(page)["meta"]
            exigir(meta["webdav"]["url"] == DAV and meta["webdav"]["usuario"] == "prueba@example.test",
                   f"qr: se guarda la misma configuración — {meta['webdav']}", fallas)
            exigir(not errores, f"qr: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # 6) Saneado de esquema y URL parcial.
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            abrir_modal(page)
            page.locator("#sync-entrada-texto").fill(
                "nc://onetime-login/user:x&password:y&server:javascript:alert(1)")
            page.locator("#sync-detectar").click()
            page.wait_for_timeout(150)
            exigir(page.locator("#sync-detectado").is_hidden(),
                   "saneado: javascript: no se acepta", fallas)
            exigir(estado(page)["meta"]["webdav"]["url"] == "",
                   "saneado: no se guarda una URL peligrosa", fallas)

            page.locator("#sync-entrada-texto").fill(
                "https://nube.example.test/remote.php/dav/files/otro-usuario")
            page.locator("#sync-detectar").click()
            page.wait_for_timeout(150)
            exigir(page.locator("#sync-detectado").is_visible(),
                   "url: una dirección WebDAV completa se reconoce", fallas)
            page.locator("#sync-usar").click()
            page.wait_for_timeout(180)
            meta = estado(page)["meta"]
            exigir(meta["webdav"]["usuario"] == "otro-usuario",
                   f"url: el usuario sale de la ruta — {meta['webdav']['usuario']}", fallas)
            exigir(not errores, f"saneado: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

        # 7) 411.
        ctx, page, errores = nav.abrir(APP, 411, 900)
        try:
            abrir_modal(page)
            ancho = page.evaluate("document.querySelector('#modal-editor .modal__caja').getBoundingClientRect().width")
            exigir(ancho <= 411, f"411: la ventana cabe — {ancho:.0f}px", fallas)
            exigir(page.locator("#sync-entrada-texto").is_visible(),
                   "411: la entrada sigue visible", fallas)
            d = desborde(page)
            exigir(d == 0, f"411: sin desborde — {d}px", fallas)
            exigir(not errores, f"411: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-sync-enlace", fallas)


if __name__ == "__main__":
    sys.exit(main())
