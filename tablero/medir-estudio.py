#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Mide el bloque T005 (Estudio y Calificaciones) del armazon nuevo.

No supone nada: abre Chromium sin cabeza en un puerto libre, carga la copia
congelada de /tmp (ANTES) y el fichero que se le pase (DESPUES), y comprueba las
medidas del encargo sobre el DOM y sobre los dos motores.

Lo que se mide, y por que:
  - que las dos secciones existan y pinten SU bloque (antes: cero cajas);
  - que las barras sumen los minutos por ramo y semana y que la meta propia
    mande sobre la base (la cuenta se compara con el motor, no con un numero
    escrito a mano);
  - que los KPIs cuadren con las horas que hay en el almacen;
  - que la linea de puntos use las horas de la semana y el objetivo;
  - que el aviso de dedicacion corta aparezca, se pueda descartar y sumar;
  - que las notas se calculen como en la app anterior, con casos escritos aqui:
    normalizar (22 -> 2,2), promedio ponderado, presentacion, final con examen,
    eximicion, minima 4,0 y estado;
  - que todo sobreviva a la recarga (F5 sin reset);
  - que el diccionario siga simetrico y sin desajustes al cambiar de idioma;
  - que los dos motores no nombren el DOM (corte motor/vista, como T002/T004).

Uso:
    python3 tablero/medir-estudio.py
    python3 tablero/medir-estudio.py --fichero tablero/armazon-paneles.html

