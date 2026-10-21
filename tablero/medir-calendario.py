#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""medir-calendario.py — instrumento del bloque Calendario (T008) de Mimo Nuevo.

Mide el calendario contra la copia CONGELADA del armazon anterior
(`/tmp/mimo-nuevo-t008-antes/armazon-paneles.html`, sha256 en la evidencia) y
contra el armazon de ahora, con el MISMO instrumento. No mide "que se ve": mide
lo que el encargo reclama.

   1. la copia de antes no tenia motor, ni caja, ni script de Calendario
   2. el armazon de ahora registra motor, vista, caja y script
   3. el motor expone la API del contrato (semestre, calendario, iCal)
   4. crearSemestre genera las semanas: clases, receso tras la que toca y examenes
   5. la tabla semanal: una fila por semana, siete dias, la fila de la semana
      actual marcada y su columna de estudio
   6. el editor: fecha, hora y tipo pintan el evento en su dia
   7. el ramo opcional enlaza el evento con su nota y la nota se ve en el chip
   8. marcaSemestreDe marca clases, receso y examen; la rejilla del mes lo pinta
   9. navegar mes/ano/semestre cambia el periodo visible
  10. los semestres extra: crear genera semanas, borrar quita y re-activa otro
  11. editar un semestre regenera sus semanas y conserva eventos y ramos
  12. los filtros: apagar un ramo esconde sus eventos y resetFiltros los devuelve
  13. exportar produce VEVENT con DTSTART y SUMMARY
  14. importar un .ics devuelve sus eventos y los deja en el calendario
  15. cuadre con la malla: los ramos del semestre salen del catalogo T004
  16. la columna de estudio suma lo registrado y la mini-barra lo reparte
  17. una recarga no pierde eventos ni el semestre activo
  18. el idioma: claves >= 153 y diagnostico 0 ausentes / 0 desajustes
  19. el motor no nombra el objeto global del navegador (grep = 0)
  20. 32 aperturas con la seccion abierta no dejan un solo evento de consola
  21. a 1100 px la losa no desborda

Uso:
  python3 medir-calendario.py --fichero armazon-paneles.html
  python3 medir-calendario.py --sin-antes          # solo DESPUES

