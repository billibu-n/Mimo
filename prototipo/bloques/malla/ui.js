/* ============================================================================
   bloques/malla/ui.js — pantalla del bloque Malla (v1.1.0 · Iteración 4a)

   Interfaz acordada en /tmp/malla-spec.md §6 y §8:
     window.MimoBloques = window.MimoBloques || {};
     window.MimoBloques.malla = { id, montar(raiz, ctx), desmontar, panel, refrescar }

   En la 4a la pantalla tiene DOS vistas: «mapa» (por defecto) y «tarjetas».
   La vista la decide esta UI; el dibujo del mapa lo pone vista-mapa.js y aquí
   solo se le entrega el contenedor y `t`. El cálculo sigue siendo del motor.

   Reglas que este fichero respeta:
   - La UI SOLO escribe dentro de `raiz` (la <section class="pantalla"> del shell).
     Ni #panel, ni .marco, ni document.body.
   - El cálculo NO vive aquí: se consume window.MimoMallaMotor (API §3).
     Si al montar todavía no existe, se dice en pantalla y `refrescar()` reintenta.
   - La importación es window.MimoMallaImportar (§4); la exportación, visual:
     window.MimoMallaExportar.resumen() (§5) y un aviso de que la 4e la completa.
   - Ningún color ni dato se inventa: el estado de cada ramo sale del motor y,
   - cuando el motor falla, se dice «sin estado» en vez de pintar un estado falso.
   ============================================================================ */
