/* ---------------------------------------- migracion de los datos al abrir en Tauri

   POR QUE HACE FALTA ESTO. Los datos del usuario viven en el `localStorage`, y el `localStorage`
   pertenece a un ORIGEN. En el lanzador de siempre el origen es `http://127.0.0.1:8734`; dentro
   de Tauri es `tauri://localhost`. Son DOS ORIGENES DISTINTOS: al abrir la version de escritorio,
   la app aparece VACIA aunque los datos esten en el disco. Medido, no supuesto.

   QUE SE HACE. No se le pide nada al usuario que pueda salir mal con un clic. La app de escritorio
   busca el perfil del lanzador (su carpeta de datos), de donde saca el valor guardado, y lo copia
   al almacenamiento de la app. La copia la hace un comando NATIVO (Rust), no el webview: asi el
   permiso de lectura del disco lo resuelve el sistema y no hace falta abrirle el disco entero a la
   pagina, que seria mucho peor.

   Se guarda una MARCA para no repetirlo: si el usuario decide luego empezar de cero, no se le
   vuelven a colar los datos viejos en cada arranque. */

const MIGRACION = {
  marca: 'mimo-migrado-desde-lanzador',
  origen: null,      // ruta del perfil encontrado
  motivo: null,      // por que no se pudo, cuando no se pudo
};

function yaMigrado() {
  // La marca SOLA no basta: tiene que estar tambien el dato. Si por lo que sea la marca quedo
  // puesta y los datos no estan (p. ej. el usuario limpio el almacenamiento a mano, o una version
  // anterior los borro), hay que volver a intentarlo en vez de dar por hecho algo que no paso.
  // Fallo real medido: una marca obsoleta dejo a la app sin sus datos y sin intentarlo.
  try {
    return localStorage.getItem(MIGRACION.marca) === '1' && localStorage.getItem(CLAVE) !== null;
  } catch (e) { return false; }
}
function marcarMigrado() {
  try { localStorage.setItem(MIGRACION.marca, '1'); } catch (e) { /* da igual */ }
}

/* Pregunta a Rust si hay datos del lanzador y, si los hay, los deja en el almacenamiento.
   Devuelve true solo si de verdad se copiaron datos. */
async function migrarDesdeLanzador(silencioso) {
  if (!enTauri()) return false;
  if (yaMigrado()) return false;
  let r;
  try {
    r = await tauriLlamar('migrar_desde_lanzador', {});
  } catch (e) {
    MIGRACION.motivo = 'no se pudo consultar';
    return false;
  }
  if (!r || !r.encontrado) {
    // No hay perfil, o no tiene datos. **NO se marca como migrado**: si el usuario instala el
    // lanzador mas adelante, o los datos aparecen despues, la migracion debe volver a intentarlo.
    // Marcar aqui seria dar por hecho algo que no ha pasado (y el usuario se quedaria sin sus
    // datos para siempre, en silencio).
    MIGRACION.motivo = (r && r.motivo) || 'sin datos anteriores';
    return false;
  }
  try {
    localStorage.setItem(CLAVE, r.datos);
  } catch (e) {
    // Cuota llena: se dice, no se calla (la leccion del "guardado honesto").
    MIGRACION.motivo = 'no caben en este almacenamiento';
    return false;
  }
  MIGRACION.origen = r.origen;
  marcarMigrado();   // solo AQUI: cuando la copia ya esta hecha
  if (!silencioso) mostrarAviso('Se recuperaron tus datos de la version anterior');
  return true;
}

/* La migracion corre ANTES de que la app lea el estado, para que el arranque ya lo vea.
   Si falla, no se detiene nada: la app funciona vacia y el respaldo .json sigue estando. */
async function initMigracion() {
  if (!enTauri()) return false;
  const migrado = await migrarDesdeLanzador(false);
  if (migrado && typeof cargar === 'function') {
    try { cargar(); pintar && pintar(); } catch (e) { /* se repinta al arrancar igual */ }
  }
  return migrado;
}

// Se engancha al evento de carga de la pagina: la app ya tiene todo definido a esa altura.
window.addEventListener('load', function () { initMigracion(); });
