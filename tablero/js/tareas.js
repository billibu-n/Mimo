/* ============================================================================
   tareas.js — Mimo Nuevo · bloque Tareas (T007)

   QUE ES. El tablero de tres columnas de la app anterior
   (`referencia/mimo-app-53cc22d/js/tareas/01-tareas.js`, 206 l.): Hoy / Esta
   semana / Hechas, con los filtros (todas, pendientes, hoy, ramos, personal),
   los KPIs, el anillo de progreso y el arrastre entre columnas. NO crea datos
   nuevos: lee y escribe la lista de tareas y los mapas `hechas`/`prioridades`
   que ya viven en el almacen unico (`mimo.datos.v1`), namespace `tareas`.

   QUE SE PORTA Y QUE NO. Se portan las tres capacidades del inventario (filas
   59-61): tablero de tres columnas, filtros/anillo/KPIs y drag&drop. NO se
   portan `abrirEditor()` ni `nuevaTarea()`: son del editor de evento de T008 y
   este bloque no los reclama. HUECO declarado: crear/editar una tarea, y mover
   con teclado (el arrastre es de puntero; marcar SI tiene boton).

   UNA TAREA ES `{id, fecha, hora, texto, ramo, origen}`. `fecha` es ISO local;
   `hora` es 'HH:MM' o ''; `ramo` es un codigo del catalogo o '' (personal);
   `origen` dice de donde vino ('manual', 'notas', 'calendario'). El motor no
   toca el DOM (ni una referencia al objeto global del navegador): se puede
   medir sin pantalla.

   EL SUSTRATO MANDA. Leer y guardar SIEMPRE por `MimoComun.leer()` y
   `MimoComun.guardar()`: el estado entero es una sola clave versionada y un
   namespace que no figure en `estadoInicial()`/`normalizar()` se pierde al
   recargar. `E.tareas` se siembra aqui la primera vez, pero la forma fija la
   declara `js/comun/almacen.js` (toque de este bloque).

   API DEL MOTOR (`window.MimoTareasMotor`)
     FILTROS, DESTINOS
     hoy()                     fecha ISO de hoy
     lunes([iso])              lunes de la semana de `iso` (o de hoy)
     todas()                   la lista viva, normalizada
     porFiltro(filtro)         todas | pendientes | hoy | ramos | personal
     columnas([filtro])        {hoy, semana, hechas} ya clasificadas
     anillo()                  {hechas, pendientes, total, pct} de la semana
     kpis()                    {total, pendientes, hoy, personales, ramo}
     marcar(id)                alterna `hechas[id]` y guarda
     soltar(id, destino)       hoy | semana | hechas (re-fecha o re-marca)
     hecha(id), prioridad(id)  consultas para la vista
     guardar([aviso])          la puerta unica de escritura

   API DE LA VISTA (`window.MimoTareasUI`)
     iniciar()                 engancha una sola vez (delegado en el DOM)
     pintar()                  repinta la caja `[data-tareas="bloque"]`
     fijarFiltro(f), filtro()  el chip activo, para las medidas
   ============================================================================ */
