/* --------------------------------------------------- copia de seguridad automatica

   Guarda el progreso en una CARPETA QUE ELIGE EL USUARIO (por ejemplo, una dentro de
   Documentos), para que NO se pierda si se desinstala o se borra la aplicacion. Es el modelo de
   las aplicaciones de escritorio que dejan sus datos en una carpeta del usuario.

   Como funciona:
   1. El usuario elige la carpeta UNA vez (dialogo del navegador).
   2. La eleccion se recuerda (IndexedDB).
   3. Cada vez que hay un cambio, se reescribe la copia ahi, con 3 versiones rotativas
      (mimo-respaldo.json, .1 y .2): la mas nueva, la anterior y la de antes.

   Que NO hace: subir nada a internet. Es una carpeta local (o la que el usuario sincronice).

   Limite honesto: el navegador solo deja reabrir la carpeta sin volver a preguntar mientras el
   permiso siga concedido; si el usuario lo revoca (o el navegador lo olvida), se le vuelve a
   pedir con un solo clic. */

const RESPALDO = { handle: null, soportado: false, ultimo: null };
const RESPALDO_ARCHIVO = 'mimo-respaldo.json';
const RESPALDO_BD = 'mimo-respaldo';

function respaldoSoportado(){
  // Dentro de Tauri la carpeta se resuelve con su propio dialogo (ver 10a-carpeta-tauri.js):
  // el webview de Linux es WebKitGTK y NO trae showDirectoryPicker, pero Tauri si puede.
  if (enTauri()) return true;
  // Hace falta el selector de carpetas y un sitio donde recordar la eleccion.
  return typeof window.showDirectoryPicker === 'function' && !!window.indexedDB;
}

