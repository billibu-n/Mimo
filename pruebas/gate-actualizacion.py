#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-actualizacion.py — actualizador in-app de Mimo.

Mide:
  1. la configuración Tauri: versión beta.4, createUpdaterArtifacts, pubkey,
     endpoint de la rama updates y requireSignedVersion;
  2. la tarjeta de Ajustes existe y en navegador explica que el updater es de escritorio;
  3. el manifiesto generado tiene claves por tipo de paquete, firmas y URLs del tag;
  4. el manifiesto no incluye linux-x86_64 genérico ni Arch.
"""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
APP = RAIZ / "app" / "index.html"
CONF = RAIZ / "escritorio" / "src-tauri" / "tauri.conf.json"
GEN = RAIZ / "scripts" / "updates" / "generar-manifiesto.py"
sys.path.insert(0, str(AQUI))
from gatelib import Navegador, exigir, salir  # noqa: E402


def crear_assets(carpeta: Path, version: str):
    nombres = [
        (f"Mimo_{version}_x64-setup.exe", ".sig", "firma-exe"),
        (f"Mimo_{version}_amd64.deb", ".sig", "firma-deb"),
        (f"Mimo-{version}-1.x86_64.rpm", ".sig", "firma-rpm"),
        (f"mimo-{version.replace('-', '')}-1-x86_64.pkg.tar.zst", ".sig", "firma-arch"),
    ]
    for nombre, sufijo, firma in nombres:
        (carpeta / nombre).write_text("paquete", encoding="utf-8")
        (carpeta / (nombre + sufijo)).write_text(firma, encoding="utf-8")


def main() -> int:
    fallas = []
    conf = json.loads(CONF.read_text(encoding="utf-8"))
    exigir(conf.get("version") == "1.2.0-beta.4",
           f"config: versión beta.4 — {conf.get('version')}", fallas)
    exigir(conf.get("bundle", {}).get("createUpdaterArtifacts") is True,
           "config: createUpdaterArtifacts", fallas)
    up = conf.get("plugins", {}).get("updater", {})
    exigir(bool(up.get("pubkey")), "config: pubkey minisign", fallas)
    exigir(up.get("requireSignedVersion") is True,
           "config: requireSignedVersion", fallas)
    endpoints = up.get("endpoints") or []
    exigir(endpoints == ["https://raw.githubusercontent.com/billibu-n/Mimo/updates/beta.json"],
           f"config: endpoint updates/beta.json — {endpoints}", fallas)
    exigir(all("latest/download" not in u for u in endpoints),
           "config: no depende de releases/latest", fallas)

    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        try:
            page.locator('#tabs [data-ir="ajustes"]').click()
            page.wait_for_timeout(300)
            exigir(page.locator("#actualizaciones-card").count() == 1,
                   "ui: tarjeta de actualizaciones", fallas)
            exigir(page.locator("#act-buscar").is_disabled(),
                   "ui: en navegador el botón se desactiva", fallas)
            exigir("escritorio" in page.locator("#act-estado").inner_text().lower(),
                   f"ui: explica que es de escritorio — {page.locator('#act-estado').inner_text()}", fallas)
            version = page.evaluate("window.MIMO_VERSION")
            exigir(version == "1.2.0-beta.4", f"ui: versión única — {version}", fallas)
            exigir(page.locator(".badge").inner_text().strip() == "v1.2.0-beta.4",
                   f"ui: badge — {page.locator('.badge').inner_text().strip()}", fallas)
            exigir(not [e for e in errores if e.startswith("pageerror")],
                   f"ui: sin pageerror — {errores[:2]}", fallas)
        finally:
            ctx.close()

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        crear_assets(td, "1.2.0-beta.4")
        out = td / "beta.json"
        p = subprocess.run([
            sys.executable, str(GEN), "--version", "1.2.0-beta.4",
            "--tag", "v1.2.0-beta.4", "--dir", str(td), "--out", str(out),
            "--notes", "prueba",
        ], capture_output=True, text=True)
        exigir(p.returncode == 0, f"manifiesto: genera — {p.stderr[-300:]}", fallas)
        if out.exists():
            m = json.loads(out.read_text(encoding="utf-8"))
            plataformas = m.get("platforms", {})
            exigir(set(plataformas) == {"windows-x86_64-nsis", "linux-x86_64-deb", "linux-x86_64-rpm"},
                   f"manifiesto: claves por paquete — {sorted(plataformas)}", fallas)
            exigir("linux-x86_64" not in plataformas and "arch" not in json.dumps(plataformas).lower(),
                   f"manifiesto: sin genérico ni Arch — {sorted(plataformas)}", fallas)
            exigir(m.get("version") == "1.2.0-beta.4", f"manifiesto: versión — {m.get('version')}", fallas)
            exigir(all(v.get("signature") and v.get("url") for v in plataformas.values()),
                   "manifiesto: firma y URL en cada plataforma", fallas)
            exigir(all("/v1.2.0-beta.4/" in v["url"] for v in plataformas.values()),
                   "manifiesto: URLs al tag exacto", fallas)

        # Firma faltante: debe fallar.
        (td / "Mimo_1.2.0-beta.4_x64-setup.exe.sig").unlink()
        p2 = subprocess.run([
            sys.executable, str(GEN), "--version", "1.2.0-beta.4",
            "--tag", "v1.2.0-beta.4", "--dir", str(td), "--out", str(td / "mal.json"),
        ], capture_output=True, text=True)
        exigir(p2.returncode != 0, "manifiesto: firma faltante falla", fallas)

    return salir("gate-actualizacion", fallas)


if __name__ == "__main__":
    sys.exit(main())
