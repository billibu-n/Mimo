/* bloque.js — ciclo de vida del bloque estudio. La vista vive en vista.js. */
(function () {
  "use strict";
  var montado = false;
  function montar(api) {
    montado = true;
    if (api.ctx && api.ctx.bindEstudio) api.ctx.bindEstudio(api.root);
  }
  function desmontar() { montado = false; }
  window.MimoBloqueEstudio = { montar: montar, desmontar: desmontar, montado: function () { return montado; } };
})();
