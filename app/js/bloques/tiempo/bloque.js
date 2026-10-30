/* bloque.js — ciclo de vida del bloque tiempo. La vista vive en vista.js. */
(function () {
  "use strict";
  var montado = false;
  var alarmaInt = null;
  function montar(api) {
    montado = true;
    if (api.ctx && api.ctx.bindTiempo) api.ctx.bindTiempo(api.root);
    if (alarmaInt) clearInterval(alarmaInt);
    if (api.ctx && api.ctx.comprobarAlarmas) alarmaInt = setInterval(api.ctx.comprobarAlarmas, 1000);
  }
  function desmontar(api) {
    montado = false;
    if (alarmaInt) { clearInterval(alarmaInt); alarmaInt = null; }
    if (api && api.ctx && api.ctx.limpiarTiempo) api.ctx.limpiarTiempo();
  }
  window.MimoBloqueTiempo = { montar: montar, desmontar: desmontar, montado: function () { return montado; } };
})();
