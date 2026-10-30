/* bloque.js — ciclo de vida del bloque calificaciones. La vista vive en vista.js. */
(function () {
  "use strict";
  var montado = false;
  function montar(api) {
    montado = true;
    if (api.ctx && api.ctx.bindCalificaciones) api.ctx.bindCalificaciones(api.root);
  }
  function desmontar() { montado = false; }
  window.MimoBloqueCalificaciones = { montar: montar, desmontar: desmontar, montado: function () { return montado; } };
})();