var MimoTareasMotor = (function () {
  'use strict';

  var FILTROS = ['todas', 'pendientes', 'hoy', 'ramos', 'personal'];
  var DESTINOS = ['hoy', 'semana', 'hechas'];
  var RANGO = { alta: 0, media: 1, baja: 2 };

  function comun() {
    if (typeof MimoComun === 'undefined' || !MimoComun) { return null; }
    if (typeof MimoComun.leer !== 'function') { return null; }
    return MimoComun;
  }
  function esObjeto(x) { return !!x && typeof x === 'object' && !(x instanceof Array); }

  /* La forma la fija el almacen; esto solo cubre el caso de una pagina que
     cargue este bloque SIN el toque de `almacen.js` (por ejemplo una copia
     congelada): se siembra y se sigue, no se rompe. */
  function E() {
    var M = comun();
    if (!M) { return { nuevas: [], hechas: {}, prioridades: {} }; }
    var e = M.leer();
    if (!esObjeto(e.tareas)) { e.tareas = {}; }
    if (!(e.tareas.nuevas instanceof Array)) { e.tareas.nuevas = []; }
    if (!esObjeto(e.tareas.hechas)) { e.tareas.hechas = {}; }
    if (!esObjeto(e.tareas.prioridades)) { e.tareas.prioridades = {}; }
    return e.tareas;
  }

  function guardar(aviso) {
    var M = comun();
    if (M) { M.guardar(aviso); }
  }

  function hoy() {
    var M = comun();
    return M ? M.hoy() : '';
  }

  /* Lunes de la semana: getDay() da 0 el domingo, asi que se corre a lunes=0
     ((d+6)%7). La fecha se compone a mediodia local, como el resto del sustrato. */
  function lunes(iso) {
    var M = comun();
    if (!M) { return ''; }
    var d = M.aFecha(iso || M.hoy());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return M.aISO(d);
  }

  function esTarea(t) {
    return !!t && typeof t === 'object' && t.id !== null && t.id !== undefined &&
      String(t.id) !== '';
  }

  function id(t) { return String(t.id); }

  /* La lista viva: los objetos que devuelve son los guardados, para que
     `soltar()` re-fecha sin copiar. Una entrada rota se ignora, no tumba el
     tablero (un JSON importado a mano puede traer basura). */
  function todas() {
    var lista = E().nuevas;
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      if (esTarea(lista[i])) { salida.push(lista[i]); }
    }
    return salida;
  }

  function buscar(cual) {
    var lista = todas();
    var clave = String(cual);
    for (var i = 0; i < lista.length; i++) {
      if (id(lista[i]) === clave) { return lista[i]; }
    }
    return null;
  }

  function hecha(cual) { return E().hechas[String(cual)] === true; }

  function prioridad(cual) {
    var p = E().prioridades[String(cual)];
    return RANGO[p] === undefined ? null : p;
  }

  /* Prioridad primero (alta, media, baja, sin prioridad), luego la hora y
     luego el texto: dos tareas de la misma prioridad no bailan entre pintados. */
  function orden(a, b) {
    var pa = prioridad(a.id), pb = prioridad(b.id);
    var ra = pa === null ? 3 : RANGO[pa];
    var rb = pb === null ? 3 : RANGO[pb];
    if (ra !== rb) { return ra - rb; }
    var ha = String(a.hora || ''), hb = String(b.hora || '');
    if (ha !== hb) {
      if (!ha) { return 1; }
      if (!hb) { return -1; }
      return ha < hb ? -1 : 1;
    }
    return String(a.texto || '') < String(b.texto || '') ? -1 : 1;
  }

  function porFiltro(filtro) {
    var f = FILTROS.indexOf(String(filtro)) >= 0 ? String(filtro) : 'todas';
    var h = hoy();
    var lista = todas();
    var salida = [];
    for (var i = 0; i < lista.length; i++) {
      var t = lista[i];
      var ok = true;
      if (f === 'pendientes') { ok = !hecha(t.id); }
      else if (f === 'hoy') { ok = String(t.fecha || '') === h; }
      else if (f === 'ramos') { ok = !!t.ramo; }
      else if (f === 'personal') { ok = !t.ramo; }
      if (ok) { salida.push(t); }
    }
    return salida;
  }

  /* Las tres columnas de la SEMANA EN CURSO. La de Hoy es lo que cae hoy y
     sigue pendiente; la de Semana, lo pendiente de esta semana que no es hoy
     (incluido lo que ya paso: se ve como vencido, no desaparece); la de Hechas,
     lo marcado con fecha dentro de la semana. Una tarea de otra semana no se
     pinta aqui: su sitio es el calendario de T008. */
  function columnas(filtro) {
    var M = comun();
    var h = hoy();
    var l = lunes(h);
    var l6 = M ? M.sumaDias(l, 6) : h;
    var lista = porFiltro(filtro || 'todas');
    var salida = { hoy: [], semana: [], hechas: [] };
    for (var i = 0; i < lista.length; i++) {
      var t = lista[i];
      var f = String(t.fecha || '');
      if (hecha(t.id)) {
        if (f >= l && f <= l6) { salida.hechas.push(t); }
      } else if (f === h) {
        salida.hoy.push(t);
      } else if (f >= l && f <= l6) {
        salida.semana.push(t);
      }
    }
    salida.hoy.sort(orden);
    salida.semana.sort(orden);
    salida.hechas.sort(orden);
    return salida;
  }

  /* El anillo: hechas frente a pendientes de la semana en curso, sobre las
     tareas que caen en ella (las de otras semanas no cuentan). */
  function anillo() {
    var M = comun();
    var h = hoy();
    var l = lunes(h);
    var l6 = M ? M.sumaDias(l, 6) : h;
    var lista = todas();
    var hechas = 0, pendientes = 0;
    for (var i = 0; i < lista.length; i++) {
      var f = String(lista[i].fecha || '');
      if (f < l || f > l6) { continue; }
      if (hecha(lista[i].id)) { hechas++; } else { pendientes++; }
    }
    var total = hechas + pendientes;
    return {
      hechas: hechas,
      pendientes: pendientes,
      total: total,
      pct: total ? Math.round((hechas / total) * 100) : 0
    };
  }

  /* Los cuatro KPIs del encargo, siempre sobre lo PENDIENTE: en la app anterior
     "personales" y "con ramo" tambien descontaban lo hecho. */
  function kpis() {
    var h = hoy();
    var lista = todas();
    var k = { total: lista.length, pendientes: 0, hoy: 0, personales: 0, ramo: 0 };
    for (var i = 0; i < lista.length; i++) {
      var t = lista[i];
      if (hecha(t.id)) { continue; }
      k.pendientes++;
      if (String(t.fecha || '') === h) { k.hoy++; }
      if (t.ramo) { k.ramo++; } else { k.personales++; }
    }
    return k;
  }

  /* Marcar/desmarcar escribe SOLO `hechas`: la fecha no se toca. */
  function marcar(cual) {
    var clave = String(cual);
    if (!buscar(cual)) { return null; }
    var H = E().hechas;
    var nuevo = !(H[clave] === true);
    if (nuevo) { H[clave] = true; } else { delete H[clave]; }
    guardar(nuevo ? 'Tarea marcada como hecha' : 'Tarea devuelta a pendientes');
    return nuevo;
  }

  /* Arrastrar entre columnas. Hoy -> fecha de hoy. Semana -> lunes de la
     semana (lo pide el encargo; asi la tarea entra en la columna Semana aunque
     se arrastre un miercoles). Hechas -> marca `hechas`. Sacar de Hechas ->
     quita la marca y vuelve a hoy. Devuelve la foto antes/despues para que el
     instrumento pueda medir el cambio, o null si el destino no existe. */
  function soltar(cual, destino) {
    var t = buscar(cual);
    if (!t) { return null; }
    var d = String(destino);
    if (DESTINOS.indexOf(d) < 0) { return null; }
    var M = comun();
    var h = hoy();
    var antes = { fecha: String(t.fecha || ''), hecha: hecha(t.id) };
    var H = E().hechas;

    if (d === 'hechas') {
      if (!(H[id(t)] === true)) { H[id(t)] = true; guardar('Tarea marcada como hecha'); }
    } else {
      if (H[id(t)] === true) { delete H[id(t)]; }
      t.fecha = d === 'hoy' ? h : lunes(h);
      guardar(d === 'hoy' ? 'Tarea movida a hoy' : 'Tarea movida a esta semana');
    }
    return {
      id: id(t),
      destino: d,
      fecha: String(t.fecha || ''),
      hecha: hecha(t.id),
      antes: antes
    };
  }

  return {
    FILTROS: FILTROS,
    DESTINOS: DESTINOS,
    hoy: hoy,
    lunes: lunes,
    todas: todas,
    porFiltro: porFiltro,
    columnas: columnas,
    anillo: anillo,
    kpis: kpis,
    marcar: marcar,
    soltar: soltar,
    hecha: hecha,
    prioridad: prioridad,
    buscar: buscar,
    guardar: guardar
  };
})();

