/* ============================================================================
   calificaciones.js — Mimo Nuevo · bloque CALIFICACIONES (T005)

   QUE HACE
   Porta el motor de notas de la app anterior
   (`referencia/mimo-app-53cc22d/js/notas/01-motor.js`) al armazon nuevo:
     - categorias ponderadas y componentes con peso dentro de su categoria;
     - examen con peso y, opcionalmente, reemplazo de un componente;
     - nota de presentacion, nota final y estado (aprobado, reprobado, eximido,
       a examen, faltan datos);
     - eximicion con condiciones sobre presentacion, categoria o componente,
       y modo «todas» o «alguna»;
     - nota minima por ramo (4,0 por defecto), guardada donde la guardaba la app
       anterior: `E.estudio.metas_ramo[cod].nota_min`;
     - simulador de nota de examen (que nota hace falta para aprobar).

   LAS NOTAS SON EL CORAZON DEL BLOQUE. Se portan las formulas TAL CUAL, no una
   version «equivalente»: una nota mal calculada es un defecto, no un hueco. Las
   reglas, en una linea cada una:
     normalizarNota: '' / null -> null; coma por punto; mientras n >= 10 se corre
       la coma (22 -> 2,2; 112 -> 1,1); tope 7; suelo 1; un decimal.
     valorComp: si el examen reemplaza a este componente y hay nota de examen,
       vale el examen; si no, su nota o null.
     promedioCategoria: media de los componentes CON nota, ponderada por su
       peso; sin ninguno, null (no 0).
     presentacion: media de las categorias CON promedio, ponderada por el peso
       de la categoria; sin ninguna, null.
     estadoEximicion: con `activa` y al menos una condicion, todas o alguna;
       una condicion sin nota no cumple.
     notaFinal: si no hay presentacion, null; si se exime, la presentacion; si
       no hay examen, la presentacion; si el examen esta activo y no hay nota de
       examen, null; si no, (1-peso)*P + peso*examen.
     estadoDe: presentacion null -> «faltan datos»; eximido; examen activo sin
       nota -> «a examen»; dec1(aCent(nf)) >= minima -> aprobado o reprobado.
     examenPara: resuelve la nota de examen que lleva la final al objetivo,
       interpolando entre la final con 0 y con 1. Si la recta es plana, null.

   EL MOTOR NO TOCA EL DOM. `MimoCalificacionesMotor` lee y escribe el almacen
   por `MimoComun.leer()`/`guardar()` y expone las cuentas puras. La vista es
   `MimoCalificacionesUI`.

   API DEL MOTOR (`window.MimoCalificacionesMotor`)
     estado()                      E.calificaciones vivo, con su forma
     guardar([aviso])              escribe el almacen unico
     ramos()                       codigos del catalogo, ordenados
     catsDe(cod) / compsDe(cod)    categorias / componentes (siembra desde CAT)
     examenDe(cod) / eximDe(cod)   examen / eximicion (siembra desde CAT)
     notaMinimaDe(cod)             minima del ramo; 4,0 por defecto
     normalizarNota(v)             '' -> null; '22' -> 2,2; 7,5 -> 7,0
     valorComp(cod, i, ex)         nota efectiva del componente i
     promedioCategoria(cod, cat, ex)
     presentacion(cod, ex)         nota de presentacion
     cumplenCondicion(cod, c, ex)  {ok, actual}
     estadoEximicion(cod, ex)      {activa, modo, detalle, cumple, sinDatos}
     notaFinal(cod, ex)            nota final (sin redondear)
     estadoDe(cod, ex)             {texto, clase}
     examenPara(cod, objetivo)     nota de examen necesaria, o null
     ponerNota(cod, i, valor)      fija la nota de un componente (y guarda)
     ponerNotaMinima(cod, valor)   fija la minima del ramo (y guarda)
     ponerAprobado(cod, si)        marca manual de aprobado (y guarda)

   API DE LA VISTA (`window.MimoCalificacionesUI`)
     iniciar()                     engancha los eventos UNA vez (delegado)
     pintar()                      repinta si el bloque esta instalado
   ============================================================================ */
