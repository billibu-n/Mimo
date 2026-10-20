/* ============================================================================
   select.js — Mimo Nuevo · sustrato comun · EL DESPLEGABLE PROPIO
   (bloque T003; portado de `referencia/mimo-app-53cc22d/js/comun/07-select.js`)

   POR QUE EXISTE
   Los `<select>` nativos abren un menu que DIBUJA el navegador: cuadrado, con
   borde propio y que no respeta el tema (en oscuro sale un recuadro ajeno a la
   piel). Eso NO se puede arreglar con CSS.

   COMO LO RESUELVE
   Se mantiene el `<select>` nativo, OCULTO, como fuente de verdad: todo el
   codigo que ya existe (los `onchange`, el `el.value`, los repintados) sigue
   funcionando sin tocar una linea de logica. El desplegable propio es la capa
   de arriba: al elegir una opcion escribe el `selectedIndex` del select oculto
   y le dispara su `change`.

   Un solo patron para todo el proyecto: si manana hay que cambiar el
   desplegable, se cambia aqui y afecta a todos los bloques.

   LO QUE NO SE TRANSFORMA
   Un select MULTIPLE (o con size > 1) es una lista de seleccion multiple, no
   un menu: se deja como esta. Es el caso de los prerrequisitos del editor de
   ramos (T004).

   API (todo cuelga de window.MimoComun):
     MimoComun.estilizarSelect(sel)     convierte uno (idempotente)
     MimoComun.estilizarSelects(raiz)   todos los que haya bajo una raiz
     MimoComun.cerrarSelects()          cierra los abiertos
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var CONTADOR = 0;

  function cerrarSelects() {
    var abiertos = document.querySelectorAll('.sel-propio.abierto');
    for (var i = 0; i < abiertos.length; i++) { abiertos[i].classList.remove('abierto'); }
  }

  function estilizarSelect(sel) {
    if (!sel || sel.dataset.propio === '1') { return null; }   // ya procesado
    if (sel.closest('.sel-propio')) { return null; }
    if (sel.multiple || (sel.size && sel.size > 1)) { return null; }

    // El envoltorio cuelga en el lugar del select; el select queda oculto dentro.
    var env = document.createElement('div');
    env.className = 'sel-propio';

    var boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'sel-cara';
    if (sel.classList.contains('sel')) { boton.classList.add('sel-cabecera'); }
    boton.innerHTML = '<span class="sel-valor"></span><span class="sel-flecha" aria-hidden="true">&#9662;</span>';
    boton.setAttribute('aria-haspopup', 'listbox');
    boton.setAttribute('aria-expanded', 'false');

    var panel = document.createElement('div');
    panel.className = 'sel-panel';
    panel.setAttribute('role', 'listbox');
    CONTADOR += 1;
    panel.id = 'sel-panel-' + CONTADOR;
    boton.setAttribute('aria-controls', panel.id);

    env.appendChild(boton);
    env.appendChild(panel);

    // El select se esconde DENTRO del env: sigue siendo hijo del formulario y
    // no pierde ni su posicion ni su semantica.
    sel.parentNode.insertBefore(env, sel);
    sel.style.display = 'none';
    env.insertBefore(sel, panel);

    var valor = function () {
      return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    };
    var pintarValor = function () {
      env.querySelector('.sel-valor').textContent = valor();
    };

    var pintarOpciones = function () {
      panel.innerHTML = '';
      for (var i = 0; i < sel.options.length; i++) {
        (function (idx) {
          var item = document.createElement('div');
          item.className = 'sel-opcion' + (idx === sel.selectedIndex ? ' on' : '');
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', idx === sel.selectedIndex ? 'true' : 'false');
          item.textContent = sel.options[idx].text;
          item.addEventListener('click', function (ev) {
            ev.stopPropagation();
            sel.selectedIndex = idx;
            pintarValor();
            cerrar();
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          });
          panel.appendChild(item);
        })(i);
      }
    };

    var abrir = function () {
      cerrarSelects();
      pintarOpciones();
      // Posicion fixed: el cuerpo de las barras tiene overflow:hidden (para
      // animar su alto) y un panel absolute quedaria recortado. Si no cabe
      // hacia abajo (select cerca del borde inferior), se despliega hacia arriba.
      var r = boton.getBoundingClientRect();
      var altoPanel = Math.min(panel.scrollHeight, 230);
      var espacioAbajo = window.innerHeight - r.bottom;
      var haciaArriba = espacioAbajo < altoPanel && r.top > altoPanel;
      panel.style.position = 'fixed';
      panel.style.left = r.left + 'px';
      panel.style.width = r.width + 'px';
      panel.style.right = 'auto';
      if (haciaArriba) {
        panel.style.top = 'auto';
        panel.style.bottom = (window.innerHeight - r.top + 3) + 'px';
      } else {
        panel.style.top = (r.bottom + 3) + 'px';
        panel.style.bottom = 'auto';
      }
      env.classList.add('abierto');
      boton.setAttribute('aria-expanded', 'true');
    };

    var cerrar = function () {
      env.classList.remove('abierto');
      boton.setAttribute('aria-expanded', 'false');
    };

    boton.addEventListener('click', function (ev) {
      ev.stopPropagation();
      if (env.classList.contains('abierto')) { cerrar(); } else { abrir(); }
    });

    // Teclado: Enter/Espacio abre, Esc cierra, flechas mueven la seleccion.
    boton.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        if (env.classList.contains('abierto')) { cerrar(); } else { abrir(); }
      } else if (ev.key === 'Escape') {
        cerrar();
        boton.focus();
      } else if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        if (!env.classList.contains('abierto')) { abrir(); }
        var n = sel.options.length;
        if (!n) { return; }
        var dir = (ev.key === 'ArrowDown') ? 1 : -1;
        var sig = (sel.selectedIndex + dir + n) % n;
        sel.selectedIndex = sig;
        pintarValor();
        pintarOpciones();
      }
    });

    pintarValor();
    sel.dataset.propio = '1';
    return env;
  }

  function estilizarSelects(raiz) {
    var raiz0 = raiz || document;
    var esSelect = (raiz0.nodeType === 1 && raiz0.tagName === 'SELECT');
    if (esSelect) {
      if (raiz0.dataset.propio !== '1') { estilizarSelect(raiz0); }
      return;
    }
    var todos = raiz0.querySelectorAll('select');
    for (var i = 0; i < todos.length; i++) { estilizarSelect(todos[i]); }
  }

  // Cierre al hacer clic fuera de cualquier desplegable. Va en captura porque
  // los bloques paran la propagacion de sus propios clics.
  document.addEventListener('click', function () { cerrarSelects(); }, true);

  Mimo.estilizarSelect = estilizarSelect;
  Mimo.estilizarSelects = estilizarSelects;
  Mimo.cerrarSelects = cerrarSelects;
})(MimoComun);
