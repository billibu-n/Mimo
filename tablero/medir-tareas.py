#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""medir-tareas.py — instrumento del bloque Tareas (T007) de Mimo Nuevo.

Mide el tablero de tres columnas contra la copia CONGELADA del armazon anterior
(`/tmp/mimo-nuevo-t007-antes/index.html`, sha256 en la evidencia) y contra el
armazon de ahora. No mide "que se ve": mide lo que el encargo reclama.

  1. la copia de antes no tiene motor, ni seccion, ni caja de Tareas
  2. el motor expone lo que el contrato pide (todas, porFiltro, columnas,
     anillo, kpis, marcar, soltar)
  3. las tres columnas clasifican por fecha contra hoy() y por `hechas`
  4. una tarea con hora aparece en el dia que toca, con su hora
  5. el orden respeta prioridad (alta, media, baja, sin prioridad)
  6. los cuatro KPIs cuentan lo pendiente
  7. el anillo cuenta hechas/pendientes/total de la semana
  8. los cinco filtros (todas, pendientes, hoy, ramos, personal)
  9. arrastrar a Hoy pone la fecha de hoy
 10. arrastrar a Esta semana pone el lunes de la semana
 11. arrastrar a Hechas marca; sacar de Hechas desmarca y vuelve a hoy
 12. el drag&drop REAL del DOM (dragstart + drop) mueve la tarea
 13. todo sobrevive a recargar (la forma la declara comun/almacen.js)
 14. los rotulos se traducen: es/en, 0 ausentes y 0 desajustes
 15. a 411 px las columnas no desbordan
 16. el motor no nombra el objeto global del navegador (grep = 0)
 17. el armazon registra seccion, bloque, caja y script
 18. las aperturas medidas no dejan un solo evento de consola

Uso:
  python3 medir-tareas.py --fichero armazon-paneles.html
  python3 medir-tareas.py --sin-antes          # solo DESPUES

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
ANTES = "/tmp/mimo-nuevo-t007-antes/index.html"
HERRAMIENTAS = "/home/billibu/workspace/herramientas"
IDIOMAS = ("es", "en")

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
    perfil = "/tmp/cdp-t007-%d-%d" % (os.getpid(), int(time.time()))
    os.makedirs(perfil, exist_ok=True)
    log = open("/tmp/t007-medir-chromium.log", "wb")
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


async def abrir(p, seccion):
    await p.js("""(() => { var b = document.querySelector('[data-seccion="%s"]');
      if (b) { b.click(); } return !!b; })()""" % seccion)
    await asyncio.sleep(0.25)


async def basicas(p, url):
    """Lo que se puede decir de un armazon sin sembrar nada: tiene o no tiene."""
    await p.ir(url + "?reset=1", espera=0.6)
    motor = await p.js("typeof window.MimoTareasMotor")
    ui = await p.js("typeof window.MimoTareasUI")
    seccion = await p.js("!!document.querySelector('[data-seccion=\"tareas\"]')")
    if seccion:
        await abrir(p, "tareas")
    caja = await p.js("!!document.querySelector('[data-tareas=\"bloque\"]')")
    claves = await p.js("window.MimoI18n ? window.MimoI18n.claves() : null")
    return {"motor": motor, "ui": ui, "seccion": seccion, "caja": caja,
            "claves": claves or {"es": 0, "en": 0},
            "eventos": len(malos(p.eventos))}


def imprime_basicas(nombre, b, sha):
    print("%s (sha256 %s):" % (nombre, sha))
    print("  motor Tareas    : %s" % b["motor"])
    print("  vista Tareas    : %s" % b["ui"])
    print("  seccion Tareas  : %s" % b["seccion"])
    print("  caja Tareas     : %s" % b["caja"])
    print("  claves i18n     : %s / %s" % (b["claves"].get("es"), b["claves"].get("en")))
    print("  eventos         : %d prohibidos" % b["eventos"])