/* ---- recordar la carpeta elegida entre sesiones (IndexedDB) ---- */
function abrirBDRespaldo(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(RESPALDO_BD, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('manejadores');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function guardarHandleRespaldo(h){
  const db = await abrirBDRespaldo();
  return new Promise((res, rej) => {
    const tx = db.transaction('manejadores', 'readwrite');
    tx.objectStore('manejadores').put(h, 'carpeta');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
async function leerHandleRespaldo(){
  const db = await abrirBDRespaldo();
  return new Promise((res, rej) => {
    const tx = db.transaction('manejadores', 'readonly');
    const rq = tx.objectStore('manejadores').get('carpeta');
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
async function olvidarHandleRespaldo(){
  const db = await abrirBDRespaldo();
  return new Promise(res => {
    const tx = db.transaction('manejadores', 'readwrite');
    tx.objectStore('manejadores').delete('carpeta');
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}

/* ---- escribir y leer dentro de una carpeta (handle) ---- */
async function escribirArchivoEn(dir, nombre, texto){
  const fh = await dir.getFileHandle(nombre, { create: true });
  const w = await fh.createWritable();
  await w.write(texto);
  await w.close();
}
async function leerArchivoEn(dir, nombre){
  try {
    const fh = await dir.getFileHandle(nombre);
    const f = await fh.getFile();
    return await f.text();
  } catch (e) { return null; }
}

/* Rotacion de 3 versiones. Se separa de RESPALDO.handle a proposito: asi se puede probar con
   cualquier carpeta (incluida la de pruebas del navegador) sin el dialogo nativo. */
async function escribirEnCarpeta(dir, texto){
  const previo1 = await leerArchivoEn(dir, RESPALDO_ARCHIVO + '.1');
  if (previo1 !== null) await escribirArchivoEn(dir, RESPALDO_ARCHIVO + '.2', previo1);
  const previo0 = await leerArchivoEn(dir, RESPALDO_ARCHIVO);
  if (previo0 !== null) await escribirArchivoEn(dir, RESPALDO_ARCHIVO + '.1', previo0);
  await escribirArchivoEn(dir, RESPALDO_ARCHIVO, texto);
}

/* ---- la accion que dispara todo ---- */
async function elegirCarpetaRespaldo(){
  if (!RESPALDO.soportado){
    // Un aviso CORTO no sirve: el usuario se queda sin saber si es culpa suya ni que hacer.
    // Aqui se dice POR QUE y COMO (es el mismo criterio del apartado de Ajustes, que ya no
    // se oculta en silencio). Medido: en Brave el boton no hacia nada visible.
    mostrarAviso('Aqui no se puede elegir carpeta: Brave trae desactivada esa funcion. ' +
      'Tus datos siguen guardados en este equipo, y puedes usar "Descargar mis datos". ' +
      'Para tener la copia automatica, usa Chromium (./abrir.sh --navegador chromium).');
    return;
  }
  // En Tauri la carpeta se elige con el dialogo del sistema; el handle que se obtiene tiene la
  // misma forma que el del navegador, asi que a partir de aqui el codigo es el mismo.
  if (enTauri()){
    try {
      const ruta = await window[TAURI].dialog.open({
        directory: true, multiple: false, title: 'Elige la carpeta para tus copias de seguridad',
      });
      if (!ruta) return;   // cancelo: no es un error que haya que gritar
      const dir = await carpetaDeTauri(ruta);
      RESPALDO.handle = dir;
      CARPETA_TAURI.ruta = ruta;
      recordarCarpetaTauri(ruta);
      await respaldarAhora(true);
      mostrarAviso('Listo: tus copias se guardan en ' + ruta, 6000);
    } catch (e) {
      // Antes decia solo "No se pudo usar esa carpeta" y el usuario se quedaba igual. Se anade el
      // motivo real (por ejemplo, que el sistema no tenga el dialogo de carpetas disponible).
      mostrarAviso('No se pudo usar esa carpeta: ' + ((e && e.message) || e), 7000);
    }
    pintarRespaldo();
    return;
  }
  try {
    const h = await window.showDirectoryPicker({ mode: 'readwrite', id: 'mimo-respaldo' });
    const permiso = await h.requestPermission({ mode: 'readwrite' });
    if (permiso !== 'granted'){
      mostrarAviso('No diste permiso para escribir en esa carpeta.');
      return;
    }
    RESPALDO.handle = h;
    await guardarHandleRespaldo(h);
    await respaldarAhora(true);
    mostrarAviso('Carpeta de respaldo lista');
  } catch (e) {
    // Lo normal aqui es que el usuario cancelara el dialogo: no es un error que haya que gritar.
  }
  pintarRespaldo();
}

async function respaldarAhora(manual){
  if (!RESPALDO.handle) return;
  try {
    let permiso = 'granted';
    if (RESPALDO.handle.queryPermission){
      permiso = await RESPALDO.handle.queryPermission({ mode: 'readwrite' });
    }
    if (permiso !== 'granted'){
      // Sin gesto del usuario el navegador no deja pedir permiso: solo se pide en manual.
      if (!manual){ RESPALDO.ultimo = { ok: false, error: 'permiso' }; pintarRespaldo(); return; }
      permiso = await RESPALDO.handle.requestPermission({ mode: 'readwrite' });
      if (permiso !== 'granted'){ RESPALDO.ultimo = { ok: false, error: 'permiso' }; pintarRespaldo(); return; }
    }
    const texto = JSON.stringify(respaldoActual(), null, 1);
    await escribirEnCarpeta(RESPALDO.handle, texto);
    RESPALDO.ultimo = { ok: true, cuando: new Date() };
    if (manual) {
      const donde = respaldarEstado();
      mostrarAviso(donde ? 'Copia guardada en ' + donde : 'Copia guardada');
    }
  } catch (e) {
    RESPALDO.ultimo = { ok: false, error: (e && e.name) || 'Error' };
    if (manual) mostrarAviso('No se pudo guardar la copia');
  }
  pintarRespaldo();
}

let tRespaldoAuto = null;
function respaldoAuto(){
  // Se llama desde guardar() en cada cambio. Se agrupa para no escribir en disco sin parar.
  if (!RESPALDO.handle) return;
  clearTimeout(tRespaldoAuto);
  tRespaldoAuto = setTimeout(() => respaldarAhora(false), 3000);
}

async function quitarCarpetaRespaldo(){
  RESPALDO.handle = null;
  RESPALDO.ultimo = null;
  CARPETA_TAURI.ruta = null;
  recordarCarpetaTauri(null);
  try { await olvidarHandleRespaldo(); } catch (e) { /* igual se olvida en memoria */ }
  pintarRespaldo();
  mostrarAviso('Se dejo de respaldar en la carpeta');
}

/* La RUTA (o el nombre) de la carpeta de respaldo elegida, para el distintivo de estado.
   En Tauri es la ruta completa; en el navegador, el nombre de la carpeta (el handle no expone
   la ruta por privacidad). Devuelve null si no hay ninguna elegida. */
function respaldarEstado(){
  if (CARPETA_TAURI.ruta) return CARPETA_TAURI.ruta;
  if (RESPALDO.handle && RESPALDO.handle.name) return RESPALDO.handle.name;
  return null;
}

/* Pinta el ESTADO del respaldo en la ficha de Ajustes y en su ventana:
   sin carpeta -> «pendiente» (dorado); con carpeta -> «sincronizado en <ruta>» (verde).
   Va con el icono: alerta en «pendiente», visto bueno en «sincronizado». */
function pintarEstadoRespaldo(){
  const ruta = respaldarEstado();
  const decir = typeof t === 'function' ? t : (k) => k;
  [['resp-estado-ficha','resp-estado-txt','resp-estado-ic'],
   ['resp-estado','resp-estado-txt2','resp-estado-ic2']].forEach(function(par){
    const caja = document.getElementById(par[0]);
    const txt  = document.getElementById(par[1]);
    const ic   = document.getElementById(par[2]);
    if (!caja || !txt) return;
    if (ruta){
      caja.classList.remove('pendiente'); caja.classList.add('sync');
      txt.textContent = decir('ajustes.respaldo.sync', { ruta: ruta });
      if (ic) ic.setAttribute('href', '#EST-02');
    } else {
      caja.classList.remove('sync'); caja.classList.add('pendiente');
      txt.textContent = decir('ajustes.respaldo.pendiente');
      if (ic) ic.setAttribute('href', '#EST-03');
    }
  });
}

function pintarRespaldo(){
  pintarEstadoRespaldo();
  if (typeof pintarSync === 'function') pintarSync();   // el boton de sync de la cabecera
  const caja = document.getElementById('plegable-respaldo-carpeta');
  if (!caja) return;
  const aviso = document.getElementById('resp-carpeta-aviso');
  if (!RESPALDO.soportado){
    // NO se oculta en silencio: antes el apartado desaparecia sin explicacion y parecia que la
    // funcion no existia. Aqui se muestra y se dice POR QUE no se puede usar y como arreglarlo.
    caja.hidden = false;
    if (aviso){
      // En Tauri la carpeta SI se puede: el dialogo lo pone el sistema. Se dice tal cual.
      // Este aviso es SOLO para el navegador: en la aplicacion de escritorio (Tauri) la carpeta
    // se elige con el dialogo del sistema y esto nunca se alcanza.
    aviso.textContent = 'Este navegador no permite elegir la carpeta (es una funcion de la ' +
        'familia de Chrome/Chromium que algunos navegadores desactivan por privacidad, como Brave). ' +
        'Mientras tanto, usa "Descargar mis datos" para guardar una copia a mano. Si quieres el ' +
        'respaldo automatico en Brave, activa el interruptor "File System Access API" en ' +
        'brave://flags y reinicia el navegador.';
    }
    const e2 = document.getElementById('resp-carpeta-estado');
    if (e2) e2.textContent = '';
    return;
  }
  if (aviso) aviso.textContent = '';
  caja.hidden = false;
  const est = document.getElementById('resp-carpeta-estado');
  const btnAhora = document.getElementById('resp-carpeta-ahora');
  const btnQuitar = document.getElementById('resp-carpeta-quitar');
  const btnElegir = document.getElementById('resp-carpeta-elegir');
  if (!est) return;
  if (!RESPALDO.handle){
    est.textContent = 'Todavia no has elegido una carpeta. Tus datos se guardan solo en este equipo.';
    if (btnAhora) btnAhora.disabled = true;
    if (btnQuitar) btnQuitar.disabled = true;
    if (btnElegir) { btnElegir.disabled = false; btnElegir.textContent = 'Elegir carpeta…'; }
    return;
  }
  // Con carpeta ya puesta, el boton lo dice: no es "elegir" otra vez, es "cambiar".
  if (btnElegir) btnElegir.textContent = 'Cambiar carpeta…';
  // El boton de elegir NO se apaga aunque ya haya carpeta: asi se puede CAMBIAR. Antes quedaba
  // deshabilitado y pulsarlo no hacia nada, sin un solo aviso (lo reporto el dueno).
  if (btnElegir) btnElegir.disabled = false;
  if (btnQuitar) btnQuitar.disabled = false;
  if (RESPALDO.ultimo && RESPALDO.ultimo.ok){
    const h = RESPALDO.ultimo.cuando;
    const hh = String(h.getHours()).padStart(2, '0') + ':' + String(h.getMinutes()).padStart(2, '0');
    est.textContent = 'Ultima copia: hoy a las ' + hh + '. Se actualiza sola con cada cambio.';
    if (btnAhora) btnAhora.disabled = false;
  } else if (RESPALDO.ultimo && RESPALDO.ultimo.error === 'permiso'){
    est.textContent = 'Falta dar permiso a la carpeta. Pulsa "Guardar copia ahora" y aceptalo.';
    if (btnAhora) btnAhora.disabled = false;
  } else {
    const donde = respaldarEstado();
    est.textContent = 'Carpeta: ' + (donde || 'elegida') + '. Se guarda una copia con cada cambio. ' +
      'Si quieres usar otra, pulsa "Elegir carpeta...".';
    if (btnAhora) btnAhora.disabled = false;
  }
}

async function initRespaldoCarpeta(){
  RESPALDO.soportado = respaldoSoportado();
  pintarRespaldo();
  if (!RESPALDO.soportado) return;
  // En Tauri la carpeta se recuerda por su RUTA (una cadena); en el navegador, por su handle.
  if (enTauri()){
    const ruta = carpetaTauriRecordada();
    if (ruta){
      try {
        RESPALDO.handle = await carpetaDeTauri(ruta);
        CARPETA_TAURI.ruta = ruta;
      } catch (e) { RESPALDO.handle = null; }
    }
    pintarRespaldo();
    return;
  }
  try {
    const h = await leerHandleRespaldo();
    if (h){
      // Solo se reengancha si el permiso SIGUE concedido; si no, el usuario lo renueva con un clic.
      const permiso = h.queryPermission ? await h.queryPermission({ mode: 'readwrite' }) : 'granted';
      RESPALDO.handle = (permiso === 'granted') ? h : null;
    }
  } catch (e) { /* sin IndexedDB no hay nada que reenganchar */ }
  pintarRespaldo();
}

// Enganches de la interfaz (los botones viven en html/ajustes.html).
(function conectarRespaldoCarpeta(){
  const elegir = document.getElementById('resp-carpeta-elegir');
  const ahora = document.getElementById('resp-carpeta-ahora');
  const quitar = document.getElementById('resp-carpeta-quitar');
  if (elegir) elegir.onclick = elegirCarpetaRespaldo;
  if (ahora) ahora.onclick = () => respaldarAhora(true);
  if (quitar) quitar.onclick = quitarCarpetaRespaldo;
  // El texto del estado es un dato montado (la ruta): no lo cubre aplicarIdioma, asi que se
  // vuelve a pintar al cambiar de idioma.
  document.addEventListener('mimo:idioma', pintarEstadoRespaldo);
  initRespaldoCarpeta();
})();
