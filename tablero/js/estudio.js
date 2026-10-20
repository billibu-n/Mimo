/* ============================================================================
   estudio.js — Mimo Nuevo · bloque ESTUDIO (T005)

   QUE HACE
   Porta el estudio de la app anterior (`referencia/mimo-app-53cc22d/js/estudio/01-estudio.js`)
   al armazon nuevo, sobre el sustrato de T003 y el catalogo de T004:
     - barras de horas por ramo y semana contra su meta;
     - meta base semanal editable y meta PROPIA por semana, que manda sobre la base;
     - KPIs del semestre (total, promedio de las semanas con registro, semanas
       sobre su meta, objetivo semanal y lo que queda sin repartir);
     - aviso de «te queda poco tiempo» por ramo, con descartar o sumar tiempo;
     - grafico de puntos de horas por semana con la linea de objetivo.

   LO QUE NO SE PORTA (y por que)
   - El importador del Excel y los semestres con nombre: en el armazon nuevo no
     hay archivo de datos (T003 lo retiro). El semestre es una ventana de 16
     semanas que termina en la semana en curso; las horas se escriben a mano.
   - `usarMetaMaxima` (meta = maximo historico): es un ajuste de Ajustes (T009).
     Aqui la meta base es siempre el numero que se escribe.
   - Los formatos de hora elegibles (`FORMATOS_HORA`): tambien son de Ajustes.
     `fmtHM` devuelve el formato de fabrica "2h 30m".
   - El color por ramo guardado (`E.colores`): el namespace del estudio no lo
     declara el contrato; el color se deriva del codigo y es estable.

   EL MOTOR NO TOCA EL DOM. `MimoEstudioMotor` solo lee y escribe el estado a
   traves de `MimoComun.leer()`/`guardar()`, y todas sus cuentas son funciones
   puras sobre lo que se le pasa. `MimoEstudioUI` es la que pinta. Es el mismo
   corte que `tiempo.js` y `malla.js`: el instrumento puede probar el motor sin
   abrir una vista.

   API DEL MOTOR (`window.MimoEstudioMotor`)
     estado()                      E.estudio vivo, con su forma garantizada
     guardar([aviso])              escribe el almacen unico
     semanas()                     16 semanas: [{lunes, numero, actual}]
     minutosDe(lunes)              minutos por ramo + OTROS ya descontado
     horasAsignadas(lunes)         horas repartidas entre ramos
     horasSemana(lunes)            TODO lo registrado (repartido + sin repartir)
     sinRepartir([lunes])          horas registradas que aun no tienen ramo
     metaBase()                    meta base semanal, en horas
     metaDe(lunes)                 la propia si existe; si no, la base
     tieneMetaPropia(lunes)        si esa semana lleva meta propia
     objetivoSemanal()             suma de las metas por ramo, en horas
     kpis()                        {total, promedio, sobre, registradas,
                                    sinRepartir, objetivo, propias}
     dedicacion()                  ramos por debajo de media meta esta semana
     prioridad()                   [{cod, abre}] por `ramosQueAbre`
     sumarTiempo(lunes, cod, min)  suma minutos a un ramo (y guarda)
     descartar(lunes, cod)         el aviso de ese ramo no se repite (y guarda)
     ponerMinutos(lunes, cod, min) fija los minutos de un ramo (y guarda)
     ponerSinRepartir(lunes, min)  fija lo registrado sin repartir (y guarda)
     ponerMetaBase(horas)          fija la meta base (y guarda)
     ponerMetaSemana(lunes, h)     fija la meta propia; 0 la borra (y guarda)
     ponerMetaRamo(cod, horas)     fija la meta semanal de un ramo (y guarda)
     ponerNota(lunes, texto)       nota libre de la semana (y guarda)
     fmtHM(min) / parseHM(txt)     "150" <-> "2h 30m"
     colorDe(cod)                  color estable, de los tokens del armazon

   API DE LA VISTA (`window.MimoEstudioUI`)
     iniciar()                     engancha los eventos UNA vez (delegado)
     pintar()                      repinta si el bloque esta instalado
   ============================================================================ */
