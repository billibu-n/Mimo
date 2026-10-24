/* Service worker de Mimo Academics.

   QUE HACE
   Guarda la aplicacion en la cache del navegador para que funcione SIN INTERNET y para que el
   navegador la pueda INSTALAR (PWA).

   ESTE FICHERO NO SE EDITA A MANO. Es la salida de `plantilla-sw.js`: lo escribe el armador
   (mimo_config/construir/index.py), que sustituye 1.1.2-desktop por la version, 44367a46f7 por un
   sello del contenido y [
  "./index.html",
  "./manifest.json",
  "./css/aviso.css",
  "./css/general.css",
  "./css/tema-alto-contraste.css",
  "./css/tema-bosque.css",
  "./css/tema-clasico.css",
  "./css/tema-deepsea.css",
  "./css/tema-medianoche.css",
  "./css/tema-negro.css",
  "./css/tema-pinky.css",
  "./css/tema-sepia.css",
  "./css/tema-vino.css",
  "./html/ajustes.html",
  "./html/estudio.html",
  "./html/malla.html",
  "./html/notas.html",
  "./html/semestre.html",
  "./html/tareas.html",
  "./html/tiempo.html",
  "./js/orden.txt",
  "./js/ajustes/01-borrador.js",
  "./js/ajustes/02-avanzados.js",
  "./js/ajustes/03-panel.js",
  "./js/ajustes/05-ayuda.js",
  "./js/ajustes/05-semestres.js",
  "./js/ajustes/06-actualizar.js",
  "./js/ajustes/07-ical.js",
  "./js/ajustes/08-g2-puente.js",
  "./js/ajustes/09-paneles.js",
  "./js/ajustes/10-colaborar.js",
  "./js/comun/00-cabecera.js",
  "./js/comun/01-utilidades.js",
  "./js/comun/02-estado.js",
  "./js/comun/03-catalogo.js",
  "./js/comun/04-almacen.js",
  "./js/comun/05-avisos.js",
  "./js/comun/06-arranque.js",
  "./js/comun/07-select.js",
  "./js/comun/08-barra.js",
  "./js/comun/09-pwa.js",
  "./js/comun/10-respaldo-carpeta.js",
  "./js/comun/10a-carpeta-tauri.js",
  "./js/comun/10b-migracion-tauri.js",
  "./js/comun/11-avisos.js",
  "./js/comun/12-contexto.js",
  "./js/comun/13-marca-juego.js",
  "./js/estudio/01-estudio.js",
  "./js/malla/01-importar.js",
  "./js/malla/02-editor-ramos.js",
  "./js/malla/03-dibujo.js",
  "./js/malla/04-pdf.js",
  "./js/malla/06-simulador.js",
  "./js/notas/01-motor.js",
  "./js/notas/02-notas.js",
  "./js/semestre/01-calendario.js",
  "./js/semestre/02-editor-evento.js",
  "./js/semestre/03-calendario.js",
  "./js/tareas/01-tareas.js",
  "./js/tiempo/01-tiempo.js",
  "./js/idioma/00-motor.js",
  "./js/idioma/01-inicio.js",
  "./js/idioma/01-panel.js",
  "./js/idioma/en.js",
  "./js/idioma/es.js",
  "./sonido/alarma.mp3",
  "./vendor/pdf-motor.js",
  "./vendor/pdf.min.js",
  "./iconos/happy.png",
  "./iconos/happy2.png",
  "./iconos/happy2_512.png",
  "./iconos/happy2_64.png",
  "./iconos/happy_512.png",
  "./iconos/happy_64.png",
  "./iconos/icon-16.png",
  "./iconos/icon-32.png",
  "./iconos/icon-512.png",
  "./iconos/icon-64.png",
  "./iconos/iconos.svg",
  "./iconos/indifferent.png",
  "./iconos/indifferent_512.png",
  "./iconos/indifferent_64.png",
  "./iconos/mimo2.png",
  "./iconos/mimo2_512.png",
  "./iconos/mimo2_64.png"
] por la lista COMPLETA de archivos.

   DOS REGLAS QUE IMPORTAN (las dos costaron un fallo real)
   -------------------------------------------------------
   1) EL HTML VA "RED PRIMERO", NO "CACHE PRIMERO". El index.html es el unico archivo cuyo
      contenido decide COMO es la app. Si se sirve desde la cache (cache primero), el usuario que
      ya tenia la app abierta se queda viendo la version VIEJA indefinidamente: se cambio la app,
      se rearmo, y el seguia viendo el HTML de antes. Se midio: metiendo un index.html viejo en la
      cache, tras recargar seguia saliendo el viejo. Con "red primero" siempre se ve lo ultimo, y
      la copia cacheada solo se usa si NO hay red (que es justo cuando se quiere).
   2) LA CACHE SE RENUEVA CON CADA REARMADO. El nombre lleva una HUELLA del contenido, no solo el
      numero de version: si se rearma la app sin subir la version (lo normal mientras se trabaja),
      antes la cache no cambiaba y se seguia sirviendo lo viejo. Con la huella, cada rearmado
      estrena cache y borra la anterior.

   OJO: un service worker SOLO se registra en http(s), NUNCA en file:// (medido: "origin 'null'
   is not supported"). Al abrir el index.html con doble clic este fichero ni se usa.
 */
