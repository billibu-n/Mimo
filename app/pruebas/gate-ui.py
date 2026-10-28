#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-ui.py — gate G-UI de MIMO v2 sobre la maqueta congelada.

Mide lo que el plan M02 reclama, no impresiones:
  1. base 4: Calendario, Tareas y Notas primero; Ajustes última
  2. panel de herramientas con 4 pestañas
  3. 1440/1100/411 sin desborde horizontal de documento
  4. 0 errores de consola y 0 excepciones
  5. 1440: split enciende y apaga; tema cambia; Ajustes declara 10 temas
  6. 1100/411: el panel pasa a cajón y se cierra
  7. fixture roto: el mismo gate sale 1 (si no, el gate no sirve)

Uso:
  python3 app/pruebas/gate-ui.py                 # maqueta buena
  python3 app/pruebas/gate-ui.py --demo          # buena 0 + rota 1
  python3 app/pruebas/gate-ui.py --fichero ...   # otro HTML
"""
from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
MAQUETA = RAIZ / "app" / "maqueta" / "index.html"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir, texto_tabs  # noqa: E402

BASE = ["Calendario", "Tareas", "Notas"]
PANEL = ["Contexto", "Detalle", "Notas", "Bloques"]


def correr(fichero: Path) -> list[str]:
    fallas: list[str] = []
    print(f"TABLERO: {fichero}")
    with Navegador() as nav:
        for ancho in (1440, 1100, 411):
            ctx, page, errores = nav.abrir(fichero, ancho, 900)
            try:
                tabs = texto_tabs(page)
                exigir(tabs[:3] == BASE, f"{ancho}: base empieza por {BASE} — {tabs[:3]}", fallas)
                exigir(tabs[-1] == "Ajustes", f"{ancho}: Ajustes es la última pestaña — {tabs[-1:]}", fallas)
                panel = [t.strip() for t in page.locator(".panel__tab").all_inner_texts()]
                exigir(panel == PANEL, f"{ancho}: panel con 4 pestañas — {panel}", fallas)
                d = desborde(page)
                exigir(d == 0, f"{ancho}: sin desborde horizontal — {d}px", fallas)
                exigir(not errores, f"{ancho}: consola limpia — {errores[:3]}", fallas)

                if ancho == 1440:
                    page.locator("#btn-split").click()
                    page.wait_for_timeout(120)
                    exigir(page.locator("#contenido-b").is_visible(),
                           "1440: el split muestra el panel secundario", fallas)
                    page.locator("#btn-cerrar-split").click()
                    page.wait_for_timeout(80)
                    exigir(not page.locator("#contenido-b").is_visible(),
                           "1440: cerrar el split lo oculta", fallas)
                    antes = page.locator("body").get_attribute("data-tema")
                    page.locator("#btn-tema").click()
                    page.wait_for_timeout(80)
                    despues = page.locator("body").get_attribute("data-tema")
                    exigir(antes != despues, f"1440: el tema cambia — {antes} -> {despues}", fallas)
                    page.locator("#btn-ajustes").click()
                    page.wait_for_timeout(80)
                    temas = page.locator("#temas .tema").count()
                    exigir(temas == 10, f"1440: Ajustes declara 10 temas — {temas}", fallas)
                else:
                    page.locator("#btn-panel").click()
                    page.wait_for_timeout(80)
                    abierto = "panel-abierto" in (page.locator("body").get_attribute("class") or "")
                    exigir(abierto, f"{ancho}: el panel se abre como cajón", fallas)
                    page.locator("#btn-panel-cerrar").click()
                    page.wait_for_timeout(80)
                    cerrado = "panel-abierto" not in (page.locator("body").get_attribute("class") or "")
                    exigir(cerrado, f"{ancho}: el cajón se cierra", fallas)
            finally:
                ctx.close()
    return fallas


def con_fixture_roto(destino: Path) -> Path:
    shutil.copytree(MAQUETA.parent, destino, dirs_exist_ok=True)
    rota = destino / "index.html"
    html = rota.read_text(encoding="utf-8")
    html = html.replace("</head>", "<style>html,body{min-width:1600px}</style></head>", 1)
    rota.write_text(html, encoding="utf-8")
    return rota


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fichero", type=Path, default=MAQUETA)
    ap.add_argument("--demo", action="store_true", help="mide la buena y la rota")
    args = ap.parse_args()

    fallas = correr(args.fichero)
    codigo = salir("gate-ui", fallas)
    if not args.demo:
        return codigo

    with tempfile.TemporaryDirectory(prefix="mimo-gate-ui-") as tmp:
        rota = con_fixture_roto(Path(tmp) / "maqueta")
        fallas_rotas = correr(rota)
        codigo_roto = salir("gate-ui/rota", fallas_rotas)
    if codigo != 0:
        print("ROJO: la maqueta buena no pasa.")
        return 1
    if codigo_roto != 1:
        print("ROJO: el fixture roto no sale 1; el gate no discrimina.")
        return 1
    print("DEMO: buena 0, rota 1. El gate discrimina.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