var MimoCalificacionesMotor = (function () {
  'use strict';

  var Mimo = window.MimoComun;

  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function copia(v) { return JSON.parse(JSON.stringify(v === undefined ? null : v)); }
  function codigo(v) {
    return String(v === undefined || v === null ? '' : v).replace(/^\s+|\s+$/g, '').toUpperCase();
  }
  function numero(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : (def === undefined ? 0 : def);
  }
  function catalogo() { return Mimo.CAT(); }
  function ramoDe(cod) {
    var c = catalogo();
    return c[codigo(cod)] || null;
  }

  function estado() {
    var e = Mimo.leer().calificaciones;
    if (!esObjeto(e)) {
      e = { cats: {}, comps: {}, examen: {}, exim: {}, estado: {}, colores: {} };
      Mimo.leer().calificaciones = e;
    }
    if (!esObjeto(e.cats)) { e.cats = {}; }
    if (!esObjeto(e.comps)) { e.comps = {}; }
    if (!esObjeto(e.examen)) { e.examen = {}; }
    if (!esObjeto(e.exim)) { e.exim = {}; }
    if (!esObjeto(e.estado)) { e.estado = {}; }
    if (!esObjeto(e.colores)) { e.colores = {}; }
    return e;
  }

  function guardar(aviso) { Mimo.guardar(aviso); }

  function ramos() {
    var c = catalogo();
    return Object.keys(c).filter(function (k) { return c[k] && c[k].en_malla !== false; }).sort();
  }

  /* ---------------------------------------------------------- 1. sembrado */
  /* Las categorias viven en el ramo del catalogo (`categorias`). La primera vez
     se copian; despues manda lo editado en este bloque, aunque el ramo cambie. */
  function catsDe(cod) {
    cod = codigo(cod);
    var s = estado();
    if (!Array.isArray(s.cats[cod])) {
      var r = ramoDe(cod);
      s.cats[cod] = copia((r && r.categorias) || []);
    }
    return s.cats[cod];
  }

  function compsDe(cod) {
    cod = codigo(cod);
    var s = estado();
    if (!Array.isArray(s.comps[cod])) {
      var r = ramoDe(cod);
      s.comps[cod] = copia((r && r.componentes) || []);
    }
    return s.comps[cod];
  }

  function examenDe(cod) {
    cod = codigo(cod);
    var s = estado();
    if (!esObjeto(s.examen[cod])) {
      var r = ramoDe(cod);
      s.examen[cod] = copia((r && r.examen) || { activo: false, peso: 0.4, reemplaza: null });
      if (!esObjeto(s.examen[cod])) {
        s.examen[cod] = { activo: false, peso: 0.4, reemplaza: null };
      }
      if (s.examen[cod].reemplaza === undefined) { s.examen[cod].reemplaza = null; }
      if (s.examen[cod].peso === undefined) { s.examen[cod].peso = 0.4; }
    }
    return s.examen[cod];
  }

  function eximDe(cod) {
    cod = codigo(cod);
    var s = estado();
    if (!esObjeto(s.exim[cod])) {
      var r = ramoDe(cod);
      s.exim[cod] = copia((r && r.eximicion) || { activa: false, modo: 'todas', condiciones: [] });
      if (!esObjeto(s.exim[cod])) {
        s.exim[cod] = { activa: false, modo: 'todas', condiciones: [] };
      }
      if (!Array.isArray(s.exim[cod].condiciones)) { s.exim[cod].condiciones = []; }
    }
    return s.exim[cod];
  }

  /* La minima vive en el namespace del estudio porque ahi la guardaba la app
     anterior (`metas_ramo[cod].nota_min`); no se duplica en calificaciones. */
  function notaMinimaDe(cod) {
    cod = codigo(cod);
    var e = Mimo.leer().estudio;
    var m = ((esObjeto(e) && esObjeto(e.metas_ramo) ? e.metas_ramo : {})[cod] || {}).nota_min;
    return (m === null || m === undefined || m === '') ? 4.0 : Number(m);
  }

  function notaMinimaTextos() { return { porDefecto: 4.0 }; }

  /* ----------------------------------------------------------- 2. el motor */
  function normalizarNota(v) {
    if (v === '' || v === null || v === undefined) { return null; }
    var n = Number(String(v).replace(',', '.'));
    if (!isFinite(n)) { return null; }
    while (n >= 10) { n = n / 10; }
    if (n > 7) { n = 7; }
    if (n < 1) { n = 1; }
    return Math.round(n * 10) / 10;
  }

  function valorComp(cod, i, ex) {
    var exa = examenDe(cod);
    if (exa.reemplaza === i && ex !== null && ex !== undefined) { return Number(ex); }
    var c = compsDe(cod)[i];
    if (!c) { return null; }
    var n = c.nota;
    return (n === null || n === undefined || n === '') ? null : Number(n);
  }

  function promedioCategoria(cod, cat, ex) {
    var comps = compsDe(cod).map(function (c, i) { return { c: c, i: i }; })
      .filter(function (x) { return (x.c.categoria || 'General') === cat.nombre; });
    var sp = 0, sn = 0;
    comps.forEach(function (x) {
      var v = valorComp(cod, x.i, ex);
      if (v === null) { return; }
      sp += (x.c.peso || 1);
      sn += (x.c.peso || 1) * v;
    });
    return sp ? sn / sp : null;
  }

  function presentacion(cod, ex) {
    var sp = 0, sn = 0;
    catsDe(cod).forEach(function (c) {
      var p = promedioCategoria(cod, c, ex);
      if (p === null) { return; }
      sp += Number(c.peso) || 0;
      sn += (Number(c.peso) || 0) * p;
    });
    return sp ? sn / sp : null;
  }

  function cumplenCondicion(cod, c, ex) {
    var v = null;
    if (c.tipo === 'presentacion') { v = presentacion(cod, ex); }
    else if (c.tipo === 'categoria') {
      var cat = catsDe(cod).filter(function (x) { return x.nombre === c.ref; })[0];
      v = cat ? promedioCategoria(cod, cat, ex) : null;
    } else if (c.tipo === 'componente') {
      var i = -1;
      compsDe(cod).forEach(function (x, j) { if (x.nombre === c.ref) { i = j; } });
      v = i >= 0 ? valorComp(cod, i, ex) : null;
    }
    if (v === null) { return { ok: false, actual: null }; }
    var x = Number(c.valor);
    var ok = c.op === '>=' ? v >= x : c.op === '<=' ? v <= x : c.op === '>' ? v > x : v < x;
    return { ok: ok, actual: v };
  }

  function estadoEximicion(cod, ex) {
    var x = eximDe(cod);
    var conds = x.condiciones || [];
    var detalle = conds.map(function (c) {
      var r = cumplenCondicion(cod, c, ex);
      return { tipo: c.tipo, ref: c.ref, op: c.op, valor: c.valor, ok: r.ok, actual: r.actual };
    });
    var sinDatos = detalle.some(function (d) { return d.actual === null; });
    var cumple = false;
    if (x.activa && detalle.length) {
      cumple = x.modo === 'alguna'
        ? detalle.some(function (d) { return d.ok; })
        : detalle.every(function (d) { return d.ok; });
    }
    return { activa: x.activa, modo: x.modo || 'todas', detalle: detalle, cumple: cumple, sinDatos: sinDatos };
  }

  function notaFinal(cod, ex) {
    var P = presentacion(cod, ex);
    if (P === null) { return null; }
    if (estadoEximicion(cod, ex).cumple) { return P; }
    var exa = examenDe(cod);
    if (!exa.activo) { return P; }
    if (ex === null || ex === undefined) { return null; }
    return (1 - Number(exa.peso)) * P + Number(exa.peso) * Number(ex);
  }

  function estadoDe(cod, ex) {
    var P = presentacion(cod, ex);
    if (P === null) { return { texto: 'faltan datos', clase: 'n' }; }
    if (estadoEximicion(cod, ex).cumple) { return { texto: 'eximido', clase: 'ok' }; }
    var exa = examenDe(cod);
    if (exa.activo && (ex === null || ex === undefined)) { return { texto: 'a examen', clase: 'warn' }; }
    var nf = notaFinal(cod, ex);
    if (nf === null) { return { texto: 'a examen', clase: 'warn' }; }
    var redondeada = Mimo.dec1(Mimo.aCent(nf));
    return redondeada >= notaMinimaDe(cod)
      ? { texto: 'aprobado', clase: 'ok' }
      : { texto: 'reprobado', clase: 'bad' };
  }

  function examenPara(cod, objetivo) {
    var f0 = notaFinal(cod, 0), f1 = notaFinal(cod, 1);
    if (f0 === null || f1 === null) { return null; }
    var p = f1 - f0;
    if (Math.abs(p) < 1e-9) { return null; }
    return (objetivo - f0) / p;
  }

  /* -------------------------------------------------------- 3. escritura */
  function ponerNota(cod, i, valor) {
    cod = codigo(cod);
    var c = compsDe(cod)[i];
    if (!c) { return; }
    c.nota = normalizarNota(valor);
    guardar();
  }

  function ponerNotaMinima(cod, valor) {
    cod = codigo(cod);
    var e = Mimo.leer();
    if (!esObjeto(e.estudio)) {
      e.estudio = { minutos: {}, metas: { semanal: 0 }, metas_ramo: {}, metas_semana: {},
                    descartes: {}, notas_otros: {} };
    }
    if (!esObjeto(e.estudio.metas_ramo)) { e.estudio.metas_ramo = {}; }
    var m = esObjeto(e.estudio.metas_ramo[cod]) ? e.estudio.metas_ramo[cod] : {};
    var n = Number(String(valor).replace(',', '.'));
    if (isFinite(n) && n > 0) { m.nota_min = Math.min(7, Math.max(1, Math.round(n * 10) / 10)); }
    else { delete m.nota_min; }
    e.estudio.metas_ramo[cod] = m;
    guardar();
  }

  function ponerAprobado(cod, si) {
    cod = codigo(cod);
    if (si) { estado().estado[cod] = 'aprobado'; } else { delete estado().estado[cod]; }
    guardar();
  }

  return {
    estado: estado,
    guardar: guardar,
    ramos: ramos,
    catsDe: catsDe,
    compsDe: compsDe,
    examenDe: examenDe,
    eximDe: eximDe,
    notaMinimaDe: notaMinimaDe,
    notaMinimaTextos: notaMinimaTextos,
    normalizarNota: normalizarNota,
    valorComp: valorComp,
    promedioCategoria: promedioCategoria,
    presentacion: presentacion,
    cumplenCondicion: cumplenCondicion,
    estadoEximicion: estadoEximicion,
    notaFinal: notaFinal,
    estadoDe: estadoDe,
    examenPara: examenPara,
    ponerNota: ponerNota,
    ponerNotaMinima: ponerNotaMinima,
    ponerAprobado: ponerAprobado
  };
})();