var MimoEstudioMotor = (function () {
  'use strict';

  var Mimo = window.MimoComun;
  var SEMANAS = 16;
  var ALTO_BARRAS = 140;                  // px utiles de una barra; lo usa la vista
  var PALETA = ['var(--acento)', 'var(--fuerte)', 'var(--muted)'];

  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function numero(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : (def === undefined ? 0 : def);
  }
  function minutosDeValor(v) {
    var n = Number(v);
    return (isFinite(n) && n > 0) ? Math.round(n) : 0;
  }
  function codigo(v) {
    return String(v === undefined || v === null ? '' : v).replace(/^\s+|\s+$/g, '').toUpperCase();
  }
  function catalogo() { return Mimo.CAT(); }
  function codigos() {
    var c = catalogo();
    return Object.keys(c).filter(function (k) { return c[k] && c[k].en_malla !== false; });
  }

  /* El estado se garantiza en un solo sitio. Si el almacen trae la rama a
     medias (un respaldo viejo, una mutacion a mano), no se adivina: se rellena
     vacio. No se toca `ajustes`: los espejos estan prohibidos. */
  function estado() {
    var e = Mimo.leer().estudio;
    if (!esObjeto(e)) {
      e = { minutos: {}, metas: { semanal: 0 }, metas_ramo: {}, metas_semana: {},
            descartes: {}, notas_otros: {} };
      Mimo.leer().estudio = e;
    }
    if (!esObjeto(e.minutos)) { e.minutos = {}; }
    if (!esObjeto(e.metas)) { e.metas = { semanal: 0 }; }
    if (!esObjeto(e.metas_ramo)) { e.metas_ramo = {}; }
    if (!esObjeto(e.metas_semana)) { e.metas_semana = {}; }
    if (!esObjeto(e.descartes)) { e.descartes = {}; }
    if (!esObjeto(e.notas_otros)) { e.notas_otros = {}; }
    return e;
  }

  function guardar(aviso) { Mimo.guardar(aviso); }

  /* --------------------------------------------------------------- 1. semanas */
  function lunesDe(iso) {
    var d = Mimo.aFecha(iso);
    var atras = (d.getDay() + 6) % 7;          // 0 = lunes ... 6 = domingo
    return Mimo.sumaDias(iso, -atras);
  }

  /* Ventana del semestre: 16 semanas, la ultima es la que contiene hoy. No
     depende de ningun archivo: la misma fecha da siempre las mismas semanas. */
  function semanas() {
    var l = lunesDe(Mimo.hoy());
    var out = [];
    for (var i = SEMANAS - 1; i >= 0; i--) {
      var n = SEMANAS - i;
      out.push({ lunes: Mimo.sumaDias(l, -7 * i), numero: n, actual: i === 0 });
    }
    return out;
  }

  /* ------------------------------------------------------------- 2. minutos */
  /* `OTROS` guarda lo REGISTRADO sin ramo. Al leer se descuenta lo repartido:
     si repartes mas de lo registrado, el resto queda en 0 y la semana crece con
     lo real (misma regla que la app anterior). */
  function minutosDe(lunes) {
    var m = estado().minutos[lunes];
    m = esObjeto(m) ? m : {};
    var out = {};
    var repartido = 0;
    Object.keys(m).forEach(function (k) { out[k] = minutosDeValor(m[k]); });
    codigos().forEach(function (c) { repartido += minutosDeValor(m[c]); });
    out.OTROS = Math.max(0, minutosDeValor(m.OTROS) - repartido);
    return out;
  }

  function horasAsignadas(lunes) {
    var m = minutosDe(lunes);
    var t = 0;
    codigos().forEach(function (c) { t += minutosDeValor(m[c]); });
    return t / 60;
  }

  function sinRepartir(lunes) {
    if (lunes) { return minutosDeValor(minutosDe(lunes).OTROS) / 60; }
    return semanas().reduce(function (a, w) {
      return a + minutosDeValor(minutosDe(w.lunes).OTROS);
    }, 0) / 60;
  }

  function horasSemana(lunes) {
    return horasAsignadas(lunes) + sinRepartir(lunes);
  }

  function totalHoras() {
    return semanas().reduce(function (a, w) { return a + horasSemana(w.lunes); }, 0);
  }

  /* ----------------------------------------------------------------- 3. metas */
  function metaBase() { return numero(estado().metas.semanal, 0); }
  function metasPropias() { return estado().metas_semana; }
  function tieneMetaPropia(lunes) {
    return numero(metasPropias()[lunes], 0) > 0;
  }
  function metaDe(lunes) {
    var propia = numero(metasPropias()[lunes], 0);
    return propia > 0 ? propia : metaBase();
  }
  function objetivoSemanal() {
    var m = estado().metas_ramo;
    return codigos().reduce(function (a, c) {
      return a + numero((m[c] || {}).horas, 0);
    }, 0);
  }

  /* ------------------------------------------------------------------ 4. KPIs */
  function kpis() {
    var total = 0, suma = 0, registradas = 0, sobre = 0, propias = 0, sin = 0;
    var ws = semanas();
    for (var i = 0; i < ws.length; i++) {
      var l = ws[i].lunes;
      var h = horasSemana(l);
      var meta = metaDe(l);
      total += h;
      sin += sinRepartir(l);
      if (h > 0) { registradas++; suma += h; }
      if (meta > 0 && h > meta) { sobre++; }
      if (tieneMetaPropia(l)) { propias++; }
    }
    return {
      total: total,
      promedio: registradas ? suma / registradas : 0,
      sobre: sobre,
      registradas: registradas,
      sinRepartir: sin,
      objetivo: objetivoSemanal(),
      propias: propias
    };
  }

  /* ------------------------------------------------------ 5. dedicacion corta */
  /* Un ramo esta corto cuando lleva menos de la MITAD de su meta semanal y su
     meta es mayor que cero. El descarte es por semana: la que viene vuelve a
     avisar, que es lo que se quiere. */
  function dedicacion() {
    var ws = semanas();
    var l = ws[ws.length - 1].lunes;
    var m = minutosDe(l);
    var metas = estado().metas_ramo;
    var desc = estado().descartes[l] || {};
    var cat = catalogo();
    var out = [];
    codigos().forEach(function (c) {
      var meta = numero((metas[c] || {}).horas, 0);
      if (meta <= 0 || desc[c]) { return; }
      var min = minutosDeValor(m[c]);
      if (min >= meta * 60 / 2) { return; }
      out.push({
        cod: c,
        nombre: (cat[c] && (cat[c].nombre || cat[c].alias)) || c,
        llevo: min / 60,
        meta: meta
      });
    });
    return out;
  }

  /* Prioridad de percepcion: cuantos ramos abre cada uno (T003 dejo el gancho
     `ramosQueAbre` sin portar y T005 lo trae). Devuelve los que abren algo. */
  function prioridad() {
    var out = [];
    codigos().forEach(function (c) {
      var n = (typeof Mimo.ramosQueAbre === 'function') ? Mimo.ramosQueAbre(c) : 0;
      if (n > 0) { out.push({ cod: c, abre: n }); }
    });
    out.sort(function (a, b) { return b.abre - a.abre || (a.cod < b.cod ? -1 : 1); });
    return out;
  }

  /* -------------------------------------------------------------- 6. escritura */
  function cajaMinutos(lunes) {
    var e = estado();
    if (!esObjeto(e.minutos[lunes])) { e.minutos[lunes] = {}; }
    return e.minutos[lunes];
  }

  function ponerMinutos(lunes, cod, min) {
    cod = codigo(cod);
    if (!cod) { return; }
    var caja = cajaMinutos(lunes);
    min = minutosDeValor(min);
    if (min > 0) { caja[cod] = min; } else { delete caja[cod]; }
    guardar();
  }

  function ponerSinRepartir(lunes, min) {
    var caja = cajaMinutos(lunes);
    var repartido = 0;
    codigos().forEach(function (c) { repartido += minutosDeValor(caja[c]); });
    var total = repartido + minutosDeValor(min);
    if (total > 0) { caja.OTROS = total; } else { delete caja.OTROS; }
    guardar();
  }

  function sumarTiempo(lunes, cod, min) {
    cod = codigo(cod);
    min = minutosDeValor(min);
    if (!cod || !min) { return 0; }
    var caja = cajaMinutos(lunes);
    caja[cod] = minutosDeValor(caja[cod]) + min;
    guardar();
    return caja[cod];
  }

  function descartar(lunes, cod) {
    cod = codigo(cod);
    var e = estado();
    if (!esObjeto(e.descartes[lunes])) { e.descartes[lunes] = {}; }
    if (cod) { e.descartes[lunes][cod] = true; }
    guardar();
  }

  function ponerMetaBase(horas) {
    estado().metas.semanal = Math.max(0, numero(horas, 0));
    guardar();
  }

  function ponerMetaSemana(lunes, horas) {
    var e = estado();
    var h = Math.max(0, numero(horas, 0));
    if (h > 0) { e.metas_semana[lunes] = h; } else { delete e.metas_semana[lunes]; }
    guardar();
  }

  function ponerMetaRamo(cod, horas) {
    cod = codigo(cod);
    if (!cod) { return; }
    var e = estado();
    var prev = esObjeto(e.metas_ramo[cod]) ? e.metas_ramo[cod] : {};
    var h = Math.max(0, numero(horas, 0));
    prev.horas = h;
    e.metas_ramo[cod] = prev;              // conserva `nota_min`, que es de Calificaciones
    guardar();
  }

  function ponerNota(lunes, texto) {
    var e = estado();
    texto = String(texto === undefined || texto === null ? '' : texto);
    if (texto) { e.notas_otros[lunes] = texto; } else { delete e.notas_otros[lunes]; }
    guardar();
  }

  /* ------------------------------------------------------------ 7. formato */
  /* "2h 30m". El cero devuelve cadena vacia: en una casilla, "0m" es ruido. */
  function fmtHM(min) {
    min = Math.round(numero(min, 0));
    if (!min) { return ''; }
    var h = Math.floor(min / 60), m = min % 60;
    return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '');
  }

  /* Lo inverso: "2h 15m", "2h15", "45m", "2h" o un numero suelto (en horas). */
  function parseHM(txt) {
    var s = String(txt === undefined || txt === null ? '' : txt)
      .trim().toLowerCase().replace(/[ ,]/g, '');
    if (!s) { return 0; }
    var reloj = s.match(/^(\d+)[:'](\d{1,2})$/);
    if (reloj) {
      return Math.max(0, Math.round(parseInt(reloj[1], 10) * 60 + parseInt(reloj[2], 10)));
    }
    var min = 0, algo = false;
    var mh = s.match(/(\d+(?:\.\d+)?)h/);
    if (mh) { min += parseFloat(mh[1]) * 60; algo = true; }
    var mm = s.match(/(\d+(?:\.\d+)?)m/);
    if (mm) { min += parseFloat(mm[1]); algo = true; }
    if (!algo) { var n = parseFloat(s); if (!isNaN(n)) { min = n * 60; } }
    return Math.max(0, Math.round(min));
  }

  function horasTexto(horas) { return fmtHM(Math.round(numero(horas, 0) * 60)) || '0m'; }

  function decimal(horas) {
    return (Math.round(numero(horas, 0) * 10) / 10).toFixed(1).replace('.', ',');
  }

  /* Color estable por codigo, de la paleta de tokens del armazon: no se guarda
     (el namespace del estudio no declara colores) y no cambia entre recargas. */
  function colorDe(cod) {
    var s = codigo(cod), h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 997; }
    return PALETA[h % PALETA.length];
  }

  return {
    SEMANAS: SEMANAS,
    ALTO_BARRAS: ALTO_BARRAS,
    estado: estado,
    guardar: guardar,
    semanas: semanas,
    minutosDe: minutosDe,
    horasAsignadas: horasAsignadas,
    horasSemana: horasSemana,
    sinRepartir: sinRepartir,
    totalHoras: totalHoras,
    metaBase: metaBase,
    metasPropias: metasPropias,
    metaDe: metaDe,
    tieneMetaPropia: tieneMetaPropia,
    objetivoSemanal: objetivoSemanal,
    kpis: kpis,
    dedicacion: dedicacion,
    prioridad: prioridad,
    sumarTiempo: sumarTiempo,
    descartar: descartar,
    ponerMinutos: ponerMinutos,
    ponerSinRepartir: ponerSinRepartir,
    ponerMetaBase: ponerMetaBase,
    ponerMetaSemana: ponerMetaSemana,
    ponerMetaRamo: ponerMetaRamo,
    ponerNota: ponerNota,
    fmtHM: fmtHM,
    parseHM: parseHM,
    horasTexto: horasTexto,
    decimal: decimal,
    colorDe: colorDe
  };
})();

