#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mide el bloque Tiempo del armazon nuevo, ANTES contra DESPUES.

No supone nada: abre Chromium sin cabeza en un puerto libre, carga la copia
congelada de /tmp (ANTES) y el fichero que se le pase (DESPUES), y comprueba
las diecisiete medidas del encargo. Una sola verdad: este script y el gate del
proyecto son el mismo.

Uso:
    python3 tablero/medir-tiempo2.py
    python3 tablero/medir-tiempo2.py --fichero tablero/armazon-paneles.html

Sale 0 solo si las diecisiete medidas dan [OK]. Si algo choca, imprime [CHOQUE] con
el numero medido y sale 1. No mata procesos por patron: guarda el pid del
Chromium que arranca y lo termina el mismo.
"""
import argparse
import asyncio
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CHROMIUM = "/usr/bin/chromium-browser"
ANTES = "/tmp/mimo-nuevo-t002-antes/index.html"
SONIDO = os.path.join(AQUI, "sonido", "alarma.mp3")
SONIDO_REF = os.path.join(
    os.path.dirname(AQUI), "referencia", "mimo-app-53cc22d",
    "sonido", "alarma.mp3")

HERRAMIENTAS = "/home/billibu/workspace/herramientas"
if HERRAMIENTAS not in sys.path:
    sys.path.insert(0, HERRAMIENTAS)
import cdp  # noqa: E402

ESTADOS = ("normal", "plegado", "contexto", "gabinete", "ambos",
           "angosto", "vacia", "apariencia")
TEMAS = ("claro", "oscuro")
IDIOMAS = ("es", "en")
MODOS = ("cronometro", "temporizador", "pomodoro", "alarmas")


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
    perfil = "/tmp/cdp-t002-%d-%d" % (os.getpid(), int(time.time()))
    os.makedirs(perfil, exist_ok=True)
    log = open("/tmp/t002-medir-chromium.log", "wb")
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


async def geometria(p, url):
    await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                   deviceScaleFactor=1, mobile=False)
    await p.ir(url + "?reset=1&estado=ambos", espera=0.6)
    losa = await p.js(
        "(document.querySelector('.losa')||{getBoundingClientRect:function(){return {width:0}}}).getBoundingClientRect().width")
    await p.enviar("Emulation.setDeviceMetricsOverride", width=1100, height=900,
                   deviceScaleFactor=1, mobile=False)
    await p.ir(url + "?reset=1&estado=contexto", espera=0.6)
    der = await p.js(
        "(document.querySelector('.der')||{getBoundingClientRect:function(){return {right:0}}}).getBoundingClientRect().right")
    return {"losa": losa, "sangria": 1100.0 - der}


async def cargas(p, url):
    """32 cargas: 8 estados x 2 temas x 2 idiomas. Devuelve los eventos vistos."""
    eventos = []
    await p.ir(url, espera=0.5)
    for idioma in IDIOMAS:
        await p.js("localStorage.setItem('mimo.idioma', '%s')" % idioma)
        for estado in ESTADOS:
            for tema in TEMAS:
                limpia(p)
                await p.ir(url + "?reset=1&estado=" + estado, espera=0.35)
                await p.js("document.body.setAttribute('data-tema', '%s')" % tema)
                await asyncio.sleep(0.12)
                eventos.extend(p.eventos)
    return eventos


def seg_de_cifra(t):
    if not t:
        return None
    m = re.match(r"\s*(\d+):(\d+)[,.](\d+)", t)
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2)) + int(m.group(3)) / 100.0


async def cronometro(p, url):
    await p.ir(url, espera=0.4)
    await p.js("localStorage.setItem('mimo.idioma', 'es')")
    await p.ir(url + "?reset=1", espera=0.5)
    await p.js("document.querySelector('[data-accion=\"crono-empezar\"]').click()")
    await asyncio.sleep(2.5)
    cifra = await p.js(
        "(document.querySelector('[data-tiempo=\"crono-cifra\"]')||{}).textContent")
    hay_pausa = await p.js("!!document.querySelector('[data-accion=\"crono-pausa\"]')")
    boton = "crono-pausa" if hay_pausa else "crono-empezar"
    await p.js("document.querySelector('[data-accion=\"%s\"]').click()" % boton)
    t0 = await p.js(
        "(document.querySelector('[data-tiempo=\"crono-cifra\"]')||{}).textContent")
    await asyncio.sleep(1.0)
    t1 = await p.js(
        "(document.querySelector('[data-tiempo=\"crono-cifra\"]')||{}).textContent")
    try:
        claves = await p.js("window.MimoI18n.claves()")
    except Exception:
        claves = {"es": 0, "en": 0}
    return {"cifra": cifra, "seg": seg_de_cifra(cifra), "pausa": t0, "pausa_1s": t1,
            "congelado": t0 == t1, "claves": claves}


async def basicas(p, url):
    geo = await geometria(p, url)
    eventos = await cargas(p, url)
    cro = await cronometro(p, url)
    return {"losa": geo["losa"], "sangria": geo["sangria"],
            "eventos": len(malos(eventos)), "eventos_todos": len(eventos),
            "crono": cro}


def imprime_basicas(nombre, b):
    print("%s:" % nombre)
    print("  losa 1280 ambos : %.2f" % b["losa"])
    print("  sangria 1100    : %.2f" % b["sangria"])
    print("  32 cargas       : %d eventos prohibidos (de %d)" %
          (b["eventos"], b["eventos_todos"]))
    print("  crono 2,50 s    : %s (congelado al pausar: %s)" %
          (b["crono"]["cifra"], b["crono"]["congelado"]))
    print("  claves i18n     : %s / %s" % (b["crono"]["claves"].get("es"),
                                          b["crono"]["claves"].get("en")))


async def set_reloj(p, pre, h, m, s):
    return await p.js("""(() => {
      var c = document.querySelector('[data-reloj="%s"]');
      if (!c) { return false; }
      c.querySelector('[data-tiempo="%s-h"]').value = '%s';
      c.querySelector('[data-tiempo="%s-m"]').value = '%s';
      c.querySelector('[data-tiempo="%s-s"]').value = '%s';
      c.querySelector('[data-tiempo="%s-h"]').dispatchEvent(new Event('change', {bubbles: true}));
      return true;
    })()""" % (pre, pre, h, pre, m, pre, s, pre))


async def deshabilitado(p, accion):
    return await p.js("""(() => {
      var b = document.querySelector('[data-accion="%s"]');
      return b ? b.hasAttribute('disabled') : null;
    })()""" % accion)


async def main():
    ap = argparse.ArgumentParser(description="Mide el bloque Tiempo (T002).")
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
            imprime_basicas("ANTES (copia congelada)", antes)
        else:
            print("ANTES: no disponible, se mide solo DESPUES")

        despues = await basicas(p, url)
        imprime_basicas("DESPUES", despues)

        # ---------------------------------------------------------- 1..4 basicas
        n_eventos = despues["eventos"]
        check(1, "32 cargas sin un solo evento", n_eventos == 0,
              "%d prohibidos" % n_eventos)
        ok_losa = abs(despues["losa"] - 544.0) < 0.01
        if antes:
            ok_losa = ok_losa and despues["losa"] >= antes["losa"] - 0.01
        check(2, "losa 544,00 a 1280", ok_losa, "%.2f" % despues["losa"])
        ok_sang = abs(despues["sangria"] - 32.0) < 0.01
        if antes:
            ok_sang = ok_sang and despues["sangria"] >= antes["sangria"] - 0.01
        check(3, "sangria 32,00 a 1100", ok_sang, "%.2f" % despues["sangria"])
        seg = despues["crono"]["seg"]
        ok_crono = (seg is not None and abs(seg - 2.50) <= 0.25
                    and (despues["crono"]["cifra"] or "").startswith("00:02,5")
                    and despues["crono"]["congelado"])
        detalle = "%s, pausa %s / +1s %s" % (
            despues["crono"]["cifra"], despues["crono"]["pausa"],
            despues["crono"]["pausa_1s"])
        if antes and antes["crono"]["seg"] is not None:
            ok_crono = ok_crono and abs(seg - antes["crono"]["seg"]) <= 0.25
        check(4, "cronometro 00:02,50 y congelado al pausar", ok_crono, detalle)

        # claves e idioma: mismo numero y cero ausentes/desajustes en los dos
        await p.ir(url + "?reset=1", espera=0.5)
        diag = {}
        for idioma in IDIOMAS:
            await p.js("window.MimoI18n.cambiar('%s')" % idioma)
            await asyncio.sleep(0.2)
            diag[idioma] = await p.js("window.MimoI18n.diagnostico()")
        await p.js("window.MimoI18n.cambiar('es')")
        c_es = diag["es"]["totalClaves"]["es"]
        c_en = diag["es"]["totalClaves"]["en"]
        ok_claves = (c_es == c_en and c_es > 0
                     and not diag["es"]["ausentes"] and not diag["en"]["ausentes"]
                     and not diag["es"]["desajustes"] and not diag["en"]["desajustes"])
        extra = ""
        if antes:
            ok_claves = ok_claves and c_es >= antes["crono"]["claves"].get("es", 0)
            extra = " (antes %s)" % antes["crono"]["claves"].get("es")
        check(13, "claves es/en iguales, 0 ausentes y 0 desajustes", ok_claves,
              "%d/%d desajustes es=%d en=%d%s" % (
                  c_es, c_en, len(diag["es"]["desajustes"]),
                  len(diag["en"]["desajustes"]), extra))

        # -------------------------------------------------- preparar el banco
        await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                       deviceScaleFactor=1, mobile=False)
        await p.ir(url + "?reset=1", espera=0.6)
        await p.js("localStorage.removeItem('mimo.bloque.tiempo');"
                   "localStorage.setItem('mimo.idioma', 'es')")
        await p.ir(url + "?reset=1", espera=0.6)
        for b in ("registro", "alarmas", "pomodoro", "temporizador"):
            await p.js("""(() => { var x = document.querySelector('[data-instalar="%s"]');
              if (x) { x.click(); } return !!x; })()""" % b)
        await asyncio.sleep(0.3)

        # ----------------------------------------------------- 5 reloj editable
        await p.js("document.querySelector('.est__v[data-bloque=\"cronometro\"]').click()")
        await set_reloj(p, "crono", "00", "01", "30")
        crono_ms = await p.js("window.MimoTiempoMotor.cronoMs()")
        crono_txt = await p.js(
            "(document.querySelector('[data-tiempo=\"crono-cifra\"]')||{}).textContent")
        await set_reloj(p, "crono", "00", "00", "45")
        crono_ms2 = await p.js("window.MimoTiempoMotor.cronoMs()")
        await p.js("document.querySelector('.est__v[data-bloque=\"temporizador\"]').click()")
        await set_reloj(p, "temp", "00", "02", "00")
        temp_ms = await p.js("window.MimoTiempoMotor.tempRestanteMs()")
        await set_reloj(p, "temp", "00", "00", "30")
        temp_ms2 = await p.js("window.MimoTiempoMotor.tempRestanteMs()")
        ok_reloj = (crono_ms == 90000 and crono_ms2 == 45000
                    and temp_ms == 120000 and temp_ms2 == 30000
                    and crono_txt == "01:30,00")
        check(5, "reloj editable hh/mm/ss (ida y vuelta)", ok_reloj,
              "crono 90000/45000, temp 120000/30000, cifra %s" % crono_txt)

        # ---------------------------------------------- 6 cuatro modos y vistas
        ok_modos = True
        detalles = []
        for b in MODOS:
            await p.js("document.querySelector('.est__v[data-bloque=\"%s\"]').click()" % b)
            await asyncio.sleep(0.15)
            visible = await p.js(
                "!!document.querySelector('.vista--bloque[data-bloque=\"%s\"]:not([hidden])')" % b)
            modo = await p.js("window.MimoTiempoMotor.modoActual()")
            esperado = "recordatorios" if b == "alarmas" else b
            detalles.append("%s:%s/%s" % (b, visible, modo))
            if not visible or modo != esperado:
                ok_modos = False
        noreloj = await p.js(
            "document.querySelectorAll('.vista--bloque[data-bloque=\"alarmas\"] [data-reloj]').length")
        nocontroles = await p.js(
            "document.querySelectorAll('.vista--bloque[data-bloque=\"alarmas\"] [data-controles]').length")
        ok_modos = ok_modos and noreloj == 0 and nocontroles == 0
        check(6, "cuatro modos; Recordatorios sin reloj ni controles", ok_modos,
              "%s; reloj=%d controles=%d" % (" ".join(detalles), noreloj, nocontroles))

        # ------------------------------------------------------ 7 pomodoro ciclo
        await p.ir(url + "?prueba=1", espera=0.6)
        await asyncio.sleep(0.2)
        await p.js("document.querySelector('.est__v[data-bloque=\"pomodoro\"]').click()")
        for campo, valor in (("trabajo", "1"), ("corto", "1"), ("largo", "2"), ("cada", "2")):
            await p.js("""(() => { var e = document.querySelector('[data-pomo="%s"]');
              e.value = '%s'; e.dispatchEvent(new Event('change', {bubbles: true}));
              return e.value; })()""" % (campo, valor))
        cfg = await p.js("window.MimoTiempoMotor.pomoConfig()")
        await p.js("document.querySelector('[data-accion=\"pomo-empezar\"]').click()")
        await asyncio.sleep(1.35)
        est = await p.js("""(() => { var m = window.MimoTiempoMotor;
          return {fase: m.pomo().fase, corriendo: m.pomoEstaCorriendo(),
                  trabajos: m.pomo().trabajos, restante: m.pomoRestanteMs()}; })()""")
        largo = await p.js("""(() => { var m = window.MimoTiempoMotor; var p = m.pomo();
          p.trabajos = 2; p.fase = 'trabajo'; return m.pomoFaseSiguiente(); })()""")
        corto = await p.js("""(() => { var m = window.MimoTiempoMotor; var p = m.pomo();
          p.trabajos = 1; p.fase = 'trabajo'; return m.pomoFaseSiguiente(); })()""")
        ok_pomo = (cfg == {"trabajo": 1, "corto": 1, "largo": 2, "cada": 2}
                   and est["fase"] == "descanso" and est["corriendo"]
                   and est["restante"] > 0 and largo == "largo" and corto == "descanso")
        check(7, "pomodoro: config guardada y ciclo encadenado", ok_pomo,
              "cfg=%s fase=%s corriendo=%s trabajos=%s; 2 trabajos->%s, 1->%s" % (
                  cfg, est["fase"], est["corriendo"], est["trabajos"], largo, corto))

        # ---------------------------------------- 8 alarma una vez y descartar
        await p.ir(url, espera=0.6)
        await p.js("document.querySelector('.est__v[data-bloque=\"temporizador\"]').click()")
        await set_reloj(p, "temp", "00", "00", "01")
        await p.js("""(() => { window.__plays = 0;
          var op = HTMLMediaElement.prototype.play;
          HTMLMediaElement.prototype.play = function () {
            window.__plays += 1; return Promise.resolve();
          }; return true; })()""")
        antes_ses = await p.js("window.MimoTiempoMotor.sesiones().length")
        await p.js("document.querySelector('[data-accion=\"temp-empezar\"]').click()")
        await asyncio.sleep(1.4)
        await p.js("window.MimoTiempoMotor.tempTic();"
                   "window.MimoTiempoMotor.tempTic();"
                   "window.MimoTiempoMotor.tempTic();")
        plays = await p.js("window.__plays")
        vivo = await p.js(
            "(document.querySelector('[data-tiempo=\"temp-live\"]')||{}).textContent")
        await p.js("document.querySelector('[data-accion=\"temp-descartar\"]').click()")
        despues_ses = await p.js("window.MimoTiempoMotor.sesiones().length")
        vivo2 = await p.js(
            "(document.querySelector('[data-tiempo=\"temp-live\"]')||{}).textContent")
        ok_alarma = (plays == 1 and vivo and not vivo2
                     and antes_ses == despues_ses)
        check(8, "alarma suena una vez y el aviso se descarta sin registrar",
              ok_alarma, "plays=%s vivo=%r/%r sesiones %s->%s" % (
                  plays, vivo, vivo2, antes_ses, despues_ses))

        # ------------------------------------------------------ 9 censo semanal
        await p.js("window.MimoTiempoMotor.sesiones().forEach(function (s) {"
                   "window.MimoTiempoMotor.quitarSesion(s.id); })")
        await p.js("""(() => { var m = window.MimoTiempoMotor; var hoy = m.hoy();
          var lunes = m.lunesDe(hoy);
          m.registrarMinutos(10, {fecha: hoy});
          m.registrarMinutos(20, {fecha: hoy});
          m.registrarMinutos(5, {fecha: lunes});
          return {hoy: hoy, lunes: lunes}; })()""")
        censo = await p.js("""(() => { var m = window.MimoTiempoMotor;
          var c = m.censoSemanal();
          return {total: c.total, suma: c.dias.reduce(function (n, d) {
            return n + d.minutos; }, 0), dias: c.dias.length,
            semana: m.minutosSemana(m.lunesDe(m.hoy())), sesiones: m.sesiones().length}; })()""")
        await p.js("window.MimoTiempoUI.pintar()")
        dom_min = await p.js(
            "[...document.querySelectorAll('[data-tiempo=\"reg-censo\"] [data-min]')].reduce(function (n, e) { return n + Number(e.getAttribute('data-min')); }, 0)")
        dom_total = await p.js(
            "Number((document.querySelector('[data-tiempo=\"reg-censo\"]')||{}).getAttribute('data-total'))")
        ok_censo = (censo["total"] == 35 and censo["suma"] == 35
                    and censo["dias"] == 7 and censo["semana"] == 35
                    and dom_min == 35 and dom_total == 35)
        check(9, "censo semanal: siete dias y la suma cuadra", ok_censo,
              "total=%s suma=%s dias=%s semana=%s dom=%s/%s" % (
                  censo["total"], censo["suma"], censo["dias"], censo["semana"],
                  dom_min, dom_total))

        # ------------------------------------- 10 recordatorio sin cronometro
        await p.js("window.MimoTiempoMotor.fijarReloj(new Date(2026, 9, 20, 9, 30, 0).getTime())")
        await p.js("document.querySelector('.est__v[data-bloque=\"alarmas\"]').click()")
        await p.js("""(() => {
          document.querySelector('[data-rec="dia"]').value = '2';
          document.querySelector('[data-rec="hora"]').value = '09:30';
          document.querySelector('[data-rec="texto"]').value = 'Aviso de prueba';
          document.querySelector('[data-rec="sonido"]').checked = false;
          document.querySelector('[data-accion="rec-agregar"]').click();
          return true; })()""")
        marcha = await p.js("window.MimoTiempoMotor.hayMarcha()")
        await p.js("window.MimoTiempoUI.revisar()")
        live = await p.js(
            "(document.querySelector('[data-tiempo=\"rec-live\"]')||{}).textContent")
        otra = await p.js("window.MimoTiempoMotor.revisarRecordatorios().length")
        filas = await p.js(
            "document.querySelectorAll('[data-tiempo=\"rec-lista\"] [data-rec-item]').length")
        await p.js("window.MimoTiempoMotor.fijarReloj(null)")
        ok_rec = (marcha is False and "Aviso de prueba" in (live or "")
                  and otra == 0 and filas == 1)
        check(10, "recordatorio a dia y hora, sin cronometro de por medio",
              ok_rec, "marcha=%s live=%r repetidos=%s filas=%s" % (
                  marcha, live, otra, filas))

        # ------------------------------- 11 play/pausa/parar deshabilitados
        await p.js("document.querySelector('.est__v[data-bloque=\"cronometro\"]').click()")
        await p.js("window.MimoTiempoMotor.cronoCero(); window.MimoTiempoUI.pintar()")
        ini = [await deshabilitado(p, "crono-empezar"),
               await deshabilitado(p, "crono-pausa"),
               await deshabilitado(p, "crono-parar")]
        await p.js("document.querySelector('[data-accion=\"crono-empezar\"]').click()")
        await asyncio.sleep(0.2)
        mar = [await deshabilitado(p, "crono-empezar"),
               await deshabilitado(p, "crono-pausa"),
               await deshabilitado(p, "crono-parar")]
        await p.js("document.querySelector('[data-accion=\"crono-pausa\"]').click()")
        await asyncio.sleep(0.15)
        pau = [await deshabilitado(p, "crono-empezar"),
               await deshabilitado(p, "crono-pausa"),
               await deshabilitado(p, "crono-parar")]
        await p.js("window.MimoTiempoMotor.cronoCero();"
                   "window.MimoTiempoUI.pintar()")
        await p.js("document.querySelector('.est__v[data-bloque=\"temporizador\"]').click()")
        t_ini = [await deshabilitado(p, "temp-empezar"),
                 await deshabilitado(p, "temp-pausa"),
                 await deshabilitado(p, "temp-parar")]
        ok_botones = (ini == [False, True, True] and mar == [True, False, False]
                      and pau == [False, True, True]
                      and t_ini == [False, True, True])
        check(11, "play/pausa/parar con estados deshabilitados", ok_botones,
              "crono ini=%s marcha=%s pausa=%s temp ini=%s" % (
                  ini, mar, pau, t_ini))

        # ---------------------------------------- 12 ocho vistas a 411 sin desborde
        await p.enviar("Emulation.setDeviceMetricsOverride", width=411, height=900,
                       deviceScaleFactor=1, mobile=False)
        desbordes = []
        for estado in ESTADOS:
            limpia(p)
            await p.ir(url + "?reset=1&estado=" + estado, espera=0.4)
            d = await p.js(
                "document.documentElement.scrollWidth - document.documentElement.clientWidth")
            desbordes.append(d)
        ok_ancho = all(d <= 0 for d in desbordes)
        check(12, "8 vistas a 411 sin desbordar", ok_ancho,
              "max=%s %s" % (max(desbordes), desbordes))

        # --------------------------------------------- no deseados del contrato
        iguales = sha256(SONIDO) == sha256(SONIDO_REF)
        check(14, "alarma.mp3 es copia literal", iguales,
              "%d bytes sha %s" % (os.path.getsize(SONIDO), sha256(SONIDO)[:16]))
        texto = open(os.path.abspath(__file__), encoding="utf-8").read()
        check(15, "el instrumento cierra su Chromium por pid",
              "proc.terminate()" in texto and "--remote-debugging-port" in texto,
              "arranca en puerto libre y termina el pid que guardo")
        motor = os.path.join(AQUI, "js", "tiempo.js")
        doc = open(motor, encoding="utf-8").read() if os.path.isfile(motor) else ""
        check(16, "el motor no toca el DOM", "document." not in doc,
              "%d apariciones de document." % doc.count("document."))

        # ------------------------- 17 las etiquetas nuevas se traducen al pintar
        # La 13 mira el banco VACIO: sin bloques instalados esos nodos ni
        # existen, asi que daba verde sin probar nada (era el defecto que dejo
        # pasar T002). Aqui se instalan los cinco bloques (el cronometro viene
        # de fabrica), se cambia a en y se espera a cruzar al menos un tic de
        # 50 ms: si la etiqueta se pinta en espanol y se corrige con un
        # aplicar() que no llega, esto lo ve.
        await p.enviar("Emulation.setDeviceMetricsOverride", width=1280, height=900,
                       deviceScaleFactor=1, mobile=False)
        limpia(p)
        await p.ir(url + "?reset=1", espera=0.5)
        await p.js("localStorage.setItem('mimo.idioma', 'es')")
        await p.ir(url + "?reset=1", espera=0.5)
        for b in ("registro", "alarmas", "pomodoro", "temporizador"):
            await p.js("""(() => { var x = document.querySelector('[data-instalar="%s"]');
              if (x) { x.click(); } return !!x; })()""" % b)
        await asyncio.sleep(0.4)
        vistas = await p.js("document.querySelectorAll('.vista--bloque').length")
        diag_es = await p.js("window.MimoI18n.diagnostico()")
        des_es = len(diag_es["desajustes"])
        await p.js("window.MimoI18n.cambiar('en')")
        await asyncio.sleep(1.30)
        diag_en = await p.js("window.MimoI18n.diagnostico()")
        etiquetas = await p.js("""(() => { var o = {};
          ['pomo.trabajoMin', 'pomo.cortoMin', 'pomo.largoMin', 'pomo.cadaN',
           'rec.dia', 'rec.hora', 'rec.sonido'].forEach(function (k) {
            var n = document.querySelector('[data-i18n="' + k + '"]');
            o[k] = n ? n.textContent : null;
          });
          return o; })()""")
        esperado_en = {
            "pomo.trabajoMin": "Work",
            "pomo.cortoMin": "Short break",
            "pomo.largoMin": "Long break",
            "pomo.cadaN": "Every N work blocks",
            "rec.dia": "Day",
            # El contrato decia «Hour»; el diccionario del disco (js/i18n.js)
            # dice «Time». Manda el disco: se mide contra el diccionario.
            "rec.hora": "Time",
            "rec.sonido": "With sound",
        }
        malas = [k for k in esperado_en if etiquetas.get(k) != esperado_en[k]]
        ok_trad = (vistas == 5 and des_es == 0
                   and not diag_en["desajustes"] and not diag_en["ausentes"]
                   and not malas)
        check(17, "etiquetas nuevas traducidas con los cinco bloques y un tic",
              ok_trad, "vistas=%s es_desajustes=%s en_desajustes=%s %s%s" % (
                  vistas, des_es, len(diag_en["desajustes"]),
                  " ".join("%s=%s" % (k.split(".")[1], etiquetas.get(k))
                           for k in esperado_en),
                  (" claves=" + ",".join(d["clave"] for d in diag_en["desajustes"])
                   if diag_en["desajustes"] else "")))
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
