/* ============================================================================
   contexto.js — Mimo Nuevo · sustrato comun · EL MENU DEL BOTON DERECHO
   (bloque T003; portado de `referencia/mimo-app-53cc22d/js/comun/12-contexto.js`)

   QUE ES
   Un solo menu para toda la aplicacion: clic derecho sobre una tarjeta y sale,
   en el sitio del puntero, lo que se puede hacer con ESA cosa. Sustituye al
   menu del navegador SOLO cuando el objeto tiene acciones; en el resto de la
   pantalla el boton derecho se comporta como siempre (no se secuestra).

   COMO SE ANADE UNA SECCION (T004, T007, T008)
   Se registra su selector y una funcion que devuelve las filas:

       MimoComun.registrarContexto('#malla .nodo[data-cod]', contextoMalla);

   Nada mas. La seccion no sabe como se pinta el menu, ni el menu sabe de la
   seccion. La primera seccion registrada que reconozca el objeto abre el menu.

   LAS FILAS
     {t:'Texto', al:function}                 una accion
     {t:'Texto', al:function, on:true}        una accion ACTIVA (ya esta en ese estado)
     {t:'Texto', al:function, peligro:true}   una accion que borra (en rojo)
     {sep:true}                               una raya de separacion
     {cab:'Texto'}                            un encabezado (lo que estas tocando)

   HOY NO HAY NINGUNA SECCION REGISTRADA: el registro esta vacio y el
   `contextmenu` sigue siendo el del navegador en toda la pantalla. Los
   manejadores son de T004 (malla), T007 (calendario) y T008 (tareas). Este
   bloque entrega solo la maquinaria, declarado como HUECO en la evidencia.

   API (todo cuelga de window.MimoComun):
     MimoComun.registrarContexto(selector, fn)
     MimoComun.abrirMenuContexto(ev, filas)   -> true si abrio
     MimoComun.cerrarMenuContexto()
     MimoComun.MENU_CTX                       el registro, para poder mirarlo
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var MENU_CTX = {};

  function esc(t) {
    if (typeof Mimo.esc === 'function') { return Mimo.esc(t); }
    return String(t === null || t === undefined ? '' : t);
  }

  function menuCtxFuera(ev) {
    var m = document.getElementById('menu-ctx');
    if (m && !m.contains(ev.target)) { cerrarMenuContexto(); }
  }
  function menuCtxEsc(ev) { if (ev.key === 'Escape') { cerrarMenuContexto(); } }

  function cerrarMenuContexto() {
    var m = document.getElementById('menu-ctx');
    if (m && m.parentNode) { m.parentNode.removeChild(m); }
    document.removeEventListener('mousedown', menuCtxFuera, true);
    document.removeEventListener('keydown', menuCtxEsc, true);
    window.removeEventListener('resize', cerrarMenuContexto);
    window.removeEventListener('scroll', cerrarMenuContexto, true);
  }

  function abrirMenuContexto(ev, filas) {
    cerrarMenuContexto();
    if (!filas || !filas.length) { return false; }

    var m = document.createElement('div');
    m.id = 'menu-ctx';
    m.className = 'menu-ctx';
    m.setAttribute('role', 'menu');
    var html = '';
    for (var i = 0; i < filas.length; i++) {
      var f = filas[i];
      if (f.cab !== undefined) {
        html += '<div class="ms-titulo">' + esc(f.cab) + '</div>';
      } else if (f.sep) {
        html += '<div class="ms-sep"></div>';
      } else {
        html += '<button type="button" class="ms-op' + (f.on ? ' on' : '') +
                (f.peligro ? ' ms-peligro' : '') + '" role="menuitem">' + esc(f.t) + '</button>';
      }
    }
    m.innerHTML = html;
    document.body.appendChild(m);

    // Junto al cursor, pero sin salirse de la ventana por ningun lado.
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - r.width - 8)) + 'px';
    m.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - r.height - 8)) + 'px';

    // Solo las filas con accion, en el mismo orden en que se pintaron los botones.
    var acciones = [];
    for (var j = 0; j < filas.length; j++) { if (filas[j].al) { acciones.push(filas[j]); } }
    var botones = m.querySelectorAll('.ms-op');
    for (var k = 0; k < botones.length; k++) {
      (function (btn, idx) {
        btn.onclick = function () {
          var f = acciones[idx];
          cerrarMenuContexto();
          if (f && typeof f.al === 'function') { f.al(); }
        };
      })(botones[k], k);
    }

    document.addEventListener('mousedown', menuCtxFuera, true);
    document.addEventListener('keydown', menuCtxEsc, true);
    window.addEventListener('resize', cerrarMenuContexto);
    window.addEventListener('scroll', cerrarMenuContexto, true);
    return true;
  }

  /* El manejador UNICO: mira donde se hizo clic derecho y pregunta a cada
     seccion registrada si ese objeto es suyo. La primera que lo reconozca abre. */
  function alMenuContexto(ev) {
    var objetivo = ev.target;
    if (!objetivo || typeof objetivo.closest !== 'function') { return; }
    for (var sel in MENU_CTX) {
      if (!Object.prototype.hasOwnProperty.call(MENU_CTX, sel)) { continue; }
      var el = objetivo.closest(sel);
      if (!el) { continue; }
      var filas = null;
      try { filas = MENU_CTX[sel](ev, el); } catch (e) { filas = null; }
      if (filas && filas.length) {
        ev.preventDefault();
        abrirMenuContexto(ev, filas);
        return;
      }
    }
  }

  function registrarContexto(selector, fn) {
    var sel = String(selector || '').replace(/^\s+|\s+$/g, '');
    if (!sel || typeof fn !== 'function') { return false; }
    MENU_CTX[sel] = fn;
    return true;
  }

  document.addEventListener('contextmenu', alMenuContexto);

  Mimo.MENU_CTX = MENU_CTX;
  Mimo.registrarContexto = registrarContexto;
  Mimo.abrirMenuContexto = abrirMenuContexto;
  Mimo.cerrarMenuContexto = cerrarMenuContexto;
})(MimoComun);
