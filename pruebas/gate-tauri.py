#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-tauri.py — binario release de Mimo en Tauri 2.

Mide el binario real, no el HTML suelto:
  1. carga la app universal desde `frontendDist` (no el prototipo);
  2. navega a Tareas y Notas, crea una nota y comprueba `localStorage`;
  3. Ajustes conserva los 4 grupos y la tarjeta de sincronización;
  4. WebDAV funciona por el puente HTTP nativo (sin CORS) contra un servidor local;
  5. el remoto queda cifrado y con Basic auth;
  6. el estado sobrevive a cerrar y abrir el binario;
  7. la carpeta nativa recuerda la ruta, escribe `mimo-sync.json` de forma atomica y lo relee;
  8. el RPM y el binario existen y pesan lo esperado.

Requiere el binario ya compilado:
  cd escritorio
  CARGO_TARGET_DIR="$HOME/.cache/mimo-tauri-target" PATH="$HOME/.cargo/bin:$PATH" cargo tauri build --bundles rpm
  cp "$HOME/.cache/mimo-tauri-target/release/mimo" release/
  cp "$HOME/.cache/mimo-tauri-target/release/bundle/rpm/"*.rpm release/
"""
from __future__ import annotations

import glob
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
ESCRITORIO = RAIZ / "escritorio"
BIN = ESCRITORIO / "release" / "mimo"
RPM = ESCRITORIO / "release"
if not BIN.exists():
    BIN = ESCRITORIO / "src-tauri" / "target" / "release" / "mimo"
    RPM = ESCRITORIO / "src-tauri" / "target" / "release" / "bundle" / "rpm"

sys.path.insert(0, str(AQUI))
from gatelib import exigir, salir  # noqa: E402
from webdav import ServidorWebDAV  # noqa: E402

CLAVE = "clave-tauri-2026"


def correr_sonda(env_base: dict, salida: Path, limite: float = 70.0):
    env = env_base.copy()
    env["MIMO_SONDA"] = "1"
    env["MIMO_SONDA_SALIDA"] = str(salida)
    p = subprocess.Popen(
        [str(BIN)], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )
    fin = time.time() + limite
    while time.time() < fin and not salida.exists() and p.poll() is None:
        time.sleep(0.25)
    if not salida.exists():
        p.kill()
    out, err = p.communicate(timeout=10)
    if salida.exists():
        return json.loads(salida.read_text(encoding="utf-8")), p.returncode, out, err
    return None, p.returncode, out, err


def main() -> int:
    fallas: list[str] = []
    if not BIN.exists():
        print(f"[ROJO] falta el binario: {BIN}")
        print("Compila con: cd escritorio && "
              "PATH=\"$HOME/.cargo/bin:$PATH\" cargo tauri build --bundles rpm")
        return 1
    if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
        print("[ROJO] no hay DISPLAY ni WAYLAND_DISPLAY: el binario no puede abrir ventana.")
        return 1

    conf = json.loads((ESCRITORIO / "src-tauri" / "tauri.conf.json").read_text(encoding="utf-8"))
    exigir(conf.get("version") == "1.2.0-beta.2", f"tauri: version 1.2.0-beta.2 — {conf.get('version')}", fallas)
    exigir(conf.get("build", {}).get("frontendDist") == "../../app",
           "tauri: frontendDist apunta a la app fuente", fallas)

    with tempfile.TemporaryDirectory() as td, ServidorWebDAV(exigir_auth=True) as srv:
        td = Path(td)
        for d in ("data", "cache", "config"):
            (td / d).mkdir()
        carpeta = td / "carpeta-sync"
        carpeta.mkdir()
        env = os.environ.copy()
        env.update({
            "MIMO_CARPETA_PRUEBA": str(carpeta),
            "MIMO_WEBDAV_URL": srv.url,
            "MIMO_WEBDAV_USER": "mimo",
            "MIMO_WEBDAV_PASS": "prueba",
            "MIMO_WEBDAV_CLAVE": CLAVE,
            "MIMO_WEBDAV_FOLDER": "Mimo",
            "XDG_DATA_HOME": str(td / "data"),
            "XDG_CACHE_HOME": str(td / "cache"),
            "XDG_CONFIG_HOME": str(td / "config"),
            "WEBKIT_DISABLE_COMPOSITING_MODE": "1",
        })

        primera, codigo, out, err = correr_sonda(env, td / "sonda-1.json")
        if primera is None:
            print(f"[ROJO] la primera sonda no respondio (codigo {codigo})\n{err[-1500:]}")
            return 1
        r = primera
        exigir(r.get("origen", "").startswith("tauri://"), f"tauri: origen tauri — {r.get('origen')}", fallas)
        exigir(r.get("titulo") == "Mimo · universal", f"tauri: titulo — {r.get('titulo')}", fallas)
        exigir(r.get("tabs") == ["calendario", "tareas", "notas", "ajustes"],
               f"tauri: 4 pestanas base — {r.get('tabs')}", fallas)
        exigir(len(r.get("secciones", [])) == 8, f"tauri: 8 secciones — {len(r.get('secciones', []))}", fallas)
        exigir(r.get("tareas_visible") is True, "tauri: Tareas navega", fallas)
        exigir(r.get("nota_guardada") is True and r.get("notas", 0) >= 1,
               f"tauri: nota en localStorage — {r.get('notas')}", fallas)
        exigir(r.get("tutorial_tareas", 0) >= 11 and r.get("tutorial_nota") is True,
               f"tauri: tutorial precargado — {r.get('tutorial_tareas')} tareas, nota={r.get('tutorial_nota')}", fallas)
        exigir(r.get("css", 0) >= 10, f"tauri: CSS cargado — {r.get('css')}", fallas)
        exigir(r.get("katex") == "object", f"tauri: KaTeX cargado — {r.get('katex')}", fallas)
        exigir(r.get("grupos") == 4, f"tauri: Ajustes con 4 grupos — {r.get('grupos')}", fallas)
        exigir(r.get("sync_card") is True, "tauri: tarjeta de sincronizacion", fallas)
        exigir("Sincronizado" in (r.get("sync_estado") or ""),
               f"tauri: estado sincronizado — {r.get('sync_estado')}", fallas)
        sync = r.get("sync") or {}
        exigir(sync.get("provider") == "webdav" and sync.get("version", 0) >= 1 and
               sync.get("pendiente") is False and sync.get("conflicto") is False,
               f"tauri: sync WebDAV cerrada — {sync}", fallas)
        exigir((r.get("carpeta_nativa") or {}).get("nombre") == "carpeta-sync",
               f"tauri: carpeta nativa recordada — {r.get('carpeta_nativa')} {r.get('carpeta_error')}", fallas)
        exigir(r.get("carpeta_texto") == '{"prueba":"carpeta-nativa","n":1}',
               f"tauri: ida y vuelta nativa — {r.get('carpeta_texto')}", fallas)
        exigir((carpeta / "mimo-sync.json").exists() and
               (carpeta / "mimo-sync.json").read_text(encoding="utf-8") == '{"prueba":"carpeta-nativa","n":1}',
               "tauri: mimo-sync.json escrito en la carpeta elegida", fallas)
        exigir(r.get("errores") == [], f"tauri: sin errores JS — {r.get('errores')}", fallas)

        ruta = "/Mimo/mimo-sync.json.enc"
        cuerpo = srv.texto(ruta)
        exigir(ruta in srv.datos, "tauri: el servidor recibio mimo-sync.json.enc", fallas)
        exigir('"formato":"mimo-sync-cifrado"' in cuerpo.replace(" ", ""),
               "tauri: el remoto esta cifrado", fallas)
        exigir("Nota Tauri" not in cuerpo and '"notas"' not in cuerpo,
               "tauri: el remoto no filtra la nota", fallas)
        exigir("PUT" in srv.metodos(), "tauri: hubo PUT nativo", fallas)
        exigir("MKCOL" in srv.metodos(), "tauri: creo la carpeta remota con MKCOL", fallas)
        exigir("OPTIONS" not in srv.metodos(),
               f"tauri: sin preflight CORS (puente nativo) — {srv.metodos()}", fallas)
        exigir(bool(srv.ultima_autorizacion and srv.ultima_autorizacion.startswith("Basic ")),
               "tauri: Basic auth en la peticion nativa", fallas)

        # Segunda apertura con el mismo XDG: localStorage sobrevive.
        segunda, codigo2, out2, err2 = correr_sonda(env, td / "sonda-2.json")
        if segunda is None:
            exigir(False, f"tauri: la segunda apertura no respondio — {err2[-400:]}", fallas)
        else:
            exigir(segunda.get("notas", 0) >= 2,
                   f"tauri: localStorage sobrevive a cerrar — {segunda.get('notas')} notas", fallas)
            exigir("Sincronizado" in (segunda.get("sync_estado") or ""),
                   f"tauri: segunda sincronizacion — {segunda.get('sync_estado')}", fallas)

    rpm = sorted(glob.glob(str(RPM / "*.rpm")))
    exigir(bool(rpm), f"tauri: RPM construido en {RPM}", fallas)
    if rpm:
        tam = Path(rpm[0]).stat().st_size
        exigir(tam > 1_000_000, f"tauri: RPM de {tam} bytes", fallas)
        lanzador = subprocess.run(
            ["sh", "-c", f"rpm2cpio {rpm[0]} | cpio -i --to-stdout ./usr/share/applications/Mimo.desktop"],
            capture_output=True, text=True)
        texto = lanzador.stdout
        exigir("Name=Mimo" in texto and "Icon=mimo" in texto and "StartupWMClass=mimo" in texto
               and "NoDisplay=true" not in texto,
               f"tauri: lanzador nativo Mimo — {texto[:140]!r}", fallas)
        meta = subprocess.run(
            ["sh", "-c", f"rpm2cpio {rpm[0]} | cpio -i --to-stdout ./usr/share/metainfo/cl.mimo.escritorio.metainfo.xml"],
            capture_output=True, text=True)
        exigir("<name>Mimo</name>" in meta.stdout and 'type="stock">mimo' in meta.stdout
               and "Mimo.desktop" in meta.stdout,
               "tauri: AppStream con nombre Mimo, icono y launchable", fallas)
    exigir(BIN.stat().st_size > 5_000_000, f"tauri: binario de {BIN.stat().st_size} bytes", fallas)
    return salir("gate-tauri", fallas)


if __name__ == "__main__":
    sys.exit(main())