SEMBRAR = """(() => {
  var M = window.MimoComun, T = window.MimoTareasMotor;
  var h = T.hoy(), l = T.lunes(h), l6 = M.sumaDias(l, 6);
  var usados = [h];
  function otro() {
    for (var i = 0; i < 7; i++) {
      var d = M.sumaDias(l, i);
      if (usados.indexOf(d) < 0) { usados.push(d); return d; }
    }
    return h;
  }
  var c = otro();   // una tarea de la semana que NO cae hoy
  var d = otro();   // otra, sin ramo
  var e = l;        // una hecha, dentro de la semana
  var tareas = {
    nuevas: [
      {id:'a', fecha:h, hora:'09:30', texto:'Repasar cálculo', ramo:'MA1001', origen:'manual'},
      {id:'b', fecha:h, hora:'', texto:'Comprar café', ramo:'', origen:'manual'},
      {id:'c', fecha:c, hora:'12:00', texto:'Informe de laboratorio', ramo:'FI1001', origen:'notas'},
      {id:'d', fecha:d, hora:'', texto:'Leer capítulo', ramo:'', origen:'manual'},
      {id:'e', fecha:e, hora:'', texto:'Entregar tarea', ramo:'MA1001', origen:'manual'},
      {id:'f', fecha:M.sumaDias(l, -7), hora:'', texto:'Semana pasada', ramo:'', origen:'manual'}
    ],
    hechas: {e: true},
    prioridades: {a:'alta', b:'media', c:'baja'}
  };
  var est = M.leer();
  est.tareas = tareas;
  M.guardar();
  return {h:h, l:l, l6:l6, c:c, d:d};
})()"""

FOTO = """(() => {
  function ids(destino) {
    var c = document.querySelector('[data-destino="' + destino + '"]');
    if (!c) { return []; }
    return [].map.call(c.querySelectorAll('.tarea'), function (x) {
      return x.getAttribute('data-id');
    });
  }
  function textos(sel) {
    return [].map.call(document.querySelectorAll(sel), function (x) {
      return x.textContent;
    });
  }
  return {
    hoy: ids('hoy'), semana: ids('semana'), hechas: ids('hechas'),
    kpis: textos('.tareas__kpis .kpi__cifra'),
    filtros: [].map.call(document.querySelectorAll('[data-filtro]'), function (x) {
      return x.getAttribute('data-filtro') + '=' +
        x.querySelector('.tareas__n').textContent;
    }),
    anillo: [].map.call(document.querySelectorAll('[data-tareas^="anillo-"]'),
      function (x) { return x.textContent; }),
    pct: (document.querySelector('.tareas__anillo-txt') || {}).textContent,
    textos: [].map.call(document.querySelectorAll('.tarea'), function (x) {
      return x.getAttribute('data-id') + ':' + x.textContent;
    })
  };
})()"""


