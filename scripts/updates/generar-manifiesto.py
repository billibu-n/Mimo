#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera el manifiesto estático del actualizador de Mimo.

Solo incluye packages que el plugin de Tauri puede instalar:
  - Windows NSIS: windows-x86_64-nsis
  - Linux DEB:    linux-x86_64-deb
  - Linux RPM:    linux-x86_64-rpm

Arch no se incluye: el plugin no instala .pkg.tar.zst. Tampoco se escribe la clave
genérica linux-x86_64, para que un paquete del sistema no reciba el formato equivocado.

Uso:
  python3 scripts/updates/generar-manifiesto.py \
    --version 1.2.0-beta.5 --tag v1.2.0-beta.5 \
    --dir publicacion --out publicacion/beta.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

PLATAFORMAS = (
    ("windows-x86_64-nsis", "Mimo_{version}_x64-setup.exe", ".sig"),
    ("linux-x86_64-deb", "Mimo_{version}_amd64.deb", ".sig"),
    ("linux-x86_64-rpm", "Mimo-{version}-1.x86_64.rpm", ".sig"),
)
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$")


def error(msg: str) -> "None":
    print(f"ROJO: {msg}", file=sys.stderr)
    raise SystemExit(1)


def leer_firma(path: Path) -> str:
    if not path.is_file():
        error(f"falta la firma {path.name}")
    texto = path.read_text(encoding="utf-8").strip()
    if not texto:
        error(f"la firma {path.name} está vacía")
    return texto


def generar(version: str, tag: str, carpeta: Path, base: str, notas: str) -> dict:
    if not SEMVER.match(version):
        error(f"versión no SemVer: {version!r}")
    if not tag:
        error("falta el tag")
    plataformas = {}
    for clave, patron, sufijo in PLATAFORMAS:
        nombre = patron.format(version=version)
        paquete = carpeta / nombre
        if not paquete.is_file():
            error(f"falta el paquete {nombre}")
        firma = leer_firma(carpeta / (nombre + sufijo))
        url = base.rstrip("/") + "/" + tag + "/" + quote(nombre)
        plataformas[clave] = {"signature": firma, "url": url}
    return {
        "version": version,
        "notes": notas,
        "pub_date": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "platforms": plataformas,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--dir", default="publicacion")
    ap.add_argument("--out", default="publicacion/beta.json")
    ap.add_argument("--base-url", default="https://github.com/billibu-n/Mimo/releases/download")
    ap.add_argument("--notes", default="Actualizador incorporado y respaldos verificables.")
    args = ap.parse_args()
    manifiesto = generar(
        args.version.strip().lstrip("v"),
        args.tag.strip(),
        Path(args.dir),
        args.base_url,
        args.notes,
    )
    salida = Path(args.out)
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(json.dumps(manifiesto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"manifiesto: {salida} ({len(manifiesto['platforms'])} plataformas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
