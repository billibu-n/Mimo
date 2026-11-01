/* plegable.js — el único plegable de Mimo.

   La app anterior ya agrupaba por categorías en la ficha de cada ramo: una barra
   por bloque (Categorías, Componentes, Examen, Eximición) con su título, su
   cuenta a la derecha y una flecha que gira al abrir. Esto es lo mismo, medido
   de `referencia/mimo-app-53cc22d` (clase `.barra-extraible`): barra con borde y
   fondo de superficie, cabecera que tiñe al pasar el ratón, al abrir toma el
   acento del tema y la flecha gira 90°, y el cuerpo se despliega deslizándose.

   Aquí la cabecera es un <button> de verdad (Enter y Espacio funcionan solos) con
   `aria-expanded` y `aria-controls`; el cuerpo se pliega con grid-rows y, cuando
   está cerrado, queda `inert` y `aria-hidden`, así que ni se pinta ni se tabula.

   El estado NO vive en el DOM: vive en `estado.plegables` (clave estable por
   grupo), de modo que al cambiar de sección y volver sigue como lo dejaste. */
(function () {
  "use strict";

  var MAPA = {};          // copia del estado persistido
  var IO = null;          // {leer, guardar} que pone el shell

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function idSeguro(v) {
    return String(v || "").replace(/[^A-Za-z0-9_-]+/g, "-");
  }
  function clave(id) { return String(id || ""); }

  function configurar(io) { IO = io || null; }
  function mapa() {
    if (IO && typeof IO.leer === "function") return IO.leer() || {};
    return MAPA;
  }

  function estaAbierto(id) {
    var k = clave(id), m = mapa();
    if (Object.prototype.hasOwnProperty.call(m, k)) return !!m[k];
    return false;
  }

  function recordar(id, valor) {
    var m = mapa();
    m[clave(id)] = !!valor;
    if (IO && typeof IO.guardar === "function") IO.guardar(m);
    else MAPA = m;
  }

  /* HTML de un grupo. `cuerpo` es HTML ya escapado por quien llama. */
  function html(conf) {
    var id = clave(conf.id);
    // lo que el usuario tocó manda; si no tocó nada, decide el valor por defecto
    var m = mapa();
    var abierto = Object.prototype.hasOwnProperty.call(m, id) ? !!m[id] : conf.abierto === true;
    var control = "plg-" + idSeguro(id);
    var cuenta = conf.cuenta ? '<span class="plegable__cuenta">' + esc(conf.cuenta) + "</span>" : "";
    return '<div class="plegable' + (abierto ? " on" : "") + '" data-plegable="' + esc(id) + '">' +
      '<button class="plegable__cab" type="button" aria-expanded="' + (abierto ? "true" : "false") +
        '" aria-controls="' + control + '">' +
        '<span class="plegable__tit">' + (conf.icono || "") + "<span>" + esc(conf.titulo || "") + "</span></span>" + cuenta +
        '<svg class="icono plegable__flecha" aria-hidden="true"><use href="#i-chevron"/></svg>' +
      "</button>" +
      '<div class="plegable__cuerpo" id="' + control + '" aria-hidden="' + (abierto ? "false" : "true") + '"' +
        (abierto ? "" : " inert") + ">" +
        '<div class="plegable__dentro"><div class="plegable__relleno">' + (conf.cuerpo || "") + "</div></div>" +
      "</div></div>";
  }

  function alternar(cab) {
    var caja = cab.closest("[data-plegable]");
    if (!caja) return;
    var id = caja.getAttribute("data-plegable");
    var cuerpo = caja.querySelector(".plegable__cuerpo");
    var abrir = !caja.classList.contains("on");
    caja.classList.toggle("on", abrir);
    cab.setAttribute("aria-expanded", abrir ? "true" : "false");
    if (cuerpo) {
      if (abrir) { cuerpo.removeAttribute("inert"); cuerpo.setAttribute("aria-hidden", "false"); }
      else { cuerpo.setAttribute("inert", ""); cuerpo.setAttribute("aria-hidden", "true"); }
    }
    recordar(id, abrir);
  }

  /* Un solo oyente para toda la app: la cabecera es un botón, así que Enter y
     Espacio llegan aquí como clic (no hace falta atajo propio). */
  document.addEventListener("click", function (e) {
    var cab = e.target.closest && e.target.closest(".plegable__cab");
    if (cab) alternar(cab);
  });

  window.MimoPlegable = {
    configurar: configurar,
    mapa: mapa,
    abierto: estaAbierto,
    html: html,
    alternar: alternar
  };
})();