Sale 0 solo si no hay ningun choque. Arranca su Chromium en un puerto libre y
CIERRA el pid que guardo, tambien si una medida revienta.
"""

import argparse
import asyncio
import hashlib
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CHROMIUM = "/usr/bin/chromium-browser"
ANTES = "/tmp/mimo-nuevo-t008-antes/armazon-paneles.html"
HERRAMIENTAS = "/home/billibu/workspace/herramientas"
IDIOMAS = ("es", "en")
ESTADOS = ("normal", "plegado", "contexto", "gabinete", "ambos", "angosto", "vacia", "apariencia")
TEMAS = ("claro", "oscuro")

if HERRAMIENTAS not in sys.path:
    sys.path.insert(0, HERRAMIENTAS)
import cdp  # noqa: E402


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
    return [e for e in eventos
            if e.get("tipo") in ("consola", "excepcion", "red-fallo")]


async def nueva():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    puerto = s.getsockname()[1]
    s.close()
    perfil = "/tmp/cdp-t008-%d-%d" % (os.getpid(), int(time.time()))
    os.makedirs(perfil, exist_ok=True)
    log = open("/tmp/t008-medir-chromium.log", "wb")
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


async def abrir(p, seccion="calendario"):
    await p.js("""(() => { var b = document.querySelector('[data-seccion="%s"]');
      if (b) { b.click(); } return !!b; })()""" % seccion)
    await asyncio.sleep(0.3)


async def basicas(p, url):
    """Lo que se puede decir de un armazon sin sembrar nada: tiene o no tiene."""
    await p.ir(url + "?reset=1", espera=0.7)
    motor = await p.js("typeof window.MimoCalendarioMotor")
    ui = await p.js("typeof window.MimoCalendarioUI")
    seccion = await p.js("!!document.querySelector('[data-seccion=\"calendario\"]')")
    if seccion:
        await abrir(p)
    caja = await p.js("!!document.querySelector('[data-calendario=\"bloque\"]')")
    script = await p.js("!!document.querySelector('script[src=\"js/calendario.js\"]')")
    kpis = await p.js("document.querySelectorAll('.cal__kpis .kpi').length")
    return {"motor": motor, "ui": ui, "seccion": seccion, "caja": caja,
            "script": script, "kpis": kpis, "eventos": len(malos(p.eventos))}


def imprime_basicas(nombre, b, sha):
    print("%s (sha256 %s):" % (nombre, sha))
    print("  motor Calendario : %s" % b["motor"])
    print("  vista Calendario : %s" % b["ui"])
    print("  seccion          : %s" % b["seccion"])
    print("  caja             : %s" % b["caja"])
    print("  script           : %s" % b["script"])
    print("  kpis pintados    : %s" % b["kpis"])
    print("  eventos          : %d prohibidos" % b["eventos"])


# --------------------------------------------------------------------- banco

SEMILLA = """(() => {
  var M = window.MimoComun, C = window.MimoCalendarioMotor;
  function R(cod, nombre, creditos, nivel) {
    M.ramoEnCatalogo(cod, {nombre: nombre, creditos: creditos, nivel: nivel, requisitos: []});
  }
  R('MA1001', 'Calculo I', 6, 1);
  R('FI1001', 'Fisica I', 6, 1);
  R('MA2001', 'Calculo II', 6, 2);
  var inicio = M.sumaDias(C.lunesDe(C.hoy()), -49);
  var a = C.crearSemestre({nombre: '2026-2', inicio: inicio, clases: 15, recesos: '8', examen: 2});
  var b = C.crearSemestre({nombre: '2027-1', inicio: M.sumaDias(inicio, 140),
                           clases: 16, recesos: '', examen: 0});
  C.datosDeSemestre(a.id).ramos = ['MA1001', 'FI1001'];
  C.cambiarSemestre(a.id);
  var receso = null, examen = null;
  for (var i = 0; i < a.semanas.length; i++) {
    if (!receso && a.semanas[i].tipo === 'receso') { receso = a.semanas[i].lunes; }
    if (!examen && a.semanas[i].tipo === 'examen') { examen = a.semanas[i].lunes; }
  }
  var ev = M.sumaDias(C.hoy(), 10);
  M.guardar('');
  return {a: a.id, b: b.id, inicio: inicio, semanas: a.semanas.length, ev: ev,
          anio: Number(ev.slice(0, 4)), mes: Number(ev.slice(5, 7)) - 1,
          receso: receso, examen: examen};
})()"""

FOTO_TABLA = """(() => {
  function textos(sel) {
    return [].map.call(document.querySelectorAll(sel), function (x) { return x.textContent; });
  }
  return {
    tablas: document.querySelectorAll('.cal__tabla').length,
    filas: document.querySelectorAll('.cal__fila').length,
    semanas: [].map.call(document.querySelectorAll('.cal__fila'), function (f) {
      return f.getAttribute('data-semana') + ':' + f.getAttribute('data-tipo');
    }),
    diasPrimera: document.querySelectorAll('.cal__fila:first-child .cal__dia').length,
    actual: [].map.call(document.querySelectorAll('.cal__fila--actual'), function (f) {
      return f.getAttribute('data-semana');
    }),
    estudio: textos('.cal__est-cifra'),
    kpis: textos('.cal__kpis .kpi__cifra'),
    kpisRot: textos('.cal__kpis .kpi__rot')
  };
})()"""

FOTO_MES = """(() => {
  var c = document.querySelector('[data-calendario="mes"]');
  return {
    celdas: c ? c.querySelectorAll('.cal__celda[data-fecha]').length : 0,
    hoy: !!document.querySelector('.cal__celda--hoy'),
    marcas: [].map.call(document.querySelectorAll('[data-marca]'), function (x) {
      return x.getAttribute('data-fecha') + ':' + x.getAttribute('data-marca');
    }),
    chips: [].map.call(document.querySelectorAll('.cal__celda .cal__chip'), function (x) {
      return x.getAttribute('data-id') + '|' + x.getAttribute('data-tipo') + '|' +
        x.getAttribute('data-ramo') + '|' +
        (x.querySelector('.cal__chip-hora') || {textContent: ''}).textContent + '|' +
        (x.querySelector('.cal__chip-nota') || {textContent: ''}).textContent;
    })
  };
})()"""


async def main():
    ap = argparse.ArgumentParser(description="Mide el bloque Calendario (T008).")
    ap.add_argument("--fichero", default=os.path.join(AQUI, "armazon-paneles.html"),
                    help="armazon a medir como DESPUES")
    ap.add_argument("--sin-antes", action="store_true",
                    help="no medir la copia congelada")
    ap.add_argument("--solo-basicas", action="store_true",
                    help="mide solo lo basico del fichero dado (sirve para el ANTES)")
    args = ap.parse_args()
    fichero = os.path.abspath(args.fichero)
    if not os.path.isfile(fichero):
        sys.exit("no existe el fichero: %s" % fichero)
    url = "file://" + fichero
    print("TABLERO: %s" % fichero)
    print("MOTOR  : %s" % os.path.join(os.path.dirname(fichero), "js/calendario.js"))

    p, proc, puerto = await nueva()
    print("PUERTO=%d pid=%d" % (puerto, proc.pid))
    checks = []

    if args.solo_basicas:
        try:
            b = await basicas(p, url)
            imprime_basicas("MEDIDO", b, sha256(fichero)[:16])
            ok = (b["motor"] == "undefined" and not b["caja"]
                  and not b["script"] and b["eventos"] == 0)
            print("[%s] 1. el fichero no tiene bloque Calendario — "
                  "motor=%s caja=%s script=%s" % (
                      "OK" if ok else "CHOQUE", b["motor"], b["caja"], b["script"]))
            print("")
            print("RESUMEN: %d choque(s) de 1 medidas." % (0 if ok else 1))
            print("MEDIDAS DEL BLOQUE: 0 disponibles (no hay bloque que medir)")
            print("EXIT=%d" % (0 if ok else 1))
            sys.exit(0 if ok else 1)
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

    def check(n, nombre, ok, detalle):
        checks.append(ok)
        print("[%s] %d. %s — %s" % ("OK" if ok else "CHOQUE", n, nombre, detalle))

    try:
        antes = None
        if not args.sin_antes and os.path.isfile(ANTES):
            antes = await basicas(p, "file://" + ANTES)
            imprime_basicas("ANTES (copia congelada)", antes, sha256(ANTES)[:16])
        else:
            print("ANTES: no disponible, se mide solo DESPUES")

        despues = await basicas(p, url)
        imprime_basicas("DESPUES", despues, sha256(fichero)[:16])
        check(1, "la copia de antes no tenia Calendario",
              antes is None or (antes["motor"] == "undefined"
              and not antes["caja"] and not antes["script"]),
              "sin copia de antes" if antes is None else
              "motor=%s caja=%s script=%s" % (
                  antes["motor"], antes["caja"], antes["script"]))
        check(2, "el armazon de ahora registra motor, vista, caja y script",
              despues["motor"] == "object" and despues["ui"] == "object"
              and despues["caja"] and despues["script"],
              "motor=%s vista=%s caja=%s script=%s" % (
                  despues["motor"], despues["ui"], despues["caja"], despues["script"]))

        # ------------------------------------------------------------ sembrar
        await p.ir(url + "?reset=1", espera=0.7)
        await p.js("localStorage.setItem('mimo.idioma', 'es')")
        base = await p.js(SEMILLA)
        await p.ir(url, espera=0.7)
        await abrir(p)
        print("BANCO: semestre=%s semanas=%d inicio=%s receso=%s examen=%s ev=%s" % (
            base["a"][:10], base["semanas"], base["inicio"], base["receso"],
            base["examen"], base["ev"]))

        # -------------------------------------------------------------- API
        api = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var nombres = ['semestres', 'semActivo', 'semEsEditable', 'crearSemestre',
            'editarSemestre', 'borrarSemestre', 'cambiarSemestre', 'semanasDe',
            'todosEventos', 'eventosDelDia', 'eventoPorId', 'nuevaEvento',
            'guardarEvento', 'borrarEvento', 'marcar', 'resetFiltros', 'chipsDe',
            'kpis', 'marcaSemestreDe', 'exportarIcal', 'importarIcal', 'vista',
            'periodo', 'periodoTexto', 'fijarVista', 'navPeriodo', 'irHoy'];
          var out = {};
          nombres.forEach(function (k) { out[k] = typeof C[k]; });
          return out;
        })()""")
        faltan = [k for k, v in api.items() if v != "function"]
        check(3, "el motor expone la API del contrato",
              not faltan,
              "%d/%d funciones%s" % (len(api) - len(faltan), len(api),
                                     "" if not faltan else " · faltan " + ", ".join(faltan)))

        # ----------------------------------------------------------- semanas
        sem = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, s = C.semActivo();
          var tipos = {}, receso = -1, examenes = 0;
          s.semanas.forEach(function (w, i) {
            tipos[w.tipo] = (tipos[w.tipo] || 0) + 1;
            if (w.tipo === 'receso') { receso = i; }
            if (w.tipo === 'examen') { examenes++; }
          });
          return {n: s.semanas.length, tipos: tipos, receso: receso,
                  examenes: examenes,
                  etiquetas: s.semanas.map(function (w) { return w.etiqueta; }),
                  editable: C.semEsEditable(s.id),
                  cabecera: s.nombre};
        })()""")
        check(4, "crearSemestre genera las semanas (15 clases, receso tras S8, 2 examenes)",
              sem["n"] == 18 and sem["tipos"].get("clases") == 15
              and sem["tipos"].get("receso") == 1 and sem["examenes"] == 2
              and sem["receso"] == 8 and sem["editable"],
              "%d semanas %s receso_en=%d editable=%s" % (
                  sem["n"], sem["tipos"], sem["receso"], sem["editable"]))

        # ---------------------------------------------------- tabla semanal
        foto = await p.js(FOTO_TABLA)
        check(5, "la tabla semanal: 18 filas, 7 dias, fila actual y columna de estudio",
              foto["tablas"] == 1 and foto["filas"] == 18
              and foto["diasPrimera"] == 7 and len(foto["estudio"]) == 18
              and len(foto["actual"]) == 1 and foto["actual"][0] == "S8"
              and len(foto["kpis"]) == 4,
              "filas=%d dias=%d estudio=%d actual=%s kpis=%d" % (
                  foto["filas"], foto["diasPrimera"], len(foto["estudio"]),
                  foto["actual"], len(foto["kpis"])))

        # ----------------------------------------------------------- editor
        await p.js("(document.querySelector('[data-accion=\"nuevo\"]')||{}).click()")
        lleno = await p.js("""(() => {
          function set(campo, v) {
            var n = document.querySelector('[data-evento="' + campo + '"]');
            if (n) { n.value = v; }
            return !!n;
          }
          return {editor: !!document.querySelector('[data-calendario="editor"]'),
                  campos: set('texto', 'Control 1 de Algebra') && set('fecha', '%s') &&
                          set('hora', '09:30') && set('tipo', 'control') &&
                          set('duracion', '1.5')};
        })()""" % base["ev"])
        await p.js("(document.querySelector('[data-accion=\"guardar-evento\"]')||{}).click()")
        await asyncio.sleep(0.25)
        guardado = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var e = C.todosEventos()[0] || {};
          return {n: C.todosEventos().length, fecha: e.fecha, hora: e.hora,
                  tipo: e.tipo, texto: e.texto, duracion: e.duracion,
                  editor: !!document.querySelector('[data-calendario="editor"]')};
        })()""")
        check(6, "el editor crea el evento con su fecha, hora y tipo",
              lleno["editor"] and lleno["campos"] and guardado["n"] == 1
              and guardado["fecha"] == base["ev"] and guardado["hora"] == "09:30"
              and guardado["tipo"] == "control" and not guardado["editor"],
              "editor=%s n=%d %s %s %s" % (lleno["editor"], guardado["n"],
              guardado["fecha"], guardado["hora"], guardado["tipo"]))

        # ponemos el periodo en el mes del evento y miramos la rejilla
        await p.js("""(() => { var e = window.MimoComun.leer();
          e.calendario.anio = %d; e.calendario.mes = %d;
          window.MimoComun.guardar(); })()""" % (base["anio"], base["mes"]))
        await p.js("(document.querySelector('.cal__vista[data-vista=\"mes\"]')||{}).click()")
        await asyncio.sleep(0.25)
        mes = await p.js(FOTO_MES)
        chip = await p.js("""(() => {
          var c = document.querySelector('.cal__celda[data-fecha="%s"]');
          var x = c ? c.querySelector('.cal__chip') : null;
          return x ? {id: x.getAttribute('data-id'), tipo: x.getAttribute('data-tipo'),
                      hora: (x.querySelector('.cal__chip-hora') || {textContent: ''}).textContent,
                      txt: x.textContent} : null;
        })()""" % base["ev"])
        check(7, "el evento se pinta en su dia con su hora y su tipo",
              mes["celdas"] >= 28 and chip is not None
              and chip["hora"] == "09:30" and chip["tipo"] == "control"
              and "Control 1 de Algebra" in chip["txt"],
              "celdas=%d chip=%s" % (mes["celdas"], chip))

        # ------------------------------------------- ramo opcional + nota
        ramo = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun;
          var fecha = M.sumaDias('%s', 1);
          var ev = C.guardarEvento({id: 'ev-ramo', fecha: fecha, hora: '15:00',
            texto: 'Entrega de laboratorio', tipo: 'entrega', ramo: 'FI1001',
            duracion: 2, nota: 6.5});
          var c2 = M.leer();
          c2.calendario.anio = Number(fecha.slice(0, 4));
          c2.calendario.mes = Number(fecha.slice(5, 7)) - 1;
          M.guardar();
          C.fijarVista('mes');
          window.MimoCalendarioUI.pintar();
          var c = document.querySelector('.cal__celda[data-fecha="' + fecha + '"]');
          var x = c ? c.querySelector('.cal__chip') : null;
          return {fecha: fecha, nota: C.notaDe('ev-ramo'), ramo: ev.ramo,
                  chip: x ? {ramo: x.getAttribute('data-ramo'),
                             nota: (x.querySelector('.cal__chip-nota') || {textContent: ''}).textContent,
                             tipo: x.getAttribute('data-tipo')} : null};
        })()""" % base["ev"])
        nota_chip = (ramo["chip"] or {}).get("nota", "").replace(",", ".")
        check(8, "el ramo opcional enlaza el evento con su nota (6.5)",
              ramo["ramo"] == "FI1001" and ramo["nota"] == 6.5
              and ramo["chip"] is not None and ramo["chip"]["ramo"] == "FI1001"
              and nota_chip == "6.5",
              "ramo=%s nota=%s chip=%s" % (ramo["ramo"], ramo["nota"], ramo["chip"]))

        # ---------------------------------------------------- marcas del semestre
        marcas = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var m1 = C.marcaSemestreDe('%s'), m2 = C.marcaSemestreDe('%s'),
              m3 = C.marcaSemestreDe('%s');
          var e = window.MimoComun.leer();
          e.calendario.anio = Number('%s'.slice(0, 4));
          e.calendario.mes = Number('%s'.slice(5, 7)) - 1;
          window.MimoComun.guardar();
          window.MimoCalendarioUI.pintar();
          var c = document.querySelector('.cal__celda[data-fecha="%s"]');
          return {clases: m1 && m1.tipo, receso: m2 && m2.tipo, examen: m3 && m3.tipo,
                  dom: c ? c.getAttribute('data-marca') : null};
        })()""" % (base["inicio"], base["receso"], base["examen"],
                   base["receso"], base["receso"], base["receso"]))
        check(9, "marcaSemestreDe marca clases, receso y examen; la rejilla lo pinta",
              marcas["clases"] == "clases" and marcas["receso"] == "receso"
              and marcas["examen"] == "examen" and marcas["dom"] == "receso",
              "clases=%s receso=%s examen=%s dom=%s" % (
                  marcas["clases"], marcas["receso"], marcas["examen"], marcas["dom"]))

        # ---------------------------------------------------------- periodo
        etiquetas = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, out = {};
          C.fijarVista('mes'); window.MimoCalendarioUI.pintar();
          out.mes1 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.navPeriodo(1); window.MimoCalendarioUI.pintar();
          out.mes2 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.fijarVista('anio'); window.MimoCalendarioUI.pintar();
          out.anio1 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.navPeriodo(1); window.MimoCalendarioUI.pintar();
          out.anio2 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.fijarVista('sem'); window.MimoCalendarioUI.pintar();
          out.sem1 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.navPeriodo(1); window.MimoCalendarioUI.pintar();
          out.sem2 = document.querySelector('[data-calendario="periodo"]').textContent;
          C.navPeriodo(-1); window.MimoCalendarioUI.pintar();
          out.sem3 = document.querySelector('[data-calendario="periodo"]').textContent;
          out.vista = C.vista();
          return out;
        })()""")
        check(10, "navegar mes/ano/semestre cambia el periodo visible",
              etiquetas["mes1"] != etiquetas["mes2"]
              and etiquetas["anio1"] != etiquetas["anio2"]
              and etiquetas["sem1"] == "2026-2" and etiquetas["sem2"] == "2027-1"
              and etiquetas["sem3"] == "2026-2",
              "mes %s>%s · ano %s>%s · sem %s>%s>%s" % (
                  etiquetas["mes1"], etiquetas["mes2"], etiquetas["anio1"],
                  etiquetas["anio2"], etiquetas["sem1"], etiquetas["sem2"],
                  etiquetas["sem3"]))

        # -------------------------------------------------------- semestres
        sueltos = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun;
          var dos = C.semestres().length;
          var borrado = C.borrarSemestre('%s');
          var uno = C.semestres();
          var act = C.semActivo();
          return {dos: dos, borrado: borrado, uno: uno.length,
                  activo: act ? act.nombre : null,
                  semanas: act ? act.semanas.length : 0,
                  ids: uno.map(function (x) { return x.id; })};
        })()""" % base["b"])
        check(11, "los semestres extra: crear genera semanas, borrar quita y re-activa otro",
              sueltos["dos"] == 2 and sueltos["borrado"] and sueltos["uno"] == 1
              and sueltos["activo"] == "2026-2" and sueltos["semanas"] == 18,
              "antes=%d borrado=%s quedan=%d activo=%s semanas=%d" % (
                  sueltos["dos"], sueltos["borrado"], sueltos["uno"],
                  sueltos["activo"], sueltos["semanas"]))

        # --------------------------------------------------------- editar
        editar = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var antesEv = C.todosEventos().length;
          var s = C.semActivo();
          var e = C.editarSemestre(s.id, {nombre: '2026-2 bis', clases: 16});
          return {semanas: e.semanas.length, nombre: e.nombre,
                  eventos: C.todosEventos().length, antesEv: antesEv,
                  ramos: (C.datosDeSemestre(s.id).ramos || []).join(','),
                  activo: (C.semActivo() || {}).nombre};
        })()""")
        check(12, "editar el semestre regenera semanas y conserva eventos y ramos",
              editar["semanas"] == 19 and editar["nombre"] == "2026-2 bis"
              and editar["eventos"] == editar["antesEv"] and editar["eventos"] == 2
              and editar["ramos"] == "MA1001,FI1001",
              "semanas=%d nombre=%s eventos=%d/%d ramos=%s" % (
                  editar["semanas"], editar["nombre"], editar["eventos"],
                  editar["antesEv"], editar["ramos"]))

        # --------------------------------------------------------- filtros
        filtros = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var f = C.filtros();
          var activos = Object.keys(f.ramos).filter(function (k) { return f.ramos[k]; });
          var tipos = Object.keys(f.tipos).filter(function (k) { return f.tipos[k]; });
          var antes = C.chipsDe('%s').length;
          C.alternarRamo('FI1001');
          var sin = C.chipsDe('%s').length;
          C.alternarRamo('FI1001');
          var despues = C.chipsDe('%s').length;
          C.resetFiltros();
          return {activo: f.activo, ramos: activos.length, tipos: tipos.length,
                  antes: antes, sin: sin, despues: despues};
        })()""" % (ramo["fecha"], ramo["fecha"], ramo["fecha"]))
        check(13, "los filtros: apagar un ramo esconde sus eventos y resetFiltros los devuelve",
              filtros["activo"] and filtros["ramos"] >= 2 and filtros["tipos"] >= 6
              and filtros["antes"] == 1 and filtros["sin"] == 0
              and filtros["despues"] == 1,
              "ramos=%d tipos=%d antes=%d sin=%d despues=%d" % (
                  filtros["ramos"], filtros["tipos"], filtros["antes"],
                  filtros["sin"], filtros["despues"]))

        # ------------------------------------------------------------ iCal
        ics = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, t = C.exportarIcal();
          return {vevent: (t.match(/BEGIN:VEVENT/g) || []).length,
                  dtstart: /DTSTART/.test(t), summary: /SUMMARY:/.test(t),
                  cierra: /END:VCALENDAR/.test(t), largo: t.length,
                  primera: t.split('\\r\\n')[0]};
        })()""")
        check(14, "exportar produce VEVENT con DTSTART y SUMMARY",
              ics["vevent"] == 2 and ics["dtstart"] and ics["summary"]
              and ics["cierra"],
              "VEVENT=%d DTSTART=%s SUMMARY=%s" % (
                  ics["vevent"], ics["dtstart"], ics["summary"]))

        importado = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var antes = C.todosEventos().length;
          var texto = ['BEGIN:VCALENDAR',
            'BEGIN:VEVENT', 'UID:1@x', 'DTSTART:20261201T090000',
            'SUMMARY:Prueba importada', 'END:VEVENT',
            'BEGIN:VEVENT', 'UID:2@x', 'DTSTART;VALUE=DATE:20261202',
            'SUMMARY:Otro dia', 'END:VEVENT', 'END:VCALENDAR'].join('\\r\\n');
          var r = C.importarIcal(texto);
          return {n: r.n, fechas: r.eventos.map(function (e) { return e.fecha + ' ' + e.hora; }),
                  total: C.todosEventos().length, antes: antes,
                  origen: r.eventos.length ? r.eventos[0].origen : null};
        })()""")
        check(15, "importar un .ics devuelve sus eventos y los deja en el calendario",
              importado["n"] == 2 and importado["total"] == importado["antes"] + 2
              and importado["fechas"][0] == "2026-12-01 09:00"
              and importado["fechas"][1] == "2026-12-02 "
              and importado["origen"] == "ical",
              "n=%d fechas=%s total=%d origen=%s" % (
                  importado["n"], importado["fechas"], importado["total"],
                  importado["origen"]))

        # ---------------------------------------------------- cuadre con malla
        malla = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun;
          var r = C.ramos();
          var codigos = r.map(function (x) { return x.codigo; });
          var cat = Object.keys(M.CAT());
          var resueltos = codigos.every(function (c) { return !!M.ramoNuevo(c); });
          return {codigos: codigos, catalogo: cat.length,
                  enCatalogo: codigos.every(function (c) { return cat.indexOf(c) >= 0; }),
                  igual: resueltos,
                  color: r.length ? r[0].color : null};
        })()""")
        check(16, "cuadre con la malla: los ramos del semestre se resuelven en el catalogo T004",
              malla["enCatalogo"] and malla["igual"]
              and malla["codigos"] == ["MA1001", "FI1001"]
              and str(malla["color"]).startswith("var(--"),
              "ramos=%s catalogo=%d enCatalogo=%s resueltos=%s color=%s" % (
                  malla["codigos"], malla["catalogo"], malla["enCatalogo"],
                  malla["igual"], malla["color"]))

        # ------------------------------------------------------------ estudio
        estudio = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun;
          var lunes = C.lunesDe(C.hoy());
          var e = M.leer();
          e.estudio = e.estudio || {};
          e.estudio.minutos = e.estudio.minutos || {};
          e.estudio.minutos[lunes] = {MA1001: 120, FI1001: 30, OTROS: 30};
          M.guardar();
          return {lunes: lunes};
        })()""")
        await p.ir(url, espera=0.7)
        await abrir(p)
        estudio2 = await p.js("""(() => {
          var C = window.MimoCalendarioMotor;
          var fila = document.querySelector('.cal__fila--actual');
          var barra = fila ? fila.querySelectorAll('.cal__barra i').length : 0;
          return {cifra: fila ? fila.querySelector('.cal__est-cifra').textContent : null,
                  meta: fila ? fila.querySelector('.cal__est-meta').textContent : null,
                  tramos: barra, horas: C.horasSemana('%s'),
                  fmt: C.fmtMin(180)};
        })()""" % estudio["lunes"])
        check(17, "la columna de estudio suma lo registrado (2h 30m) y la barra lo reparte",
              estudio2["cifra"] == "2h 30m" and estudio2["horas"] == 2.5
              and estudio2["tramos"] == 2 and estudio2["fmt"] == "3h",
              "cifra=%s horas=%s tramos=%d meta=%s" % (
                  estudio2["cifra"], estudio2["horas"], estudio2["tramos"],
                  estudio2["meta"]))

        # ------------------------------------------------------------ recarga
        antes_rec = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun, e = M.leer();
          return {eventos: C.todosEventos().length,
                  activo: (C.semActivo() || {}).nombre,
                  claves: Object.keys(e.calendario).sort().join(','),
                  forma: !!e.semestre && Array.isArray(e.semestre.extras),
                  semanas: (C.semActivo() || {}).semanas.length};
        })()""")
        await p.ir(url, espera=0.7)
        await abrir(p)
        await p.ir(url, espera=0.7)
        await abrir(p)
        despues_rec = await p.js("""(() => {
          var C = window.MimoCalendarioMotor, M = window.MimoComun, e = M.leer();
          return {eventos: C.todosEventos().length,
                  activo: (C.semActivo() || {}).nombre,
                  claves: Object.keys(e.calendario).sort().join(','),
                  forma: !!e.semestre && Array.isArray(e.semestre.extras),
                  semanas: (C.semActivo() || {}).semanas.length};
        })()""")
        check(18, "una recarga no pierde eventos ni el semestre activo",
              antes_rec["eventos"] == despues_rec["eventos"] == 4
              and antes_rec["activo"] == despues_rec["activo"] == "2026-2 bis"
              and antes_rec["claves"] == despues_rec["claves"]
              and despues_rec["forma"] and despues_rec["semanas"] == 19,
              "eventos %d>%d activo=%s claves=%s" % (
                  antes_rec["eventos"], despues_rec["eventos"],
                  despues_rec["activo"], despues_rec["forma"]))

        # ------------------------------------------------------------- idioma
        idioma = await p.js("""(() => {
          var c = window.MimoI18n.claves(), d = window.MimoI18n.diagnostico();
          return {es: c.es, en: c.en, ausentes: d.ausentes.length,
                  desajustes: d.desajustes.length, total: d.totalClaves};
        })()""")
        check(19, "el idioma: claves >= 153 por idioma y diagnostico limpio",
              idioma["es"] >= 153 and idioma["en"] >= 153
              and idioma["es"] == idioma["en"]
              and idioma["ausentes"] == 0 and idioma["desajustes"] == 0,
              "claves=%s/%s ausentes=%d desajustes=%d" % (
                  idioma["es"], idioma["en"], idioma["ausentes"],
                  idioma["desajustes"]))

        # --------------------------------------------------- motor sin documento
        motor_js = os.path.join(os.path.dirname(fichero), "js/calendario.js")
        with open(motor_js, encoding="utf-8") as f:
            fuente = f.read()
        documento = len(re.findall(r"document\.", fuente))
        check(20, "el motor no nombra el objeto global del navegador",
              documento == 0, "%s: %d ocurrencia(s) de document." % (
                  os.path.basename(motor_js), documento))

        # -------------------------------------------------------- 32 aperturas
        eventos = []
        await p.ir(url, espera=0.5)
        for idi in IDIOMAS:
            await p.js("localStorage.setItem('mimo.idioma', '%s')" % idi)
            for estado in ESTADOS:
                for tema in TEMAS:
                    limpia(p)
                    await p.ir(url + "?reset=1&estado=" + estado, espera=0.3)
                    await p.js(
                        "(document.querySelector('[data-seccion=\"calendario\"]')||"
                        "{click:function(){}}).click()")
                    await asyncio.sleep(0.12)
                    await p.js("document.body.setAttribute('data-tema', '%s')" % tema)
                    await asyncio.sleep(0.1)
                    eventos.extend(p.eventos)
        print("32 aperturas: %d eventos, %d prohibidos" % (len(eventos), len(malos(eventos))))
        check(21, "32 aperturas con la seccion abierta no dejan eventos de consola",
              len(malos(eventos)) == 0,
              "%d eventos, %d prohibidos" % (len(eventos), len(malos(eventos))))

        # ------------------------------------------------------------ geometria
        await p.enviar("Emulation.setDeviceMetricsOverride", width=1100, height=900,
                       deviceScaleFactor=1, mobile=False)
        await p.ir(url + "?reset=1&estado=contexto", espera=0.6)
        await abrir(p)
        geo = await p.js("""(() => {
          var c = document.querySelector('.calendario');
          var l = document.querySelector('.losa');
          return {vw: window.innerWidth,
                  sw: document.documentElement.scrollWidth,
                  caja: c ? c.getBoundingClientRect().width : 0,
                  losa: l ? l.getBoundingClientRect().width : 0};
        })()""")
        check(22, "a 1100 px el calendario no desborda la losa ni la ventana",
              geo["sw"] <= geo["vw"] + 1 and geo["caja"] <= geo["losa"] + 1,
              "ventana=%d scroll=%d caja=%.2f losa=%.2f" % (
                  geo["vw"], geo["sw"], geo["caja"], geo["losa"]))

        # -------------------------------------------------------------- resumen
        fallos = [i + 1 for i, ok in enumerate(checks) if not ok]
        print("")
        print("RESUMEN: %d choque(s) de %d medidas." % (len(fallos), len(checks)))
        if fallos:
            print("CHOQUES: " + ", ".join(str(n) for n in fallos))
        print("EXIT=%d" % (0 if not fallos else 1))
        sys.exit(0 if not fallos else 1)
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
    asyncio.run(main())