const VERSION = '1.1.2-desktop';
const HUELLA = '44367a46f7';
const CACHE = 'mimo-' + VERSION + '-' + HUELLA;

// La aplicacion COMPLETA, la escribio el armador al construir.
const ARCHIVOS = [
  "./index.html",
  "./manifest.json",
  "./css/aviso.css",
  "./css/general.css",
  "./css/tema-alto-contraste.css",
  "./css/tema-bosque.css",
  "./css/tema-clasico.css",
  "./css/tema-deepsea.css",
  "./css/tema-medianoche.css",
  "./css/tema-negro.css",
  "./css/tema-pinky.css",
  "./css/tema-sepia.css",
  "./css/tema-vino.css",
  "./html/ajustes.html",
  "./html/estudio.html",
  "./html/malla.html",
  "./html/notas.html",
  "./html/semestre.html",
  "./html/tareas.html",
  "./html/tiempo.html",
  "./js/orden.txt",
  "./js/ajustes/01-borrador.js",
  "./js/ajustes/02-avanzados.js",
  "./js/ajustes/03-panel.js",
  "./js/ajustes/05-ayuda.js",
  "./js/ajustes/05-semestres.js",
  "./js/ajustes/06-actualizar.js",
  "./js/ajustes/07-ical.js",
  "./js/ajustes/08-g2-puente.js",
  "./js/ajustes/09-paneles.js",
  "./js/ajustes/10-colaborar.js",
  "./js/comun/00-cabecera.js",
  "./js/comun/01-utilidades.js",
  "./js/comun/02-estado.js",
  "./js/comun/03-catalogo.js",
  "./js/comun/04-almacen.js",
  "./js/comun/05-avisos.js",
  "./js/comun/06-arranque.js",
  "./js/comun/07-select.js",
  "./js/comun/08-barra.js",
  "./js/comun/09-pwa.js",
  "./js/comun/10-respaldo-carpeta.js",
  "./js/comun/10a-carpeta-tauri.js",
  "./js/comun/10b-migracion-tauri.js",
  "./js/comun/11-avisos.js",
  "./js/comun/12-contexto.js",
  "./js/comun/13-marca-juego.js",
  "./js/estudio/01-estudio.js",
  "./js/malla/01-importar.js",
  "./js/malla/02-editor-ramos.js",
  "./js/malla/03-dibujo.js",
  "./js/malla/04-pdf.js",
  "./js/malla/06-simulador.js",
  "./js/notas/01-motor.js",
  "./js/notas/02-notas.js",
  "./js/semestre/01-calendario.js",
  "./js/semestre/02-editor-evento.js",
  "./js/semestre/03-calendario.js",
  "./js/tareas/01-tareas.js",
  "./js/tiempo/01-tiempo.js",
  "./js/idioma/00-motor.js",
  "./js/idioma/01-inicio.js",
  "./js/idioma/01-panel.js",
  "./js/idioma/en.js",
  "./js/idioma/es.js",
  "./sonido/alarma.mp3",
  "./vendor/pdf-motor.js",
  "./vendor/pdf.min.js",
  "./iconos/happy.png",
  "./iconos/happy2.png",
  "./iconos/happy2_512.png",
  "./iconos/happy2_64.png",
  "./iconos/happy_512.png",
  "./iconos/happy_64.png",
  "./iconos/icon-16.png",
  "./iconos/icon-32.png",
  "./iconos/icon-512.png",
  "./iconos/icon-64.png",
  "./iconos/iconos.svg",
  "./iconos/indifferent.png",
  "./iconos/indifferent_512.png",
  "./iconos/indifferent_64.png",
  "./iconos/mimo2.png",
  "./iconos/mimo2_512.png",
  "./iconos/mimo2_64.png"
];

