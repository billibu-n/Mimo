/* almacen.js — espejo nativo y respaldos de Mimo.
   localStorage sigue siendo la lectura rápida; este módulo deja una copia atómica en el
   directorio de datos de la app y escribe respaldos con SHA-256. En navegador no hace nada:
   la oficina y los gates web siguen funcionando sin Tauri. */
(function () {
  "use strict";

  var timer = null;
  var ultimo = null;

  function tauri() {
    var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
    return !!(t && t.invoke);
  }
  function invoke(cmd, args) {
    var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
    return t.invoke(cmd, args);
  }
  function avisar(tipo, detalle) {
    try {
      document.dispatchEvent(new CustomEvent("mimo:almacen-" + tipo, { detail: detalle || {} }));
    } catch (e) {}
  }

  function guardar(texto, inmediato) {
    if (!tauri() || !texto) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      invoke("estado_guardar", { texto: String(texto) }).then(function (info) {
        ultimo = info;
        avisar("ok", info);
      }).catch(function (e) {
        avisar("error", { mensaje: e && e.message ? e.message : String(e) });
      });
    }, inmediato ? 0 : 300);
  }

  async function leer() {
    if (!tauri()) return null;
    return invoke("estado_leer");
  }

  async function respaldar(motivo, texto) {
    if (!tauri()) return null;
    return invoke("respaldo_crear", { motivo: motivo || "manual", texto: String(texto) });
  }

  async function listar() {
    if (!tauri()) return [];
    return invoke("respaldo_listar");
  }

  window.MimoAlmacen = {
    esTauri: tauri,
    guardar: guardar,
    leer: leer,
    respaldar: respaldar,
    listar: listar,
    ultimo: function () { return ultimo; }
  };
})();
