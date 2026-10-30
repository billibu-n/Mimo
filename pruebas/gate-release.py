#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-release.py — artefactos y manifiesto del updater.

Comprueba los paquetes Linux construidos, sus firmas .sig, la configuración de firma y
el manifiesto generado. Windows se simula como fixture si no está en la carpeta; el
manifiesto real se valida en el release multiplataforma.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
GEN = RAIZ / "scripts" / "updates" / "generar-manifiesto.py"
CONF = RAIZ / "escritorio" / "src-tauri" / "tauri.conf.json"
VERSION = "1.2.0-beta.4"

fallas: list[str] = []


def exigir(cond, msg):
    print(("[OK] " if cond else "[ROJO] ") + msg)
    if not cond:
        fallas.append(msg)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=str(RAIZ / "escritorio" / "release"))
    args = ap.parse_args()
    carpeta = Path(args.dir)
    conf = json.loads(CONF.read_text(encoding="utf-8"))
    exigir(conf.get("version") == VERSION, f"release: versión {VERSION} — {conf.get('version')}")
    up = conf.get("plugins", {}).get("updater", {})
    exigir(bool(up.get("pubkey")) and up.get("requireSignedVersion") is True,
           "release: pubkey y requireSignedVersion")

    rpm = carpeta / f"Mimo-{VERSION}-1.x86_64.rpm"
    deb = carpeta / f"Mimo_{VERSION}_amd64.deb"
    for paquete, firma in [(rpm, rpm.with_suffix(rpm.suffix + ".sig")),
                           (deb, deb.with_suffix(deb.suffix + ".sig"))]:
        exigir(paquete.is_file() and paquete.stat().st_size > 1_000_000,
               f"release: {paquete.name} ({paquete.stat().st_size if paquete.is_file() else 0} B)")
        exigir(firma.is_file() and firma.read_text(encoding="utf-8").strip() != "",
               f"release: firma {firma.name}")

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        for p in [rpm, deb, rpm.with_suffix(rpm.suffix + ".sig"), deb.with_suffix(deb.suffix + ".sig")]:
            if p.is_file():
                shutil.copy2(p, td / p.name)
        # Fixture de Windows si no está el instalador real.
        exe = carpeta / f"Mimo_{VERSION}_x64-setup.exe"
        if not exe.is_file():
            exe = td / f"Mimo_{VERSION}_x64-setup.exe"
            exe.write_bytes(b"fixture-windows")
            (td / (exe.name + ".sig")).write_text("firma-windows-fixture", encoding="utf-8")
        else:
            shutil.copy2(exe, td / exe.name)
            shutil.copy2(exe.with_suffix(exe.suffix + ".sig"), td / (exe.name + ".sig"))
        out = td / "beta.json"
        p = subprocess.run([
            sys.executable, str(GEN), "--version", VERSION, "--tag", "v" + VERSION,
            "--dir", str(td), "--out", str(out),
        ], capture_output=True, text=True)
        exigir(p.returncode == 0, f"release: manifiesto generado — {p.stderr[-300:]}")
        if out.exists():
            m = json.loads(out.read_text(encoding="utf-8"))
            exigir(m.get("version") == VERSION, f"release: manifiesto versión — {m.get('version')}")
            claves = set((m.get("platforms") or {}).keys())
            exigir(claves == {"windows-x86_64-nsis", "linux-x86_64-deb", "linux-x86_64-rpm"},
                   f"release: claves — {sorted(claves)}")
            exigir(m["platforms"]["linux-x86_64-rpm"]["signature"] ==
                   (rpm.with_suffix(rpm.suffix + ".sig")).read_text(encoding="utf-8").strip(),
                   "release: firma RPM en el manifiesto")
            exigir(m["platforms"]["linux-x86_64-deb"]["signature"] ==
                   (deb.with_suffix(deb.suffix + ".sig")).read_text(encoding="utf-8").strip(),
                   "release: firma DEB en el manifiesto")
            exigir(all("/v" + VERSION + "/" in v["url"] for v in m["platforms"].values()),
                   "release: URLs al tag exacto")

    print()
    if fallas:
        print(f"RESUMEN gate-release: {len(fallas)} choque(s).")
        return 1
    print("RESUMEN gate-release: 0 choque(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
