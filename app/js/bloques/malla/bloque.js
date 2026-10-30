/* bloque.js — ciclo de vida del bloque malla. La vista vive en vista.js. */
(function () {
  "use strict";
  var montado = false;
  function montar(api) {
    montado = true;
    if (api.ctx && api.ctx.bindMalla) api.ctx.bindMalla(api.root);
  }
  function desmontar() { montado = false; }
  window.MimoBloqueMalla = { montar: montar, desmontar: desmontar, montado: function () { return montado; } };
})();
