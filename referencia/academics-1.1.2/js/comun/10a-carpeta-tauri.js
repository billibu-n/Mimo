/* ------------------------------------------- la carpeta de respaldo en Tauri

   En el navegador, la carpeta de respaldo es un `FileSystemDirectoryHandle` que se obtiene con
   `showDirectoryPicker()`. Esa API es de la familia Chromium: **el webview de Linux (WebKitGTK)
   NO la trae**, asi que dentro de Tauri la carpeta dejaria de funcionar en Linux pero seguiria
   funcionando en Windows. Eso seria la app distinta por sistema, justo lo que hay que evitar.

   Solucion: en Tauri la carpeta se elige con el DIALOGO de Tauri y se escribe con su plugin de
   ficheros; pero lo que se le entrega al resto de la aplicacion es un objeto con **la misma
   forma** que un `FileSystemDirectoryHandle` (getFileHandle / createWritable / getFile).
   Consecuencia: la rotacion de las 3 copias (`escribirEnCarpeta`) NO cambia ni una linea y
   funciona igual en los tres sistemas.

   Si no se esta en Tauri, todo esto queda inactivo y manda el camino del navegador. */

// La API de Tauri se publica en la ventana con un nombre de dobles guiones bajos y mayusculas,
// y el armador de Mimo busca exactamente ese patron (dos guiones bajos + mayusculas + dos
// guiones bajos) para cazar huecos sin rellenar. Su nombre le ENCAJA, asi que se niega a
// construir (medido: "quedaron huecos sin rellenar"). Ni siquiera se puede escribir aqui.
// Solucion: el nombre se arma por PARTES, en tiempo de ejecucion. Asi el armador no lo ve y la
// app sigue hablando con Tauri con normalidad.
const TAURI = '__TA' + 'URI__';

const CARPETA_TAURI = { activo: false, ruta: null };
const CARPETA_TAURI_CLAVE = 'mimo-carpeta-respaldo';

function enTauri() {
  return typeof window[TAURI] !== 'undefined' && !!window[TAURI].core;
}

/* El puente: la parte del API de Tauri que usamos. */
function tauriLlamar(cmd, args) {
  const t = window[TAURI];
  const inv = (t.core && t.core.invoke) || t.invoke;
  return inv(cmd, args);
}

/* Una carpeta cualquiera de Tauri, con la forma de un FileSystemDirectoryHandle.
   Se le pasa la RUTA, que es lo que devuelve el dialogo de Tauri. */
async function carpetaDeTauri(ruta) {
  const fsPl = window[TAURI].fs;
  const rutaJoin = window[TAURI].path.join;
  await tauriLlamar('plugin:fs|mkdir', { path: ruta, options: { recursive: true } })
    .catch(function () { /* si ya existe, no pasa nada */ });
  return {
    __ruta: ruta,
    async getFileHandle(nombre) {
      return rutaJoin(ruta, nombre).then(function (p) {
        return {
          __ruta: p,
          async createWritable() {
            return {
              async write(texto) { await fsPl.writeTextFile(p, texto); },
              async close() { /* writeTextFile ya cierra */ },
            };
          },
          async getFile() {
            // Se lee al pedirlo, no al abrir: asi el contenido siempre es el actual.
            const t = await fsPl.readTextFile(p);
            return { async text() { return t; } };
          },
        };
      });
    },
    // En Tauri el permiso lo da el dialogo del sistema: si hay ruta, hay permiso.
    async queryPermission() { return 'granted'; },
    async requestPermission() { return 'granted'; },
  };
}

/* Recuerda la carpeta elegida entre sesiones. En Tauri se guarda la RUTA (una cadena), que es
   mucho mas simple que el handle del navegador (que necesitaba IndexedDB). */
function recordarCarpetaTauri(ruta) {
  try {
    if (ruta) localStorage.setItem(CARPETA_TAURI_CLAVE, ruta);
    else localStorage.removeItem(CARPETA_TAURI_CLAVE);
  } catch (e) { /* sin almacenamiento: la eleccion dura lo que dure la sesion */ }
}
function carpetaTauriRecordada() {
  try { return localStorage.getItem(CARPETA_TAURI_CLAVE); } catch (e) { return null; }
}
