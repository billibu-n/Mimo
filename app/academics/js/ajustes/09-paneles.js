/* ------------------------------------------------- ajustes/09-paneles.js
   Abre y cierra las VENTANAS EMERGENTES de la pestana Ajustes.

   POR QUE EXISTE
   La cara nueva agrupa los ajustes en recuadros; cada recuadro abre, en la
   misma pantalla, un panel con sus controles. Los controles son los de
   SIEMPRE (mismos ids), asi que el motor y el puente no cambian: este archivo
   solo muestra y oculta.

   REGLA: no se usa innerHTML sobre un panel. Si un panel se reescribiera, se
   perderian las escuchas que 02-avanzados.js engancha a #avanzado al cargar
   (lo hace fuera de renderAjustes) y el motor quedaria desconectado. */
(function () {
  var velo = document.getElementById('aj-velo');
  if (!velo) return;
  var abierto = null;

  function cerrar() {
    velo.classList.remove('on');
    if (abierto) abierto.classList.remove('on');
    abierto = null;
    document.body.style.overflow = '';
  }
  function abrir(id) {
    var p = document.getElementById(id);
    if (!p) return;
    if (abierto) abierto.classList.remove('on');
    abierto = p;
    p.classList.add('on');
    velo.classList.add('on');
    velo.scrollTop = 0;
    // Mientras hay una ventana abierta, el fondo no se desplaza.
    document.body.style.overflow = 'hidden';
    var x = p.querySelector('.aj-x');
    if (x) x.focus();
  }

  // Cada recuadro de la pantalla abre su ventana. La tarjeta es <section role="button">
  // (lleva un <h2>; un <button> no admite titulos), asi que el teclado se maneja aqui.
  document.querySelectorAll('#p-ajustes [data-abrir]').forEach(function (b) {
    b.addEventListener('click', function () { abrir(b.dataset.abrir); });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        abrir(b.dataset.abrir);
      }
    });
  });
  // Cerrar: la X, el boton "Cerrar" del pie, un clic fuera o la tecla Escape.
  velo.querySelectorAll('[data-cerrar]').forEach(function (b) {
    b.addEventListener('click', cerrar);
  });
  velo.addEventListener('click', function (e) { if (e.target === velo) cerrar(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrar(); });
})();