Sale 0 solo si todas las medidas dan [OK]. Si algo choca imprime [CHOQUE] con el
numero medido y sale 1. No mata procesos por patron: guarda el pid del Chromium
que arranca y lo termina el mismo con proc.terminate().
"""
import argparse
import asyncio
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

AQUI = os.path.dirname(os.path.abspath(__file__))
CHROMIUM = "/usr/bin/chromium-browser"
ANTES = "/tmp/mimo-nuevo-t005-antes/index.html"
HERRAMIENTAS = "/home/billibu/workspace/herramientas"
if HERRAMIENTAS not in sys.path:
    sys.path.insert(0, HERRAMIENTAS)
import cdp  # noqa: E402

IDIOMAS = ("es", "en")
TEMAS = ("claro", "oscuro")


def sha256(ruta):
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for trozo in iter(lambda: f.read(65536), b""):
            h.update(trozo)
    return h.hexdigest()


def malos(eventos):
    return [e for e in eventos
            if e.get("tipo") in ("consola", "excepcion", "red-fallo")]


def casi(a, b, tol=1e-6):
    try:
        return abs(float(a) - float(b)) <= tol
    except (TypeError, ValueError):
        return False


async def nueva():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    puerto = s.getsockname()[1]
    s.close()
    perfil = "/tmp/cdp-t005-%d-%d" % (os.getpid(), int(time.time()))
    os.makedirs(perfil, exist_ok=True)
    log = open("/tmp/t005-medir-chromium.log", "wb")
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


async def abrir(p, seccion, espera=0.35):
    await p.js("(document.querySelector('[data-seccion=\"%s\"]')"
               "||{click:function(){}}).click()" % seccion)
    await asyncio.sleep(espera)


async def main():
    ap = argparse.ArgumentParser(description="Mide Estudio y Calificaciones (T005).")
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
    print("SHA256 : %s" % sha256(fichero))

    p, proc, puerto = await nueva()
    print("PUERTO=%d pid=%d" % (puerto, proc.pid))
    checks = []

    def check(n, nombre, ok, detalle=""):
        checks.append(bool(ok))
        print("[%s] %d. %s — %s" % ("OK" if ok else "CHOQUE", n, nombre, detalle))

    try:
        # ---------------------------------------------------------------- ANTES
        if not args.sin_antes and os.path.isfile(ANTES):
            await p.ir("file://" + ANTES, espera=0.6)
            antes = await p.js("""(() => ({
              motorEstudio: typeof window.MimoEstudioMotor,
              motorCalif: typeof window.MimoCalificacionesMotor,
              cajaEstudio: document.querySelectorAll('[data-estudio="bloque"]').length,
              cajaCalif: document.querySelectorAll('[data-calif="bloque"]').length,
              claves: window.MimoI18n ? window.MimoI18n.claves() : null
            }))()""")
            print("ANTES (copia congelada %s):" % ANTES)
            print("  sha256          : %s" % sha256(ANTES))
            print("  motor estudio   : %s · cajas %d" %
                  (antes["motorEstudio"], antes["cajaEstudio"]))
            print("  motor calif     : %s · cajas %d" %
                  (antes["motorCalif"], antes["cajaCalif"]))
            await abrir(p, "estudio")
            await abrir(p, "calificaciones")
            antes["trasAbrir"] = await p.js(
                "document.querySelectorAll('[data-estudio=\"bloque\"],[data-calif=\"bloque\"]').length")
            print("  tras abrir las dos secciones: %d cajas" % antes["trasAbrir"])
        else:
            antes = None
            print("ANTES: no disponible, se mide solo DESPUES")

        # --------------------------------------------------------------- DESPUES
        await p.ir(url + "?reset=1", espera=0.6)
        await p.js("window.MimoI18n.cambiar('es')")
        # catalogo de prueba: tres ramos, uno con cadena de requisitos
        n_cat = await p.js("""(() => {
          var c = window.MimoComun;
          c.ramoEnCatalogo('MA1001', {nombre:'Calculo I', nivel:1, creditos:6,
            desbloquea:['MA2001']});
          c.ramoEnCatalogo('MA2001', {nombre:'Calculo II', nivel:2, creditos:6,
            requisitos:['MA1001']});
          c.ramoEnCatalogo('FI2004', {nombre:'Fisica I', nivel:1, creditos:6});
          c.guardar();
          return Object.keys(c.CAT()).length;
        })()""")
        await asyncio.sleep(0.2)

        # 1. las dos secciones existen, pintan y traen su motor
        await abrir(p, "estudio")
        est = await p.js("""(() => ({
          motor: typeof window.MimoEstudioMotor,
          vista: typeof window.MimoEstudioUI,
          caja: !!document.querySelector('[data-estudio="bloque"]'),
          kpis: document.querySelectorAll('[data-estudio="kpis"] .kpi').length,
          barras: document.querySelectorAll('[data-barra-semana]').length,
          vacio: !!document.querySelector('[data-estudio="barras-vacio"]'),
          puntos: document.querySelectorAll('[data-punto-semana]').length,
          ramos: Object.keys(window.MimoComun.CAT()).length
        }))()""")
        await abrir(p, "calificaciones")
        cal = await p.js("""(() => ({
          motor: typeof window.MimoCalificacionesMotor,
          vista: typeof window.MimoCalificacionesUI,
          caja: !!document.querySelector('[data-calif="bloque"]'),
          items: document.querySelectorAll('[data-calif-ramo]').length
        }))()""")
        ok1 = (n_cat == 3 and est["motor"] == "object" and est["vista"] == "object"
               and est["caja"] and est["kpis"] == 5
               and ((est["barras"] == 16) or (est["barras"] == 0 and est["vacio"]))
               and est["puntos"] == 16 and cal["motor"] == "object"
               and cal["vista"] == "object" and cal["caja"] and cal["items"] == 3)
        check(1, "Estudio y Calificaciones existen, pintan su caja y su motor",
              ok1, "ramos=%d estudio=%s/%s kpis=%d barras=%d vacio=%s puntos=%d calif=%s items=%d"
              % (n_cat, est["motor"], est["vista"], est["kpis"], est["barras"],
                 est["vacio"], est["puntos"], cal["motor"], cal["items"]))

        # 2. el motor no nombra el DOM (corte motor/vista)
        piezas = []
        ok2 = True
        for nombre, corte in (("estudio.js", "var MimoEstudioUI"),
                              ("calificaciones.js", "var MimoCalificacionesUI")):
            ruta = os.path.join(AQUI, "js", nombre)
            texto = open(ruta, encoding="utf-8").read()
            cabeza = texto.split(corte)[0] if corte in texto else texto
            apariciones = cabeza.count("document.")
            piezas.append("%s=%d" % (nombre, apariciones))
            ok2 = ok2 and ("document." not in cabeza) and (corte in texto)
        check(2, "los dos motores no nombran el DOM y su vista vive aparte",
              ok2, " · ".join(piezas))

        # 3. horas: barras por ramo y semana, sin repartir y meta propia
        await abrir(p, "estudio")
        datos = await p.js("""(() => {
          var M = window.MimoEstudioMotor;
          var w = M.semanas();
          var act = w[w.length-1].lunes, prev = w[w.length-2].lunes;
          M.ponerMetaBase(3);
          M.ponerMetaRamo('MA1001', 2);
          M.ponerMinutos(prev, 'MA1001', 150);
          M.ponerMinutos(act, 'MA1001', 60);
          M.ponerSinRepartir(act, 60);
          M.ponerMetaSemana(act, 5);
          window.MimoEstudioUI.pintar();
          return {act:act, prev:prev,
            asignadas_prev:M.horasAsignadas(prev), semana_act:M.horasSemana(act),
            sin_act:M.sinRepartir(act), meta_prev:M.metaDe(prev),
            meta_act:M.metaDe(act), propia:M.tieneMetaPropia(act),
            kpis:M.kpis()};
        })()""")
        await asyncio.sleep(0.15)
        k = datos["kpis"]
        ok3 = (casi(datos["asignadas_prev"], 2.5) and casi(datos["semana_act"], 2.0)
               and casi(datos["sin_act"], 1.0) and casi(datos["meta_prev"], 3.0)
               and casi(datos["meta_act"], 5.0) and datos["propia"] is True)
        check(3, "minutos por ramo y semana: 1h + 1h sin repartir = 2h; meta propia 5 manda sobre 3",
              ok3, "prev=%.2fh act=%.2fh sin=%.2fh meta prev=%.1f act=%.1f propia=%s"
              % (datos["asignadas_prev"], datos["semana_act"], datos["sin_act"],
                 datos["meta_prev"], datos["meta_act"], datos["propia"]))

        # 4. las barras del DOM cuadran con el motor, semana a semana
        barras = await p.js("""(() => {
          var M = window.MimoEstudioMotor, mal = [];
          document.querySelectorAll('[data-barra-semana]').forEach(function (el) {
            var l = el.getAttribute('data-barra-semana');
            if (Math.abs(Number(el.getAttribute('data-barra-total')) - M.horasAsignadas(l)) > 1e-6) {
              mal.push(l + ':' + el.getAttribute('data-barra-total') + '/' + M.horasAsignadas(l));
            }
            if (Math.abs(Number(el.getAttribute('data-barra-meta')) - M.metaDe(l)) > 1e-6) {
              mal.push(l + ':meta ' + el.getAttribute('data-barra-meta') + '/' + M.metaDe(l));
            }
          });
          return {mal: mal, n: document.querySelectorAll('[data-barra-semana]').length};
        })()""")
        check(4, "barras: 16 columnas y cada total/meta igual al motor",
              not barras["mal"] and barras["n"] == 16,
              "%d columnas, %d desajustes %s" %
              (barras["n"], len(barras["mal"]), barras["mal"][:3]))

        # 5. KPIs contra las horas del motor
        kpis_dom = await p.js("""(() => {
          var M = window.MimoEstudioMotor, k = M.kpis();
          var txt = Array.prototype.map.call(
            document.querySelectorAll('[data-estudio="kpis"] .kpi__cifra'),
            function (e) { return e.textContent; });
          return {txt: txt, total: M.horasTexto(k.total),
            promedio: M.decimal(k.promedio) + ' h', sobre: k.sobre + ' / 16',
            objetivo: M.horasTexto(k.objetivo), sin: M.horasTexto(k.sinRepartir),
            k: k};
        })()""")
        ok5 = (kpis_dom["txt"][:5] == [kpis_dom["total"], kpis_dom["promedio"],
                                       kpis_dom["sobre"], kpis_dom["objetivo"],
                                       kpis_dom["sin"]]
               and casi(kpis_dom["k"]["total"], 4.5)
               and casi(kpis_dom["k"]["promedio"], 2.25)
               and kpis_dom["k"]["sobre"] == 0
               and kpis_dom["k"]["registradas"] == 2)
        check(5, "KPIs: total 4h 30m, promedio 2,3 h, 0/16 sobre meta, 2 semanas con registro",
              ok5, "%s · total=%.2f prom=%.3f sobre=%d reg=%d"
              % (kpis_dom["txt"][:5], kpis_dom["k"]["total"],
                 kpis_dom["k"]["promedio"], kpis_dom["k"]["sobre"],
                 kpis_dom["k"]["registradas"]))

        # 6. la linea de puntos: horas de la semana y objetivo
        puntos = await p.js("""(() => {
          var M = window.MimoEstudioMotor, mal = [];
          document.querySelectorAll('[data-punto-semana]').forEach(function (el) {
            var l = el.getAttribute('data-punto-semana');
            if (Math.abs(Number(el.getAttribute('data-punto-horas')) - M.horasSemana(l)) > 1e-6) {
              mal.push(l);
            }
          });
          var caja = document.querySelector('[data-estudio="puntos"]');
          return {mal: mal, n: document.querySelectorAll('[data-punto-semana]').length,
            objetivo: Number(caja ? caja.getAttribute('data-punto-objetivo') : -1),
            esperado: M.objetivoSemanal()};
        })()""")
        check(6, "puntos: 16 semanas con sus horas y la linea de objetivo",
              not puntos["mal"] and puntos["n"] == 16
              and casi(puntos["objetivo"], puntos["esperado"]),
              "%d puntos, %d desajustes, objetivo %.1f/%.1f"
              % (puntos["n"], len(puntos["mal"]), puntos["objetivo"], puntos["esperado"]))

        # 7. editar desde la vista: una casilla de minutos y la meta base
        await abrir(p, "estudio")
        edito = await p.js("""(() => {
          var M = window.MimoEstudioMotor, w = M.semanas();
          var prev = w[w.length-2].lunes, act = w[w.length-1].lunes;
          var campo = document.querySelector('[data-min-lunes="' + prev +
            '"][data-min-ramo="MA1001"]');
          if (!campo) { return {error: 'sin casilla'}; }
          campo.value = '1h 30m';
          campo.dispatchEvent(new Event('change', {bubbles: true}));
          var base = document.querySelector('[data-meta-base]');
          base.value = '2';
          base.dispatchEvent(new Event('change', {bubbles: true}));
          return {min: M.minutosDe(prev).MA1001, metaPrev: M.metaDe(prev),
            metaAct: M.metaDe(act), base: M.metaBase()};
        })()""")
        ok7 = (edito.get("min") == 90 and casi(edito.get("metaPrev"), 2.0)
               and casi(edito.get("metaAct"), 5.0) and casi(edito.get("base"), 2.0))
        check(7, "editar en la vista: '1h 30m' = 90 min y meta base 2 (la propia sigue en 5)",
              ok7, "min=%s metaPrev=%s metaAct=%s base=%s"
              % (edito.get("min"), edito.get("metaPrev"), edito.get("metaAct"),
                 edito.get("base")))
        # se restauran los valores de la bateria
        await p.js("""(() => {
          var M = window.MimoEstudioMotor, w = M.semanas();
          M.ponerMetaBase(3);
          M.ponerMinutos(w[w.length-2].lunes, 'MA1001', 150);
          M.ponerMetaRamo('MA1001', 4);
          M.ponerMetaRamo('MA2001', 10);
          window.MimoEstudioUI.pintar();
        })()""")
        await asyncio.sleep(0.15)

        # 8. aviso de dedicacion corta: descartar y sumar
        await abrir(p, "estudio")
        avisos = await p.js("""(() => {
          var c = document.querySelectorAll('[data-aviso]');
          return {n: c.length,
            cods: Array.prototype.map.call(c, function (e) {
              return e.getAttribute('data-aviso'); })};
        })()""")
        ok8a = (avisos["n"] == 2 and "MA1001" in avisos["cods"]
                and "MA2001" in avisos["cods"])
        await p.js("(document.querySelector('[data-descartar=\"MA1001\"]')"
                   "||{click:function(){}}).click()")
        await asyncio.sleep(0.15)
        tras_descartar = await p.js("""(() => ({
          n: document.querySelectorAll('[data-aviso]').length,
          queda: !!document.querySelector('[data-aviso="MA2001"]'),
          seFue: !document.querySelector('[data-aviso="MA1001"]')
        }))()""")
        await p.js("(document.querySelector('[data-anadir=\"MA2001\"]')"
                   "||{click:function(){}}).click()")
        await asyncio.sleep(0.15)
        campo_sumar = await p.js(
            "!!document.querySelector('[data-cantidad]')")
        await p.js("""(() => {
          var c = document.querySelector('[data-cantidad]');
          if (c) { c.value = '45m'; }
          var b = document.querySelector('[data-anadir-guardar]');
          if (b) { b.click(); }
        })()""")
        await asyncio.sleep(0.15)
        sumado = await p.js("""(() => { try {
          var M = window.MimoEstudioMotor, w = M.semanas();
          var m = M.minutosDe(w[w.length-1].lunes);
          return {min: (m && m.MA2001) || 0, todos: m,
            avisos: document.querySelectorAll('[data-aviso]').length};
        } catch (e) { return {min: -1, error: String(e), pila: e.stack}; } })()""")
        ok8 = ok8a and tras_descartar["n"] == 1 and tras_descartar["queda"] \
            and tras_descartar["seFue"] and campo_sumar and sumado["min"] == 45
        check(8, "dedicacion corta: dos avisos, descartar quita uno y sumar 45m al otro",
              ok8, "avisos=%d/%s tras descartar=%d campo=%s sumado=%s"
              % (avisos["n"], avisos["cods"], tras_descartar["n"], campo_sumar,
                 sumado.get("todos", sumado)))

        # 9. normalizar notas (los dedos se comen la coma)
        norm = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor;
          return ['22', '7,5', '', '3,95', '0', 'abc', '1,05'].map(function (v) {
            return C.normalizarNota(v); });
        })()""")
        esperado = [2.2, 7.0, None, 4.0, 1.0, None, 1.1]
        ok9 = len(norm) == len(esperado) and all(
            (a is None and b is None) or casi(a, b) for a, b in zip(norm, esperado))
        check(9, "normalizarNota: 22->2,2 · 7,5->7,0 · ''->null · 3,95->4,0 · 0->1,0 · 1,05->1,1",
              ok9, "%s" % json.dumps(norm))

        # 10. promedio ponderado por categoria y presentacion
        await abrir(p, "calificaciones")
        nota = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor, s = C.estado();
          s.cats['MA1001'] = [{nombre:'Controles', peso:0.6},
                              {nombre:'Tareas', peso:0.4}];
          s.comps['MA1001'] = [
            {nombre:'Control 1', categoria:'Controles', peso:1, nota:6, fecha:null},
            {nombre:'Tarea 1', categoria:'Tareas', peso:1, nota:4, fecha:null}];
          C.guardar();
          window.MimoCalificacionesUI.pintar();
          var cat = s.cats['MA1001'][0];
          return {prom: C.promedioCategoria('MA1001', cat, null),
            p: C.presentacion('MA1001', null),
            estado: C.estadoDe('MA1001', null).texto};
        })()""")
        await p.js("(document.querySelector('[data-calif-ramo=\"MA1001\"]')"
                   "||{click:function(){}}).click()")
        await asyncio.sleep(0.2)
        dom10 = await p.js("""(() => {
          var d = document.querySelector('[data-detalle="MA1001"]');
          return d ? {p: d.getAttribute('data-p'), nf: d.getAttribute('data-nf'),
            estado: d.getAttribute('data-estado')} : null;
        })()""")
        ok10 = (casi(nota["prom"], 6.0) and casi(nota["p"], 5.2)
                and nota["estado"] == "aprobado" and dom10
                and casi(dom10["p"], 5.2) and casi(dom10["nf"], 5.2)
                and dom10["estado"] == "aprobado")
        check(10, "categorias 60/40 con 6,0 y 4,0: presentacion 5,2 y estado aprobado",
              ok10, "promCat=%.2f P=%.2f estado=%s DOM=%s"
              % (nota["prom"], nota["p"], nota["estado"], dom10))

        # 11. examen con peso: final y nota necesaria
        examen = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor, s = C.estado();
          s.examen['MA1001'] = {activo:true, peso:0.4, reemplaza:null};
          C.guardar();
          window.MimoCalificacionesUI.pintar();
          var sinNota = C.estadoDe('MA1001', null).texto;
          var con5 = C.notaFinal('MA1001', 5);
          var nec = C.examenPara('MA1001', 6);
          var d = document.querySelector('[data-detalle="MA1001"]');
          var campo = document.querySelector('[data-sim-ex]');
          if (campo) { campo.value = '5'; campo.dispatchEvent(new Event('input', {bubbles:true})); }
          var sim = document.querySelector('[data-sim]');
          return {sinNota: sinNota, con5: con5, nec: nec,
            domNf: sim ? sim.getAttribute('data-sim-nf') : null,
            domNec: sim ? sim.getAttribute('data-sim-nec') : null,
            estado5: C.estadoDe('MA1001', 5).texto};
        })()""")
        ok11 = (examen["sinNota"] == "a examen" and casi(examen["con5"], 5.12)
                and casi(examen["nec"], 7.2) and examen["estado5"] == "aprobado"
                and casi(examen["domNf"], 5.12) and casi(examen["domNec"], 2.2))
        check(11, "examen 40%: sin nota 'a examen'; con 5,0 final 5,12; para 6,0 hace falta 7,2",
              ok11, "sinNota=%s nf(5)=%s nec(6)=%s DOM nf=%s nec=%s"
              % (examen["sinNota"], examen["con5"], examen["nec"],
                 examen["domNf"], examen["domNec"]))

        # 12. eximicion por presentacion
        exim = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor, s = C.estado();
          s.exim['MA1001'] = {activa:true, modo:'todas',
            condiciones:[{tipo:'presentacion', op:'>=', valor:5}]};
          C.guardar();
          window.MimoCalificacionesUI.pintar();
          var e = C.estadoEximicion('MA1001', null);
          var d = document.querySelector('[data-detalle="MA1001"]');
          return {cumple: e.cumple, actual: e.detalle[0].actual,
            nf: C.notaFinal('MA1001', null), estado: C.estadoDe('MA1001', null).texto,
            domEstado: d ? d.getAttribute('data-estado') : null};
        })()""")
        ok12 = (exim["cumple"] is True and casi(exim["actual"], 5.2)
                and casi(exim["nf"], 5.2) and exim["estado"] == "eximido"
                and exim["domEstado"] == "eximido")
        check(12, "eximicion con presentacion >= 5: cumple y la final es la presentacion (5,2)",
              ok12, "cumple=%s actual=%s nf=%s estado=%s DOM=%s"
              % (exim["cumple"], exim["actual"], exim["nf"], exim["estado"],
                 exim["domEstado"]))
        # se apaga para medir la minima y el examen por separado
        await p.js("""(() => {
          var C = window.MimoCalificacionesMotor, s = C.estado();
          s.exim['MA1001'] = {activa:false, modo:'todas', condiciones:[]};
          C.guardar();
        })()""")

        # 13. nota minima: 4,0 por defecto y 5,5 a mano
        minima = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor;
          var porDefecto = C.notaMinimaDe('MA1001');
          C.ponerNotaMinima('MA1001', 5.5);
          var est = C.estadoDe('MA1001', 2).texto;   // final 3,92 con la minima en 5,5
          var nf = C.notaFinal('MA1001', 2);
          window.MimoCalificacionesUI.pintar();
          var campo = document.querySelector('[data-nota-minima]');
          var enVista = campo ? Number(campo.value) : null;
          C.ponerNotaMinima('MA1001', 4);
          return {porDefecto: porDefecto, est: est, nf: nf, enVista: enVista};
        })()""")
        ok13 = (casi(minima["porDefecto"], 4.0) and casi(minima["nf"], 3.92)
                and minima["est"] == "reprobado" and casi(minima["enVista"], 5.5))
        check(13, "nota minima 4,0 por defecto; con 5,5 y final 3,92 queda reprobado",
              ok13, "defecto=%.1f nf=%s estado=%s enVista=%s"
              % (minima["porDefecto"], minima["nf"], minima["est"], minima["enVista"]))

        # 14. sin categorias: faltan datos, nunca un cero
        faltan = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor;
          window.MimoCalificacionesUI.pintar();
          var it = document.querySelector('[data-calif-ramo="FI2004"]');
          if (it) { it.click(); }
          var d = document.querySelector('[data-detalle="FI2004"]');
          return {p: C.presentacion('FI2004', null), nf: C.notaFinal('FI2004', null),
            estado: C.estadoDe('FI2004', null).texto,
            dom: d ? {p: d.getAttribute('data-p'), estado: d.getAttribute('data-estado')} : null};
        })()""")
        ok14 = (faltan["p"] is None and faltan["nf"] is None
                and faltan["estado"] == "faltan datos" and faltan["dom"]
                and faltan["dom"]["p"] == "" and faltan["dom"]["estado"] == "faltan datos")
        check(14, "ramo sin categorias: presentacion y final null y estado 'faltan datos'",
              ok14, "P=%s nf=%s estado=%s DOM=%s"
              % (faltan["p"], faltan["nf"], faltan["estado"], faltan["dom"]))

        # 15. examen que reemplaza al componente de la categoria del 60%:
        #     P(ex) = 0,6*ex + 1,6 y final = 0,6*P + 0,4*ex = 0,76*ex + 0,96.
        #     Es la formula de la app anterior, aunque cuente el examen dos veces:
        #     f(0)=0,96, f(1)=1,72 y para 6,0 hace falta 6,63.
        reemplazo = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor, s = C.estado();
          s.examen['MA1001'] = {activo:true, peso:0.4, reemplaza:0};
          C.guardar();
          var f0 = C.notaFinal('MA1001', 0), f1 = C.notaFinal('MA1001', 1);
          var nec = C.examenPara('MA1001', 6);
          s.examen['MA1001'] = {activo:true, peso:0.4, reemplaza:null};
          s.exim['MA1001'] = {activa:false, modo:'todas', condiciones:[]};
          C.guardar();
          window.MimoCalificacionesUI.pintar();
          return {f0: f0, f1: f1, nec: nec};
        })()""")
        ok15 = (casi(reemplazo["f0"], 0.96) and casi(reemplazo["f1"], 1.72)
                and casi(reemplazo["nec"], 6.631578947368421))
        check(15, "examen que reemplaza un componente: f(0)=0,96 f(1)=1,72 y para 6,0 pide 6,63",
              ok15, "f0=%s f1=%s nec=%s"
              % (reemplazo["f0"], reemplazo["f1"], reemplazo["nec"]))

        # 16. todo sobrevive a la recarga, sin reset
        await p.ir(url, espera=0.7)
        await p.js("window.MimoI18n.cambiar('es')")
        await abrir(p, "estudio")
        persist = await p.js("""(() => {
          var M = window.MimoEstudioMotor, w = M.semanas();
          var guardado = JSON.parse(localStorage.getItem('mimo.datos.v1') || '{}');
          return {min: M.minutosDe(w[w.length-1].lunes).MA1001,
            minMA2001: M.minutosDe(w[w.length-1].lunes).MA2001,
            partes: Object.keys(guardado).sort(),
            barras: document.querySelectorAll('[data-barra-semana]').length};
        })()""")
        await abrir(p, "calificaciones")
        persist2 = await p.js("""(() => {
          var C = window.MimoCalificacionesMotor;
          return {nota: (C.compsDe('MA1001')[0] || {}).nota,
            p: C.presentacion('MA1001', null)};
        })()""")
        ok16 = (persist["min"] == 60 and persist["minMA2001"] == 45
                and "estudio" in persist["partes"] and "calificaciones" in persist["partes"]
                and persist["barras"] == 16 and casi(persist2["nota"], 6.0)
                and casi(persist2["p"], 5.2))
        check(16, "F5 sin reset: minutos, notas y los dos namespaces siguen ahi",
              ok16, "min=%s MA2001=%s claves=%s nota=%s P=%s"
              % (persist["min"], persist["minMA2001"],
                 ",".join(persist["partes"]), persist2["nota"], persist2["p"]))

        # 17. idioma: diccionario simetrico, cero desajustes y la vista traducida
        diag = {}
        for idioma in IDIOMAS:
            await p.js("window.MimoI18n.cambiar('%s')" % idioma)
            await asyncio.sleep(0.25)
            diag[idioma] = await p.js("window.MimoI18n.diagnostico()")
        await abrir(p, "estudio")
        en = await p.js("""(() => {
          var c = document.querySelector('[data-estudio="kpis"]');
          return {texto: c ? c.textContent : '',
            total: typeof window.MimoI18n.t === 'function'
              ? window.MimoI18n.t('estudio.total') : ''};
        })()""")
        c_es = diag["es"]["totalClaves"]["es"]
        c_en = diag["es"]["totalClaves"]["en"]
        ok17 = (c_es == c_en and c_es >= 153
                and not diag["es"]["ausentes"] and not diag["en"]["ausentes"]
                and not diag["es"]["desajustes"] and not diag["en"]["desajustes"]
                and en["total"] and en["total"] in en["texto"])
        check(17, "claves es/en iguales, 0 ausentes, 0 desajustes y KPI traducido",
              ok17, "%d/%d ausentes es=%d en=%d desajustes es=%d en=%d"
              % (c_es, c_en, len(diag["es"]["ausentes"]),
                 len(diag["en"]["ausentes"]),
                 len(diag["es"]["desajustes"]), len(diag["en"]["desajustes"])))
        await p.js("window.MimoI18n.cambiar('es')")

        # 18. abrir las dos secciones en los dos temas y los dos idiomas no ensucia
        eventos = []
        for idioma in IDIOMAS:
            await p.js("localStorage.setItem('mimo.idioma', '%s')" % idioma)
            for tema in TEMAS:
                p.eventos = []
                await p.ir(url + "?reset=1", espera=0.45)
                await p.js("document.body.setAttribute('data-tema', '%s')" % tema)
                await abrir(p, "estudio", 0.25)
                await abrir(p, "calificaciones", 0.25)
                eventos.extend(p.eventos)
        prohibidos = malos(eventos)
        check(18, "8 aperturas (2 idiomas x 2 temas x 2 secciones) sin un evento prohibido",
              not prohibidos, "%d prohibidos de %d" % (len(prohibidos), len(eventos)))

        print("RESUMEN: %d choque(s) de %d medidas." %
              (len([c for c in checks if not c]), len(checks)))
        return 0 if all(checks) else 1
    finally:
        try:
            await p.cerrar()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
