#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mide el bloque T004 (Malla) del armazon nuevo.

No supone nada: abre Chromium sin cabeza en un puerto libre, siembra un catalogo
conocido por la puerta del sustrato (`MimoComun`), y comprueba con el DOM y con el
motor las dieciseis medidas de este bloque. Una sola verdad: este script y la
evidencia que se entrega son el mismo.

Uso:
    python3 tablero/medir-malla.py
    python3 tablero/medir-malla.py --fichero tablero/armazon-paneles.html

Sale 0 solo si las dieciseis medidas dan [OK]. Si algo choca, imprime [CHOQUE] con
el numero medido y sale 1. No mata procesos por patron: guarda el pid del Chromium
que arranca y lo termina el mismo.
"""
import argparse
import asyncio
import hashlib
import os
import socket
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CHROMIUM = "/usr/bin/chromium-browser"

HERRAMIENTAS = "/home/billibu/workspace/herramientas"
if HERRAMIENTAS not in sys.path:
    sys.path.insert(0, HERRAMIENTAS)
import cdp  # noqa: E402

ESTADOS = ("normal", "plegado", "contexto", "gabinete", "ambos",
           "angosto", "vacia", "apariencia")
TEMAS = ("claro", "oscuro")
IDIOMAS = ("es", "en")

# El catalogo de la prueba. Seis ramos que cubren lo que hay que ver: cadena de
# requisitos de dos saltos, un anual, un electivo (99) y dos sueltos de nivel 1.
SEMILLA = """(() => {
  var M = window.MimoComun;
  function R(cod, nombre, creditos, nivel, req, anual) {
    M.ramoEnCatalogo(cod, {nombre: nombre, creditos: creditos, nivel: nivel,
      requisitos: req || [], anual: !!anual});
  }
  R('MA1001', 'Calculo I', 6, 1, []);
  R('FI1001', 'Fisica I', 6, 1, []);
  R('AN1001', 'Anual I', 9, 1, [], true);
  R('MA2001', 'Calculo II', 6, 2, ['MA1001']);
  R('MA3001', 'Analisis', 6, 3, ['MA1001', 'MA2001']);
  R('EL001', 'Electivo', 3, 99, []);
  M.guardar('');
  return Object.keys(M.CAT()).length; })()"""


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for trozo in iter(lambda: f.read(65536), b""):
            h.update(trozo)
    return h.hexdigest()


def limpia(p):
    p.eventos = []
    p.log = []


def malos(eventos):
    """Solo los tres eventos que el gate prohibe: consola, excepcion, red."""
    return [e for e in eventos
            if e.get("tipo") in ("consola", "excepcion", "red-fallo")]


async def nueva():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    puerto = s.getsockname()[1]
    s.close()
    perfil = "/tmp/cdp-t004-%d-%d" % (os.getpid(), int(time.time()))
    os.makedirs(perfil, exist_ok=True)
    log = open("/tmp/t004-medir-chromium.log", "wb")
    proc = subprocess.Popen(
        [CHROMIUM, "--headless=new", "--no-sandbox", "--disable-gpu",
         "--hide-scrollbars", "--mute-audio",
         "--remote-debugging-port=%d" % puerto,
         "--user-data-dir=%s" % perfil, "about:blank"],
        stdout=log, stderr=log)
    base = "http://127.0.0.1:%d" % puerto
    for _ in range(80):
        try:
            urllib.request.urlopen(base + "/json/version", timeout=1)
            break
        except Exception:
            time.sleep(0.25)
    else:
        proc.terminate()
        sys.exit("chromium no arranco")
    info = cdp.http_json(base + "/json/new?about:blank", method="PUT")
    p = cdp.Pagina(info["webSocketDebuggerUrl"])
    await p.abrir()
    await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                   deviceScaleFactor=1, mobile=False)
    return p, proc, puerto


async def abrir(p, url):
    """Abre la seccion Malla y su unica vista: sin eso la caja no existe."""
    await p.ir(url, espera=0.7)
    hay_riel = await p.js(
        "(() => { var s = document.querySelector('[data-seccion=\"malla\"]');"
        " if (s) { s.click(); } return !!s; })()")
    await asyncio.sleep(0.25)
    hay_vista = await p.js(
        "(() => { var v = document.querySelector('.est__v[data-bloque=\"malla\"]');"
        " if (v) { v.click(); } return !!v; })()")
    await asyncio.sleep(0.35)
    return bool(hay_riel and hay_vista)


async def sembrar(p, url):
    """Deja el banco limpio y sembrado, con la malla abierta."""
    await p.ir(url + "?reset=1", espera=0.7)
    n = await p.js(SEMILLA)
    await abrir(p, url)
    return n


async def geometria(p, url):
    await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                   deviceScaleFactor=1, mobile=False)
    await p.ir(url + "?reset=1&estado=ambos", espera=0.6)
    await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
    await asyncio.sleep(0.3)
    losa = await p.js(
        "(document.querySelector('.losa')||{getBoundingClientRect:function(){return {width:0}}}).getBoundingClientRect().width")
    await p.enviar("Emulation.setDeviceMetricsOverride", width=1100, height=900,
                   deviceScaleFactor=1, mobile=False)
    await p.ir(url + "?reset=1&estado=contexto", espera=0.6)
    await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
    await asyncio.sleep(0.3)
    der = await p.js(
        "(document.querySelector('.der')||{getBoundingClientRect:function(){return {right:0}}}).getBoundingClientRect().right")
    return {"losa": losa, "sangria": 1100.0 - der}


async def cargas(p, url):
    """32 cargas con la malla abierta: 8 estados x 2 temas x 2 idiomas."""
    eventos = []
    await p.ir(url, espera=0.5)
    for idioma in IDIOMAS:
        await p.js("localStorage.setItem('mimo.idioma', '%s')" % idioma)
        for estado in ESTADOS:
            for tema in TEMAS:
                limpia(p)
                await p.ir(url + "?reset=1&estado=" + estado, espera=0.3)
                await p.js(
                    "(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
                await asyncio.sleep(0.12)
                await p.js("document.body.setAttribute('data-tema', '%s')" % tema)
                await asyncio.sleep(0.1)
                eventos.extend(p.eventos)
    return eventos


# La foto del semestre que tiene que sobrevivir a la ida y vuelta. Se compara el
# CONTENIDO (codigo, columna, estado, aprobado, en curso, anual), no el orden de
# las filas del CSV: el CSV no guarda orden de columnas y eso es una diferencia
# declarada, no un fallo.
SNAPSHOT = """(() => {
  var M = window.MimoMallaMotor;
  var est = M.estados();
  var aprob = M.getAprobados();
  var activos = {};
  M.getRamosActivos().forEach(function (r) { activos[r.codigo] = true; });
  var filas = [];
  M.getSemestres().forEach(function (c) {
    c.cursos.forEach(function (cod) {
      filas.push([cod, c.n, est[cod] || '', aprob[cod] ? 1 : 0,
                  activos[cod] ? 1 : 0, M.esAnual(cod) ? 1 : 0].join(':'));
    });
  });
  filas.sort();
  return {filas: filas.join('|'),
          cols: M.getSemestres().map(function (c) { return c.n + ':' + c.titulo; }).join('|'),
          aprobados: Object.keys(aprob).sort().join(',')}; })()"""


async def main():
    ap = argparse.ArgumentParser(description="Mide el bloque Malla (T004).")
    ap.add_argument("--fichero", default=os.path.join(AQUI, "armazon-paneles.html"),
                    help="armazon a medir")
    args = ap.parse_args()
    fichero = os.path.abspath(args.fichero)
    if not os.path.isfile(fichero):
        sys.exit("no existe el fichero: %s" % fichero)
    url = "file://" + fichero
    print("TABLERO: %s" % fichero)

    p, proc, puerto = await nueva()
    print("PUERTO=%d pid=%d" % (puerto, proc.pid))
    checks = []

    def check(n, nombre, ok, detalle):
        checks.append(ok)
        print("[%s] %d. %s — %s" % ("OK" if ok else "CHOQUE", n, nombre, detalle))

    try:
        # -------------------------------------------------- 1..4 lo de siempre
        geo = await geometria(p, url)
        eventos = await cargas(p, url)
        n_eventos = len(malos(eventos))
        print("  losa 1280  : %.2f" % geo["losa"])
        print("  sangria 1100: %.2f" % geo["sangria"])
        print("  32 cargas   : %d prohibidos de %d" % (n_eventos, len(eventos)))
        check(1, "32 cargas con la malla abierta, sin un solo evento",
              n_eventos == 0, "%d prohibidos de %d" % (n_eventos, len(eventos)))
        check(2, "losa 544,00 a 1280 con la reticula dentro",
              abs(geo["losa"] - 544.0) < 0.01, "%.2f" % geo["losa"])
        check(3, "sangria 32,00 a 1100", abs(geo["sangria"] - 32.0) < 0.01,
              "%.2f" % geo["sangria"])

        # ------------------------------------------------- 4 ocho vistas a 411
        await p.enviar("Emulation.setDeviceMetricsOverride", width=411, height=900,
                       deviceScaleFactor=1, mobile=False)
        desbordes = []
        for estado in ESTADOS:
            limpia(p)
            await p.ir(url + "?reset=1&estado=" + estado, espera=0.35)
            await p.js(
                "(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
            await asyncio.sleep(0.2)
            d = await p.js(
                "document.documentElement.scrollWidth - document.documentElement.clientWidth")
            desbordes.append(d)
        check(4, "8 vistas a 411 sin desbordar (la reticula scrollea dentro)",
              all(d <= 0 for d in desbordes),
              "max=%s %s" % (max(desbordes), desbordes))
        await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                       deviceScaleFactor=1, mobile=False)

        # ----------------------------------------------------- 5 la reticula
        await sembrar(p, url)
        reticula = await p.js("""(() => {
          var cols = [...document.querySelectorAll('.malla__colcab')].map(function (c) {
            return c.getAttribute('data-columna'); });
          var ramos = [...document.querySelectorAll('[data-malla="ramo"]')].map(function (r) {
            return r.getAttribute('data-codigo') + '@' + r.getAttribute('data-nivel'); });
          return {cols: cols, ramos: ramos,
                  flechas: document.querySelectorAll('.malla__flecha').length,
                  mapa: !!document.querySelector('[data-malla="mapa"]'),
                  resumen: (document.querySelector('[data-malla="resumen"]')||{}).textContent}; })()""")
        ok_reticula = (reticula["mapa"]
                       and reticula["cols"] == ["1", "2", "3", "99"]
                       and len(reticula["ramos"]) == 6
                       and "MA1001@1" in reticula["ramos"]
                       and "EL001@99" in reticula["ramos"]
                       and reticula["flechas"] == 3)
        check(5, "una columna por nivel, electivos al final y una flecha por requisito",
              ok_reticula, "cols=%s ramos=%d flechas=%s resumen=%r" % (
                  reticula["cols"], len(reticula["ramos"]),
                  reticula["flechas"], reticula["resumen"]))

        # ------------------------------------------------------ 6 alta de ramo
        alta = await p.js("""(() => {
          document.querySelector('[data-malla-accion="nuevo"]').click();
          var forma = document.querySelector('[data-malla="editor"]');
          function set(k, v) { forma.querySelector('[data-malla-campo="' + k + '"]').value = v; }
          set('codigo', 'MA4001'); set('nombre', 'Optativo IV'); set('creditos', '4');
          set('nivel', '4'); set('requisitos', '');
          forma.querySelector('button[type="submit"]').click();
          var n = document.querySelector('[data-malla="ramo"][data-codigo="MA4001"]');
          return {existe: !!n, estado: n ? n.getAttribute('data-estado') : null,
                  nivel: n ? n.getAttribute('data-nivel') : null,
                  cols: [...document.querySelectorAll('.malla__colcab')].map(function (c) {
                    return c.getAttribute('data-columna'); })}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        tras_f5 = await p.js("""(() => {
          var n = document.querySelector('[data-malla="ramo"][data-codigo="MA4001"]');
          var c = window.MimoMallaMotor.getCurso('MA4001');
          return {existe: !!n, nombre: c ? c.nombre : null, creditos: c ? c.creditos : null}; })()""")
        ok_alta = (alta["existe"] and alta["estado"] == "disponible"
                   and alta["nivel"] == "4" and "4" in alta["cols"]
                   and tras_f5["existe"] and tras_f5["nombre"] == "Optativo IV"
                   and tras_f5["creditos"] == 4)
        check(6, "el editor da de alta un ramo (disponible, columna 4) y sobrevive al F5",
              ok_alta, "estado=%s nivel=%s cols=%s tras F5=%s/%r/%s" % (
                  alta["estado"], alta["nivel"], alta["cols"], tras_f5["existe"],
                  tras_f5["nombre"], tras_f5["creditos"]))

        # --------------------------------------------------- 7 edicion de ramo
        await p.js("(document.querySelector('[data-malla-accion=\"editar\"][data-codigo=\"MA2001\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.2)
        edicion = await p.js("""(() => {
          var forma = document.querySelector('[data-malla="editor"]');
          function set(k, v) { forma.querySelector('[data-malla-campo="' + k + '"]').value = v; }
          set('nombre', 'Calculo II bis'); set('creditos', '7');
          set('requisitos', 'MA1001;FI1001');
          forma.querySelector('button[type="submit"]').click();
          var c = window.MimoMallaMotor.getCurso('MA2001');
          var n = document.querySelector('[data-malla="ramo"][data-codigo="MA2001"]');
          return {nombre: c.nombre, creditos: c.creditos,
                  req: (c.requisitos || []).join(','),
                  texto: n ? n.textContent : ''}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        editado_f5 = await p.js(
            "(window.MimoMallaMotor.getCurso('MA2001')||{}).nombre")
        ok_edicion = (edicion["nombre"] == "Calculo II bis" and edicion["creditos"] == 7
                      and edicion["req"] == "MA1001,FI1001"
                      and "Calculo II bis" in edicion["texto"]
                      and editado_f5 == "Calculo II bis")
        check(7, "editar nombre, creditos y requisitos, y sobrevive al F5", ok_edicion,
              "%r %s cr req=%s tras F5=%r" % (edicion["nombre"], edicion["creditos"],
                                             edicion["req"], editado_f5))

        # ---------------------------------------------- 8 estados encadenados
        await sembrar(p, url)
        uno = await p.js("""(() => {
          document.querySelector('[data-malla-accion="aprobar"][data-codigo="MA1001"]').click();
          var M = window.MimoMallaMotor;
          return {ma2001: M.getEstadoCurso('MA2001'), ma3001: M.getEstadoCurso('MA3001')}; })()""")
        dos = await p.js("""(() => {
          document.querySelector('[data-malla-accion="aprobar"][data-codigo="MA2001"]').click();
          var M = window.MimoMallaMotor;
          return {ma3001: M.getEstadoCurso('MA3001')}; })()""")
        pintado = await p.js("""(() => {
          var a = document.querySelector('[data-malla="ramo"][data-codigo="MA1001"]');
          var b = document.querySelector('[data-malla="ramo"][data-codigo="MA3001"]');
          return {a: a ? a.getAttribute('data-estado') : null,
                  b: b ? b.getAttribute('data-estado') : null}; })()""")
        ok_estados = (uno["ma2001"] == "disponible" and uno["ma3001"] == "bloqueado"
                      and dos["ma3001"] == "disponible"
                      and pintado["a"] == "aprobado"
                      and pintado["b"] == "disponible")
        check(8, "aprobar abre la cadena: MA2001 y luego MA3001 (dos requisitos)",
              ok_estados, "con MA1001: %s/%s; con las dos: %s; pintado %s/%s" % (
                  uno["ma2001"], uno["ma3001"], dos["ma3001"],
                  pintado["a"], pintado["b"]))

        # ------------------------------------------------------ 9 ramo anual
        await sembrar(p, url)
        anual = await p.js("""(() => {
          var a = document.querySelector('[data-malla="ramo"][data-anual="1"]');
          var b = document.querySelector('[data-malla="ramo"][data-anual="0"]');
          var M = window.MimoMallaMotor;
          return {ancho: a ? a.getBoundingClientRect().width : 0,
                  normal: b ? b.getBoundingClientRect().width : 0,
                  cod: a ? a.getAttribute('data-codigo') : null,
                  esAnual: M.esAnual('AN1001'), ocupa: M.semestresQueOcupa('AN1001')}; })()""")
        ok_anual = (anual["cod"] == "AN1001" and anual["esAnual"] is True
                    and anual["ocupa"] == 2 and anual["normal"] > 0
                    and anual["ancho"] >= 1.8 * anual["normal"])
        check(9, "el anual ocupa dos columnas (ancho doble) y lo dice el motor",
              ok_anual, "AN1001 %.1f px contra %.1f px de un ramo normal (x%.2f)" % (
                  anual["ancho"], anual["normal"],
                  (anual["ancho"] / anual["normal"]) if anual["normal"] else 0))

        # ------------------------------------------------ 10 mover de columna
        await p.js("(document.querySelector('[data-malla-accion=\"editar\"][data-codigo=\"FI1001\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.2)
        movido = await p.js("""(() => {
          var forma = document.querySelector('[data-malla="editor"]');
          forma.querySelector('[data-malla-campo="nivel"]').value = '3';
          forma.querySelector('button[type="submit"]').click();
          var M = window.MimoMallaMotor;
          return {nivel: M.getCurso('FI1001').nivel,
                  en3: M.getCursosDeSemestre(3).indexOf('FI1001') >= 0,
                  en1: M.getCursosDeSemestre(1).indexOf('FI1001') >= 0}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        movido_f5 = await p.js(
            "window.MimoMallaMotor.getCurso('FI1001').nivel")
        ok_mover = (movido["nivel"] == 3 and movido["en3"] and not movido["en1"]
                    and movido_f5 == 3)
        check(10, "mover un ramo de nivel desde el editor y sobrevive al F5",
              ok_mover, "nivel=%s en3=%s en1=%s tras F5=%s" % (
                  movido["nivel"], movido["en3"], movido["en1"], movido_f5))

        # -------------------------------------------- 11 reordenar columnas
        await sembrar(p, url)
        orden = await p.js("""(() => {
          var M = window.MimoMallaMotor;
          var antes = M.getSemestres().map(function (c) { return c.n; });
          document.querySelector('[data-malla-accion="col-der"][data-nivel="1"]').click();
          var despues = M.getSemestres().map(function (c) { return c.n; });
          return {antes: antes, despues: despues}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        orden_f5 = await p.js(
            "window.MimoMallaMotor.getSemestres().map(function (c) { return c.n; })")
        ok_orden = (orden["antes"] == [1, 2, 3, 99]
                    and orden["despues"] == [2, 1, 3, 99]
                    and orden_f5 == [2, 1, 3, 99])
        check(11, "reordenar columnas y que 99 siga el ultimo, tambien tras F5",
              ok_orden, "%s -> %s; tras F5 %s" % (
                  orden["antes"], orden["despues"], orden_f5))

        # -------------------------------------- 12 ida y vuelta JSON y 13 CSV
        await sembrar(p, url)
        json_rt = await p.js("""(() => {
          var M = window.MimoMallaMotor;
          var foto = """ + SNAPSHOT + """;
          var txt = M.exportarMalla('json');
          var r = M.importarMalla(txt, 'json');
          var foto2 = """ + SNAPSHOT + """;
          return {ok: r.ok, antes: foto, despues: foto2,
                  bytes: txt.length, esJson: txt.indexOf('"estado"') > 0}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        json_pintado = await p.js(
            "document.querySelectorAll('[data-malla=\"ramo\"]').length")
        ok_json = (json_rt["ok"] and json_rt["esJson"]
                   and json_rt["antes"]["filas"] == json_rt["despues"]["filas"]
                   and json_rt["antes"]["cols"] == json_rt["despues"]["cols"]
                   and json_rt["antes"]["aprobados"] == json_rt["despues"]["aprobados"]
                   and json_pintado == 6)
        check(12, "exportar malla.json e importarlo devuelve el mismo semestre",
              ok_json, "%d bytes, %d ramos pintados, mismo contenido=%s" % (
                  json_rt["bytes"], json_pintado,
                  json_rt["antes"]["filas"] == json_rt["despues"]["filas"]))

        await sembrar(p, url)
        csv_rt = await p.js("""(() => {
          var M = window.MimoMallaMotor;
          var foto = """ + SNAPSHOT + """;
          var txt = M.exportarMalla('csv');
          var r = M.importarMalla(txt, 'csv');
          var foto2 = """ + SNAPSHOT + """;
          var lineas = txt.split('\\n').filter(function (l) { return l; });
          return {ok: r.ok, antes: foto, despues: foto2, lineas: lineas.length,
                  cab: lineas[0]}; })()""")
        await p.ir(url, espera=0.6)
        await p.js("(document.querySelector('[data-seccion=\"malla\"]')||{click:function(){}}).click()")
        await asyncio.sleep(0.3)
        csv_pintado = await p.js(
            "document.querySelectorAll('[data-malla=\"ramo\"]').length")
        ok_csv = (csv_rt["ok"] and csv_rt["lineas"] == 7
                  and csv_rt["cab"].startswith("codigo,nombre,creditos,nivel")
                  and csv_rt["antes"]["filas"] == csv_rt["despues"]["filas"]
                  and csv_rt["antes"]["aprobados"] == csv_rt["despues"]["aprobados"]
                  and csv_pintado == 6)
        check(13, "exportar CSV e importarlo devuelve el mismo semestre", ok_csv,
              "%d lineas, cabecera %r, %d ramos pintados" % (
                  csv_rt["lineas"], csv_rt["cab"], csv_pintado))

        # ------------------------------------------- 14 pegado desde una foto
        await sembrar(p, url)
        pegado = await p.js(r"""(() => {
          var M = window.MimoMallaMotor;
          var txt = 'Semestre 1\nMA1001 Calculo I\nFI1001 Fisica I\n'
                  + 'Semestre 2\nMA2001 Calculo II\n';
          var r = M.importarMalla(txt, 'auto');
          var cols = M.getSemestres().map(function (c) { return c.n; });
          var c1 = M.getCursosDeSemestre(1);
          return {ok: r.ok, cols: cols, c1: c1,
                  nombre: (M.getCurso('MA2001') || {}).nombre}; })()""")
        ok_pegado = (pegado["ok"] and pegado["cols"] == [1, 2]
                     and sorted(pegado["c1"]) == ["FI1001", "MA1001"]
                     and pegado["nombre"] == "Calculo II")
        check(14, "pegar lineas de una foto arma las columnas de su semestre",
              ok_pegado, "cols=%s nivel1=%s MA2001=%r" % (
                  pegado["cols"], pegado["c1"], pegado["nombre"]))

        # ----------------------------------------------- 15 el motor sin DOM
        motor = os.path.join(AQUI, "js", "malla.js")
        doc = open(motor, encoding="utf-8").read() if os.path.isfile(motor) else ""
        ok_motor = ("document." not in doc
                    and "window.MimoMallaMotor" in doc
                    and "window.MimoMallaUI" in doc)
        check(15, "el motor no nombra el DOM y el fichero expone motor y vista",
              ok_motor, "%d apariciones de document. en %s" % (
                  doc.count("document."), os.path.basename(motor)))

        # --------------------------------------------- 16 i18n sin basura
        await sembrar(p, url)
        diag = await p.js("window.MimoI18n.diagnostico()")
        nombre_bloque = await p.js(
            "(document.querySelector('[data-bloque=\"malla\"]')||{}).textContent")
        c_es = diag["totalClaves"]["es"]
        c_en = diag["totalClaves"]["en"]
        ok_i18n = (c_es == c_en and c_es > 0
                   and not diag["ausentes"] and not diag["desajustes"]
                   and "Malla" in (nombre_bloque or ""))
        check(16, "el bloque no ensucia el diccionario (claves iguales, 0 ausentes)",
              ok_i18n, "%s/%s claves, ausentes=%d desajustes=%d" % (
                  c_es, c_en, len(diag["ausentes"]), len(diag["desajustes"])))

        # ------------------------------------------------------------ resumen
        fallos = len([c for c in checks if not c])
        print("RESUMEN: %d choque(s) de %d medidas." % (fallos, len(checks)))
        return 0 if fallos == 0 else 1
    finally:
        try:
            await p.cerrar()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