async def main():
    ap = argparse.ArgumentParser(description="Mide el bloque Tareas (T007).")
    ap.add_argument("--fichero", default=os.path.join(AQUI, "armazon-paneles.html"),
                    help="armazon a medir como DESPUES")
    ap.add_argument("--sin-antes", action="store_true",
                    help="no medir la copia congelada")
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
        antes = None
        if not args.sin_antes and os.path.isfile(ANTES):
            antes = await basicas(p, "file://" + ANTES)
            imprime_basicas("ANTES (copia congelada)", antes, sha256(ANTES)[:16])
        else:
            print("ANTES: no disponible, se mide solo DESPUES")

        despues = await basicas(p, url)
        imprime_basicas("DESPUES", despues, sha256(fichero)[:16])
        check(1, "la copia de antes no tenia bloque de Tareas",
              antes is None or (antes["motor"] == "undefined"
              and not antes["seccion"] and not antes["caja"]),
              "sin copia de antes" if antes is None else
              "motor=%s seccion=%s caja=%s" % (
                  antes["motor"], antes["seccion"], antes["caja"]))

        # ------------------------------------------------------------ sembrar
        await p.ir(url + "?reset=1", espera=0.6)
        await p.js("localStorage.setItem('mimo.idioma', 'es')")
        base = await p.js(SEMBRAR)
        await p.ir(url, espera=0.6)
        await abrir(p, "tareas")
        foto = await p.js(FOTO)
        print("BANCO: hoy=%s lunes=%s domingo=%s c=%s d=%s" % (
            base["h"], base["l"], base["l6"], base["c"], base["d"]))

        # 2. superficie del motor
        api = await p.js("""(() => {
          var M = window.MimoTareasMotor, faltan = [];
          ['todas','porFiltro','columnas','anillo','kpis','marcar','soltar']
            .forEach(function (k) { if (typeof M[k] !== 'function') { faltan.push(k); } });
          return {faltan: faltan, filtros: M.FILTROS.slice(), destinos: M.DESTINOS.slice()};
        })()""")
        check(2, "motor con todas/porFiltro/columnas/anillo/kpis/marcar/soltar",
              not api["faltan"] and api["filtros"] == ["todas", "pendientes", "hoy", "ramos", "personal"]
              and api["destinos"] == ["hoy", "semana", "hechas"],
              "faltan=%s filtros=%s destinos=%s" % (
                  api["faltan"], ",".join(api["filtros"]), ",".join(api["destinos"])))

        # 3. las tres columnas
        ok_cols = (foto["hoy"] == ["a", "b"] and foto["semana"] == ["c", "d"]
                   and foto["hechas"] == ["e"])
        check(3, "columnas: hoy 2, semana 2, hechas 1 y la de fuera no entra",
              ok_cols, "hoy=%s semana=%s hechas=%s" % (
                  foto["hoy"], foto["semana"], foto["hechas"]))

        # 4. la hora aparece en el dia que toca
        tarjeta_a = [t for t in foto["textos"] if t.startswith("a:")]
        tarjeta_c = [t for t in foto["textos"] if t.startswith("c:")]
        ok_hora = (len(tarjeta_a) == 1 and "09:30" in tarjeta_a[0]
                   and len(tarjeta_c) == 1 and "12:00" in tarjeta_c[0]
                   and "c" not in foto["hoy"])
        check(4, "una tarea con hora cae en su dia y muestra la hora",
              ok_hora, "a=%s c=%s" % (tarjeta_a[:1], tarjeta_c[:1]))

        # 5. orden por prioridad (a alta, b media; c baja antes que d sin prioridad)
        ok_orden = foto["hoy"] == ["a", "b"] and foto["semana"] == ["c", "d"]
        check(5, "orden por prioridad dentro de cada columna", ok_orden,
              "hoy=%s semana=%s" % (foto["hoy"], foto["semana"]))

        # 6. KPIs
        check(6, "KPIs: 5 pendientes, 2 de hoy, 3 personales, 2 con ramo",
              foto["kpis"] == ["5", "2", "3", "2"], "kpis=%s" % foto["kpis"])

        # 7. anillo
        check(7, "anillo de la semana: 1 hecha, 4 pendientes, 5 y 20%",
              foto["anillo"] == ["1", "4", "5"] and foto["pct"] == "20%",
              "anillo=%s pct=%s" % (foto["anillo"], foto["pct"]))

        # 8. filtros, por el DOM
        await p.js("""document.querySelector('[data-filtro="ramos"]').click()""")
        await asyncio.sleep(0.15)
        ramos = await p.js(FOTO)
        ok_ramos = (sorted(ramos["hoy"] + ramos["semana"] + ramos["hechas"])
                    == ["a", "c", "e"] and not ramos["semana"].count("d"))
        await p.js("""document.querySelector('[data-filtro="personal"]').click()""")
        await asyncio.sleep(0.15)
        personal = await p.js(FOTO)
        ok_personal = sorted(personal["hoy"] + personal["semana"]
                             + personal["hechas"]) == ["b", "d"]
        await p.js("""document.querySelector('[data-filtro="todas"]').click()""")
        await asyncio.sleep(0.15)
        check(8, "los cinco filtros y sus cuentas",
              foto["filtros"] == ["todas=6", "pendientes=5", "hoy=2", "ramos=3",
                                  "personal=3"] and ok_ramos and ok_personal,
              "cuentas=%s ramos=%s personal=%s" % (
                  foto["filtros"], ramos["hoy"] + ramos["semana"] + ramos["hechas"],
                  personal["hoy"] + personal["semana"] + personal["hechas"]))

        # 9. soltar en Hoy
        r9 = await p.js("window.MimoTareasMotor.soltar('c', 'hoy')")
        await p.js("window.MimoTareasUI.pintar()")
        f9 = await p.js(FOTO)
        check(9, "soltar en Hoy pone la fecha de hoy", r9["fecha"] == base["h"]
              and "c" in f9["hoy"] and r9["hecha"] is False,
              "fecha=%s hoy=%s" % (r9["fecha"], f9["hoy"]))

        # 10. soltar en Esta semana
        r10 = await p.js("window.MimoTareasMotor.soltar('a', 'semana')")
        await p.js("window.MimoTareasUI.pintar()")
        f10 = await p.js(FOTO)
        donde10 = "hoy" if "a" in f10["hoy"] else ("semana" if "a" in f10["semana"] else "fuera")
        ok10 = (r10["fecha"] == base["l"] and "a" not in f10["hechas"]
                and donde10 != "fuera")
        check(10, "soltar en Esta semana pone el lunes", ok10,
              "fecha=%s lunes=%s columna=%s" % (r10["fecha"], base["l"], donde10))

        # 11. Hechas y salir de Hechas
        r11 = await p.js("window.MimoTareasMotor.soltar('b', 'hechas')")
        await p.js("window.MimoTareasUI.pintar()")
        f11 = await p.js(FOTO)
        r11b = await p.js("window.MimoTareasMotor.soltar('e', 'hoy')")
        await p.js("window.MimoTareasUI.pintar()")
        f11b = await p.js(FOTO)
        ok11 = (r11["hecha"] is True and "b" in f11["hechas"]
                and f11["anillo"] == ["2", "3", "5"] and f11["pct"] == "40%"
                and r11b["hecha"] is False and r11b["fecha"] == base["h"]
                and "e" in f11b["hoy"])
        check(11, "Hechas marca; sacar de Hechas desmarca y vuelve a hoy", ok11,
              "marcar=%s anillo=%s sacar=%s fecha=%s hoy=%s" % (
                  r11["hecha"], f11["anillo"], r11b["hecha"], r11b["fecha"],
                  f11b["hoy"]))

        # 12. el drag&drop REAL del DOM (no solo el motor)
        await p.js("""(() => {
          var t = document.querySelector('[data-destino="semana"] .tarea[data-id="d"]');
          var c = document.querySelector('[data-destino="hoy"]');
          if (!t || !c) { return false; }
          t.dispatchEvent(new Event('dragstart', {bubbles: true}));
          c.dispatchEvent(new Event('drop', {bubbles: true}));
          return true;
        })()""")
        await asyncio.sleep(0.25)
        f12 = await p.js(FOTO)
        d_fecha = await p.js("""(() => { var l = window.MimoComun.leer().tareas.nuevas;
          for (var i = 0; i < l.length; i++) { if (l[i].id === 'd') { return l[i].fecha; } }
          return null; })()""")
        check(12, "el arrastre del DOM mueve la tarjeta y re-fecha",
              "d" in f12["hoy"] and d_fecha == base["h"],
              "hoy=%s fecha=%s" % (f12["hoy"], d_fecha))

        # 13. recarga: la forma declarada en comun/almacen.js
        guardado = await p.js("""(() => { var t = window.MimoComun.leer().tareas;
          return {claves: Object.keys(t).sort(), hechas: Object.keys(t.hechas).sort(),
            fechas: [].map.call(t.nuevas, function (x) { return x.id + '=' + x.fecha; }),
            prioridades: t.prioridades}; })()""")
        await p.ir(url, espera=0.7)
        await abrir(p, "tareas")
        tras = await p.js(FOTO)
        guardado2 = await p.js("""(() => { var t = window.MimoComun.leer().tareas;
          return {claves: Object.keys(t).sort(), hechas: Object.keys(t.hechas).sort(),
            fechas: [].map.call(t.nuevas, function (x) { return x.id + '=' + x.fecha; }),
            prioridades: t.prioridades}; })()""")
        ok13 = (guardado == guardado2 and guardado["claves"] == ["hechas", "nuevas", "prioridades"]
                and "b" in tras["hechas"] and "d" in tras["hoy"])
        check(13, "todo sobrevive a recargar (nuevas, hechas, prioridades)",
              ok13, "claves=%s hechas=%s hoy=%s" % (
                  ",".join(guardado["claves"]), tras["hechas"], tras["hoy"]))

        # 14. idioma
        diag = {}
        for idioma in IDIOMAS:
            await p.js("window.MimoI18n.cambiar('%s')" % idioma)
            await asyncio.sleep(0.25)
            diag[idioma] = await p.js("window.MimoI18n.diagnostico()")
        en = await p.js("""(() => ({
          col: (document.querySelector('[data-destino="semana"] .tareas__colTit') || {}).textContent,
          filtro: (document.querySelector('[data-filtro="todas"] span') || {}).textContent }))()""")
        c_es = diag["es"]["totalClaves"]["es"]
        c_en = diag["es"]["totalClaves"]["en"]
        ok14 = (c_es == c_en and c_es >= (antes["claves"]["es"] if antes else 0)
                and not diag["es"]["ausentes"] and not diag["en"]["ausentes"]
                and not diag["es"]["desajustes"] and not diag["en"]["desajustes"]
                and en["col"] == "This week" and en["filtro"] == "All")
        check(14, "rotulos es/en: 0 ausentes, 0 desajustes y la columna traducida",
              ok14, "%d/%d desajustes es=%d en=%d col=%s filtro=%s" % (
                  c_es, c_en, len(diag["es"]["desajustes"]),
                  len(diag["en"]["desajustes"]), en["col"], en["filtro"]))
        await p.js("window.MimoI18n.cambiar('es')")

        # 15. a 411 px no desborda
        await p.enviar("Emulation.setDeviceMetricsOverride", width=411, height=900,
                       deviceScaleFactor=1, mobile=False)
        await p.ir(url, espera=0.6)
        await abrir(p, "tareas")
        desborde = await p.js("""(() => {
          var max = 0, nodos = document.querySelectorAll('.tareas, .tareas__col, .tarea');
          for (var i = 0; i < nodos.length; i++) {
            max = Math.max(max, nodos[i].scrollWidth - nodos[i].clientWidth);
          }
          return {max: max, doc: document.documentElement.scrollWidth - window.innerWidth};
        })()""")
        check(15, "a 411 px el tablero y sus columnas no desbordan",
              desborde["max"] <= 1 and desborde["doc"] <= 1,
              "max=%s doc=%s" % (desborde["max"], desborde["doc"]))
        await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                       deviceScaleFactor=1, mobile=False)

        # 16. el motor no nombra el objeto global del navegador
        with open(os.path.join(AQUI, "js", "tareas.js"), "r", encoding="utf-8") as f:
            fuente = f.read()
        cuenta = len(re.findall(r"document\.", fuente))
        check(16, "el motor no nombra el objeto global del navegador", cuenta == 0,
              "%d apariciones de document. en tareas.js" % cuenta)

        # 17. el armazon registra seccion, bloque, caja y script
        with open(fichero, "r", encoding="utf-8") as f:
            html = f.read()
        with open(os.path.join(AQUI, "js", "comun", "almacen.js"), "r",
                  encoding="utf-8") as f:
            almacen = f.read()
        ok17 = ('{ id: \'tareas\', icono: \'i-tareas\', bloques: [\'tareas\']' in html
                and 'data-tareas="bloque"' in html
                and '<script src="js/tareas.js"></script>' in html
                and "tareas: {\n        nuevas: []" in almacen
                and "normalizarTareas(s.tareas)" in almacen
                and "function normalizarTareas(v)" in almacen)
        check(17, "armazon: seccion, bloque, caja y script; almacen: namespace",
              ok17, "seccion=%s caja=%s script=%s almacen=%s" % (
                  '{ id: \'tareas\'' in html, 'data-tareas="bloque"' in html,
                  'src="js/tareas.js"' in html, "normalizarTareas" in almacen))

        # 18. aperturas medidas sin eventos prohibidos
        limpia(p)
        for idioma in IDIOMAS:
            await p.js("localStorage.setItem('mimo.idioma', '%s')" % idioma)
            for tema in ("claro", "oscuro"):
                await p.ir(url, espera=0.45)
                await p.js("document.body.setAttribute('data-tema', '%s')" % tema)
                await abrir(p, "tareas")
                await asyncio.sleep(0.15)
        prohibidos = malos(p.eventos)
        check(18, "8 aperturas de Tareas sin un solo evento prohibido",
              len(prohibidos) == 0, "%d prohibidos de %d" % (
                  len(prohibidos), len(p.eventos)))

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
