/* eventos.js — bus mínimo del núcleo.
   Notifica hechos consumados; no ordena acciones ni encadena eventos. */
(function () {
  "use strict";
  var oyentes = {};

  function on(nombre, fn) {
    if (typeof fn !== "function") return function () {};
    (oyentes[nombre] || (oyentes[nombre] = [])).push(fn);
    return function () { off(nombre, fn); };
  }

  function off(nombre, fn) {
    var lista = oyentes[nombre];
    if (!lista) return;
    oyentes[nombre] = lista.filter(function (x) { return x !== fn; });
  }

  function emitir(nombre, dato) {
    (oyentes[nombre] || []).slice().forEach(function (fn) {
      try { fn(dato); } catch (e) { if (window.console) console.error(e); }
    });
  }

  function limpiar(nombre) {
    if (nombre) delete oyentes[nombre];
    else oyentes = {};
  }

  window.MimoEventos = { on: on, off: off, emitir: emitir, limpiar: limpiar };
})();