(function (global) {
  'use strict';

  var ID = 'malla';

  /* Estados del motor (§3). El orden no importa; el nombre sí. */
  var ESTADOS = ['aprobado', 'curso', 'disponible', 'bloqueado'];

  /* Vista elegida (4a): 'mapa' | 'tarjetas'. Se recuerda por usuario. */
  var CLAVE_VISTA = 'mimo.bloque.malla.vista';

  /* Estado de la pantalla: el bloque es UNA sección, así que hay una instancia. */
  var raiz = null;
  var ctx = null;
  var montada = false;
  var seleccion = null;
  var vista = 'mapa';
  var manifiestoCargando = false;
  var oyentes = [];
  var refs = { sub: null, cuerpo: null, input: null, mapa: null, manifiesto: null };

  /* Respaldos en español de los textos que pide la vista de mapa: son la
     red de seguridad si i18n no trae la clave (la vista nunca escribe texto
     visible por su cuenta). */
  var TEXTOS_MAPA = {
    'malla.mapa.aria': 'Mapa curricular',
    'malla.mapa.pista': 'Elige un ramo para ver sus prerrequisitos y lo que desbloquea.',
    'malla.mapa.leyendaSel': 'Azul: lo que necesita · Ámbar: lo que desbloquea.',
    'malla.creditosCorto': 'cr',
    'malla.semestreN': 'Semestre {n}',
    'malla.badge.anual': 'anual',
    'malla.estado.aprobado': 'Aprobado',
    'malla.estado.curso': 'En curso',
    'malla.estado.disponible': 'Disponible',
    'malla.estado.bloqueado': 'Bloqueado',
    'malla.estado.desconocido': 'Sin estado',
    'malla.seccion.planComun': 'Plan común',
    'malla.seccion.licenciatura': 'Licenciatura',
    'malla.seccion.especialidad': 'Especialidad'
  };

  /* ---------------------------------------------------------- 1. utilidades */

  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) { n.className = clase; }
    if (texto !== undefined && texto !== null) { n.textContent = String(texto); }
    return n;
  }

  function icono(id, tam, clase) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', clase || 'btn__ic');
    svg.setAttribute('width', String(tam || 15));
    svg.setAttribute('height', String(tam || 15));
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#' + id);
    svg.appendChild(use);
    return svg;
  }

  function escuchar(nodo, tipo, fn) {
    if (!nodo || !nodo.addEventListener) { return; }
    nodo.addEventListener(tipo, fn);
    oyentes.push([nodo, tipo, fn]);
  }

  function olvidarOyentes() {
    for (var i = 0; i < oyentes.length; i++) {
      oyentes[i][0].removeEventListener(oyentes[i][1], oyentes[i][2]);
    }
    oyentes = [];
  }

  /* i18n con respaldo: en la página de prueba ctx.t no existe y se usa el texto. */
  function tr(clave, params, respaldo) {
    if (ctx && typeof ctx.t === 'function') {
      try {
        var texto = ctx.t(clave, params, respaldo);
        if (texto && texto !== clave) { return texto; }
      } catch (e) { /* se usa el respaldo */ }
    }
    var out = String(respaldo === undefined ? clave : respaldo);
    if (params) {
      out = out.replace(/\{(\w+)\}/g, function (todo, nombre) {
        return (params[nombre] === undefined || params[nombre] === null) ? todo : String(params[nombre]);
      });
    }
    return out;
  }

  function avisar(texto, tipo, iconoId) {
    if (ctx && typeof ctx.aviso === 'function') {
      try { ctx.aviso(texto, tipo || '', iconoId || 'ic-info'); return; } catch (e) { /* sin aviso */ }
    }
    if (global.console && global.console.info) { global.console.info('[malla] ' + texto); }
  }

  function pedirPanel() {
    if (ctx && typeof ctx.pedirPanel === 'function') {
      try { ctx.pedirPanel(); } catch (e) { /* el panel no es imprescindible */ }
    }
  }

  /* textos de la vista de mapa: la clave, con el respaldo en español de arriba */
  function tMapa(clave, params) {
    var respaldo = Object.prototype.hasOwnProperty.call(TEXTOS_MAPA, clave)
      ? TEXTOS_MAPA[clave] : clave;
    return tr(clave, params, respaldo);
  }

  /* ------------------------------------------------ 1-bis. elección de vista */

  function leerVistaGuardada() {
    try {
      var v = global.localStorage.getItem(CLAVE_VISTA);
      return (v === 'mapa' || v === 'tarjetas') ? v : null;
    } catch (e) { return null; }
  }

  /* La extensión de vista que el manifiesto marca por defecto (vista-mapa /
     vista-tarjetas), y si no hay ninguna, `vistas.porDefecto`, y si no «mapa». */
  function extensionDefecto() {
    var m = refs.manifiesto;
    var lista = (m && Array.isArray(m.extensiones)) ? m.extensiones : [];
    for (var i = 0; i < lista.length; i++) {
      var ext = lista[i];
      if (!ext || !ext.porDefecto) { continue; }
      var id = String(ext.id || '');
      if (id.indexOf('vista-') !== 0) { continue; }
      var v = id.slice(6);
      if (v === 'mapa' || v === 'tarjetas') { return v; }
    }
    var porDefecto = (m && m.vistas) ? m.vistas.porDefecto : null;
    if (porDefecto === 'mapa' || porDefecto === 'tarjetas') { return porDefecto; }
    return 'mapa';
  }

  function vistaInicial() {
    var guardada = leerVistaGuardada();
    if (guardada) { return guardada; }
    return extensionDefecto();
  }

  function seccionesDelManifiesto() {
    var m = refs.manifiesto;
    if (!m || !m.vistas || !Array.isArray(m.vistas.secciones)) { return []; }
    return m.vistas.secciones;
  }

  /* El manifiesto se pide UNA vez al montar. Si cambia el defecto y el usuario
     no había elegido, se repinta; si declara secciones, el mapa se rehace. */
  function cargarManifiesto() {
    if (refs.manifiesto || manifiestoCargando) { return; }
    manifiestoCargando = true;
    var pedido;
    try {
      pedido = global.fetch('bloques/malla/manifiesto.json', { cache: 'no-cache' });
    } catch (e) {
      manifiestoCargando = false;
      return;
    }
    if (!pedido || typeof pedido.then !== 'function') {
      manifiestoCargando = false;
      return;
    }
    pedido.then(function (r) {
      if (!r || !r.ok) { throw new Error('HTTP ' + (r ? r.status : '?')); }
      return r.json();
    }).then(function (m) {
      manifiestoCargando = false;
      if (!m || !montada) { return; }
      refs.manifiesto = m;
      var guardada = leerVistaGuardada();
      var defecto = extensionDefecto();
      if (!guardada && vista !== defecto) {
        vista = defecto;
        pintarCuerpo();
        return;
      }
      if (vista === 'mapa' && seccionesDelManifiesto().length) { pintarCuerpo(); }
    }).catch(function () {
      manifiestoCargando = false;
      /* sin manifiesto se sigue con los valores de fábrica: no es un error */
    });
  }

  function desmontarVista() {
    var V = global.MimoMallaVistaMapa;
    if (V && typeof V.desmontar === 'function') {
      try { V.desmontar(); } catch (e) { /* ya estaba suelta */ }
    }
    refs.mapa = null;
  }

  /* ------------------------------------------------------- 2. puerta al motor */

  function motor() {
    var M = global.MimoMallaMotor;
    return (M && typeof M.getSemestres === 'function') ? M : null;
  }

  function estadoDe(codigo) {
    var M = motor();
    if (!M || typeof M.getEstadoCurso !== 'function') { return 'desconocido'; }
    try {
      var e = M.getEstadoCurso(codigo);
      return ESTADOS.indexOf(e) >= 0 ? e : 'desconocido';
    } catch (err) {
      return 'desconocido';
    }
  }

  function etiquetaEstado(estado) {
    var nombres = {
      aprobado: 'Aprobado', curso: 'En curso',
      disponible: 'Disponible', bloqueado: 'Bloqueado', desconocido: 'Sin estado'
    };
    return tr('malla.estado.' + estado, null, nombres[estado] || 'Sin estado');
  }

  function creditosDe(curso) {
    /* Ojo: Number(null) es 0. Un curso sin créditos NO tiene 0 créditos. */
    if (!curso || curso.creditos === null || curso.creditos === undefined || curso.creditos === '') {
      return null;
    }
    var n = Number(curso.creditos);
    return isFinite(n) ? n : null;
  }

  function formatearNota(n) {
    /* Ojo: Number(null) es 0. Sin nota no se pinta «0,0». */
    if (n === null || n === undefined || n === '') { return null; }
    var num = Number(n);
    if (!isFinite(num)) { return null; }
    return num.toFixed(1).replace('.', ',');
  }

  function tituloSemestre(sem) {
    if (sem && sem.titulo) { return String(sem.titulo); }
    return tr('malla.semestreN', { n: sem ? sem.n : '' }, 'Semestre ' + (sem ? sem.n : ''));
  }

  function codigosActivos() {
    var set = {};
    var M = motor();
    if (!M || typeof M.getRamosActivos !== 'function') { return set; }
    try {
      var activos = M.getRamosActivos() || [];
      for (var i = 0; i < activos.length; i++) {
        if (activos[i] && activos[i].codigo) { set[activos[i].codigo] = true; }
      }
    } catch (e) { /* sin activos: no se marca ningún semestre */ }
    return set;
  }

  /* Los colores importados por el usuario (§2) son DATOS, no kit: se aplican como
     variables en línea sobre `raiz`, con los tokens como respaldo en el CSS. */
  function aplicarColores() {
    var M = motor();
    var colores = null;
    if (M && typeof M.getAjustes === 'function') {
      try {
        var aj = M.getAjustes() || {};
        colores = (aj.av && aj.av.colores) || null;
      } catch (e) { colores = null; }
    }
    for (var i = 0; i < ESTADOS.length; i++) {
      var clave = '--malla-color-' + ESTADOS[i];
      var valor = colores && colores[ESTADOS[i]];
      var valido = typeof valor === 'string' &&
        /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))$/.test(valor.trim());
      if (valido) { raiz.style.setProperty(clave, valor.trim()); }
      else { raiz.style.removeProperty(clave); }
    }
  }

  /* --------------------------------------------------------- 3. cabecera */

  function subtitulo() {
    var M = motor();
    if (!M) {
      return tr('malla.sub.sinMotor', null,
        'Falta el motor de la malla: esta pantalla se activa cuando cargue bloques/malla/motor.js.');
    }
    try {
      var semestres = M.getSemestres() || [];
      var catalogo = M.getCatalogo() || {};
      var aprobados = M.getAprobados() || {};
      var activos = M.getRamosActivos() || [];
      var ramos = 0;
      for (var i = 0; i < semestres.length; i++) {
        ramos += (semestres[i].cursos || []).length;
      }
      if (!semestres.length && !Object.keys(catalogo).length) {
        return tr('malla.sub.vacio', null, 'Sin datos todavía · importa el respaldo en JSON.');
      }
      var creditos = 0;
      if (typeof M.creditosAprobados === 'function') {
        try { creditos = Number(M.creditosAprobados()) || 0; } catch (e) { creditos = 0; }
      }
      return tr('malla.sub.resumen', {
        semestres: semestres.length, ramos: ramos,
        aprobados: Object.keys(aprobados).length, activos: activos.length, creditos: creditos
      }, semestres.length + ' semestres · ' + ramos + ' ramos · ' +
         Object.keys(aprobados).length + ' aprobados · ' + activos.length +
         ' en curso · ' + creditos + ' créditos aprobados');
    } catch (e) {
      return tr('malla.sub.error', null, 'No se pudo leer la malla. Vuelve a intentarlo.');
    }
  }

  function construirCabecera() {
    var cab = crear('div', 'sec-cab malla-cab');

    var txt = crear('div', 'sec-cab__txt');
    var h1 = crear('h1', 'sec-cab__tit', tr('malla.titulo', null, 'Malla curricular'));
    h1.id = 'malla-titulo';
    var sub = crear('p', 'sec-cab__sub', '');
    sub.setAttribute('data-malla-sub', 'si');
    txt.appendChild(h1);
    txt.appendChild(sub);
    cab.appendChild(txt);

    var acc = crear('div', 'sec-cab__acc');

    var input = crear('input', 'malla-file');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    input.setAttribute('aria-hidden', 'true');
    input.setAttribute('tabindex', '-1');
    acc.appendChild(input);

    var bImportar = crear('button', 'btn btn--solido');
    bImportar.type = 'button';
    bImportar.setAttribute('data-accion', 'importar');
    bImportar.setAttribute('aria-label',
      tr('malla.acc.importarAria', null, 'Importar JSON · abre un archivo de respaldo de la malla'));
    bImportar.setAttribute('title',
      tr('malla.acc.importarTitulo', null, 'Importar el respaldo en JSON (formato 2)'));
    bImportar.appendChild(icono('ic-sync', 15));
    bImportar.appendChild(crear('span', null, tr('malla.acc.importar', null, 'Importar JSON')));

    var bExportar = crear('button', 'btn');
    bExportar.type = 'button';
    bExportar.setAttribute('data-accion', 'exportar');
    bExportar.setAttribute('aria-label',
      tr('malla.acc.exportarAria', null,
        'Exportar · resumen de la malla (la exportación completa llega en la 4e)'));
    bExportar.setAttribute('title',
      tr('malla.acc.exportarTitulo', null, 'Por ahora muestra el resumen: la descarga llega en la 4e'));
    bExportar.appendChild(crear('span', null, tr('malla.acc.exportar', null, 'Exportar')));

    acc.appendChild(bImportar);
    acc.appendChild(bExportar);
    cab.appendChild(acc);

    refs.sub = sub;
    refs.input = input;
    return cab;
  }

  /* ------------------------------------------------------- 4. vacío honesto */

  function mostrarVacio(estado) {
    var textos = {
      'sin-motor': {
        tit: tr('malla.vacio.sinMotorTit', null, 'Falta el motor de la malla'),
        txt: tr('malla.vacio.sinMotorTxt', null,
          'Esta pantalla necesita bloques/malla/motor.js. Se reintenta al refrescar y no se inventa ningún dato.'),
        accion: 'refrescar', etiqueta: tr('malla.vacio.reintentar', null, 'Reintentar')
      },
      'sin-datos': {
        tit: tr('malla.vacio.sinDatosTit', null, 'Todavía no hay malla'),
        txt: tr('malla.vacio.sinDatosTxt', null,
          'Importa el respaldo en JSON (formato 2) para ver tus ramos agrupados por semestre.'),
        accion: 'importar', etiqueta: tr('malla.acc.importar', null, 'Importar JSON')
      },
      'error': {
        tit: tr('malla.vacio.errorTit', null, 'No se pudo leer la malla'),
        txt: tr('malla.vacio.errorTxt', null,
          'El motor respondió con un error. Vuelve a intentarlo o revisa el respaldo importado.'),
        accion: 'refrescar', etiqueta: tr('malla.vacio.reintentar', null, 'Reintentar')
      }
    };
    var cfg = textos[estado] || textos['error'];

    var caja = crear('div', 'malla-vacio');
    var ico = crear('span', 'malla-vacio__ic');
    ico.appendChild(icono('ic-malla', 22, 'malla-vacio__svg'));
    caja.appendChild(ico);
    caja.appendChild(crear('h2', 'malla-vacio__tit', cfg.tit));
    caja.appendChild(crear('p', 'malla-vacio__txt', cfg.txt));

    var boton = crear('button', 'btn btn--solido');
    boton.type = 'button';
    boton.setAttribute('data-accion', cfg.accion);
    if (cfg.accion === 'importar') { boton.appendChild(icono('ic-sync', 15)); }
    boton.appendChild(crear('span', null, cfg.etiqueta));
    caja.appendChild(boton);

    refs.cuerpo.appendChild(caja);
  }

  /* ------------------------------------------------------- 5. barra y tarjetas */

  function barra() {
    var caja = crear('div', 'malla-barra');
    var leyenda = crear('div', 'malla-leyenda');
    leyenda.setAttribute('role', 'group');
    leyenda.setAttribute('aria-label', tr('malla.leyenda.aria', null, 'Estado de los ramos'));
    for (var i = 0; i < ESTADOS.length; i++) {
      var it = crear('span', 'malla-leyenda__it');
      var pto = crear('i', 'malla-leyenda__pto malla-leyenda__pto--' + ESTADOS[i]);
      pto.setAttribute('aria-hidden', 'true');
      it.appendChild(pto);
      it.appendChild(crear('span', null, etiquetaEstado(ESTADOS[i])));
      leyenda.appendChild(it);
    }
    caja.appendChild(leyenda);
    caja.appendChild(selectorVista());

    var pista = crear('p', 'malla-barra__pista',
      tr('malla.pista', null, 'Selecciona un ramo para ver su detalle en el panel.'));
    caja.appendChild(pista);
    return caja;
  }

  /* Selector Mapa/Tarjetas. Lleva su propia etiqueta (no depende de la
     leyenda) y es el único control de la barra. */
  function selectorVista() {
    var etiqueta = tr('malla.vista.selector', null, 'Vista');
    var lab = crear('label', 'malla-vista');
    lab.appendChild(crear('span', null, etiqueta));

    var sel = crear('select', 'malla-vista__sel');
    sel.setAttribute('aria-label', etiqueta);
    var opciones = [
      ['mapa', tr('malla.vista.mapa', null, 'Mapa')],
      ['tarjetas', tr('malla.vista.tarjetas', null, 'Tarjetas')]
    ];
    for (var i = 0; i < opciones.length; i++) {
      var op = crear('option', null, opciones[i][1]);
      op.value = opciones[i][0];
      if (vista === opciones[i][0]) { op.selected = true; }
      sel.appendChild(op);
    }
    lab.appendChild(sel);
    return lab;
  }

  function alCambiarVista(ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('malla-vista__sel')) { return; }
    var valor = t.value;
    if (valor !== 'mapa' && valor !== 'tarjetas') { return; }
    vista = valor;
    try { global.localStorage.setItem(CLAVE_VISTA, valor); } catch (e) { /* sin almacén */ }
    pintarCuerpo();
    var sel = refs.cuerpo ? refs.cuerpo.querySelector('.malla-vista__sel') : null;
    if (sel) { sel.focus(); }
  }

  function nodoCurso(codigo) {
    var M = motor();
    var curso = null;
    if (M && typeof M.getCurso === 'function') {
      try { curso = M.getCurso(codigo); } catch (e) { curso = null; }
    }
    var estado = estadoDe(codigo);
    var nombre = (curso && curso.nombre) ? String(curso.nombre) : codigo;
    var creditos = creditosDe(curso);

    var boton = crear('button', 'malla-curso malla-curso--' + estado);
    boton.type = 'button';
    boton.setAttribute('data-codigo', codigo);
    boton.setAttribute('aria-pressed', seleccion === codigo ? 'true' : 'false');
    /* AU-109: el estado no viaja solo en el color; va en texto y en el title. */
    boton.setAttribute('title', nombre + ' · ' + etiquetaEstado(estado));

    var aria = codigo + ' · ' + nombre + ' · ' + etiquetaEstado(estado);
    if (creditos !== null) {
      aria += ' · ' + creditos + ' ' + tr('malla.creditos', null, 'créditos');
    }
    boton.setAttribute('aria-label', aria);

    boton.appendChild(crear('span', 'malla-curso__cod', codigo));
    boton.appendChild(crear('span', 'malla-curso__nom', nombre));

    var pie = crear('span', 'malla-curso__pie');
    if (creditos !== null) {
      pie.appendChild(crear('span', 'malla-curso__cred',
        creditos + ' ' + tr('malla.creditosCorto', null, 'cr')));
    }
    var pill = crear('span', 'malla-estado malla-estado--' + estado);
    var pto = crear('i', 'malla-estado__pto');
    pto.setAttribute('aria-hidden', 'true');
    pill.appendChild(pto);
    pill.appendChild(document.createTextNode(etiquetaEstado(estado)));
    pie.appendChild(pill);
    boton.appendChild(pie);

    return boton;
  }

  function nodoSemestre(sem, activos) {
    var cursos = (sem && sem.cursos) || [];
    var activoAqui = false;
    for (var i = 0; i < cursos.length; i++) {
      if (activos[cursos[i]]) { activoAqui = true; break; }
    }

    var sec = crear('section', 'malla-semestre' + (activoAqui ? ' malla-semestre--activo' : ''));
    sec.setAttribute('aria-labelledby', 'malla-sem-' + sem.n);

    var cab = crear('header', 'malla-semestre__cab');
    var tit = crear('h2', 'malla-semestre__tit', tituloSemestre(sem));
    tit.id = 'malla-sem-' + sem.n;
    cab.appendChild(tit);
    if (activoAqui) {
      cab.appendChild(crear('span', 'pill pill--warn pill--mini',
        tr('malla.enCurso', null, 'En curso')));
    }

    var creditos = 0;
    for (var j = 0; j < cursos.length; j++) {
      var c = null;
      try { c = motor().getCurso(cursos[j]); } catch (e) { c = null; }
      var n = creditosDe(c);
      if (n !== null) { creditos += n; }
    }
    cab.appendChild(crear('span', 'malla-semestre__meta',
      cursos.length + ' ' + tr('malla.ramos', null, 'ramos') + ' · ' +
      creditos + ' ' + tr('malla.creditos', null, 'créditos')));
    sec.appendChild(cab);

    var lista = crear('ul', 'malla-cursos');
    for (var k = 0; k < cursos.length; k++) {
      var li = crear('li', 'malla-cursos__it');
      li.appendChild(nodoCurso(cursos[k]));
      lista.appendChild(li);
    }
    sec.appendChild(lista);
    return sec;
  }

  /* --------------------------------------------------------- 6. pintar cuerpo */

  function pintarCuerpo() {
    if (!refs.cuerpo) { return; }
    desmontarVista();
    refs.cuerpo.innerHTML = '';
    if (refs.sub) { refs.sub.textContent = subtitulo(); }

    var M = motor();
    if (!M) { mostrarVacio('sin-motor'); return; }

    var semestres;
    try {
      if (typeof M.tieneDatos === 'function' && !M.tieneDatos()) {
        mostrarVacio('sin-datos');
        return;
      }
      semestres = M.getSemestres() || [];
    } catch (e) {
      mostrarVacio('error');
      return;
    }
    if (!semestres.length) { mostrarVacio('sin-datos'); return; }

    aplicarColores();
    refs.cuerpo.appendChild(barra());

    /* si el ramo seleccionado ya no está (otra importación), la selección caduca */
    if (seleccion) {
      var existe = false;
      try { existe = !!M.getCurso(seleccion); } catch (e) { existe = false; }
      if (!existe) { seleccion = null; }
    }

    if (!pintarMapa()) { pintarTarjetas(); }
    marcarSeleccion();
  }

  /* Vista de mapa: el dibujo es de vista-mapa.js; aquí solo se le da el host,
     los textos y las secciones del manifiesto. Si no puede montarse, se cae a
     las tarjetas: una pantalla vacía nunca es la salida. */
  function pintarMapa() {
    var V = global.MimoMallaVistaMapa;
    if (vista !== 'mapa' || !V || typeof V.montar !== 'function') { return false; }

    var host = crear('div', 'malla-mapa-host');
    refs.cuerpo.appendChild(host);

    var montado = false;
    try {
      montado = V.montar(host, {
        t: tMapa,
        seleccion: seleccion,
        secciones: seccionesDelManifiesto()
      });
    } catch (e) {
      montado = false;
      if (global.console && global.console.error) {
        global.console.error('[mimo] la vista de mapa no se pudo montar', e);
      }
    }
    if (!montado) {
      if (host.parentNode) { host.parentNode.removeChild(host); }
      refs.mapa = null;
      return false;
    }
    refs.mapa = host;
    return true;
  }

  /* Vista de tarjetas: la rejilla de semestres de la iteración 3, tal cual. */
  function pintarTarjetas() {
    var semestres = [];
    try { semestres = motor().getSemestres() || []; } catch (e) { semestres = []; }

    var activos = codigosActivos();
    var rejilla = crear('div', 'malla-semestres');
    for (var i = 0; i < semestres.length; i++) {
      if (!semestres[i] || !(semestres[i].cursos || []).length) { continue; }
      rejilla.appendChild(nodoSemestre(semestres[i], activos));
    }
    if (!rejilla.children.length) { mostrarVacio('sin-datos'); return; }
    refs.cuerpo.appendChild(rejilla);
  }

  function marcarSeleccion() {
    if (!raiz) { return; }
    var tarjetas = raiz.querySelectorAll('.malla-curso');
    for (var i = 0; i < tarjetas.length; i++) {
      var cod = tarjetas[i].getAttribute('data-codigo');
      tarjetas[i].setAttribute('aria-pressed', cod === seleccion ? 'true' : 'false');
    }
    /* la vista de mapa pinta su propia selección; se le dice sin emitir */
    var V = global.MimoMallaVistaMapa;
    if (refs.mapa && V && typeof V.seleccionar === 'function') {
      try { V.seleccionar(seleccion); } catch (e) { /* ya se pinta sola */ }
    }
  }

  /* el mapa avisa de su selección por evento: la UI la adopta y repinta panel */
  function alSeleccionarMapa(ev) {
    var codigo = (ev && ev.detail && ev.detail.codigo) ? String(ev.detail.codigo) : null;
    seleccion = codigo || null;
    marcarSeleccion();
    pedirPanel();
  }

  /* ------------------------------------------------------ 7. selección y teclado */

  function elegir(codigo) {
    seleccion = (seleccion === codigo) ? null : codigo;
    marcarSeleccion();
    pedirPanel();
  }

  function centro(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* Flechas: vecino geométrico en esa dirección. Robusto cuando la rejilla
     cambia de columnas con el ancho, sin cablear índices a mano. */
  function vecino(actual, tarjetas, tecla) {
    var ca = centro(actual.getBoundingClientRect());
    var dir = { x: 0, y: 0 };
    if (tecla === 'ArrowLeft') { dir.x = -1; }
    if (tecla === 'ArrowRight') { dir.x = 1; }
    if (tecla === 'ArrowUp') { dir.y = -1; }
    if (tecla === 'ArrowDown') { dir.y = 1; }

    var mejor = null;
    var mejorD = Infinity;
    for (var i = 0; i < tarjetas.length; i++) {
      var el = tarjetas[i];
      if (el === actual) { continue; }
      var r = el.getBoundingClientRect();
      if (!r.width && !r.height) { continue; }
      var cc = centro(r);
      var dx = cc.x - ca.x;
      var dy = cc.y - ca.y;
      var avance = dx * dir.x + dy * dir.y;
      if (avance <= 1) { continue; }
      var desvio = Math.abs(dx * dir.y - dy * dir.x);
      var d = avance + desvio * 2;
      if (d < mejorD) { mejorD = d; mejor = el; }
    }
    return mejor;
  }

  function alTecla(ev) {
    if (!raiz) { return; }
    var objetivo = ev.target;
    if (!objetivo || typeof objetivo.closest !== 'function') { return; }
    var tarjeta = objetivo.closest('.malla-curso');
    if (!tarjeta) { return; }
    /* Enter y Espacio los resuelve el propio <button> (click); no se reimplementan. */
    var tecla = ev.key;
    if (tecla === 'Home' || tecla === 'End' || /^Arrow(Up|Down|Left|Right)$/.test(tecla)) {
      var tarjetas = raiz.querySelectorAll('.malla-curso');
      if (!tarjetas.length) { return; }
      ev.preventDefault();
      if (tecla === 'Home') { tarjetas[0].focus(); return; }
      if (tecla === 'End') { tarjetas[tarjetas.length - 1].focus(); return; }
      var destino = vecino(tarjeta, tarjetas, tecla);
      if (destino) { destino.focus(); }
    }
  }

  /* ------------------------------------------------------- 8. acciones */

  function importar() {
    if (!motor()) {
      avisar(tr('malla.import.sinMotor', null,
        'El motor de la malla aún no está cargado: no se puede importar.'), 'bad', 'ic-info');
      return;
    }
    if (!refs.input) { return; }
    refs.input.click();
  }

  function alElegirArchivo() {
    var input = refs.input;
    var archivo = input && input.files && input.files[0];
    if (!archivo) { return; }
    var IM = global.MimoMallaImportar;
    if (!IM || typeof IM.desdeArchivo !== 'function') {
      avisar(tr('malla.import.sinImportador', null,
        'Falta bloques/malla/importar.js: no se puede leer el archivo.'), 'bad', 'ic-info');
      if (input) { input.value = ''; }
      return;
    }
    var promesa;
    try {
      promesa = IM.desdeArchivo(archivo);
    } catch (e) {
      avisar(tr('malla.import.error', null, 'No se pudo leer el archivo: ') + (e && e.message ? e.message : ''), 'bad', 'ic-info');
      input.value = '';
      return;
    }
    if (!promesa || typeof promesa.then !== 'function') {
      avisar(tr('malla.import.error', null, 'No se pudo leer el archivo.'), 'bad', 'ic-info');
      input.value = '';
      return;
    }
    promesa.then(function (r) {
      if (r && r.ok) {
        var re = r.resumen || {};
        avisar(tr('malla.import.ok', {
          cursos: re.cursos || 0, aprobados: re.aprobados || 0, activos: re.activos || 0
        }, 'Malla importada: ' + (re.cursos || 0) + ' cursos · ' +
           (re.aprobados || 0) + ' aprobados · ' + (re.activos || 0) + ' en curso'),
          'ok', 'ic-info');
        refrescar();
        pedirPanel();
      } else {
        avisar((r && r.error) ? String(r.error) : tr('malla.import.error', null,
          'No se pudo importar el archivo.'), 'bad', 'ic-info');
      }
      if (input) { input.value = ''; }
    }, function (err) {
      avisar(tr('malla.import.error', null, 'No se pudo importar el archivo: ') +
        (err && err.message ? err.message : ''), 'bad', 'ic-info');
      if (input) { input.value = ''; }
    });
    if (input) { input.value = ''; }
  }

  function exportar() {
    var resumen = null;
    var E = global.MimoMallaExportar;
    if (E && typeof E.resumen === 'function') {
      try { resumen = E.resumen(); } catch (e) { resumen = null; }
    }
    var cola = tr('malla.export.4e', null, 'La exportación completa llega en la 4e.');
    if (resumen) {
      avisar(tr('malla.export.resumen', {
        cursos: resumen.cursos || 0, aprobados: resumen.aprobados || 0, activos: resumen.activos || 0
      }, (resumen.cursos || 0) + ' cursos · ' + (resumen.aprobados || 0) + ' aprobados · ' +
         (resumen.activos || 0) + ' en curso. ') + cola, '', 'ic-info');
    } else {
      avisar(tr('malla.export.sinExportador', null, 'No hay exportador cargado todavía. ') + cola, '', 'ic-info');
    }
  }

  function accion(nombre) {
    if (nombre === 'importar') { importar(); return; }
    if (nombre === 'exportar') { exportar(); return; }
    if (nombre === 'refrescar') { refrescar(); return; }
  }

  function alClic(ev) {
    var objetivo = ev.target;
    if (!objetivo || typeof objetivo.closest !== 'function') { return; }
    var boton = objetivo.closest('[data-accion]');
    if (boton) {
      accion(boton.getAttribute('data-accion'));
      return;
    }
    var tarjeta = objetivo.closest('.malla-curso');
    if (tarjeta) {
      elegir(tarjeta.getAttribute('data-codigo'));
    }
  }

  /* -------------------------------------------------------- 9. panel derecho */

  function itemsRequisitos(curso) {
    var items = [];
    var reqs = (curso && Array.isArray(curso.requisitos)) ? curso.requisitos : [];
    for (var i = 0; i < reqs.length; i++) {
      items.push({ t: String(reqs[i]), meta: etiquetaEstado(estadoDe(reqs[i])) });
    }
    var grupos = (curso && Array.isArray(curso.requisitos_o)) ? curso.requisitos_o : [];
    for (var j = 0; j < grupos.length; j++) {
      var grupo = Array.isArray(grupos[j]) ? grupos[j] : [];
      items.push({
        t: grupo.join(' ' + tr('malla.o', null, 'o') + ' '),
        meta: tr('malla.panel.unoDe', null, 'uno de los dos')
      });
    }
    return items;
  }

  function panel() {
    if (!montada || !seleccion) { return null; }
    var M = motor();
    if (!M) { return null; }

    var codigo = seleccion;
    var curso = null;
    try { curso = M.getCurso(codigo); } catch (e) { curso = null; }
    if (!curso) { return null; }

    var estado = estadoDe(codigo);
    var bloques = [];

    var basicos = [{ t: tr('malla.panel.estado', null, 'Estado'), meta: etiquetaEstado(estado) }];
    var creditos = creditosDe(curso);
    if (creditos !== null) {
      basicos.push({ t: tr('malla.panel.creditos', null, 'Créditos'), meta: String(creditos) });
    }
    var semestre = null;
    try {
      var semestres = M.getSemestres() || [];
      for (var i = 0; i < semestres.length; i++) {
        if ((semestres[i].cursos || []).indexOf(codigo) >= 0) { semestre = semestres[i]; break; }
      }
    } catch (e) { semestre = null; }
    if (semestre) {
      basicos.push({ t: tr('malla.panel.semestre', null, 'Semestre'), meta: tituloSemestre(semestre) });
    }
    bloques.push({
      h: codigo + ' · ' + String(curso.nombre || codigo),
      items: basicos
    });

    if (Array.isArray(curso.requisitos) || Array.isArray(curso.requisitos_o)) {
      var requisitos = itemsRequisitos(curso);
      if (!requisitos.length) {
        requisitos = [{ t: tr('malla.panel.sinRequisitos', null, 'Sin prerrequisitos'), meta: '' }];
      }
      bloques.push({ h: tr('malla.panel.prerrequisitos', null, 'Prerrequisitos'), items: requisitos });
    }

    try {
      var abre = (typeof M.desbloquea === 'function') ? (M.desbloquea(codigo) || []) : [];
      var itemsAbre = [];
      for (var k = 0; k < abre.length; k++) {
        itemsAbre.push({ t: String(abre[k]), meta: etiquetaEstado(estadoDe(abre[k])) });
      }
      if (!itemsAbre.length) {
        itemsAbre = [{ t: tr('malla.panel.noDesbloquea', null, 'No abre paso a ningún ramo'), meta: '' }];
      }
      bloques.push({ h: tr('malla.panel.desbloquea', null, 'Desbloquea'), items: itemsAbre });
    } catch (e) { /* sin bloque de desbloqueo antes que datos inventados */ }

    if (typeof M.getNota === 'function') {
      var nota = null;
      try { nota = M.getNota(codigo); } catch (e) { nota = null; }
      var notaTxt = formatearNota(nota);
      if (notaTxt !== null) {
        bloques.push({
          h: tr('malla.panel.notas', null, 'Notas'),
          items: [{ t: tr('malla.panel.notaFinal', null, 'Nota final'), meta: notaTxt }]
        });
      }
    }

    return {
      titulo: tr('malla.panel.titulo', null, 'Detalle del curso'),
      bloques: bloques
    };
  }

  /* ------------------------------------------------------ 10. ciclo de vida */

  function montar(raizNueva, ctxNuevo) {
    if (!raizNueva || typeof raizNueva.appendChild !== 'function') { return false; }
    if (montada) { desmontar(); }

    raiz = raizNueva;
    ctx = ctxNuevo || {};
    montada = true;
    seleccion = null;
    oyentes = [];
    refs = { sub: null, cuerpo: null, input: null, mapa: null, manifiesto: null };
    vista = vistaInicial();

    raiz.classList.add('malla-pantalla');
    raiz.setAttribute('aria-labelledby', 'malla-titulo');
    raiz.innerHTML = '';

    var cab = construirCabecera();
    raiz.appendChild(cab);

    refs.cuerpo = crear('div', 'malla-cuerpo');
    raiz.appendChild(refs.cuerpo);

    escuchar(raiz, 'click', alClic);
    escuchar(raiz, 'keydown', alTecla);
    escuchar(raiz, 'change', alCambiarVista);
    escuchar(raiz, 'malla:seleccionar', alSeleccionarMapa);
    escuchar(refs.input, 'change', alElegirArchivo);

    pintarCuerpo();
    cargarManifiesto();
    return true;
  }

  function desmontar() {
    olvidarOyentes();
    desmontarVista();
    if (raiz) {
      raiz.innerHTML = '';
      raiz.classList.remove('malla-pantalla');
      raiz.removeAttribute('aria-labelledby');
      for (var i = 0; i < ESTADOS.length; i++) {
        raiz.style.removeProperty('--malla-color-' + ESTADOS[i]);
      }
    }
    raiz = null;
    ctx = null;
    refs = { sub: null, cuerpo: null, input: null, mapa: null, manifiesto: null };
    montada = false;
    seleccion = null;
    vista = 'mapa';
    manifiestoCargando = false;
  }

  function refrescar() {
    if (!montada || !raiz) { return false; }
    pintarCuerpo();
    pedirPanel();
    return true;
  }

  /* ------------------------------------------------------------ 11. registro */

  global.MimoBloques = global.MimoBloques || {};
  global.MimoBloques[ID] = {
    id: ID,
    montar: montar,
    desmontar: desmontar,
    panel: panel,
    refrescar: refrescar
  };

}(window));
