/* ---------------------------------------------------------------- PWA (instalable y offline)

   Registra el "service worker" de sw.js, que es lo que permite DOS cosas: que el navegador
   pueda INSTALAR la app y que funcione SIN INTERNET. El service worker solo se registra
   servida por http(s); con file:// (doble clic) el navegador NO los permite (medido: "origin
   'null' is not supported"), asi que aqui se comprueba antes y, si no se puede, no se hace
   nada: la app funciona igual, sin cache.

   sw.js NO se edita a mano: lo escribe el armador desde plantilla-sw.js, con la version. */

(function () {
  function sePUedeRegistrar() {
    if (!('serviceWorker' in navigator)) return false;
    var p = location.protocol;
    if (p === 'https:') return true;
    // localhost y 127.0.0.1 cuentan como contexto seguro para el navegador.
    return p === 'http:' && (location.hostname === 'localhost' ||
                             location.hostname === '127.0.0.1');
  }
  if (!sePUedeRegistrar()) return;

  // Recarga AUTOMATICA cuando el service worker se actualiza.
  // El service worker nuevo, al activarse, toma el control de la pagina (skipWaiting + claim) y el
  // navegador dispara 'controllerchange' AQUI, en la pagina. Recargar en ese momento es lo que
  // hace que una version nueva se aplique SOLA, sin pedirle al usuario que recargue a mano.
  // Se probo antes desde el service worker (clients.matchAll) y NO funcionaba.
  // El guardia 'si ya habia controlador' evita una recarga de mas en la PRIMERA instalacion.
  var teniaControlador = !!navigator.serviceWorker.controller;
  var recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!teniaControlador || recargando) return;
    recargando = true;
    location.reload();
  });

  window.addEventListener('load', function () {
    try {
      // Si falla, no pasa nada: la app sigue funcionando, solo que sin cache ni instalable.
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        // Buscar una version nueva EN CUANTO se abre la app. Sin esto, el navegador puede tardar
        // hasta 24 h en revisar sw.js y el usuario se queda viendo la version vieja sin saberlo
        // (paso: el apartado nuevo de Ajustes no aparecia). Al encontrarla, el service worker
        // nuevo se instala, activa y RECARGA las ventanas abiertas el solo.
        try { reg.update(); } catch (e) { /* da igual */ }
      }).catch(function () {});
    } catch (e) { /* idem */ }
  });
})();