/* ============================================================================
   LA VISTA. Pinta dentro de `[data-estudio="bloque"]`, que la crea el armazon
   desde `cuerpoDe()`. No rehace la estetica: usa las clases `.estudio__*` y los
   tokens que declara armazon-paneles.html. Un solo listener delegado en el
   documento para todos los controles: la vista se repinta entera y los nodos
   viejos no dejan escuchas colgadas.
   ============================================================================ */
var MimoEstudioUI = (function () {
  'use strict';

  var Mimo = window.MimoComun;
  var M = window.MimoEstudioMotor;
  var iniciado = false;
  var sumando = null;                     // {lunes, cod}: fila con el campo abierto

  function esc(t) { return Mimo.esc(t); }
  function T(clave, params) { return window.MimoI18n.t(clave, params); }
  function rot(clave, params) { return esc(T(clave, params)); }
  function atr(clave) { return ' data-i18n="' + clave + '"'; }
  function atrAria(clave) {
    return ' data-i18n-attr="aria-label:' + clave + '" aria-label="' + rot(clave) + '"';
  }
  function caja() { return document.querySelector('[data-estudio="bloque"]'); }

  function nombreRamo(cod) {
    var c = Mimo.CAT()[cod];
    return (c && (c.nombre || c.alias)) || cod;
  }

  /* ------------------------------------------------------------- 1. los KPIs */
  function htmlKpis() {
    var k = M.kpis();
    var filas = [
      ['estudio.total', M.horasTexto(k.total)],
      ['estudio.promedio', M.decimal(k.promedio) + ' h'],
      ['estudio.sobreMeta', k.sobre + ' / ' + M.SEMANAS],
      ['estudio.objetivo', M.horasTexto(k.objetivo)],
      ['estudio.sinRepartir', M.horasTexto(k.sinRepartir)]
    ];
    var h = '<div class="estudio__kpis" data-estudio="kpis">';
    for (var i = 0; i < filas.length; i++) {
      h += '<div class="kpi"><b class="kpi__cifra">' + esc(filas[i][1]) + '</b>' +
        '<span class="kpi__rot"' + atr(filas[i][0]) + '>' + rot(filas[i][0]) + '</span></div>';
    }
    h += '</div>';
    h += '<p class="estudio__meta">' +
      '<label class="estudio__campo-rot"><span' + atr('estudio.metaBase') + '>' +
      rot('estudio.metaBase') + '</span> ' +
      '<input class="estudio__campo estudio__campo--num" type="number" min="0" step="0.5"' +
      ' data-meta-base value="' + esc(String(M.metaBase())) + '"></label>' +
      '<span class="estudio__pista"' + atr('estudio.semanas') + '>' +
      rot('estudio.semanas', { n: k.registradas }) + '</span></p>';
    return h;
  }

  /* ---------------------------------------------------------- 2. las barras */
  function htmlBarras() {
    var ws = M.semanas();
    var cods = Object.keys(Mimo.CAT()).filter(function (c) {
      return Mimo.CAT()[c] && Mimo.CAT()[c].en_malla !== false;
    });
    var totales = ws.map(function (w) { return M.horasAsignadas(w.lunes); });
    var metas = ws.map(function (w) { return M.metaDe(w.lunes); });
    var tope = Math.max.apply(null, [M.metaBase()].concat(metas).concat(totales).concat([1])) * 1.12;
    var algo = Math.max.apply(null, totales.concat([0])) > 0;

    var h = '<section class="estudio__panel" data-estudio="panel-barras">' +
      '<h3 class="estudio__tit"' + atr('estudio.barras') + '>' + rot('estudio.barras') + '</h3>';

    h += '<div class="estudio__leyenda">';
    for (var i = 0; i < cods.length; i++) {
      var horasRamo = ws.reduce(function (a, w) {
        return a + (Number(M.minutosDe(w.lunes)[cods[i]]) || 0);
      }, 0) / 60;
      h += '<span class="estudio__lg"><i class="estudio__punto" style="background:' +
        M.colorDe(cods[i]) + '"></i>' + esc(nombreRamo(cods[i])) + ' <b>' +
        esc(M.horasTexto(horasRamo)) + '</b></span>';
    }
    h += '<span class="estudio__lg"><i class="estudio__punto estudio__punto--base"></i>' +
      rot('estudio.metaBaseCorta') + ' ' + esc(M.horasTexto(M.metaBase())) + '</span>';
    if (ws.some(function (w) { return M.tieneMetaPropia(w.lunes); })) {
      h += '<span class="estudio__lg"><i class="estudio__punto estudio__punto--propia"></i>' +
        rot('estudio.metaPropiaCorta') + '</span>';
    }
    h += '</div>';

    if (!algo) {
      h += '<p class="estudio__pista" data-estudio="barras-vacio">' +
        rot('estudio.sinDatos') + '</p></section>';
      return h;
    }

    h += '<div class="estudio__lienzo" data-estudio="barras" role="img"' +
      ' aria-label="' + rot('estudio.barras') + '">';
    for (var j = 0; j < ws.length; j++) {
      var w = ws[j];
      var m = M.minutosDe(w.lunes);
      var total = M.horasAsignadas(w.lunes);
      var meta = M.metaDe(w.lunes);
      var alto = Math.max(0, Math.min(M.ALTO_BARRAS, (total / tope) * M.ALTO_BARRAS));
      var seg = '';
      for (var k = 0; k < cods.length; k++) {
        var min = Number(m[cods[k]]) || 0;
        if (!min) { continue; }
        var sAlto = (min / 60 / tope) * M.ALTO_BARRAS;
        seg += '<span class="estudio__seg" style="height:' + sAlto.toFixed(2) + 'px;background:' +
          M.colorDe(cods[k]) + '" title="' + esc(nombreRamo(cods[k]) + ': ' + M.horasTexto(min / 60)) +
          '"></span>';
      }
      h += '<div class="estudio__semana' + (w.actual ? ' estudio__semana--actual' : '') +
        (total > meta && meta > 0 ? ' estudio__semana--pasada' : '') +
        '" data-barra-semana="' + w.lunes + '" data-barra-total="' + total.toFixed(3) +
        '" data-barra-meta="' + meta + '">' +
        '<span class="estudio__tot">' + esc(total ? M.horasTexto(total) : '') + '</span>' +
        '<div class="estudio__pila" style="height:' + alto.toFixed(2) + 'px">' + seg + '</div>' +
        (M.tieneMetaPropia(w.lunes)
          ? '<span class="estudio__propia" title="' + esc(M.horasTexto(meta)) + '"></span>' : '') +
        '<span class="estudio__etq">S' + w.numero + '</span></div>';
    }
    h += '<span class="estudio__linea" style="bottom:' +
      ((M.metaBase() / tope) * M.ALTO_BARRAS).toFixed(2) + 'px">' +
      esc(M.horasTexto(M.metaBase())) + '</span>';
    h += '</div></section>';
    return h;
  }

  /* ---------------------------------------------------------- 3. los puntos */
  function htmlPuntos() {
    var ws = M.semanas();
    var horas = ws.map(function (w) { return M.horasSemana(w.lunes); });
    var objetivo = M.objetivoSemanal();
    var ANCHO = 560, ALTO = 150, IZQ = 34, DER = 10, ARRIBA = 12, ABAJO = 26;
    var tope = Math.max.apply(null, horas.concat([objetivo, 1])) * 1.12;
    var paso = ws.length > 1 ? (ANCHO - IZQ - DER) / (ws.length - 1) : 0;
    function x(i) { return IZQ + paso * i; }
    function y(v) { return ARRIBA + (1 - v / tope) * (ALTO - ARRIBA - ABAJO); }

    var puntos = '', circulos = '';
    for (var i = 0; i < ws.length; i++) {
      puntos += (i ? ' ' : '') + x(i).toFixed(1) + ',' + y(horas[i]).toFixed(1);
      circulos += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(horas[i]).toFixed(1) +
        '" r="' + (ws[i].actual ? 4 : 3) + '" fill="' +
        (ws[i].actual ? 'var(--acento)' : 'var(--tinta)') +
        '" data-punto-semana="' + ws[i].lunes + '" data-punto-horas="' + horas[i].toFixed(3) +
        '"><title>' + esc('S' + ws[i].numero + ': ' + M.horasTexto(horas[i])) + '</title></circle>';
    }

    var h = '<section class="estudio__panel" data-estudio="panel-puntos">' +
      '<h3 class="estudio__tit"' + atr('estudio.puntos') + '>' + rot('estudio.puntos') + '</h3>' +
      '<div class="estudio__puntos" data-estudio="puntos" data-punto-objetivo="' + objetivo + '">' +
      '<svg viewBox="0 0 ' + ANCHO + ' ' + ALTO + '" width="100%" height="' + ALTO +
      '" role="img" aria-label="' + rot('estudio.puntos') + '">' +
      '<line x1="' + IZQ + '" x2="' + (ANCHO - DER) + '" y1="' + y(0).toFixed(1) +
      '" y2="' + y(0).toFixed(1) + '" stroke="var(--linea)" stroke-width="1"></line>' +
      '<line x1="' + IZQ + '" x2="' + (ANCHO - DER) + '" y1="' + y(objetivo).toFixed(1) +
      '" y2="' + y(objetivo).toFixed(1) + '" stroke="var(--acento)" stroke-width="2"' +
      ' stroke-dasharray="4 4"></line>' +
      '<text x="' + (ANCHO - DER) + '" y="' + (y(objetivo) - 6).toFixed(1) +
      '" text-anchor="end" font-size="11" fill="var(--acento)">' +
      esc(rot('estudio.leyendaObjetivo') + ' ' + M.horasTexto(objetivo)) + '</text>' +
      '<polyline points="' + puntos + '" fill="none" stroke="var(--tinta)" stroke-width="2"></polyline>' +
      circulos + '</svg></div>' +
      '<p class="estudio__pista">' +
      '<span class="estudio__lg"><i class="estudio__punto"></i>' + rot('estudio.leyendaHoras') + '</span> ' +
      '<span class="estudio__lg"><i class="estudio__punto estudio__punto--objetivo"></i>' +
      rot('estudio.leyendaObjetivo') + '</span> ' +
      '<span class="estudio__pista"' + atr('estudio.actual') + '>' + rot('estudio.actual') + '</span></p>' +
      '</section>';
    return h;
  }

  /* ------------------------------------------------------ 4. dedicacion corta */
  function htmlDedicacion() {
    var avisos = M.dedicacion();
    if (!avisos.length) { return ''; }
    var h = '<section class="estudio__panel estudio__panel--aviso" data-estudio="dedicacion">' +
      '<h3 class="estudio__tit"' + atr('estudio.dedicacion') + '>' + rot('estudio.dedicacion') + '</h3>' +
      '<p class="estudio__pista"' + atr('estudio.dedicacionTexto') + '>' + rot('estudio.dedicacionTexto') + '</p>';
    for (var i = 0; i < avisos.length; i++) {
      var a = avisos[i];
      h += '<div class="estudio__aviso" data-aviso="' + esc(a.cod) + '"><p class="estudio__aviso-t">' +
        '<b>' + esc(a.cod) + '</b> ' + esc(a.nombre) + ' — ' +
        esc(M.horasTexto(a.llevo) + ' / ' + M.horasTexto(a.meta)) + '</p>';
      if (sumando && sumando.lunes === M.semanas()[M.SEMANAS - 1].lunes && sumando.cod === a.cod) {
        h += '<div class="estudio__acciones">' +
          '<input class="estudio__campo" type="text" maxlength="20" data-cantidad' +
          atrAria('estudio.cantidad') + ' placeholder="' + rot('estudio.cantidad') + '" value="30m">' +
          '<button class="btn btn--mini" type="button" data-anadir-guardar="' + esc(a.cod) + '"' +
          atrAria('estudio.guardar') + '>' + rot('estudio.guardar') + '</button>' +
          '<button class="btn btn--mini" type="button" data-anadir-cancelar="' + esc(a.cod) + '"' +
          atrAria('estudio.cancelar') + '>' + rot('estudio.cancelar') + '</button></div>';
      } else {
        h += '<div class="estudio__acciones">' +
          '<button class="btn btn--mini" type="button" data-descartar="' + esc(a.cod) + '"' +
          atrAria('estudio.descartar') + '>' + rot('estudio.descartar') + '</button>' +
          '<button class="btn btn--mini" type="button" data-anadir="' + esc(a.cod) + '"' +
          atrAria('estudio.sumar') + '>' + rot('estudio.sumar') + '</button></div>';
      }
      h += '</div>';
    }
    h += '</section>';
    return h;
  }

  /* ----------------------------------------------------------- 5. la tabla */
  function htmlTabla() {
    var ws = M.semanas();
    var cat = Mimo.CAT();
    var cods = Object.keys(cat).filter(function (c) { return cat[c] && cat[c].en_malla !== false; });
    if (!cods.length) {
      return '<section class="estudio__panel"><h3 class="estudio__tit"' + atr('estudio.tabla') +
        '>' + rot('estudio.tabla') + '</h3><p class="estudio__pista"' + atr('estudio.sinRamos') +
        '>' + rot('estudio.sinRamos') + '</p></section>';
    }
    var h = '<section class="estudio__panel" data-estudio="tabla">' +
      '<h3 class="estudio__tit"' + atr('estudio.tabla') + '>' + rot('estudio.tabla') + '</h3>' +
      '<div class="estudio__scroll"><table class="estudio__tabla"><thead><tr>' +
      '<th scope="col"' + atr('estudio.semana') + '>' + rot('estudio.semana') + '</th>';
    for (var i = 0; i < cods.length; i++) {
      h += '<th scope="col" title="' + esc(nombreRamo(cods[i])) + '">' + esc(cods[i]) +
        '<br><input class="estudio__campo estudio__campo--num" type="number" min="0" step="0.5"' +
        ' data-meta-ramo="' + esc(cods[i]) + '" value="' +
        esc(String((M.estado().metas_ramo[cods[i]] || {}).horas || '')) +
        '" aria-label="' + esc(T('estudio.meta') + ' ' + cods[i]) + '"></th>';
    }
    h += '<th scope="col"' + atr('estudio.sinRepartir') + '>' + rot('estudio.sinRepartir') + '</th>' +
      '<th scope="col"' + atr('estudio.totalCorto') + '>' + rot('estudio.totalCorto') + '</th>' +
      '<th scope="col"' + atr('estudio.meta') + '>' + rot('estudio.meta') + '</th>' +
      '<th scope="col"' + atr('estudio.nota') + '>' + rot('estudio.nota') + '</th></tr></thead><tbody>';

    for (var j = 0; j < ws.length; j++) {
      var w = ws[j];
      var m = M.minutosDe(w.lunes);
      var total = M.horasSemana(w.lunes);
      h += '<tr' + (w.actual ? ' class="estudio__fila--actual"' : '') + '>' +
        '<th scope="row"><span class="estudio__sem">S' + w.numero + '</span><br>' +
        '<span class="estudio__rango">' + esc(Mimo.rangoSemana(w.lunes)) + '</span></th>';
      for (var k = 0; k < cods.length; k++) {
        h += '<td><input class="estudio__campo" type="text" inputmode="text" maxlength="10"' +
          ' data-min-lunes="' + w.lunes + '" data-min-ramo="' + esc(cods[k]) + '" value="' +
          esc(M.fmtHM(m[cods[k]])) + '" aria-label="' +
          esc(cods[k] + ' S' + w.numero) + '"></td>';
      }
      h += '<td><input class="estudio__campo" type="text" inputmode="text" maxlength="10"' +
        ' data-sin-lunes="' + w.lunes + '" value="' + esc(M.fmtHM(m.OTROS)) +
        '" aria-label="' + esc(T('estudio.sinRepartir') + ' S' + w.numero) + '"></td>' +
        '<td class="estudio__num" data-total-semana="' + w.lunes + '">' +
        esc(M.horasTexto(total)) + '</td>' +
        '<td><input class="estudio__campo estudio__campo--num" type="number" min="0" step="0.5"' +
        ' data-meta-semana="' + w.lunes + '" value="' +
        esc(M.tieneMetaPropia(w.lunes) ? String(M.metaDe(w.lunes)) : '') +
        '" placeholder="' + esc(String(M.metaBase())) + '" aria-label="' +
        esc(T('estudio.metaPropia') + ' S' + w.numero) + '"></td>' +
        '<td><input class="estudio__campo" type="text" maxlength="80" data-nota-lunes="' + w.lunes +
        '" value="' + esc(M.estado().notas_otros[w.lunes] || '') +
        '" aria-label="' + esc(T('estudio.nota') + ' S' + w.numero) + '"></td></tr>';
    }
    h += '</tbody></table></div>';

    var prioridad = M.prioridad();
    if (prioridad.length) {
      var piezas = prioridad.slice(0, 4).map(function (p) {
        return '<b>' + esc(p.cod) + '</b> (' + p.abre + ')';
      });
      h += '<p class="estudio__pista"><span' + atr('estudio.prioridad') + '>' +
        rot('estudio.prioridad') + ':</span> ' + piezas.join(' · ') + '</p>';
    }
    h += '</section>';
    return h;
  }

  function pintar() {
    var c = caja();
    if (!c) { return; }
    if (!Mimo.leer().catalogo || !Object.keys(Mimo.CAT()).length) {
      /* sin catalogo no hay ramos, pero la seccion explica que hacer */
    }
    c.innerHTML = htmlKpis() + htmlBarras() + htmlPuntos() + htmlDedicacion() + htmlTabla();
  }

  /* --------------------------------------------------------------- 6. eventos */
  function lunesActual() {
    var ws = M.semanas();
    return ws[ws.length - 1].lunes;
  }

  function dentro(el) {
    return el && el.closest && el.closest('[data-estudio="bloque"]');
  }

  function iniciar() {
    if (iniciado) { return; }
    iniciado = true;

    document.addEventListener('change', function (ev) {
      var el = ev.target;
      if (!dentro(el)) { return; }
      if (el.hasAttribute('data-meta-base')) {
        M.ponerMetaBase(Number(el.value) || 0);
        pintar(); return;
      }
      if (el.hasAttribute('data-min-lunes')) {
        M.ponerMinutos(el.getAttribute('data-min-lunes'),
          el.getAttribute('data-min-ramo'), M.parseHM(el.value));
        pintar(); return;
      }
      if (el.hasAttribute('data-sin-lunes')) {
        M.ponerSinRepartir(el.getAttribute('data-sin-lunes'), M.parseHM(el.value));
        pintar(); return;
      }
      if (el.hasAttribute('data-meta-semana')) {
        M.ponerMetaSemana(el.getAttribute('data-meta-semana'), Number(el.value) || 0);
        pintar(); return;
      }
      if (el.hasAttribute('data-meta-ramo')) {
        M.ponerMetaRamo(el.getAttribute('data-meta-ramo'), Number(el.value) || 0);
        pintar(); return;
      }
      if (el.hasAttribute('data-nota-lunes')) {
        M.ponerNota(el.getAttribute('data-nota-lunes'), el.value);
        return;                                  // la nota no cambia ninguna cifra
      }
    });

    document.addEventListener('click', function (ev) {
      var el = ev.target;
      if (!dentro(el)) { return; }
      var descartar = el.closest('[data-descartar]');
      if (descartar) {
        M.descartar(lunesActual(), descartar.getAttribute('data-descartar'));
        sumando = null;
        pintar();
        return;
      }
      var anadir = el.closest('[data-anadir]');
      if (anadir) {
        sumando = { lunes: lunesActual(), cod: anadir.getAttribute('data-anadir') };
        pintar();
        var campo = caja().querySelector('[data-cantidad]');
        if (campo) { campo.focus(); campo.select(); }
        return;
      }
      var cancelar = el.closest('[data-anadir-cancelar]');
      if (cancelar) { sumando = null; pintar(); return; }
      var guardarBtn = el.closest('[data-anadir-guardar]');
      if (guardarBtn) {
        var cod = guardarBtn.getAttribute('data-anadir-guardar');
        var input = caja().querySelector('[data-cantidad]');
        var min = input ? M.parseHM(input.value) : 0;
        if (min > 0) {
          M.sumarTiempo(lunesActual(), cod, min);
          if (Mimo.mostrarAviso) {
            Mimo.mostrarAviso(T('estudio.anadido', {
              min: M.fmtHM(min), ramo: cod
            }));
          }
        }
        sumando = null;
        pintar();
        return;
      }
    });

    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' || !dentro(ev.target)) { return; }
      if (ev.target.hasAttribute('data-cantidad')) {
        ev.preventDefault();
        var b = caja().querySelector('[data-anadir-guardar]');
        if (b) { b.click(); }
      }
    });
  }

  return { iniciar: iniciar, pintar: pintar };
})();