if (typeof window !== 'undefined') { window.MimoTareasMotor = MimoTareasMotor; }

var MimoTareasUI = (function () {
  'use strict';

  /* El motor no nombra el DOM. La vista SI, y toma el documento UNA vez con
     `window.document`: asi el fichero entero se puede medir con un grep del
     verbo del navegador y el motor queda limpio por construccion. */
  var D = (typeof window !== 'undefined' && window.document) ? window.document : null;
  var Mimo = (typeof window !== 'undefined' && window.MimoComun) ? window.MimoComun : null;
  var M = MimoTareasMotor;
  var filtro = 'todas';
  var iniciado = false;
  var arrastrando = '';

  function T(clave, params) {
    if (typeof window !== 'undefined' && window.MimoI18n) { return window.MimoI18n.t(clave, params); }
    return clave;
  }
  function esc(v) { return Mimo ? Mimo.esc(v) : String(v === null || v === undefined ? '' : v); }
  function rot(clave, params) { return esc(T(clave, params)); }
  function atr(clave) { return ' data-i18n="' + clave + '"'; }
  function caja() { return D ? D.querySelector('[data-tareas="bloque"]') : null; }

  function nombreRamo(cod) {
    var c = Mimo ? Mimo.CAT()[cod] : null;
    var nombre = (c && (c.nombre || c.alias)) || '';
    return nombre === String(cod) ? '' : nombre;
  }

  /* Una fecha corta y legible: "20 oct". El año no hace falta en un tablero de
     la semana; la fecha completa vive en el title de la tarjeta. */
  function fechaCorta(iso) {
    if (!Mimo || !iso) { return String(iso || ''); }
    var d = Mimo.aFecha(iso);
    return d.getDate() + ' ' + Mimo.MESES[d.getMonth()];
  }

  function etiquetaFecha(t) {
    var h = M.hoy();
    var f = String(t.fecha || '');
    if (f === h) { return T('tareas.hoy'); }
    if (f < h) { return T('tareas.vencidaEl', { fecha: fechaCorta(f) }); }
    return fechaCorta(f);
  }

  function textoCola(t) {
    var partes = [];
    if (t.hora) { partes.push(String(t.hora)); }
    if (M.hecha(t.id)) {
      partes.push(T('tareas.hechaEl', { fecha: fechaCorta(t.fecha) }));
    } else {
      partes.push(etiquetaFecha(t));
    }
    return partes.join(' · ');
  }

  function origen(t) {
    var o = String(t.origen || '');
    if (o === 'notas') { return T('tareas.origenNotas'); }
    if (o === 'calendario') { return T('tareas.origenCalendario'); }
    return '';
  }

  function prioridad(t) {
    var p = M.prioridad(t.id);
    return p ? ' tarea--pri-' + p : '';
  }

  /* ------------------------------------------------------------ 1. la tarjeta */
  function tarjeta(t, col) {
    var id = esc(t.id);
    var estaHecha = M.hecha(t.id);
    var ramo = t.ramo
      ? '<span class="tarea__ramo"><i class="tarea__punto" aria-hidden="true"></i>' +
        '<b>' + esc(t.ramo) + '</b> ' + esc(nombreRamo(t.ramo)) + '</span>'
      : '<span class="tarea__ramo"><i class="tarea__punto tarea__punto--personal"' +
        ' aria-hidden="true"></i>' + rot('tareas.personal') + '</span>';
    var etqOrigen = origen(t);
    var origenHtml = etqOrigen
      ? '<span class="tarea__origen">' + esc(etqOrigen) + '</span>' : '';
    return '<article class="tarea' + (estaHecha ? ' tarea--hecha' : '') +
      prioridad(t) + '" data-id="' + id + '" data-tareas="tarjeta"' +
      ' draggable="true" title="' + esc(t.texto || '') + ' · ' + esc(t.fecha || '') + '">' +
      '<button class="tarea__check" type="button" data-marcar="' + id + '"' +
      ' aria-pressed="' + (estaHecha ? 'true' : 'false') + '"' +
      ' data-i18n-attr="aria-label:' + (estaHecha ? 'tareas.desmarcar' : 'tareas.marcar') + '"' +
      ' aria-label="' + rot(estaHecha ? 'tareas.desmarcar' : 'tareas.marcar') + '">' +
      '<span class="tarea__punto" aria-hidden="true"></span></button>' +
      '<div class="tarea__cuerpo">' +
      '<p class="tarea__titulo">' + esc(t.texto || '') + '</p>' +
      '<p class="tarea__meta">' + ramo + origenHtml + '</p>' +
      '<p class="tarea__meta tarea__cuando' + (String(t.fecha || '') < M.hoy() && !estaHecha
        ? ' tarea__cuando--vencida' : '') + '">' + esc(textoCola(t)) + '</p>' +
      '</div></article>';
  }

  function vacio(clave) {
    return '<p class="tareas__vacio"' + atr(clave) + '>' + rot(clave) + '</p>';
  }

  /* ------------------------------------------------------------- 2. el anillo */
  function htmlAnillo() {
    var a = M.anillo();
    var C = 2 * Math.PI * 50;
    var lenHechas = a.total ? (a.hechas / a.total) * C : 0;
    var lenPend = a.total ? (a.pendientes / a.total) * C : 0;
    var h = '<section class="tareas__anillo" data-tareas="anillo">' +
      '<svg viewBox="0 0 120 120" role="img" aria-label="' + rot('tareas.anillo') + '">' +
      '<circle class="tareas__pista" cx="60" cy="60" r="50"></circle>' +
      '<circle class="tareas__hecho" cx="60" cy="60" r="50"' +
      ' stroke-dasharray="' + lenHechas.toFixed(2) + ' ' + C.toFixed(2) + '"></circle>' +
      '<circle class="tareas__pend" cx="60" cy="60" r="50"' +
      ' stroke-dasharray="' + lenPend.toFixed(2) + ' ' + C.toFixed(2) + '"' +
      ' stroke-dashoffset="' + (-lenHechas).toFixed(2) + '"></circle>' +
      '<text class="tareas__anillo-txt" x="60" y="62" text-anchor="middle">' +
      a.pct + '%</text>' +
      '<text class="tareas__anillo-sub" x="60" y="80" text-anchor="middle">' +
      a.hechas + '/' + a.total + '</text></svg>' +
      '<div class="tareas__leyenda">' +
      '<p><b data-tareas="anillo-hechas">' + a.hechas + '</b> ' +
        rot(a.hechas === 1 ? 'tareas.anilloHecha' : 'tareas.anilloHechas') + '</p>' +
      '<p><b data-tareas="anillo-pendientes">' + a.pendientes + '</b> ' +
        rot(a.pendientes === 1 ? 'tareas.anilloPendiente' : 'tareas.anilloPendientes') + '</p>' +
      '<p><b data-tareas="anillo-total">' + a.total + '</b> ' +
        rot('tareas.anilloTotal') + '</p>' +
      '</div></section>';
    return h;
  }

  /* ------------------------------------------------------------- 3. los KPIs */
  function htmlKpis() {
    var k = M.kpis();
    var filas = [
      ['tareas.kpiPendientes', k.pendientes, 'kpi-pendientes'],
      ['tareas.kpiHoy', k.hoy, 'kpi-hoy'],
      ['tareas.kpiPersonal', k.personales, 'kpi-personal'],
      ['tareas.kpiRamo', k.ramo, 'kpi-ramo']
    ];
    var h = '<div class="tareas__kpis" data-tareas="kpis">';
    for (var i = 0; i < filas.length; i++) {
      h += '<div class="kpi"><b class="kpi__cifra" data-tareas="' + filas[i][2] + '">' +
        filas[i][1] + '</b><span class="kpi__rot"' + atr(filas[i][0]) + '>' +
        rot(filas[i][0]) + '</span></div>';
    }
    return h + '</div>';
  }

  /* ----------------------------------------------------------- 4. los filtros */
  function htmlFiltros() {
    var todos = M.todas();
    var cuenta = {
      todas: todos.length,
      pendientes: M.porFiltro('pendientes').length,
      hoy: M.porFiltro('hoy').length,
      ramos: M.porFiltro('ramos').length,
      personal: M.porFiltro('personal').length
    };
    var etiquetas = {
      todas: 'tareas.filtroTodas',
      pendientes: 'tareas.filtroPendientes',
      hoy: 'tareas.filtroHoy',
      ramos: 'tareas.filtroRamos',
      personal: 'tareas.filtroPersonal'
    };
    var h = '<div class="tareas__barra" role="group" aria-label="' + rot('tareas.filtros') + '">';
    for (var i = 0; i < M.FILTROS.length; i++) {
      var f = M.FILTROS[i];
      h += '<button class="tareas__filtro" type="button" data-filtro="' + f + '"' +
        ' aria-pressed="' + (f === filtro ? 'true' : 'false') + '">' +
        '<span' + atr(etiquetas[f]) + '>' + rot(etiquetas[f]) + '</span>' +
        ' <b class="tareas__n">' + cuenta[f] + '</b></button>';
    }
    return h + '</div>';
  }

  /* ---------------------------------------------------------- 5. las columnas */
  function htmlColumnas() {
    var c = M.columnas(filtro);
    var cols = [
      ['hoy', 'tareas.colHoy', 'tareas.vacioHoy', c.hoy],
      ['semana', 'tareas.colSemana', 'tareas.vacioSemana', c.semana],
      ['hechas', 'tareas.colHechas', 'tareas.vacioHechas', c.hechas]
    ];
    var h = '<div class="tareas__panel">';
    for (var i = 0; i < cols.length; i++) {
      var d = cols[i][0];
      var lista = cols[i][3];
      var cuerpo = '';
      for (var j = 0; j < lista.length; j++) { cuerpo += tarjeta(lista[j], d); }
      if (!cuerpo) { cuerpo = vacio(cols[i][2]); }
      h += '<section class="tareas__col" data-destino="' + d + '"' +
        ' data-tareas="col-' + d + '" aria-label="' + rot(cols[i][1]) + '">' +
        '<h3 class="tareas__colTit"' + atr(cols[i][1]) + '>' + rot(cols[i][1]) + '</h3>' +
        '<div class="tareas__lista" data-tareas="lista-' + d + '">' + cuerpo + '</div>' +
        '</section>';
    }
    return h + '</div>';
  }

  /* -------------------------------------------------------------- 6. pintar */
  function pintar() {
    var c = caja();
    if (!c) { return; }
    c.innerHTML = htmlKpis() + htmlFiltros() + htmlAnillo() + htmlColumnas();
  }

  /* -------------------------------------------------------------- 7. eventos */
  function marcarClic(ev) {
    var b = ev.target.closest('[data-marcar]');
    if (!b) { return; }
    ev.preventDefault();
    M.marcar(b.getAttribute('data-marcar'));
    pintar();
  }

  function filtroClic(ev) {
    var b = ev.target.closest('[data-filtro]');
    if (!b) { return; }
    filtro = b.getAttribute('data-filtro');
    pintar();
  }

  function iniciarDrag(ev) {
    var t = ev.target.closest('.tarea[data-id]');
    if (!t || !caja() || !caja().contains(t)) { return; }
    arrastrando = t.getAttribute('data-id');
    t.classList.add('tarea--arrastrando');
    if (ev.dataTransfer) {
      try {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', arrastrando);
      } catch (e) { /* algunos navegadores no dejan escribir el portapapeles */ }
    }
  }

  function finDrag(ev) {
    var t = ev.target.closest ? ev.target.closest('.tarea[data-id]') : null;
    if (t) { t.classList.remove('tarea--arrastrando'); }
    arrastrando = '';
  }

  function sobreCol(ev) {
    var col = ev.target.closest ? ev.target.closest('.tareas__col') : null;
    if (!col) { return; }
    ev.preventDefault();
    col.classList.add('tareas__col--sobre');
    if (ev.dataTransfer) { ev.dataTransfer.dropEffect = 'move'; }
  }

  function salirCol(ev) {
    var col = ev.target.closest ? ev.target.closest('.tareas__col') : null;
    if (!col) { return; }
    if (ev.relatedTarget && col.contains(ev.relatedTarget)) { return; }
    col.classList.remove('tareas__col--sobre');
  }

  function soltarCol(ev) {
    var col = ev.target.closest ? ev.target.closest('.tareas__col') : null;
    if (!col) { return; }
    ev.preventDefault();
    col.classList.remove('tareas__col--sobre');
    var id = arrastrando;
    if (!id && ev.dataTransfer) {
      try { id = ev.dataTransfer.getData('text/plain'); } catch (e) { id = ''; }
    }
    arrastrando = '';
    if (!id) { return; }
    M.soltar(id, col.getAttribute('data-destino'));
    pintar();
  }

  function iniciar() {
    if (iniciado || !D) { return; }
    iniciado = true;
    D.addEventListener('click', marcarClic);
    D.addEventListener('click', filtroClic);
    D.addEventListener('dragstart', iniciarDrag);
    D.addEventListener('dragend', finDrag);
    D.addEventListener('dragover', sobreCol);
    D.addEventListener('dragleave', salirCol);
    D.addEventListener('drop', soltarCol);
  }

  return {
    iniciar: iniciar,
    pintar: pintar,
    fijarFiltro: function (f) {
      filtro = M.FILTROS.indexOf(String(f)) >= 0 ? String(f) : 'todas';
      pintar();
    },
    filtro: function () { return filtro; }
  };
})();

if (typeof window !== 'undefined') { window.MimoTareasUI = MimoTareasUI; }