/* ============================================================================
   LA VISTA. Lista-resumen-detalle. La lista calcula la final de todos los ramos
   para que se vea de un golpe quien esta en riesgo; el detalle edita el ramo
   elegido. Todo lo que se escribe pasa por el motor, y el motor guarda.
   ============================================================================ */
var MimoCalificacionesUI = (function () {
  'use strict';

  var Mimo = window.MimoComun;
  var M = window.MimoCalificacionesMotor;
  var iniciado = false;
  var sel = null;             // codigo elegido (transitorio, no se guarda)
  var sim = {};               // codigo -> nota de examen simulada (transitorio)

  function esc(t) { return Mimo.esc(t); }
  function T(clave, params) { return window.MimoI18n.t(clave, params); }
  function rot(clave, params) { return esc(T(clave, params)); }
  function atr(clave) { return ' data-i18n="' + clave + '"'; }
  function atrAria(clave) {
    return ' data-i18n-attr="aria-label:' + clave + '" aria-label="' + rot(clave) + '"';
  }
  function caja() { return document.querySelector('[data-calif="bloque"]'); }
  function nombreRamo(cod) {
    var c = Mimo.CAT()[cod];
    return (c && (c.nombre || c.alias)) || cod;
  }
  function textoEstado(e) {
    var mapa = { 'aprobado': 'calificaciones.aprobado', 'reprobado': 'calificaciones.reprobado',
      'eximido': 'calificaciones.eximido', 'a examen': 'calificaciones.aExamen',
      'faltan datos': 'calificaciones.faltan' };
    return T(mapa[e.texto] || 'calificaciones.faltan');
  }
  /* La marca manual de aprobado manda sobre el calculo, como en la app anterior. */
  function estadoVisible(cod, ex) {
    var e = M.estadoDe(cod, ex);
    if (M.estado().estado[cod] === 'aprobado') { return { texto: 'aprobado', clase: 'ok', manual: true }; }
    return e;
  }
  function notaVisible(cod, ex) {
    if (M.estado().estado[cod] === 'aprobado') {
      return M.presentacion(cod, ex);
    }
    return M.notaFinal(cod, ex);
  }
  function ramoElegido() {
    var ramos = M.ramos();
    if (sel && ramos.indexOf(sel) >= 0) { return sel; }
    return ramos.length ? ramos[0] : null;
  }
  function ver(n) { return Mimo.ver1(n); }

  /* --------------------------------------------------------------- 1. lista */
  function htmlLista() {
    var ramos = M.ramos();
    if (!ramos.length) {
      return '<section class="calif__caja"><p class="calif__pista"' + atr('calificaciones.sinRamos') +
        '>' + rot('calificaciones.sinRamos') + '</p></section>';
    }
    var elegido = ramoElegido();
    var h = '<section class="calif__caja calif__caja--lista"><h3 class="calif__tit"' +
      atr('calificaciones.lista') + '>' + rot('calificaciones.lista') + '</h3>' +
      '<div class="calif__lista">';
    for (var i = 0; i < ramos.length; i++) {
      var cod = ramos[i];
      var nf = notaVisible(cod, null);
      var est = estadoVisible(cod, null);
      h += '<button class="calif__item' + (cod === elegido ? ' calif__item--sel' : '') +
        '" type="button" data-calif-ramo="' + esc(cod) + '" aria-pressed="' +
        (cod === elegido ? 'true' : 'false') + '">' +
        '<span class="calif__item-cod">' + esc(cod) + '</span>' +
        '<span class="calif__item-nom">' + esc(nombreRamo(cod)) + '</span>' +
        '<span class="calif__nota">' + esc(ver(nf)) + '</span>' +
        '<span class="calif__estado calif__estado--' + est.clase + '">' +
        esc(textoEstado(est)) + '</span></button>';
    }
    h += '</div></section>';
    return h;
  }

  /* -------------------------------------------------------------- 2. detalle */
  function htmlResumen(cod) {
    var P = M.presentacion(cod, null);
    var nf = notaVisible(cod, null);
    var est = estadoVisible(cod, null);
    var minima = M.notaMinimaDe(cod);
    return '<div class="calif__cifras" data-detalle="' + esc(cod) + '" data-p="' +
      (P === null ? '' : P.toFixed(4)) + '" data-nf="' +
      (nf === null ? '' : nf.toFixed(4)) + '" data-estado="' + esc(est.texto) + '">' +
      '<div class="kpi"><b class="kpi__cifra">' + esc(ver(P)) + '</b><span class="kpi__rot"' +
      atr('calificaciones.presentacion') + '>' + rot('calificaciones.presentacion') + '</span></div>' +
      '<div class="kpi"><b class="kpi__cifra">' + esc(ver(nf)) + '</b><span class="kpi__rot"' +
      atr('calificaciones.final') + '>' + rot('calificaciones.final') + '</span></div>' +
      '<div class="kpi"><b class="kpi__cifra calif__estado calif__estado--' + est.clase + '">' +
      esc(textoEstado(est)) + '</b><span class="kpi__rot"' + atr('calificaciones.estado') + '>' +
      rot('calificaciones.estado') + '</span></div>' +
      '<div class="kpi"><label class="kpi__rot" for="calif-minima" ' + atr('calificaciones.notaMinima') +
      '>' + rot('calificaciones.notaMinima') + '</label>' +
      '<input id="calif-minima" class="calif__campo calif__campo--num" type="number" min="1" max="7"' +
      ' step="0.1" data-nota-minima value="' + esc(ver(minima)) + '"></div>' +
      '<div class="kpi"><label class="kpi__rot"><input type="checkbox" data-aprobado' +
      (M.estado().estado[cod] === 'aprobado' ? ' checked' : '') + '> ' +
      esc(T('calificaciones.aprobado')) + '</label>' +
      '<span class="kpi__rot">' + esc(T('calificaciones.umbral') + ' ' + ver(minima)) + '</span></div>' +
      '</div>';
  }

  function htmlCategorias(cod) {
    var cats = M.catsDe(cod);
    var h = '<section class="calif__caja"><h3 class="calif__tit"' + atr('calificaciones.categorias') +
      '>' + rot('calificaciones.categorias') + '</h3><table class="calif__tabla"><thead><tr>' +
      '<th' + atr('calificaciones.nombre') + '>' + rot('calificaciones.nombre') + '</th>' +
      '<th' + atr('calificaciones.peso') + '>' + rot('calificaciones.peso') + '</th>' +
      '<th' + atr('calificaciones.promedio') + '>' + rot('calificaciones.promedio') + '</th>' +
      '<th></th></tr></thead><tbody>';
    for (var i = 0; i < cats.length; i++) {
      var p = M.promedioCategoria(cod, cats[i], null);
      h += '<tr><td><input class="calif__campo" type="text" maxlength="40" data-cat-nombre="' + i +
        '" value="' + esc(cats[i].nombre || '') + '"></td>' +
        '<td><input class="calif__campo calif__campo--num" type="number" min="0" step="0.1" data-cat-peso="' +
        i + '" value="' + esc(String(cats[i].peso === undefined ? 1 : cats[i].peso)) + '"></td>' +
        '<td class="calif__num">' + esc(ver(p)) + '</td>' +
        '<td><button class="btn btn--mini" type="button" data-del-cat="' + i + '"' +
        atrAria('calificaciones.categorias') + '>×</button></td></tr>';
    }
    if (!cats.length) {
      h += '<tr><td colspan="4" class="calif__pista"' + atr('calificaciones.sinCategorias') +
        '>' + rot('calificaciones.sinCategorias') + '</td></tr>';
    }
    h += '</tbody></table><button class="btn btn--mini" type="button" data-add-cat="1"' +
      atrAria('calificaciones.agregarCategoria') + '>' + rot('calificaciones.agregarCategoria') +
      '</button></section>';
    return h;
  }

  function opcionesCategorias(cod, actual) {
    var h = '';
    var cats = M.catsDe(cod);
    for (var i = 0; i < cats.length; i++) {
      h += '<option value="' + esc(cats[i].nombre) + '"' +
        (cats[i].nombre === actual ? ' selected' : '') + '>' + esc(cats[i].nombre) + '</option>';
    }
    if (!cats.length) { h += '<option value="General">General</option>'; }
    return h;
  }

  function htmlComponentes(cod) {
    var comps = M.compsDe(cod);
    var h = '<section class="calif__caja"><h3 class="calif__tit"' + atr('calificaciones.componentes') +
      '>' + rot('calificaciones.componentes') + '</h3><table class="calif__tabla"><thead><tr>' +
      '<th' + atr('calificaciones.nombre') + '>' + rot('calificaciones.nombre') + '</th>' +
      '<th' + atr('calificaciones.categoria') + '>' + rot('calificaciones.categoria') + '</th>' +
      '<th' + atr('calificaciones.peso') + '>' + rot('calificaciones.peso') + '</th>' +
      '<th' + atr('calificaciones.nota') + '>' + rot('calificaciones.nota') + '</th>' +
      '<th' + atr('calificaciones.fecha') + '>' + rot('calificaciones.fecha') + '</th>' +
      '<th></th></tr></thead><tbody>';
    for (var i = 0; i < comps.length; i++) {
      var c = comps[i];
      h += '<tr><td><input class="calif__campo" type="text" maxlength="40" data-comp-nombre="' + i +
        '" value="' + esc(c.nombre || '') + '"></td>' +
        '<td><select class="calif__campo" data-comp-cat="' + i + '">' +
        opcionesCategorias(cod, c.categoria || 'General') + '</select></td>' +
        '<td><input class="calif__campo calif__campo--num" type="number" min="0" step="0.1" data-comp-peso="' +
        i + '" value="' + esc(String(c.peso === undefined ? 1 : c.peso)) + '"></td>' +
        '<td><input class="calif__campo calif__campo--num" type="text" maxlength="5" data-comp-nota="' +
        i + '" value="' + esc(c.nota === null || c.nota === undefined ? '' : String(c.nota)) + '"></td>' +
        '<td><input class="calif__campo" type="date" data-comp-fecha="' + i + '" value="' +
        esc(c.fecha || '') + '"></td>' +
        '<td><button class="btn btn--mini" type="button" data-del-comp="' + i + '"' +
        atrAria('calificaciones.componentes') + '>×</button></td></tr>';
    }
    if (!comps.length) {
      h += '<tr><td colspan="6" class="calif__pista"' + atr('calificaciones.sinComponentes') +
        '>' + rot('calificaciones.sinComponentes') + '</td></tr>';
    }
    h += '</tbody></table><button class="btn btn--mini" type="button" data-add-comp="1"' +
      atrAria('calificaciones.agregarComponente') + '>' + rot('calificaciones.agregarComponente') +
      '</button></section>';
    return h;
  }

  function htmlExamen(cod) {
    var e = M.examenDe(cod);
    var comps = M.compsDe(cod);
    var h = '<section class="calif__caja"><h3 class="calif__tit"' + atr('calificaciones.examen') +
      '>' + rot('calificaciones.examen') + '</h3>' +
      '<p><label><input type="checkbox" data-examen-activo' + (e.activo ? ' checked' : '') + '> ' +
      '<span' + atr('calificaciones.examenActivo') + '>' + rot('calificaciones.examenActivo') +
      '</span></label></p><p class="calif__fila">' +
      '<label class="calif__campo-rot"><span' + atr('calificaciones.pesoExamen') + '>' +
      rot('calificaciones.pesoExamen') + '</span> ' +
      '<input class="calif__campo calif__campo--num" type="number" min="0" max="100" step="1"' +
      ' data-examen-peso value="' + esc(String(Math.round(Number(e.peso) * 100))) + '"></label> ' +
      '<label class="calif__campo-rot"><span' + atr('calificaciones.reemplaza') + '>' +
      rot('calificaciones.reemplaza') + '</span> <select class="calif__campo" data-examen-reemplaza>' +
      '<option value=""' + (e.reemplaza === null || e.reemplaza === undefined ? ' selected' : '') +
      '>' + rot('calificaciones.noReemplaza') + '</option>';
    for (var i = 0; i < comps.length; i++) {
      h += '<option value="' + i + '"' + (Number(e.reemplaza) === i ? ' selected' : '') + '>' +
        esc(comps[i].nombre || ('#' + (i + 1))) + '</option>';
    }
    h += '</select></label></p>';

    var simEx = sim[cod];
    var nec = M.examenPara(cod, M.notaMinimaDe(cod));
    var conSim = (simEx === undefined || simEx === null) ? null : M.notaFinal(cod, simEx);
    var estSim = (simEx === undefined || simEx === null) ? null : M.estadoDe(cod, simEx);
    h += '<div class="calif__sim" data-sim="' + esc(cod) + '" data-sim-nec="' +
      (nec === null ? '' : nec.toFixed(4)) + '" data-sim-nf="' +
      (conSim === null ? '' : conSim.toFixed(4)) + '">' +
      '<h4 class="calif__tit"' + atr('calificaciones.simulador') + '>' + rot('calificaciones.simulador') +
      '</h4><p class="calif__fila"><label class="calif__campo-rot"><span' +
      atr('calificaciones.simulacro') + '>' + rot('calificaciones.simulacro') + '</span> ' +
      '<input class="calif__campo calif__campo--num" type="number" min="1" max="7" step="0.1"' +
      ' data-sim-ex value="' + esc(simEx === undefined || simEx === null ? '' : String(simEx)) +
      '"></label></p>' +
      '<p class="calif__pista" data-sim-nec-txt>' +
      (nec === null ? rot('calificaciones.faltanNotas')
        : rot('calificaciones.necesitas') + ' ' + esc(ver(nec))) + '</p>' +
      '<p class="calif__pista" data-sim-nf-txt>' +
      (conSim === null ? rot('calificaciones.sinNota')
        : rot('calificaciones.conExamen') + ' ' + esc(ver(conSim)) +
          (estSim ? ' · ' + esc(textoEstado(estSim)) : '')) + '</p></div>';

    h += '</section>';
    return h;
  }

  function opcionesRef(cod, tipo, actual) {
    var h = '';
    if (tipo === 'categoria') {
      var cats = M.catsDe(cod);
      for (var i = 0; i < cats.length; i++) {
        h += '<option value="' + esc(cats[i].nombre) + '"' +
          (cats[i].nombre === actual ? ' selected' : '') + '>' + esc(cats[i].nombre) + '</option>';
      }
    } else if (tipo === 'componente') {
      var comps = M.compsDe(cod);
      for (var j = 0; j < comps.length; j++) {
        h += '<option value="' + esc(comps[j].nombre) + '"' +
          (comps[j].nombre === actual ? ' selected' : '') + '>' + esc(comps[j].nombre) + '</option>';
      }
    }
    return h;
  }

  function htmlEximicion(cod) {
    var x = M.eximDe(cod);
    var det = M.estadoEximicion(cod, null);
    var h = '<section class="calif__caja"><h3 class="calif__tit"' + atr('calificaciones.eximicion') +
      '>' + rot('calificaciones.eximicion') + '</h3>' +
      '<p><label><input type="checkbox" data-exim-activa' + (x.activa ? ' checked' : '') + '> ' +
      '<span' + atr('calificaciones.activa') + '>' + rot('calificaciones.activa') + '</span></label> ' +
      '<label class="calif__campo-rot"><span' + atr('calificaciones.modo') + '>' +
      rot('calificaciones.modo') + '</span> <select class="calif__campo" data-exim-modo>' +
      '<option value="todas"' + ((x.modo || 'todas') === 'todas' ? ' selected' : '') + '>' +
      rot('calificaciones.todas') + '</option><option value="alguna"' +
      ((x.modo || 'todas') === 'alguna' ? ' selected' : '') + '>' + rot('calificaciones.alguna') +
      '</option></select></label></p>';

    var conds = x.condiciones || [];
    h += '<table class="calif__tabla"><thead><tr><th>' + rot('calificaciones.categoria') +
      '</th><th></th><th>' + rot('calificaciones.umbral') + '</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < conds.length; i++) {
      var c = conds[i];
      var d = det.detalle[i];
      h += '<tr><td><select class="calif__campo" data-cond-tipo="' + i + '">' +
        '<option value="presentacion"' + (c.tipo === 'presentacion' ? ' selected' : '') + '>' +
        rot('calificaciones.presentacion') + '</option>' +
        '<option value="categoria"' + (c.tipo === 'categoria' ? ' selected' : '') + '>' +
        rot('calificaciones.categoria') + '</option>' +
        '<option value="componente"' + (c.tipo === 'componente' ? ' selected' : '') + '>' +
        rot('calificaciones.nota') + '</option></select> ' +
        '<select class="calif__campo" data-cond-ref="' + i + '">' +
        opcionesRef(cod, c.tipo, c.ref) + '</select></td>' +
        '<td><select class="calif__campo" data-cond-op="' + i + '">' +
        ['>=', '>', '<=', '<'].map(function (op) {
          return '<option value="' + op + '"' + (c.op === op ? ' selected' : '') + '>' + op + '</option>';
        }).join('') + '</select></td>' +
        '<td><input class="calif__campo calif__campo--num" type="number" min="1" max="7" step="0.1"' +
        ' data-cond-valor="' + i + '" value="' + esc(String(c.valor)) + '"> ' +
        '<span class="calif__pista">' + esc(d && d.actual !== null ? ver(d.actual) : T('calificaciones.sinDatosCond')) +
        '</span></td>' +
        '<td><button class="btn btn--mini" type="button" data-del-cond="' + i + '"' +
        atrAria('calificaciones.eximicion') + '>×</button></td></tr>';
    }
    if (!conds.length) {
      h += '<tr><td colspan="4" class="calif__pista"' + atr('calificaciones.sinCondiciones') +
        '>' + rot('calificaciones.sinCondiciones') + '</td></tr>';
    }
    h += '</tbody></table><button class="btn btn--mini" type="button" data-add-cond="1"' +
      atrAria('calificaciones.agregarCondicion') + '>' + rot('calificaciones.agregarCondicion') +
      '</button><p class="calif__pista">' +
      (x.activa && conds.length
        ? esc(det.cumple ? T('calificaciones.cumple') : T('calificaciones.noCumple'))
        : '') + '</p></section>';
    return h;
  }

  function htmlDetalle() {
    var cod = ramoElegido();
    if (!cod) { return ''; }
    return '<section class="calif__detalle" data-calif-detalle="' + esc(cod) + '">' +
      '<h2 class="calif__ramo"><span class="calif__ramo-cod">' + esc(cod) + '</span> ' +
      esc(nombreRamo(cod)) + '</h2>' +
      htmlResumen(cod) + htmlCategorias(cod) + htmlComponentes(cod) +
      htmlExamen(cod) + htmlEximicion(cod) + '</section>';
  }

  function pintar() {
    var c = caja();
    if (!c) { return; }
    if (!M.ramos().length) {
      c.innerHTML = '<p class="calif__pista"' + atr('calificaciones.sinRamos') + '>' +
        rot('calificaciones.sinRamos') + '</p>';
      return;
    }
    c.innerHTML = htmlLista() + htmlDetalle();
  }

  /* -------------------------------------------------------------- 3. eventos */
  function dentro(el) { return el && el.closest && el.closest('[data-calif="bloque"]'); }
  function componenteActual() {
    var d = caja() && caja().querySelector('[data-calif-detalle]');
    return d ? d.getAttribute('data-calif-detalle') : ramoElegido();
  }

  function iniciar() {
    if (iniciado) { return; }
    iniciado = true;

    document.addEventListener('click', function (ev) {
      var el = ev.target;
      if (!dentro(el)) { return; }
      var ir = el.closest('[data-calif-ramo]');
      if (ir) { sel = ir.getAttribute('data-calif-ramo'); pintar(); return; }
      var cod = componenteActual();
      if (!cod) { return; }

      var addCat = el.closest('[data-add-cat]');
      if (addCat) {
        M.catsDe(cod).push({ nombre: T('calificaciones.categoria') + ' ' + (M.catsDe(cod).length + 1), peso: 1 });
        M.guardar(); pintar(); return;
      }
      var delCat = el.closest('[data-del-cat]');
      if (delCat) {
        M.catsDe(cod).splice(Number(delCat.getAttribute('data-del-cat')), 1);
        M.guardar(); pintar(); return;
      }
      var addComp = el.closest('[data-add-comp]');
      if (addComp) {
        var cats = M.catsDe(cod);
        M.compsDe(cod).push({
          nombre: T('calificaciones.categoria') + ' ' + (M.compsDe(cod).length + 1),
          categoria: cats.length ? cats[0].nombre : 'General', peso: 1, nota: null, fecha: null
        });
        M.guardar(); pintar(); return;
      }
      var delComp = el.closest('[data-del-comp]');
      if (delComp) {
        M.compsDe(cod).splice(Number(delComp.getAttribute('data-del-comp')), 1);
        M.guardar(); pintar(); return;
      }
      var addCond = el.closest('[data-add-cond]');
      if (addCond) {
        var cats2 = M.catsDe(cod);
        M.eximDe(cod).condiciones.push({
          tipo: cats2.length ? 'categoria' : 'presentacion',
          ref: cats2.length ? cats2[0].nombre : null, op: '>=', valor: 5
        });
        M.guardar(); pintar(); return;
      }
      var delCond = el.closest('[data-del-cond]');
      if (delCond) {
        M.eximDe(cod).condiciones.splice(Number(delCond.getAttribute('data-del-cond')), 1);
        M.guardar(); pintar(); return;
      }
    });

    document.addEventListener('change', function (ev) {
      var el = ev.target;
      if (!dentro(el)) { return; }
      var cod = componenteActual();
      if (!cod) { return; }
      var i;

      if (el.hasAttribute('data-nota-minima')) { M.ponerNotaMinima(cod, el.value); pintar(); return; }
      if (el.hasAttribute('data-aprobado')) { M.ponerAprobado(cod, el.checked); pintar(); return; }
      if (el.hasAttribute('data-cat-nombre')) {
        i = Number(el.getAttribute('data-cat-nombre')); M.catsDe(cod)[i].nombre = el.value; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-cat-peso')) {
        i = Number(el.getAttribute('data-cat-peso'));
        M.catsDe(cod)[i].peso = Math.max(0, Number(el.value) || 0); M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-comp-nombre')) {
        i = Number(el.getAttribute('data-comp-nombre')); M.compsDe(cod)[i].nombre = el.value; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-comp-cat')) {
        i = Number(el.getAttribute('data-comp-cat')); M.compsDe(cod)[i].categoria = el.value; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-comp-peso')) {
        i = Number(el.getAttribute('data-comp-peso'));
        M.compsDe(cod)[i].peso = Math.max(0, Number(el.value) || 0); M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-comp-nota')) {
        i = Number(el.getAttribute('data-comp-nota')); M.ponerNota(cod, i, el.value); pintar(); return;
      }
      if (el.hasAttribute('data-comp-fecha')) {
        i = Number(el.getAttribute('data-comp-fecha')); M.compsDe(cod)[i].fecha = el.value || null; M.guardar(); return;
      }
      if (el.hasAttribute('data-examen-activo')) {
        M.examenDe(cod).activo = !!el.checked; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-examen-peso')) {
        var p = Number(el.value);
        M.examenDe(cod).peso = Math.min(1, Math.max(0, (isFinite(p) ? p : 40) / 100));
        M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-examen-reemplaza')) {
        M.examenDe(cod).reemplaza = el.value === '' ? null : Number(el.value);
        M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-exim-activa')) {
        M.eximDe(cod).activa = !!el.checked; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-exim-modo')) {
        M.eximDe(cod).modo = el.value === 'alguna' ? 'alguna' : 'todas';
        M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-cond-tipo')) {
        i = Number(el.getAttribute('data-cond-tipo'));
        var c = M.eximDe(cod).condiciones[i];
        c.tipo = el.value;
        c.ref = el.value === 'presentacion' ? null
          : (el.value === 'categoria'
            ? (M.catsDe(cod)[0] || {}).nombre || null
            : (M.compsDe(cod)[0] || {}).nombre || null);
        M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-cond-ref')) {
        i = Number(el.getAttribute('data-cond-ref'));
        M.eximDe(cod).condiciones[i].ref = el.value; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-cond-op')) {
        i = Number(el.getAttribute('data-cond-op'));
        M.eximDe(cod).condiciones[i].op = el.value; M.guardar(); pintar(); return;
      }
      if (el.hasAttribute('data-cond-valor')) {
        i = Number(el.getAttribute('data-cond-valor'));
        M.eximDe(cod).condiciones[i].valor = Number(el.value) || 0; M.guardar(); pintar(); return;
      }
    });

    /* El simulador se siente vivo: al mover la nota no se repinta la vista
       entera (perderia el foco), solo el bloque del simulador. */
    document.addEventListener('input', function (ev) {
      var el = ev.target;
      if (!dentro(el) || !el.hasAttribute('data-sim-ex')) { return; }
      var cod = componenteActual();
      if (!cod) { return; }
      var v = Number(el.value);
      sim[cod] = (el.value === '' || !isFinite(v)) ? null : Math.min(7, Math.max(1, v));
      var nec = M.examenPara(cod, M.notaMinimaDe(cod));
      var nf = sim[cod] === null ? null : M.notaFinal(cod, sim[cod]);
      var est = sim[cod] === null ? null : M.estadoDe(cod, sim[cod]);
      var bloque = caja() && caja().querySelector('[data-sim]');
      if (!bloque) { return; }
      bloque.setAttribute('data-sim-nec', nec === null ? '' : nec.toFixed(4));
      bloque.setAttribute('data-sim-nf', nf === null ? '' : nf.toFixed(4));
      var t1 = bloque.querySelector('[data-sim-nec-txt]');
      var t2 = bloque.querySelector('[data-sim-nf-txt]');
      if (t1) {
        t1.textContent = nec === null ? T('calificaciones.faltanNotas')
          : T('calificaciones.necesitas') + ' ' + ver(nec);
      }
      if (t2) {
        t2.textContent = nf === null ? T('calificaciones.sinNota')
          : T('calificaciones.conExamen') + ' ' + ver(nf) + (est ? ' · ' + textoEstado(est) : '');
      }
    });
  }

  return { iniciar: iniciar, pintar: pintar };
})();
