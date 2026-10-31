#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""webdav.py — servidor WebDAV mínimo para medir la sincronización de MIMO.

No es un WebDAV completo: implementa GET/PUT/HEAD/MKCOL/PROPFIND/OPTIONS con
ETag, escritura condicional (If-Match, If-None-Match), Basic auth y CORS. Sirve
para probar la app real desde `file://` en Chromium, sin cuentas ni red externa.
"""
from __future__ import annotations

import base64
import hashlib
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit


class ServidorWebDAV:
    def __init__(self, usuario: str = "mimo", clave: str = "prueba", exigir_auth: bool = False):
        self.usuario = usuario
        self.clave = clave
        self.exigir_auth = exigir_auth
        self.datos: dict[str, bytes] = {}
        self.sondeos: dict[str, int] = {}
        self.etags: dict[str, str] = {}
        self.peticiones: list[tuple[str, str, int]] = []
        self.ultimo_if_match: str | None = None
        self.ultimo_if_none_match: str | None = None
        self.ultima_autorizacion: str | None = None
        self._lock = threading.Lock()
        servidor = self

        class Handler(BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def log_message(self, fmt, *args):  # silencio en la suite
                pass

            # ---- utilidades ----
            def _cabeceras(self, codigo: int, extra: dict | None = None):
                self.send_response(codigo)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, PUT, HEAD, MKCOL, PROPFIND, OPTIONS")
                pedidas = self.headers.get("Access-Control-Request-Headers")
                self.send_header("Access-Control-Allow-Headers", pedidas or "Authorization, Content-Type, If-Match, If-None-Match, Depth")
                self.send_header("Access-Control-Expose-Headers", "ETag, Last-Modified")
                self.send_header("Access-Control-Allow-Private-Network", "true")
                self.send_header("Access-Control-Max-Age", "600")
                for k, v in (extra or {}).items():
                    self.send_header(k, v)
                self.end_headers()

            def _ruta(self) -> str:
                return unquote(urlsplit(self.path).path)

            def _autorizado(self) -> bool:
                if not servidor.exigir_auth:
                    return True
                cab = self.headers.get("Authorization", "")
                if not cab.startswith("Basic "):
                    return False
                try:
                    par = base64.b64decode(cab[6:]).decode("utf-8")
                except Exception:
                    return False
                return par == f"{servidor.usuario}:{servidor.clave}"

            def _rechazar(self) -> bool:
                if self._autorizado():
                    return False
                self._cabeceras(401, {"WWW-Authenticate": 'Basic realm="mimo"'})
                return True

            def _etag(self, cuerpo: bytes) -> str:
                return '"' + hashlib.sha256(cuerpo).hexdigest()[:32] + '"'

            def _leer_cuerpo(self) -> bytes:
                n = int(self.headers.get("Content-Length") or 0)
                return self.rfile.read(n) if n else b""

            # ---- métodos ----
            def do_OPTIONS(self):
                servidor.peticiones.append(("OPTIONS", self._ruta(), 204))
                self._cabeceras(204)

            def do_GET(self):
                ruta = self._ruta()
                # Nextcloud: `status.php` es público y la OCS dice el identificador,
                # que es lo que el conector usa para armar /remote.php/dav/files/<id>/.
                if ruta == "/status.php":
                    cuerpo = json.dumps({"installed": True, "version": "34.0.4", "productname": "Nextcloud"}).encode()
                    servidor.peticiones.append(("GET", ruta, 200))
                    self._cabeceras(200, {"Content-Type": "application/json", "Content-Length": str(len(cuerpo))})
                    self.wfile.write(cuerpo)
                    return
                if ruta.startswith("/login/v2/flow/"):
                    cuerpo = b"<html><body><h1>Autoriza a Mimo</h1></body></html>"
                    servidor.peticiones.append(("GET", ruta, 200))
                    self._cabeceras(200, {"Content-Type": "text/html; charset=utf-8", "Content-Length": str(len(cuerpo))})
                    self.wfile.write(cuerpo)
                    return
                if ruta.startswith("/ocs/v2.php/cloud/user"):
                    if self._rechazar():
                        return
                    cuerpo = json.dumps({
                        "ocs": {"meta": {"status": "ok", "statuscode": 200},
                                "data": {"id": servidor.usuario, "displayname": servidor.usuario}}
                    }).encode()
                    servidor.peticiones.append(("GET", ruta, 200))
                    self._cabeceras(200, {"Content-Type": "application/json", "Content-Length": str(len(cuerpo))})
                    self.wfile.write(cuerpo)
                    return
                if self._rechazar():
                    return
                with servidor._lock:
                    cuerpo = servidor.datos.get(ruta)
                    etag = servidor.etags.get(ruta, "")
                if cuerpo is None:
                    servidor.peticiones.append(("GET", ruta, 404))
                    self._cabeceras(404, {"Content-Length": "0"})
                    return
                servidor.peticiones.append(("GET", ruta, 200))
                self._cabeceras(200, {
                    "Content-Type": "application/octet-stream",
                    "Content-Length": str(len(cuerpo)),
                    "ETag": etag,
                })
                self.wfile.write(cuerpo)

            def do_HEAD(self):
                if self._rechazar():
                    return
                ruta = self._ruta()
                with servidor._lock:
                    cuerpo = servidor.datos.get(ruta)
                    etag = servidor.etags.get(ruta, "")
                if cuerpo is None:
                    self._cabeceras(404, {"Content-Length": "0"})
                    return
                self._cabeceras(200, {"Content-Length": str(len(cuerpo)), "ETag": etag})

            def do_POST(self):
                ruta = self._ruta()
                if ruta == "/index.php/login/v2":
                    token = "token-de-prueba-2026"
                    cuerpo = json.dumps({
                        "poll": {"token": token, "endpoint": servidor.url + "/login/v2/poll"},
                        "login": servidor.url + "/login/v2/flow/" + token,
                    }).encode()
                    servidor.peticiones.append(("POST", ruta, 200))
                    self._leer_cuerpo()
                    self._cabeceras(200, {"Content-Type": "application/json", "Content-Length": str(len(cuerpo))})
                    self.wfile.write(cuerpo)
                    return
                if ruta == "/login/v2/poll":
                    cuerpo = self._leer_cuerpo().decode("utf-8", "replace")
                    token = ""
                    for trozo in cuerpo.split("&"):
                        if trozo.startswith("token="):
                            token = unquote(trozo[6:])
                    n = servidor.sondeos.get(token, 0) + 1
                    servidor.sondeos[token] = n
                    if n <= 2:
                        servidor.peticiones.append(("POST", ruta, 404))
                        self._cabeceras(404, {"Content-Length": "0"})
                        return
                    salida = json.dumps({
                        "server": servidor.url,
                        "loginName": servidor.usuario,
                        "appPassword": servidor.clave,
                    }).encode()
                    servidor.peticiones.append(("POST", ruta, 200))
                    self._cabeceras(200, {"Content-Type": "application/json", "Content-Length": str(len(salida))})
                    self.wfile.write(salida)
                    return
                self._cabeceras(404, {"Content-Length": "0"})

            def do_PUT(self):
                if self._rechazar():
                    return
                ruta = self._ruta()
                cuerpo = self._leer_cuerpo()
                servidor.ultimo_if_match = self.headers.get("If-Match")
                servidor.ultimo_if_none_match = self.headers.get("If-None-Match")
                servidor.ultima_autorizacion = self.headers.get("Authorization")
                with servidor._lock:
                    existe = ruta in servidor.datos
                    actual = servidor.etags.get(ruta, "")
                    if_match = self.headers.get("If-Match")
                    if_none = self.headers.get("If-None-Match")
                    choque = False
                    if if_match is not None and if_match.strip() != actual:
                        choque = True
                    if if_none is not None and if_none.strip() == "*" and existe:
                        choque = True
                    if choque:
                        servidor.peticiones.append(("PUT", ruta, 412))
                        self._cabeceras(412, {"Content-Length": "0"})
                        return
                    servidor.datos[ruta] = cuerpo
                    servidor.etags[ruta] = self._etag(cuerpo)
                    etag = servidor.etags[ruta]
                codigo = 204 if existe else 201
                servidor.peticiones.append(("PUT", ruta, codigo))
                self._cabeceras(codigo, {"ETag": etag, "Content-Length": "0"})

            def do_MKCOL(self):
                if self._rechazar():
                    return
                ruta = self._ruta().rstrip("/")
                with servidor._lock:
                    existe = ruta in servidor.datos
                    servidor.datos.setdefault(ruta, b"")
                    servidor.etags.setdefault(ruta, self._etag(b""))
                servidor.peticiones.append(("MKCOL", ruta, 405 if existe else 201))
                self._cabeceras(405 if existe else 201, {"Content-Length": "0"})

            def do_PROPFIND(self):
                if self._rechazar():
                    return
                ruta = self._ruta()
                with servidor._lock:
                    existe = ruta in servidor.datos
                    etag = servidor.etags.get(ruta, "")
                if not existe:
                    self._cabeceras(404, {"Content-Length": "0"})
                    return
                xml = (
                    '<?xml version="1.0" encoding="utf-8"?>'
                    '<d:multistatus xmlns:d="DAV:"><d:response><d:href>' + ruta + '</d:href>'
                    '<d:propstat><d:prop><d:getetag>' + etag + '</d:getetag></d:prop>'
                    '<d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>'
                ).encode("utf-8")
                self._cabeceras(207, {"Content-Type": "application/xml", "Content-Length": str(len(xml))})
                self.wfile.write(xml)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._hilo = threading.Thread(target=self._httpd.serve_forever, daemon=True)

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self._httpd.server_address[1]}"

    def __enter__(self):
        self._hilo.start()
        return self

    def __exit__(self, *exc):
        self._httpd.shutdown()
        self._httpd.server_close()
        self._hilo.join(timeout=3)

    # ---- ayudas para el gate ----
    def texto(self, ruta: str = "/Mimo/mimo-sync.json.enc") -> str:
        with self._lock:
            return self.datos.get(ruta, b"").decode("utf-8", "replace")

    def poner(self, ruta: str, cuerpo: bytes) -> None:
        with self._lock:
            self.datos[ruta] = cuerpo
            self.etags[ruta] = '"' + hashlib.sha256(cuerpo).hexdigest()[:32] + '"'

    def metodos(self) -> list[str]:
        return [m for m, _, _ in self.peticiones]


if __name__ == "__main__":
    with ServidorWebDAV() as s:
        print(f"WebDAV de prueba en {s.url} (Ctrl+C para salir)")
        try:
            threading.Event().wait()
        except KeyboardInterrupt:
            pass
