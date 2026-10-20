/* ============================================================================
   avisos.js — Mimo Nuevo · sustrato comun · EL TOAST Y LA VENTANA PROPIA
   (bloque T003; portado de dos ficheros de la app anterior:
    `js/comun/05-avisos.js` para el toast y `js/comun/11-avisos.js` para el modal)

   POR QUE HAY VENTANA PROPIA Y NO `confirm()`
   La app anterior usaba `confirm()`, `alert()` y `prompt()`. En el navegador
   funcionan, pero en la aplicacion de ESCRITORIO (webview) no hay quien los
   muestre: se midio que la pagina se QUEDA BLOQUEADA, y el efecto en un boton
   que borra es el peor posible: "Restablecer todo" parece no hacer nada, pero
   el borrado YA se ejecuto. El dueno lo reporto con esas palabras: "descarga
   sin consultar y borra sin consultar".

   La solucion es una ventana dibujada por la propia aplicacion, que funciona
   igual en navegador y en escritorio, se puede leer y pulsar con teclado, y
   responde una PROMESA para que el codigo que llama se lea casi igual que con
   `confirm()`:

       if (!await confirmar('¿Borrar esto?', {peligro:true})) return;

   Aqui no hay async/await (estilo de la casa: var y function); la promesa se
   devuelve y se encadena con .then().

   USO
     MimoComun.mostrarAviso(txt[, ms])   toast abajo, se va solo
     MimoComun.confirmar(msg[, opciones]) -> Promise<true|false>
     MimoComun.avisar(msg[, opciones])    -> Promise<undefined>
     MimoComun.pedir(msg[, opciones])     -> Promise<string|null>
   Opciones: {titulo, aceptar, cancelar, peligro, valor, marcador}.

   LOS MONTAJES DEL MARCADO. El toast vive en `#aviso` y la ventana en `#aviso-app` (los
   pone armazon-paneles.html en el marcado). Si faltaran, se crean: un aviso
   que revienta por no encontrar su caja convierte un guardado en un error de
   consola, y eso ya se medía como fallo en T002.
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var _temporizador = null;
  var _caja = null;

  function esc(t) {
    if (typeof Mimo.esc === 'function') { return Mimo.esc(t); }
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ------------------------------------------------------------------ toast */
  function cajaToast() {
    var el = document.getElementById('aviso');
    if (!el) {
      el = document.createElement('div');
      el.id = 'aviso';
      el.className = 'aviso';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  function mostrarAviso(txt, ms) {
    var el = cajaToast();
    el.textContent = String(txt === null || txt === undefined ? '' : txt);
    el.classList.add('on');
    if (_temporizador) { clearTimeout(_temporizador); }
    _temporizador = setTimeout(function () {
      el.classList.remove('on');
      _temporizador = null;
    }, ms || 1800);
    return true;
  }

  /* ------------------------------------------------------------------ modal */
  function asegurarCaja() {
    var raiz = document.getElementById('aviso-app');
    if (!raiz) {
      raiz = document.createElement('div');
      raiz.className = 'modal';
      raiz.id = 'aviso-app';
      document.body.appendChild(raiz);
    }
    _caja = raiz.querySelector('.modal-caja');
    if (!_caja) {
      _caja = document.createElement('div');
      _caja.className = 'modal-caja aviso-caja';
      _caja.setAttribute('role', 'dialog');
      _caja.setAttribute('aria-modal', 'true');
      _caja.setAttribute('aria-labelledby', 'aviso-titulo');
      raiz.appendChild(_caja);
    }
    return raiz;
  }

  function abrir(tipo, mensaje, opciones) {
    var o = opciones || {};
    var titulo = o.titulo || (tipo === 'confirmar' ? 'Confirmar' : (tipo === 'pedir' ? 'Escribe' : 'Aviso'));
    var aceptarTxt = o.aceptar || 'Aceptar';
    var cancelarTxt = o.cancelar || 'Cancelar';
    var peligro = !!o.peligro;

    var raiz = asegurarCaja();
    var caja = _caja;

    // El mensaje puede traer saltos de linea: se respetan.
    var lineas = String(mensaje === null || mensaje === undefined ? '' : mensaje).split('\n');
    var parrafos = '';
    for (var i = 0; i < lineas.length; i++) {
      parrafos += '<p class="aviso-texto">' + esc(lineas[i]) + '</p>';
    }

    var html = '<h2 id="aviso-titulo">' + esc(titulo) + '</h2>' + parrafos;
    if (tipo === 'pedir') {
      html += '<input type="text" class="entrada aviso-entrada" id="aviso-entrada" value="' +
              esc(o.valor || '') + '" placeholder="' + esc(o.marcador || '') + '">';
    }
    html += '<div class="aviso-botones">';
    if (tipo !== 'avisar') {
      html += '<button type="button" class="btn" id="aviso-cancelar">' + esc(cancelarTxt) + '</button>';
    }
    html += '<button type="button" class="btn btn--primario' + (peligro ? ' peligro' : '') +
            '" id="aviso-aceptar">' + esc(aceptarTxt) + '</button>';
    html += '</div>';
    caja.innerHTML = html;

    var entrada = caja.querySelector('#aviso-entrada');
    var btnAceptar = caja.querySelector('#aviso-aceptar');
    var btnCancelar = caja.querySelector('#aviso-cancelar');

    raiz.classList.add('on');
    raiz.setAttribute('aria-hidden', 'false');

    // El foco va al boton que confirma si es una accion normal, y a cancelar si
    // es peligrosa: en un borrado, que la tecla Entrar NO confirme sola.
    var foco = (peligro && btnCancelar) ? btnCancelar : (entrada || btnAceptar);
    if (foco) {
      setTimeout(function () {
        try { foco.focus(); if (entrada) { entrada.select(); } } catch (e) { /* sin foco */ }
      }, 30);
    }

    return new Promise(function (resolve) {
      var cerrado = false;

      function escuchar(quit) {
        document.removeEventListener('keydown', alTecla, true);
        if (quit) { raiz.classList.remove('on'); raiz.setAttribute('aria-hidden', 'true'); }
      }
      function cerrar(valor) {
        if (cerrado) { return; }
        cerrado = true;
        escuchar(true);
        resolve(valor);
      }
      function aceptar() {
        cerrar(tipo === 'pedir' ? (entrada ? entrada.value : '') : true);
      }
      function cancelar() {
        cerrar(tipo === 'pedir' ? null : (tipo === 'avisar' ? undefined : false));
      }

      if (btnAceptar) { btnAceptar.onclick = aceptar; }
      if (btnCancelar) { btnCancelar.onclick = cancelar; }

      // Esc cancela siempre; Entrar acepta (menos en un aviso, que solo se
      // cierra aceptando). Se captura en fase de captura para que no lo robe el
      // resto de la pagina.
      function alTecla(ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          cancelar();
        } else if (ev.key === 'Enter' && tipo !== 'avisar') {
          ev.preventDefault();
          ev.stopPropagation();
          aceptar();
        }
      }
      document.addEventListener('keydown', alTecla, true);
    });
  }

  function confirmar(mensaje, opciones) { return abrir('confirmar', mensaje, opciones); }
  function avisar(mensaje, opciones) { return abrir('avisar', mensaje, opciones); }
  function pedir(mensaje, opciones) { return abrir('pedir', mensaje, opciones); }

  Mimo.mostrarAviso = mostrarAviso;
  Mimo.confirmar = confirmar;
  Mimo.avisar = avisar;
  Mimo.pedir = pedir;
})(MimoComun);
