#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-bloques.py — gate G-BLOQUES de MIMO v2 (M02).

Dos capas, porque un manifiesto correcto no garantiza una interfaz correcta:

  A. contrato: valida manifiestos v1.1 (ids, padre existente, kit que instala
     bloques existentes, sin ciclos, dos niveles visibles).
  B. interfaz: sobre la maqueta congelada, Tiempo tiene 4 bloques dentro; al
     quitar uno el padre sigue y la cuenta baja; el kit Academics instala sus
     cuatro y al quitarlo no deja pestañas huérfanas.
  C. roto: sin `tiempo`, `pomodoro` queda huérfano y el validador debe salir 1.

Uso:
  python3 app/pruebas/gate-bloques.py
  python3 app/pruebas/gate-bloques.py --demo
"""
from __future__ import annotations

import argparse
import copy
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent.parent
MAQUETA = RAIZ / "app" / "maqueta" / "index.html"
APP = RAIZ / "app" / "index.html"
FIXTURE = AQUI / "fixtures" / "manifiestos-v1.1.json"

sys.path.insert(0, str(AQUI))
from gatelib import Navegador, desborde, exigir, salir  # noqa: E402

NATURALEZAS = {"seccion", "dentro-de-otro", "aporte", "pack", "tema"}


def validar_manifiestos(doc: dict) -> list[str]:
    errores: list[str] = []
    bloques = doc.get("bloques")
    if not isinstance(bloques, list) or not bloques:
        return ["bloques vacío"]
    por_id = {}
    for b in bloques:
        if not isinstance(b, dict):
            errores.append("un bloque no es objeto")
            continue
        for campo in ("id", "nombre", "version", "naturaleza"):
            if not b.get(campo):
                errores.append(f"bloque sin {campo}: {b.get('id')!r}")
        if b.get("id") in por_id:
            errores.append(f"id duplicado: {b.get('id')}")
        por_id[b.get("id")] = b
        if b.get("naturaleza") not in NATURALEZAS:
            errores.append(f"{b.get('id')}: naturaleza desconocida {b.get('naturaleza')!r}")

    for b in por_id.values():
        padre = b.get("padre")
        if b.get("naturaleza") == "dentro-de-otro" and not padre:
            errores.append(f"{b.get('id')}: dentro-de-otro sin padre")
        if padre:
            if padre not in por_id:
                errores.append(f"{b.get('id')}: padre {padre!r} no existe")
            elif por_id[padre].get("naturaleza") != "seccion":
                errores.append(f"{b.get('id')}: el padre {padre!r} no es sección (2 niveles)")
            # ciclo de padres
            visto = {b.get("id")}
            p = padre
            while p:
                if p in visto:
                    errores.append(f"{b.get('id')}: ciclo de padres en {p!r}")
                    break
                visto.add(p)
                p = por_id.get(p, {}).get("padre")
        if b.get("naturaleza") == "pack":
            hijos = b.get("instala")
            if not isinstance(hijos, list) or not hijos:
                errores.append(f"{b.get('id')}: kit sin instala[]")
            else:
                for h in hijos:
                    if h not in por_id:
                        errores.append(f"{b.get('id')}: instala {h!r}, que no existe")
                    elif h == b.get("id"):
                        errores.append(f"{b.get('id')}: un kit no se instala a sí mismo")
    return errores


def interfaz() -> list[str]:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(MAQUETA, 1440, 900)
        try:
            page.locator('#tabs .tab:has-text("Tiempo")').click()
            page.wait_for_timeout(100)
            estantes = page.locator("#estanteria-tiempo [data-tiempo-vista]")
            exigir(estantes.count() == 4, f"Tiempo: 4 bloques dentro — {estantes.count()}", fallas)
            page.locator("#btn-editar-tiempo").click()
            page.wait_for_timeout(80)
            page.locator("#estanteria-tiempo .estante__x").first.click()
            page.wait_for_timeout(100)
            quedan = page.locator("#estanteria-tiempo [data-tiempo-vista]").count()
            exigir(quedan == 3, f"Tiempo: quitar un hijo deja 3 — {quedan}", fallas)
            exigir(page.locator("#reloj").is_visible(), "Tiempo: el padre sigue montado tras quitar un hijo", fallas)
            cuenta = page.locator("#tiempo-cuenta").inner_text().strip()
            exigir(cuenta == "3 bloques dentro", f"Tiempo: la cuenta baja a 3 — {cuenta!r}", fallas)
            exigir(not errores, f"Tiempo: consola limpia — {errores[:3]}", fallas)

            page.locator("#btn-add").click()
            page.wait_for_timeout(150)
            kit = page.locator(".bcard").filter(has_text="Kit académico:")
            exigir(kit.count() == 1, "catálogo: la ficha del kit Academics existe", fallas)
            boton = kit.locator("button", has_text="Instalar kit")
            exigir(boton.count() == 1, "catálogo: el kit incompleto ofrece Instalar kit", fallas)
            if boton.count() == 1:
                boton.click()
                page.wait_for_timeout(150)
                sub = page.locator("#modal-sub").inner_text()
                exigir("5 bloques instalados" in sub, f"kit: instalar Academics suma su aporte — {sub!r}", fallas)
                exigir(kit.locator("button", has_text="Quitar kit").count() == 1,
                       "kit: tras instalar, la ficha ofrece Quitar kit", fallas)
                kit.locator("button", has_text="Quitar kit").click()
                page.wait_for_timeout(150)
                sub = page.locator("#modal-sub").inner_text()
                exigir(sub.startswith("1 "), f"kit: quitarlo deja solo Tiempo — {sub!r}", fallas)
                page.locator("#modal-x").click()
                tabs = [t.strip() for t in page.locator("#tabs .tab").all_inner_texts()]
                exigir(not any(x in tabs for x in ("Malla", "Calificaciones", "Estudio", "Evaluaciones")),
                       f"kit: quitarlo no deja pestañas huérfanas — {tabs}", fallas)
        finally:
            ctx.close()
    return fallas


def catalogo_app() -> list[str]:
    """Catálogo real: filtros por origen, tags, búsqueda, persistencia y enlace."""
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950, reset=False)
        try:
            page.locator("#btn-add").click()
            page.wait_for_timeout(200)
            exigir(page.locator("#catalogo-filtros .cchip").count() == 3,
                   f"catálogo: 3 filtros de origen — {page.locator('#catalogo-filtros .cchip').count()}", fallas)
            exigir(page.locator("#catalogo .bcard").count() == 9,
                   f"catálogo: 9 fichas visibles — {page.locator('#catalogo .bcard').count()}", fallas)
            exigir(page.locator('#catalogo-filtros [data-origen="todos"] b').inner_text() == "9",
                   "catálogo: el contador de Todos es la lista completa", fallas)
            exigir(page.locator('#catalogo-filtros [data-origen="nativo"] b').inner_text() == "8",
                   "catálogo: 8 nativos", fallas)
            exigir(page.locator('#catalogo-filtros [data-origen="kit"] b').inner_text() == "1",
                   "catálogo: 1 kit", fallas)

            page.locator('#catalogo-filtros [data-origen="kit"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#catalogo .bcard").count() == 1 and
                   "Academics" in page.locator("#catalogo .bcard").inner_text(),
                   "catálogo: Kits deja solo Academics", fallas)
            exigir(page.locator('#catalogo-filtros [data-origen="todos"] b').inner_text() == "9",
                   "catálogo: filtrar no cambia el contador total", fallas)

            page.locator('#catalogo-filtros [data-origen="nativo"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#catalogo .bcard").count() == 8,
                   f"catálogo: Nativos deja 8 — {page.locator('#catalogo .bcard').count()}", fallas)

            page.locator('#catalogo-filtros [data-origen="todos"]').click()
            page.wait_for_timeout(120)
            page.locator('#catalogo .bcard[data-bloque="tiempo"] [data-tag="pomodoro"]').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#catalogo .bcard").count() == 1 and
                   "Tiempo" in page.locator("#catalogo .bcard").inner_text(),
                   "catálogo: tag pomodoro deja Tiempo", fallas)
            exigir(page.locator("#catalogo-filtros .cchip--activo").count() == 1,
                   "catálogo: el tag activo se ve en el panel", fallas)

            page.locator("#catalogo-filtros [data-quitar-tag]").click()
            page.wait_for_timeout(120)
            page.locator("#catalogo-buscar").fill("probabilidad")
            page.wait_for_timeout(120)
            exigir(page.locator("#catalogo .bcard").count() == 0 and page.locator("#catalogo-vacio").is_visible(),
                   "catálogo: búsqueda sin resultados muestra el vacío", fallas)
            page.locator("#catalogo-limpiar").click()
            page.wait_for_timeout(120)
            exigir(page.locator("#catalogo .bcard").count() == 9,
                   "catálogo: limpiar filtros vuelve a 9", fallas)

            page.locator('#catalogo-filtros [data-origen="kit"]').click()
            page.wait_for_timeout(120)
            page.reload(wait_until="load")
            page.wait_for_timeout(250)
            page.locator("#btn-add").click()
            page.wait_for_timeout(150)
            exigir(page.locator('#catalogo-filtros [data-origen="kit"]').get_attribute("aria-pressed") == "true",
                   "catálogo: el filtro de origen sobrevive a recargar", fallas)
            exigir(page.locator("#catalogo .bcard").count() == 1,
                   "catálogo: al recargar sigue filtrado a Kits", fallas)

            page.set_viewport_size({"width": 411, "height": 900})
            page.wait_for_timeout(100)
            exigir(desborde(page) == 0, f"catálogo 411: sin desborde — {desborde(page)}px", fallas)

            page.locator("#modal-x").click()
            page.locator("#btn-ajustes").click()
            page.wait_for_timeout(150)
            enlace = page.locator("#sync-webdav-registro")
            texto = enlace.inner_text().strip()
            exigir(texto == "Crea una en Nextcloud", f"sync: el enlace no filtra atributos — {texto!r}", fallas)
            exigir("data-l10n" not in texto, "sync: el enlace no muestra data-l10n como texto", fallas)
            exigir(enlace.get_attribute("href") == "https://nextcloud.com/es/sign-up/",
                   "sync: el enlace conserva su destino", fallas)
            exigir(not errores, f"catálogo: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return fallas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()

    fallas: list[str] = []
    doc = json.loads(FIXTURE.read_text(encoding="utf-8"))
    errores = validar_manifiestos(doc)
    exigir(not errores, f"contrato: manifiestos v1.1 válidos — {errores}", fallas)
    fallas += interfaz()
    fallas += catalogo_app()
    codigo = salir("gate-bloques", fallas)

    if not args.demo:
        return codigo
    roto = copy.deepcopy(doc)
    roto["bloques"] = [b for b in roto["bloques"] if b.get("id") != "tiempo"]
    errores_rotos = validar_manifiestos(roto)
    exigir(bool(errores_rotos), f"roto: sin tiempo, pomodoro queda huérfano — {errores_rotos[:2]}", [])
    if codigo != 0:
        print("ROJO: la maqueta buena no pasa.")
        return 1
    if not errores_rotos:
        print("ROJO: el caso huérfano no se detecta.")
        return 1
    print("DEMO: buena 0, huérfano detectado. El gate discrimina.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
