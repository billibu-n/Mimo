#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gate-bloques.py — contrato mínimo de bloques y independencia de Calificaciones.

Mide sobre app/index.html:
1. el registro existe, valida y mantiene la base fija;
2. Calificaciones se instala sola, sin Malla;
3. desde Calificaciones se puede crear un curso cuando Malla no está;
4. al instalar Malla, el curso creado aparece en el plan;
5. al quitar Malla, Calificaciones conserva el curso y sus datos;
6. no hay errores de consola.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gatelib import Navegador, exigir, salir  # noqa: E402

APP = Path(__file__).resolve().parent.parent / "app" / "index.html"


def abrir_catalogo(page) -> None:
    page.locator("#btn-add").click()
    page.wait_for_timeout(120)


def instalar(page, bloque: str) -> None:
    abrir_catalogo(page)
    page.locator(f'.bcard[data-bloque="{bloque}"] [data-instalar]').click()
    page.wait_for_timeout(180)
    page.locator("#modal-x").click()
    page.wait_for_timeout(100)


def main() -> int:
    fallas: list[str] = []
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            datos = page.evaluate(
                """() => {
                    const eventos = [];
                    ["cursos.creado", "cursos.actualizado", "cursos.borrado",
                     "sesiones.creada", "sesiones.actualizada", "sesiones.borrada"].forEach(n =>
                        MimoEventos.on(n, () => eventos.push(n)));
                    const c = MimoDominioCursos.crear({ codigo: "EV1001", nombre: "Evento" });
                    MimoDominioCursos.actualizar(c, { nombre: "Evento 2" });
                    MimoDominioCursos.borrar([c], "EV1001");
                    const s = MimoDominioSesiones.crear({ minutos: 5 });
                    MimoDominioSesiones.actualizar(s, { minutos: 6 });
                    MimoDominioSesiones.borrar([s], s.id);
                    MimoRegistro.registrar({ id: "prueba-padre", nombre: "Padre", tipo: "seccion", oculto: true });
                    MimoRegistro.registrar({ id: "prueba-hijo", nombre: "Hijo", tipo: "seccion",
                        oculto: true, requiere: ["prueba-padre"] });
                    const sin = MimoRegistro.puedeInstalar("prueba-hijo", []);
                    const con = MimoRegistro.puedeInstalar("prueba-hijo", ["prueba-padre"]);
                    const quitar = MimoRegistro.puedeQuitar("prueba-padre", ["prueba-padre", "prueba-hijo"]);
                    const notas = document.querySelector("#p-notas");
                    return {
                        fallas: MimoRegistro.validar(),
                        base: MimoRegistro.base().map(b => b.id),
                        secciones: MimoRegistro.secciones([]),
                        notas_dinamica: !!(notas && notas.getAttribute("data-dinamica")),
                        notas_montada: MimoRegistro.montado("notas"),
                        eventos,
                        dependencia_sin: sin.ok,
                        dependencia_con: con.ok,
                        dependientes: quitar.dependientes || [],
                        evaluaciones: !!MimoRegistro.obtener("evaluaciones")
                    };
                }"""
            )
            exigir(datos["fallas"] == [], f"registro: sin fallas — {datos['fallas']}", fallas)
            exigir(datos["base"] == ["calendario", "tareas", "notas", "ajustes"],
                   f"registro: base fija — {datos['base']}", fallas)
            exigir(datos["secciones"] == ["calendario", "tareas", "notas", "ajustes"],
                   f"registro: sin opcionales solo queda la base — {datos['secciones']}", fallas)
            exigir(datos["notas_dinamica"] and datos["notas_montada"],
                   "host: Notas se inyecta desde su bloque y queda montada", fallas)
            exigir(datos["eventos"] == ["cursos.creado", "cursos.actualizado", "cursos.borrado",
                                        "sesiones.creada", "sesiones.actualizada", "sesiones.borrada"],
                   f"dominio: emite los seis eventos — {datos['eventos']}", fallas)
            exigir(datos["dependencia_sin"] is False and datos["dependencia_con"] is True,
                   "registro: requiere se respeta al instalar", fallas)
            exigir(datos["dependientes"] == ["prueba-hijo"],
                   f"registro: quitar avisa dependientes — {datos['dependientes']}", fallas)
            exigir(datos["evaluaciones"] is False,
                   "catálogo: evaluaciones no existe ni está en el kit", fallas)

            abrir_catalogo(page)
            page.locator('.bcard[data-bloque="tiempo"] .bcard__desc').click()
            page.wait_for_timeout(120)
            exigir(page.locator("#modal-bloque").evaluate("e => e.classList.contains('on')") and
                   "Cronómetro" in page.locator("#modal-bloque-resumen").inner_text(),
                   "catálogo: la ficha abre el detalle del bloque", fallas)
            page.keyboard.press("Escape")
            page.wait_for_timeout(80)
            page.locator("#modal-x").click()
            page.wait_for_timeout(80)

            instalar(page, "calificaciones")
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator("#calif-vacio").is_visible(), "calif sola: muestra el vacío", fallas)
            exigir(page.locator("#calif-curso-form").is_visible(),
                   "calif sola: ofrece crear un curso sin Malla", fallas)
            exigir(not page.locator("#btn-calif-malla").is_visible(),
                   "calif sola: no ofrece un enlace a Malla inexistente", fallas)

            page.locator("#calif-curso-codigo").fill("MA1001")
            page.locator("#calif-curso-nombre").fill("Cálculo I")
            page.locator('#calif-curso-form button[type="submit"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator(".calif-item").count() == 1,
                   "calif sola: el curso creado aparece en la lista", fallas)
            exigir("MA1001" in page.locator("#calif-lista").inner_text(),
                   "calif sola: la lista muestra el código", fallas)

            instalar(page, "malla")
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(200)
            exigir("MA1001" in page.locator("#malla-cols").inner_text(),
                   "malla: ve el curso creado desde Calificaciones", fallas)

            abrir_catalogo(page)
            page.locator('.bcard[data-bloque="malla"] [data-quitar]').click()
            page.wait_for_timeout(180)
            page.locator("#modal-x").click()
            page.wait_for_timeout(100)
            exigir(page.locator("#p-malla").count() == 0 and
                   page.evaluate("MimoRegistro.montado('malla')") is False,
                   "quitar Malla: el host se desmonta y desaparece", fallas)
            page.locator('#tabs .tab[data-ir="calificaciones"]').click()
            page.wait_for_timeout(150)
            exigir(page.locator(".calif-item").count() == 1,
                   "quitar Malla: Calificaciones conserva el curso", fallas)
            exigir(not page.locator("#calif-curso-form").is_visible(),
                   "quitar Malla: con cursos no muestra el formulario vacío", fallas)
            instalar(page, "malla")
            page.locator('#tabs .tab[data-ir="malla"]').click()
            page.wait_for_timeout(180)
            exigir(page.locator("#p-malla").count() == 1 and
                   page.evaluate("MimoRegistro.montado('malla')") is True,
                   "reinstalar Malla: vuelve el host y el ciclo de vida", fallas)
            exigir("MA1001" in page.locator("#malla-cols").inner_text(),
                   "reinstalar Malla: el curso sigue ahí", fallas)

            # Tiempo solo: cronómetro y sesión sin Estudio.
            instalar(page, "tiempo")
            page.locator('#tabs .tab[data-ir="tiempo"]').click()
            page.wait_for_timeout(120)
            page.locator("#btn-empezar").click()
            page.wait_for_timeout(1200)
            page.locator("#btn-parar").click()
            page.wait_for_timeout(200)
            exigir(page.locator(".sesion-item").count() == 1,
                   "tiempo solo: registra una sesión sin Estudio", fallas)
            exigir(page.locator("#tiempo-sesiones").inner_text().strip() == "1",
                   "tiempo solo: el contador de sesiones sube", fallas)

            # Quitar Tiempo y usar Estudio solo: el formulario manual sigue.
            abrir_catalogo(page)
            page.locator('.bcard[data-bloque="tiempo"] [data-quitar]').click()
            page.wait_for_timeout(180)
            page.locator("#modal-x").click()
            page.wait_for_timeout(100)
            instalar(page, "estudio")
            page.locator('#tabs .tab[data-ir="estudio"]').click()
            page.wait_for_timeout(180)
            exigir(page.locator("#est-form").is_visible(),
                   "estudio solo: ofrece registrar una sesión manual", fallas)
            page.locator("#est-minutos").fill("0:30")
            page.locator('#est-form button[type="submit"]').click()
            page.wait_for_timeout(220)
            exigir(page.locator(".est-sesion").count() >= 1,
                   "estudio solo: la sesión manual entra", fallas)

            exigir(not errores, f"consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()

    # Malla sola: cerrar un curso no debe inventar calificaciones.
    with Navegador() as nav:
        ctx, page, errores = nav.abrir(APP, 1440, 950)
        page.on("dialog", lambda d: d.accept())
        try:
            instalar(page, "malla")
            page.locator("#btn-nuevo-ramo").click()
            page.locator("#ramo-codigo").fill("MA1001")
            page.locator("#ramo-nombre").fill("Cálculo I")
            page.locator('#ramo-form button[type="submit"]').click()
            page.wait_for_timeout(200)
            exigir(page.locator('[data-abrir-calif]').count() == 0,
                   "malla sola: no ofrece Calificaciones si no está", fallas)
            page.locator("[data-toggle-ramo]").click()
            page.wait_for_timeout(220)
            califs = page.evaluate("JSON.parse(localStorage.getItem('mimo.shell.v1')).califs || {}")
            exigir(len(califs) == 0,
                   f"malla sola: cerrar no crea calificaciones — {califs}", fallas)
            exigir("APROBADO" in page.locator('.ramo-card[data-ramo="MA1001"]').inner_text(),
                   "malla sola: el cierre manual deja el ramo aprobado", fallas)
            exigir(not errores, f"malla sola: consola limpia — {errores[:3]}", fallas)
        finally:
            ctx.close()
    return salir("gate-bloques", fallas)


if __name__ == "__main__":
    sys.exit(main())
