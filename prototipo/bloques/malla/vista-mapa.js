/* ============================================================================
   bloques/malla/vista-mapa.js — vista de mapa del bloque Malla (iteración 4a)

   Qué es: la malla dibujada como un grafo por niveles (una columna por
   semestre/nivel) con las flechas de prerrequisito encima. Sustituye a la
   rejilla de tarjetas cuando el usuario elige «Mapa».

   Reglas que este fichero respeta:
   - NO calcula estados ni prerrequisitos: los pide a window.MimoMallaMotor
     (getSemestres, getCurso, getEstadoCurso, getCatalogo). Si el motor no
     está, montar() devuelve false y no se pinta nada.
   - NO escribe textos de interfaz: todos entran por `opciones.t`. Si `t` no
     resuelve una clave, se ve la clave; nunca se inventa una frase.
   - NO inventa colores: las clases que produce son las que define
     bloques/malla/vista-mapa.css, y los colores de allí son tokens (--malla-*).
   - Solo escribe dentro del contenedor que le entrega ui.js.

   API: window.MimoMallaVistaMapa = { id, montar, desmontar, refrescar, seleccionar }
   ============================================================================ */
(function (global) {
  'use strict';

  var ID = 'vista-mapa';
  var MAX_COLS = 12;                       /* una columna por nivel */
  var ESTADOS = ['aprobado', 'curso', 'disponible', 'bloqueado'];
  var NS = 'http://www.w3.org/2000/svg';

  /* Estado de la vista (una instancia: el bloque es UNA sección). */
  var contenedor = null;
  var opciones = null;
  var tFn = null;
  var raiz = null;
  var pista = null;
  var svg = null;
  var lienzo = null;
  var nodos = {};          /* codigo -> <button> */
  var ficha = {};          /* codigo -> {nivel, estado, anual} */
  var flechas = [];        /* [{g, req, curso}] */
  var seleccion = null;
  var oyentes = [];
  var observador = null;
  var raf = null;
  var vivo = false;

  /* ---------------------------------------------------------- 1. utilidades */

  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) { n.className = clase; }
    if (texto !== undefined && texto !== null) { n.textContent = String(texto); }
    return n;
  }

  function svgNodo(tag, clase) {
    var n = document.createElementNS(NS, tag);
    if (clase) { n.setAttribute('class', clase); }
    return n;
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

  /* i18n sin literales: la clave se sustituye con params; si no hay t o no la
     resuelve, se devuelve la clave (el hueco se ve, no se tapa con español). */
  function tr(clave, params) {
    var out = null;
    if (typeof tFn === 'function') {
      try { out = tFn(clave, params); } catch (e) { out = null; }
    }
    if (out === null || out === undefined || out === '') { out = clave; }
    out = String(out);
    if (params) {
      out = out.replace(/\{(\w+)\}/g, function (todo, nombre) {
        return (params[nombre] === undefined || params[nombre] === null) ? todo : String(params[nombre]);
      });
    }
    return out;
  }

  function aplanar(grupos) {
    var out = [];
    var lista = Array.isArray(grupos) ? grupos : [];
    for (var i = 0; i < lista.length; i++) {
      if (Array.isArray(lista[i])) { out = out.concat(lista[i]); }
    }
    return out;
  }

  function motor() {
    var M = global.MimoMallaMotor;
    if (!M) { return null; }
    if (typeof M.getSemestres !== 'function' || typeof M.getCurso !== 'function' ||
        typeof M.getEstadoCurso !== 'function' || typeof M.getCatalogo !== 'function') {
      return null;
    }
    return M;
  }

  function estadoDe(M, codigo) {
    var e = null;
    try { e = M.getEstadoCurso(codigo); } catch (err) { e = null; }
    return ESTADOS.indexOf(e) >= 0 ? e : 'desconocido';
  }

  function creditosDe(curso) {
    /* Number(null) es 0: un curso sin créditos NO tiene 0 créditos. */
    if (!curso || curso.creditos === null || curso.creditos === undefined || curso.creditos === '') {
      return null;
    }
    var n = Number(curso.creditos);
    return isFinite(n) ? n : null;
  }

  function etiquetaEstado(estado) {
    return tr('malla.estado.' + estado);
  }

  function nombreSeccion(sec) {
    var n = (sec && sec.nombre) ? String(sec.nombre) : '';
    if (!n) { return ''; }
    /* el manifiesto puede traer la clave i18n en vez del texto: si t la
       resuelve, se usa la traducción; si no, el valor es el nombre. */
    if (typeof tFn === 'function') {
      try {
        var v = tFn(n);
        if (v && v !== n) { return String(v); }
      } catch (e) { /* se usa el nombre tal cual */ }
    }
    return n;
  }

  /* --------------------------------------------------- 2. reparto en columnas */

  /* Niveles presentes, en el orden del motor (1..11, 99 al final). */
  function nivelesDe(semestres) {
    var out = [];
    for (var i = 0; i < semestres.length; i++) {
      var n = semestres[i] ? Number(semestres[i].n) : NaN;
      if (isFinite(n) && out.indexOf(n) < 0) { out.push(n); }
    }
    return out;
  }

  /* [{nombre, sigla, niveles:[...]}] → bloques visuales, sin niveles repetidos.
     Sin secciones: un único bloque sin fondo con todos los niveles. */
  function repartir(secciones, niveles) {
    var bloques = [];
    var puestos = {};
    var lista = Array.isArray(secciones) ? secciones : [];

    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      if (!s || typeof s !== 'object') { continue; }
      var propios = [];
      var crudos = Array.isArray(s.niveles) ? s.niveles : null;
      if (crudos) {
        for (var j = 0; j < crudos.length; j++) {
          var nv = Number(crudos[j]);
          if (isFinite(nv) && niveles.indexOf(nv) >= 0 && propios.indexOf(nv) < 0) { propios.push(nv); }
        }
      } else {
        var desde = Number(s.desde);
        var hasta = Number(s.hasta);
        if (isFinite(desde) && isFinite(hasta)) {
          for (var k = 0; k < niveles.length; k++) {
            if (niveles[k] >= desde && niveles[k] <= hasta) { propios.push(niveles[k]); }
          }
        }
      }
      if (!propios.length) { continue; }
      for (var m = 0; m < propios.length; m++) { puestos[propios[m]] = true; }
      bloques.push({ nombre: s.nombre || '', sigla: s.sigla || '', niveles: propios });
    }

    var sueltos = [];
    for (var p = 0; p < niveles.length; p++) {
      if (!puestos[niveles[p]]) { sueltos.push(niveles[p]); }
    }
    if (sueltos.length) { bloques.push({ nombre: '', sigla: '', niveles: sueltos }); }
    if (!bloques.length) { bloques.push({ nombre: '', sigla: '', niveles: niveles.slice() }); }
    return bloques;
  }

  /* --------------------------------------------------------- 3. construcción */

  function construirBloque(sec, semPorNivel, M) {
    var conTitulo = !!sec.nombre;
    var bloque = crear('section',
      'malla-mapa__bloque' + (conTitulo ? ' malla-mapa__bloque--seccion' : ''));
    bloque.setAttribute('aria-label', conTitulo ? nombreSeccion(sec) : tr('malla.mapa.aria'));

    if (conTitulo) {
      var h2 = crear('h2', 'malla-mapa__seccion-tit');
      if (sec.sigla) { h2.appendChild(crear('span', 'malla-mapa__sigla', sec.sigla)); }
      h2.appendChild(document.createTextNode(nombreSeccion(sec)));
      bloque.appendChild(h2);
    }

    var cols = crear('div', 'malla-mapa__cols');
    cols.style.setProperty('--malla-cols', String(sec.niveles.length));
    bloque.appendChild(cols);

    var total = sec.niveles.length;
    var fila = [];
    for (var c = 0; c < total; c++) { fila[c] = 2; }

    /* cabeceras: una por columna, en la fila 1 de la rejilla */
    for (var h = 0; h < total; h++) {
      var sem = semPorNivel[sec.niveles[h]] || { n: sec.niveles[h], cursos: [] };
      var cab = crear('div', 'malla-mapa__colcab');
      cab.setAttribute('data-col', String(h));
      cab.setAttribute('data-nivel', String(sec.niveles[h]));
      cab.style.gridColumn = String(h + 1);
      cab.style.gridRow = '1';
      cab.appendChild(crear('span', 'malla-mapa__nivel',
        sem.titulo ? String(sem.titulo) : tr('malla.semestreN', { n: sem.n })));
      var creditos = creditosColumna(sem, M);
      if (creditos !== null && creditos > 0) {
        cab.appendChild(crear('span', 'malla-mapa__cred',
          creditos + ' ' + tr('malla.creditosCorto')));
      }
      cols.appendChild(cab);
    }

    /* ramos: cada uno se coloca por (columna, fila) desde la fila 2 */
    for (var i = 0; i < total; i++) {
      var nivel = sec.niveles[i];
      var cursos = (semPorNivel[nivel] && semPorNivel[nivel].cursos) || [];
      for (var j = 0; j < cursos.length; j++) {
        cols.appendChild(construirNodo(cursos[j], i, nivel, fila, total, M));
      }
    }

    return bloque;
  }

  function creditosColumna(sem, M) {
    var cursos = (sem && sem.cursos) || [];
    var total = 0;
    var alguno = false;
    for (var i = 0; i < cursos.length; i++) {
      var c = null;
      try { c = M.getCurso(cursos[i]); } catch (e) { c = null; }
      var n = creditosDe(c);
      if (n !== null) { total += n; alguno = true; }
    }
    return alguno ? total : null;
  }

  function construirNodo(codigo, col, nivel, fila, total, M) {
    var curso = null;
    try { curso = M.getCurso(codigo); } catch (e) { curso = null; }
    var estado = estadoDe(M, codigo);
    var nombre = (curso && curso.nombre) ? String(curso.nombre) : codigo;
    var anual = !!(curso && curso.anual) && (col + 1 < total);
    var r;

    if (anual) {
      r = Math.max(fila[col], fila[col + 1]);
      fila[col] = r + 1;
      fila[col + 1] = r + 1;
    } else {
      r = fila[col];
      fila[col] = r + 1;
    }

    var clase = 'malla-nodo malla-nodo--' + estado;
    if (anual) { clase += ' malla-nodo--anual'; }
    if (nivel === 99) { clase += ' malla-nodo--mini'; }

    var boton = crear('button', clase);
    boton.type = 'button';
    boton.setAttribute('data-codigo', codigo);
    boton.setAttribute('data-col', String(col));
    boton.setAttribute('aria-pressed', seleccion === codigo ? 'true' : 'false');
    boton.style.gridColumn = anual ? (col + 1) + ' / span 2' : String(col + 1);
    boton.style.gridRow = String(r);

    var aria = codigo + ' · ' + nombre + ' · ' + etiquetaEstado(estado);
    if (anual) { aria += ' · ' + tr('malla.badge.anual'); }
    boton.setAttribute('aria-label', aria);
    boton.setAttribute('title', nombre + ' · ' + etiquetaEstado(estado));

    var cab = crear('span', 'malla-nodo__cab');
    cab.appendChild(crear('span', 'malla-nodo__cod', codigo));
    if (anual) {
      cab.appendChild(crear('span', 'malla-nodo__badge', tr('malla.badge.anual')));
    }
    boton.appendChild(cab);
    boton.appendChild(crear('span', 'malla-nodo__nom', nombre));

    nodos[codigo] = boton;
    ficha[codigo] = { nivel: nivel, estado: estado, anual: anual };
    return boton;
  }

  /* ------------------------------------------------------------ 4. pista */

  function actualizarPista() {
    if (!pista) { return; }
    if (seleccion) {
      pista.textContent = seleccion + ' · ' + tr('malla.mapa.leyendaSel');
      pista.setAttribute('data-hay', 'si');
    } else {
      pista.textContent = tr('malla.mapa.pista');
      pista.removeAttribute('data-hay');
    }
  }

  function actualizarAria() {
    for (var cod in nodos) {
      if (Object.prototype.hasOwnProperty.call(nodos, cod)) {
        nodos[cod].setAttribute('aria-pressed', cod === seleccion ? 'true' : 'false');
      }
    }
  }

  /* --------------------------------------------------------- 5. selección */

  /* arista = [requisito, curso]. Azul (entra): lo que el ramo elegido necesita,
     es decir, las aristas que APUNTAN a él. Ámbar (sale): lo que desbloquea,
     las que salen de él. El resto se queda dibujado, atenuado. */
  function claseDe(req, curso) {
    if (!seleccion) { return 'malla-flecha'; }
    if (curso === seleccion) { return 'malla-flecha malla-flecha--entra'; }
    if (req === seleccion) { return 'malla-flecha malla-flecha--sale'; }
    return 'malla-flecha malla-flecha--resto';
  }

  function pintarClasesFlechas() {
    for (var i = 0; i < flechas.length; i++) {
      flechas[i].g.setAttribute('class', claseDe(flechas[i].req, flechas[i].curso));
    }
  }

  /* aplica la selección; `emitir` distingue el clic del teclado (sí) de una
     orden del shell (no, para no rebotar el evento). */
  function aplicar(codigo, emitir) {
    seleccion = codigo || null;
    actualizarAria();
    actualizarPista();
    pintarClasesFlechas();
    if (!emitir || !raiz) { return; }
    var evento;
    try {
      evento = new global.CustomEvent('malla:seleccionar', {
        bubbles: true, detail: { codigo: seleccion }
      });
    } catch (e) {
      evento = document.createEvent('CustomEvent');
      evento.initCustomEvent('malla:seleccionar', true, false, { codigo: seleccion });
    }
    raiz.dispatchEvent(evento);
  }

  function elegir(codigo) {
    var nuevo = (seleccion === codigo) ? null : (codigo || null);
    aplicar(nuevo, true);
  }

  function alClic(ev) {
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') { return; }
    var boton = t.closest('.malla-nodo');
    if (!boton || !raiz || !raiz.contains(boton)) { return; }
    elegir(boton.getAttribute('data-codigo'));
  }

  /* --------------------------------------------------------- 6. teclado */

  function centro(r) {
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* vecino geométrico: funciona con la rejilla tal como quedó pintada. */
  function vecino(actual, lista, tecla) {
    var ca = centro(actual.getBoundingClientRect());
    var dir = { x: 0, y: 0 };
    if (tecla === 'ArrowLeft') { dir.x = -1; }
    if (tecla === 'ArrowRight') { dir.x = 1; }
    if (tecla === 'ArrowUp') { dir.y = -1; }
    if (tecla === 'ArrowDown') { dir.y = 1; }

    var mejor = null;
    var mejorD = Infinity;
    for (var i = 0; i < lista.length; i++) {
      var el = lista[i];
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
    var t = ev.target;
    if (!t || typeof t.closest !== 'function') { return; }
    var actual = t.closest('.malla-nodo');
    if (!actual) { return; }

    if (ev.key === 'Escape') {
      if (seleccion) {
        ev.preventDefault();
        aplicar(null, true);
      }
      return;
    }

    var tecla = ev.key;
    if (tecla !== 'Home' && tecla !== 'End' && !/^Arrow(Up|Down|Left|Right)$/.test(tecla)) { return; }
    var lista = raiz.querySelectorAll('.malla-nodo');
    if (!lista.length) { return; }
    ev.preventDefault();
    if (tecla === 'Home') { lista[0].focus(); return; }
    if (tecla === 'End') { lista[lista.length - 1].focus(); return; }
    var destino = vecino(actual, lista, tecla);
    if (destino) { destino.focus(); }
  }

  /* --------------------------------------------------------- 7. flechas */

  function programar() {
    if (!vivo || raf !== null) { return; }
    raf = global.requestAnimationFrame(function () {
      raf = null;
      if (vivo) { dibujar(); }
    });
  }

  /* Mide los nodos y traza las aristas. Todo en coordenadas del lienzo. */
  function dibujar() {
    if (!vivo || !svg || !lienzo || !raiz) { return; }
    var ancho = lienzo.offsetWidth;
    var alto = lienzo.offsetHeight;
    if (!ancho || !alto) { return; }

    svg.setAttribute('width', String(ancho));
    svg.setAttribute('height', String(alto));
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);

    var base = lienzo.getBoundingClientRect();
    var pos = {};
    var nivelDe = {};
    var columnas = [];
    var porCol = {};
    var cod, i, j;

    /* las cabeceras dan la x de cada columna; un anual invade la siguiente.
       `tope` es hasta dónde llegan: ninguna franja de viaje puede pasar por
       encima del texto de una cabecera. */
    var cabs = raiz.querySelectorAll('.malla-mapa__colcab');
    var tope = 0;
    for (i = 0; i < cabs.length; i++) {
      var rc = cabs[i].getBoundingClientRect();
      columnas.push({
        x0: rc.left - base.left,
        x1: rc.left - base.left + rc.width,
        nivel: Number(cabs[i].getAttribute('data-nivel')),
        nodos: []
      });
      if (rc.bottom - base.top > tope) { tope = rc.bottom - base.top + 4; }
    }
    columnas.sort(function (a, b) { return a.x0 - b.x0; });
    for (i = 0; i < columnas.length; i++) {
      columnas[i].i = i;
      porCol[i] = [];
    }

    function colDe(x) {
      for (var k = 0; k < columnas.length; k++) {
        if (x >= columnas[k].x0 - 2 && x < columnas[k].x1 - 2) { return k; }
      }
      /* sin cabecera a la vista: la columna más cercana por la izquierda */
      var mejor = 0;
      for (var m = 0; m < columnas.length; m++) {
        if (columnas[m].x0 <= x) { mejor = m; }
      }
      return mejor;
    }

    /* Ancho del pasillo a la derecha de la columna i. Los desvíos del trazado
       se reparten DENTRO de este hueco: con el pasillo de 12 px, un desvío de
       31 px (el del original, pensado para pasillos de 40) se metía en la
       tarjeta de al lado. */
    function pasillo(i) {
      if (i + 1 < columnas.length) {
        return Math.max(6, columnas[i + 1].x0 - columnas[i].x1);
      }
      if (i > 0) { return Math.max(6, columnas[i].x0 - columnas[i - 1].x1); }
      return 12;
    }

    for (cod in nodos) {
      if (!Object.prototype.hasOwnProperty.call(nodos, cod)) { continue; }
      var rb = nodos[cod].getBoundingClientRect();
      if (!rb.width && !rb.height) { continue; }
      var p = {
        x: rb.left - base.left,
        y: rb.top - base.top,
        w: rb.width,
        h: rb.height
      };
      pos[cod] = p;
      nivelDe[cod] = (ficha[cod] && ficha[cod].nivel !== undefined) ? ficha[cod].nivel : 99;
      var ci = colDe(p.x);
      columnas[ci].nodos.push(p);
      porCol[ci].push(p);
      /* un anual ocupa dos columnas: para el trazado es estorbo en la vecina */
      if (ficha[cod] && ficha[cod].anual) {
        for (j = ci + 1; j < columnas.length; j++) {
          if (p.x + p.w <= columnas[j].x0 + 2) { break; }
          porCol[j] = porCol[j] || [];
          porCol[j].push(p);
        }
      }
    }

    /* pasillos: una franja horizontal libre de la columna k, por su centro */
    function tapa(k, y) {
      var ps = porCol[k] || [];
      for (var n = 0; n < ps.length; n++) {
        if (y > ps[n].y - 3 && y < ps[n].y + ps[n].h + 3) { return true; }
      }
      return false;
    }

    function franjas(k) {
      var ps = (porCol[k] || []).slice().sort(function (a, b) { return a.y - b.y; });
      var out = [];
      var prev = tope;
      for (var n = 0; n < ps.length; n++) {
        if (ps[n].y - 3 > prev) { out.push((prev + ps[n].y - 3) / 2); }
        prev = Math.max(prev, ps[n].y + ps[n].h + 3);
      }
      if (alto > prev) { out.push((prev + alto) / 2); }
      return out;
    }

    /* aristas: cada curso con sus requisitos y sus grupos «basta uno» */
    var catalogo = {};
    try { catalogo = global.MimoMallaMotor.getCatalogo() || {}; } catch (e) { catalogo = {}; }
    var codigos = Object.keys(catalogo).sort();
    var aristas = [];
    for (i = 0; i < codigos.length; i++) {
      var c = catalogo[codigos[i]];
      if (!pos[codigos[i]]) { continue; }
      var fuentes = (Array.isArray(c.requisitos) ? c.requisitos : []).concat(aplanar(c.requisitos_o));
      for (j = 0; j < fuentes.length; j++) {
        if (pos[fuentes[j]]) { aristas.push([fuentes[j], codigos[i]]); }
      }
    }
    /* orden estable: si no, los desvíos cambian de sitio en cada repintado */
    aristas.sort(function (a, b) {
      return (nivelDe[a[0]] - nivelDe[b[0]]) || (pos[a[0]].y - pos[b[0]].y);
    });

    var usados = {};
    function turno(k) {
      var v = usados[k] || 0;
      usados[k] = v + 1;
      return v;
    }

    /* Todos los recuadros, con su código: sirven para comprobar que un tramo
       del trazado no pisa una tarjeta. Devuelve el borde derecho del estorbo
       más lejano (o -Infinity si el tramo está libre). */
    var todos = [];
    for (cod in pos) {
      if (Object.prototype.hasOwnProperty.call(pos, cod)) {
        todos.push({ cod: cod, p: pos[cod] });
      }
    }

    function tapaVertical(x, ya, yb, a, b) {
      var y0 = Math.min(ya, yb);
      var y1b = Math.max(ya, yb);
      var derecha = -Infinity;
      for (var n = 0; n < todos.length; n++) {
        var q = todos[n];
        if (q.cod === a || q.cod === b) { continue; }
        if (x > q.p.x - 2 && x < q.p.x + q.p.w + 2 &&
            y1b > q.p.y - 2 && y0 < q.p.y + q.p.h + 2) {
          if (q.p.x + q.p.w > derecha) { derecha = q.p.x + q.p.w; }
        }
      }
      return derecha;
    }

    function tapaHorizontal(y, xa, xb, a, b) {
      var x0 = Math.min(xa, xb);
      var x1b = Math.max(xa, xb);
      for (var n = 0; n < todos.length; n++) {
        var q = todos[n];
        if (q.cod === a || q.cod === b) { continue; }
        if (y > q.p.y - 2 && y < q.p.y + q.p.h + 2 &&
            x1b > q.p.x - 2 && x0 < q.p.x + q.p.w + 2) {
          return true;
        }
      }
      return false;
    }

    while (svg.firstChild) { svg.removeChild(svg.firstChild); }
    flechas = [];

    for (i = 0; i < aristas.length; i++) {
      var req = aristas[i][0];
      var cur = aristas[i][1];
      var p1 = pos[req];
      var p2 = pos[cur];
      var i1 = colDe(p1.x);
      var i2 = colDe(p2.x);
      var nl1 = nivelDe[req];
      var nl2 = nivelDe[cur];
      var x1 = p1.x + p1.w;
      var y1 = p1.y + p1.h / 2;
      var x2 = p2.x;
      var y2 = p2.y + p2.h / 2;
      var pts;
      var punta;
      var puntaDerecha = false;

      if (i1 === i2) {
        /* mismo nivel (p. ej. Inglés I → II): sale por la derecha y vuelve */
        var huecoM = pasillo(i1);
        var xOut = Math.max(p1.x + p1.w, p2.x + p2.w) + huecoM * 0.55 +
          (turno('m' + nl1) % 3) * Math.max(0, huecoM * 0.12);
        var blqM = tapaVertical(xOut, y1, y2, req, cur);
        if (isFinite(blqM)) { xOut = blqM + 8; }
        pts = [[x1, y1], [xOut, y1], [xOut, y2], [p2.x + p2.w, y2]];
        puntaDerecha = true;
      } else if (Math.abs(i2 - i1) <= 1) {
        /* columnas vecinas: un solo codo en el pasillo; si un anual lo tapa,
           se rodea por la derecha del recuadro y se entra por ese lado */
        var huecoA = Math.min(pasillo(i1), pasillo(i2));
        var xm = (x1 + x2) / 2 + (turno('a' + nl1) % 3 - 1) * Math.max(0, huecoA / 2 - 3);
        var blqA = tapaVertical(xm, y1, y2, req, cur);
        if (isFinite(blqA) && !tapaHorizontal(y1, x1, blqA + 8, req, cur)) {
          var xL = blqA + 8;
          pts = [[x1, y1], [xL, y1], [xL, y2], [p2.x + p2.w, y2]];
          puntaDerecha = true;
        } else {
          pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
        }
      } else {
        /* salta columnas: viaja por una franja horizontal libre de las de en medio */
        var huecoI = pasillo(i1);
        var huecoJ = pasillo(i2 > 0 ? i2 - 1 : i2);
        var desvio1 = x1 + 3 + (turno('i' + nl1) % 4) * Math.max(0, (huecoI - 6) / 3);
        var desvio2 = x2 - 3 - (turno('j' + nl2) % 4) * Math.max(0, (huecoJ - 6) / 3);
        var cands = [];
        var desde = Math.min(i1, i2) + 1;
        var hasta = Math.max(i1, i2);
        for (var k = desde; k < hasta; k++) { cands = cands.concat(franjas(k)); }
        if (!cands.length) { cands = [(y1 + y2) / 2]; }
        var medio = (y1 + y2) / 2;
        var estorbo = function (v) {
          var n = 0;
          for (var m = desde; m < hasta; m++) { if (tapa(m, v)) { n++; } }
          return n;
        };
        var yy = cands.slice().sort(function (m, n) {
          return (estorbo(m) - estorbo(n)) || (Math.abs(m - medio) - Math.abs(n - medio));
        })[0];
        var blqI = tapaVertical(desvio1, y1, yy, req, cur);
        if (isFinite(blqI)) { desvio1 = blqI + 4; }
        var blqJ = tapaVertical(desvio2, y2, yy, req, cur);
        if (isFinite(blqJ)) { desvio2 = blqJ + 4; }
        pts = [[x1, y1], [desvio1, y1], [desvio1, yy], [desvio2, yy], [desvio2, y2], [x2, y2]];
      }

      var d = '';
      for (j = 0; j < pts.length; j++) {
        d += (j ? 'L' : 'M') + Math.round(pts[j][0]) + ' ' + Math.round(pts[j][1]) + (j === pts.length - 1 ? '' : ' ');
      }

      /* punta orientada al lado por el que entra: izquierda normal, derecha en
         el caso de misma columna */
      if (puntaDerecha) {
        var xt = p2.x + p2.w;
        punta = Math.round(xt) + ',' + Math.round(y2) + ' ' +
          Math.round(xt + 7) + ',' + Math.round(y2 - 4) + ' ' +
          Math.round(xt + 7) + ',' + Math.round(y2 + 4);
      } else {
        punta = Math.round(x2) + ',' + Math.round(y2) + ' ' +
          Math.round(x2 - 7) + ',' + Math.round(y2 - 4) + ' ' +
          Math.round(x2 - 7) + ',' + Math.round(y2 + 4);
      }

      var g = svgNodo('g', claseDe(req, cur));
      g.setAttribute('data-req', req);
      g.setAttribute('data-curso', cur);
      var path = svgNodo('path');
      path.setAttribute('d', d);
      g.appendChild(path);
      var poligono = svgNodo('polygon', 'malla-flecha__punta');
      poligono.setAttribute('points', punta);
      g.appendChild(poligono);
      svg.appendChild(g);
      flechas.push({ g: g, req: req, curso: cur });
    }
  }

  /* ------------------------------------------------------- 8. ciclo de vida */

  function montar(nuevoContenedor, nuevasOpciones) {
    if (!nuevoContenedor || typeof nuevoContenedor.appendChild !== 'function') { return false; }
    var M = motor();
    if (!M) { return false; }

    var semestres = [];
    try { semestres = M.getSemestres() || []; } catch (e) { semestres = []; }
    if (!semestres.length) { return false; }

    if (vivo) { desmontar(); }

    contenedor = nuevoContenedor;
    opciones = nuevasOpciones || {};
    tFn = (typeof opciones.t === 'function') ? opciones.t : null;
    seleccion = opciones.seleccion ? String(opciones.seleccion) : null;
    vivo = true;

    var niveles = nivelesDe(semestres);
    if (niveles.length > MAX_COLS) {
      if (global.console && global.console.warn) {
        global.console.warn('[malla] ' + niveles.length + ' levels, showing ' + MAX_COLS +
          ': the map keeps one column per level up to the limit.');
      }
      niveles = niveles.slice(0, MAX_COLS);
    }

    var semPorNivel = {};
    for (var i = 0; i < semestres.length; i++) {
      var n = semestres[i] ? Number(semestres[i].n) : NaN;
      if (isFinite(n)) { semPorNivel[n] = semestres[i]; }
    }

    raiz = crear('div', 'malla-mapa');
    raiz.setAttribute('aria-label', tr('malla.mapa.aria'));

    pista = crear('p', 'malla-mapa__pista');
    pista.setAttribute('role', 'status');
    raiz.appendChild(pista);

    var scroll = crear('div', 'malla-mapa__scroll');
    lienzo = crear('div', 'malla-mapa__lienzo');

    svg = svgNodo('svg', 'malla-mapa__flechas');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    lienzo.appendChild(svg);

    var bloques = repartir(opciones.secciones, niveles);
    for (var b = 0; b < bloques.length; b++) {
      lienzo.appendChild(construirBloque(bloques[b], semPorNivel, M));
    }

    scroll.appendChild(lienzo);
    raiz.appendChild(scroll);
    contenedor.appendChild(raiz);

    actualizarAria();
    actualizarPista();

    escuchar(raiz, 'click', alClic);
    escuchar(raiz, 'keydown', alTecla);

    if (global.ResizeObserver) {
      observador = new global.ResizeObserver(programar);
      observador.observe(lienzo);
    }
    /* la métrica cambia cuando terminan de cargar las fuentes: se remide */
    if (global.document && document.fonts && document.fonts.ready &&
        typeof document.fonts.ready.then === 'function') {
      document.fonts.ready.then(function () {
        if (vivo) { programar(); }
      });
    }

    dibujar();
    return true;
  }

  function desmontar() {
    olvidarOyentes();
    if (observador) {
      try { observador.disconnect(); } catch (e) { /* ya estaba suelto */ }
      observador = null;
    }
    if (raf !== null) {
      try { global.cancelAnimationFrame(raf); } catch (e) { /* sin rAF */ }
      raf = null;
    }
    if (contenedor) { contenedor.innerHTML = ''; }
    contenedor = null;
    opciones = null;
    tFn = null;
    raiz = null;
    pista = null;
    svg = null;
    lienzo = null;
    nodos = {};
    ficha = {};
    flechas = [];
    seleccion = null;
    vivo = false;
  }

  function refrescar() {
    if (!vivo || !contenedor) { return false; }
    var c = contenedor;
    var o = opciones || {};
    var s = seleccion;
    return montar(c, { t: o.t, secciones: o.secciones, seleccion: s });
  }

  /* fija la selección SIN emitir: la usa ui.js al cambiar de vista */
  function seleccionar(codigo) {
    if (!vivo) { return; }
    var nuevo = codigo ? String(codigo) : null;
    if (nuevo && !nodos[nuevo]) { nuevo = null; }
    if (nuevo === seleccion) { return; }
    aplicar(nuevo, false);
  }

  global.MimoMallaVistaMapa = {
    id: ID,
    montar: montar,
    desmontar: desmontar,
    refrescar: refrescar,
    seleccionar: seleccionar
  };

}(window));