// Lo que NUNCA se sirve de la cache: el propio service worker y el HTML.
function vaSiempreARed(url){
  return /\/sw\.js$/.test(url.pathname) || /\/index\.html$/.test(url.pathname) ||
         url.pathname.endsWith('/');
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // addAll es todo-o-nada: si un solo archivo falla, no se instala NADA y quedaria una cache a
    // medias. Por eso se anade uno a uno: si a alguno le va mal, se sigue.
    await Promise.all(ARCHIVOS.map(u => c.add(u).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  // Borra las cache de versiones/huellas anteriores: si no, se acumulan y sirven lo viejo.
  e.waitUntil((async () => {
    const ks = await caches.keys();
    // Si YA habia otra cache, esto es una ACTUALIZACION (no la primera instalacion).
    const esActualizacion = ks.some(k => k !== CACHE);
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
    // En una ACTUALIZACION, se recargan las ventanas abiertas. Sin esto, quien tuviera la app
    // abierta seguiria viendo la copia vieja hasta cerrarla y volver a abrirla: el service worker
    // nuevo quedaba activo pero la pagina ya cargada no se enteraba. Es la diferencia entre "se
    // actualiza solo" y "hay que decirle al usuario que recargue a mano".
    if (esActualizacion) {
      const ventanas = await self.clients.matchAll({ type: 'window' });
      for (const v of ventanas) { try { await v.navigate(v.url); } catch (err) { /* da igual */ } }
    }
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  // Solo lo propio de la app. Lo de fuera (p. ej. GitHub, para buscar actualizacion) va directo
  // a la red, sin pasar por aqui.
  if (url.origin !== location.origin) return;

  if (vaSiempreARed(url)) {
    // RED PRIMERO para el HTML: lo ultimo manda; si no hay red, la copia cacheada.
    e.respondWith((async () => {
      try {
        const r = await fetch(req);
        if (r && r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
        return r;
      } catch (err) {
        const copia = await caches.match(req, { ignoreSearch: true });
        return copia || Response.error();
      }
    })());
    return;
  }

  // El resto (js, css, iconos): CACHE PRIMERO. Responde al instante y sin internet; por detras
  // se actualiza la copia si hay red.
  e.respondWith((async () => {
    const enCache = await caches.match(req, { ignoreSearch: true });
    if (enCache) {
      const red = fetch(req).then(r => {
        if (r && r.ok) caches.open(CACHE).then(c => c.put(req, r.clone()));
        return r;
      }).catch(() => null);
      e.waitUntil(red);
      return enCache;
    }
    try {
      const r = await fetch(req);
      if (r && r.ok) { const c = await caches.open(CACHE); c.put(req, r.clone()); }
      return r;
    } catch (err) {
      // Sin copia y sin red: vacio, NO el index.html (servir HTML donde se espera un .js
      // envenena la app con errores de sintaxis, que es peor que un fallo limpio).
      return Response.error();
    }
  })());
});
