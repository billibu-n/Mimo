/* ============================================================================
   i18n.js — Mimo Nuevo · motor de idioma (Iteración 3)

   Es la ÚNICA puerta por la que sale texto de la app. Nada escribe una cadena
   visible a mano: el marcado lleva `data-i18n` (o sus variantes) y el JS llama
   a `t()`. Si falta una clave, NO se inventa texto: se devuelve la clave y se
   avisa por consola (un texto que desaparece en silencio es peor que uno feo).

   API (la que pide el encargo):
     t("clave.subclave"[, {param: valor}])  -> string del idioma activo
     cargarIdioma("es" | "en")               -> Promesa; fetch + caché
     idiomaActual()                          -> "es" | "en"

   Además:
     MimoI18n.listo        Promesa que se cumple cuando el idioma ACTIVO ya está
                           aplicado al DOM (navegacion.js espera a esto).
     MimoI18n.aplicar()    vuelve a pintar el marcado con el idioma activo.
     MimoI18n.alCambiar(fn) suscribe un repintado a un cambio de idioma.

   Convención del marcado:
     data-i18n="clave"              textContent
     data-i18n-html="clave"         innerHTML (solo donde la clave trae <strong>/<code>)
     data-i18n-ph="clave"           placeholder
     data-i18n-attr="a:clave;b:clave"  atributos (aria-label, title, content…)
     data-fecha-mes="AAAA-MM"       nombre del mes + año, con Intl (no una lista a mano)
     data-dia-corto="0..6"          día de la semana corto, con Intl

   Regla del proyecto: el idioma BASE es "es" y siempre se carga; si al idioma
   activo le falta una clave, se cae al base (AU-34 aplicado al idioma).
   ============================================================================ */
