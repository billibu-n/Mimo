/* Juego del icono MIMO: un clic cambia la cara; 10 clics en 20 s muestran "indiferente".
   Importado del viejo (js/comun/13-marca-juego.js); no toca datos ni secciones. */
(function () {
  "use strict";
  var RUTA = "img/";
  var ORIGINAL = "icon-64.png";
  var RARO = "indifferent_64.png";
  var AZAR = ["icon-64.png", "happy_64.png", "happy2_64.png", "mimo2_64.png"];
  var CLICS = 10, VENTANA = 20000, RARO_MS = 10000;
  var boton = document.getElementById("btn-mimo");
  var img = document.getElementById("mimo-ic");
  if (!boton || !img) return;
  var marcas = [], tVuelta = null, enRaro = false;
  function poner(n) { img.src = RUTA + n; }
  function alAzar() {
    var actual = img.src.split("/").pop();
    var otros = AZAR.filter(function (n) { return n !== actual; });
    return otros[Math.floor(Math.random() * otros.length)];
  }
  function volver() {
    enRaro = false;
    boton.classList.remove("jugando");
    poner(ORIGINAL);
  }
  function raro() {
    enRaro = true; poner(RARO); boton.classList.add("jugando");
    clearTimeout(tVuelta); tVuelta = setTimeout(volver, RARO_MS);
  }
  boton.addEventListener("click", function () {
    if (enRaro) { clearTimeout(tVuelta); tVuelta = setTimeout(volver, RARO_MS); return; }
    var ahora = Date.now();
    marcas.push(ahora);
    marcas = marcas.filter(function (t) { return ahora - t < VENTANA; });
    if (marcas.length >= CLICS) { marcas = []; raro(); return; }
    poner(alAzar());
  });
  poner(ORIGINAL);
})();