(function (global) {
  'use strict';

  var RUTA = 'i18n/';
  var IDIOMA_BASE = 'es';
  var IDIOMAS = ['es', 'en'];
  var CLAVE_ALMACEN = 'mimo.idioma';

  var idioma = IDIOMA_BASE;
  var dicc = {};          /* diccionario del idioma activo */
  var base = {};          /* diccionario del idioma base (respaldo) */
  var cache = {};         /* promesas de fetch, una por idioma */
  var oyentes = [];
  var listo = null;

  /* ------------------------------------------------------- 1. DICCIONARIOS */
  function pedir(lang) {
    if (!cache[lang]) {
      cache[lang] = fetch(RUTA + lang + '.json', { cache: 'no-cache' })
        .then(function (r) {
          if (!r.ok) { throw new Error('HTTP ' + r.status + ' en ' + RUTA + lang + '.json'); }
          return r.json();
        });
    }
    return cache[lang];
  }

  /* busca "a.b.c" dentro del diccionario, sin romperse si falta un tramo */
  function buscar(d, clave) {
    var partes = String(clave).split('.');
    var nodo = d;
    for (var i = 0; i < partes.length; i++) {
      if (nodo === null || nodo === undefined || typeof nodo !== 'object') { return null; }
      nodo = nodo[partes[i]];
    }
    return (typeof nodo === 'string') ? nodo : null;
  }

  function sustituir(texto, params) {
    if (!params) { return texto; }
    return texto.replace(/\{(\w+)\}/g, function (todo, nombre) {
      return (params[nombre] === undefined || params[nombre] === null) ? todo : String(params[nombre]);
    });
  }

  /* ------------------------------------------------------------- 2. t() */
  function t(clave, params) {
    var texto = buscar(dicc, clave);
    if (texto === null) { texto = buscar(base, clave); }   /* caída al base */
    if (texto === null) {
      if (global.console) { console.warn('[i18n] falta la clave: ' + clave); }
      return clave;                                        /* se ve la clave: grita */
    }
    return sustituir(texto, params);
  }

  /* --------------------------------------------------- 3. FECHAS CON INTL */
  function locale(lang) { return lang === 'en' ? 'en-GB' : 'es-ES'; }

  function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function nombreMes(anio, mes) {
    try {
      var f = new Date(anio, mes - 1, 1);
      var s = new Intl.DateTimeFormat(locale(idioma), { month: 'long', year: 'numeric' }).format(f);
      return capitalizar(s);
    } catch (e) { return ''; }
  }

  function diaCorto(indice) {
    try {
      /* lunes 05-01-2026 es lunes: se usa una semana de referencia fija */
      var lunes = new Date(2026, 0, 5);
      var f = new Date(2026, 0, 5 + Number(indice));
      var s = new Intl.DateTimeFormat(locale(idioma), { weekday: 'short' }).format(f);
      if (lunes.getDay() !== 1) { s = ''; }
      return capitalizar(s.replace(/\.$/, ''));
    } catch (e) { return ''; }
  }

  /* ---------------------------------------------------- 4. PINTAR EL MARCADO */
  function pintarAtributos(el, valor) {
    /* formato: "aria-label:nav.abrir;title:nav.abrir" */
    var pares = String(valor).split(';');
    for (var i = 0; i < pares.length; i++) {
      var par = pares[i].split(':');
      if (par.length !== 2 || !par[0].trim()) { continue; }
      el.setAttribute(par[0].trim(), t(par[1].trim()));
    }
  }

  function aplicar(raiz) {
    var doc = raiz || document;

    document.documentElement.lang = idioma;
    document.title = t('app.titulo');

    var nodos = doc.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodos.length; i++) {
      nodos[i].textContent = t(nodos[i].getAttribute('data-i18n'));
    }

    nodos = doc.querySelectorAll('[data-i18n-html]');
    for (var j = 0; j < nodos.length; j++) {
      nodos[j].innerHTML = t(nodos[j].getAttribute('data-i18n-html'));
    }

    nodos = doc.querySelectorAll('[data-i18n-ph]');
    for (var k = 0; k < nodos.length; k++) {
      nodos[k].setAttribute('placeholder', t(nodos[k].getAttribute('data-i18n-ph')));
    }

    nodos = doc.querySelectorAll('[data-i18n-attr]');
    for (var m = 0; m < nodos.length; m++) {
      pintarAtributos(nodos[m], nodos[m].getAttribute('data-i18n-attr'));
    }

    nodos = doc.querySelectorAll('[data-fecha-mes]');
    for (var n = 0; n < nodos.length; n++) {
      var trozos = String(nodos[n].getAttribute('data-fecha-mes')).split('-');
      nodos[n].textContent = nombreMes(Number(trozos[0]), Number(trozos[1]));
    }

    nodos = doc.querySelectorAll('[data-dia-corto]');
    for (var p = 0; p < nodos.length; p++) {
      nodos[p].textContent = diaCorto(Number(nodos[p].getAttribute('data-dia-corto')));
    }
  }

  /* -------------------------------------------------- 5. CAMBIAR DE IDIOMA */

  /* este script va en la CABECERA: cuando el JSON llega, el <body> puede estar
     todavía a medio parsear. Pintar el marcado antes de que exista no pinta nada,
     así que se espera al DOM una vez y solo si hace falta. */
  function cuandoDomListo(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  function avisarCambio() {
    for (var i = 0; i < oyentes.length; i++) {
      try { oyentes[i](idioma); } catch (e) {
        if (global.console) { console.warn('[i18n] oyente roto', e); }
      }
    }
  }

  function cargarIdioma(lang) {
    var pedido = (IDIOMAS.indexOf(lang) >= 0) ? lang : IDIOMA_BASE;

    listo = Promise.all([pedir(IDIOMA_BASE), pedir(pedido)])
      .then(function (res) {
        base = res[0];
        dicc = (pedido === IDIOMA_BASE) ? res[0] : res[1];
        idioma = pedido;
        try { global.localStorage.setItem(CLAVE_ALMACEN, idioma); } catch (e) { /* sin almacén: se sigue */ }
        return new Promise(function (ya) {
          cuandoDomListo(function () {
            aplicar();
            avisarCambio();
            if (global.console) { console.info('[i18n] idioma activo: ' + idioma); }
            ya(idioma);
          });
        });
      })
      .catch(function (err) {
        /* sin diccionario no se inventa: el marcado conserva el texto del HTML
           (que está en español) y t() devuelve la clave, que se ve. */
        if (global.console) {
          console.error('[i18n] no se pudo cargar el idioma (' + err.message + '). ' +
                        'Abre la página por HTTP, no por file://.');
        }
        idioma = IDIOMA_BASE;
        dicc = {}; base = {};
        return idioma;
      });

    return listo;
  }

  function idiomaActual() { return idioma; }

  function alCambiar(fn) {
    if (typeof fn === 'function') { oyentes.push(fn); }
  }

  function idiomaGuardado() {
    try {
      var guardado = global.localStorage.getItem(CLAVE_ALMACEN);
      return (IDIOMAS.indexOf(guardado) >= 0) ? guardado : null;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ 6. ARRANQUE */
  global.MimoI18n = {
    t: t,
    cargarIdioma: cargarIdioma,
    idiomaActual: idiomaActual,
    aplicar: aplicar,
    alCambiar: alCambiar,
    idiomas: IDIOMAS,
    get listo() { return listo; }
  };

  listo = cargarIdioma(idiomaGuardado() || IDIOMA_BASE);
}(window));
