/* ============================================================================
   respaldo.js — Mimo Nuevo · sustrato comun · COPIA EN UNA CARPETA DEL USUARIO
   (bloque T003; portado de
    `referencia/mimo-app-53cc22d/js/comun/10-respaldo-carpeta.js`)

   QUE HACE
   Guarda el progreso en una CARPETA QUE ELIGE EL USUARIO (por ejemplo, una
   dentro de Documentos), para que NO se pierda si se desinstala o se borra la
   aplicacion. Es el modelo de las aplicaciones de escritorio que dejan sus
   datos en una carpeta del usuario.

   COMO
   1. El usuario elige la carpeta UNA vez (dialogo del navegador).
   2. La eleccion se recuerda en IndexedDB (el handle del navegador).
   3. Cada vez que hay un cambio se reescribe la copia ahi, con 3 versiones
      rotativas (`mimo-respaldo.json`, `.1` y `.2`): la mas nueva, la anterior
      y la de antes.

   QUE NO HACE: subir nada a internet. Es una carpeta local (o una que el
   usuario sincronice).

   EL CONTENIDO DEL RESPALDO ES EL ESTADO UNIFICADO TAL CUAL:
   `MimoComun.leer()` — el mismo cajon `mimo.datos.v1`, con las tres ramas
   (armazon, tiempo, idioma) y las que vengan. Un solo respaldo para todo.

   LIMITE HONESTO: el navegador solo deja reabrir la carpeta sin volver a
   preguntar mientras el permiso siga concedido. Si el usuario lo revoca (o el
   navegador lo olvida), al siguiente guardado automatico la copia falla con
   `error:'permiso'` y se le vuelve a pedir con un clic en "Elegir carpeta".

   LO QUE NO SE PORTA (HUECO declarado)
   - La rama de Tauri/escritorio (`10a-carpeta-tauri.js`, `10b-migracion-tauri.js`):
     este tablero corre en navegador; el dialogo del sistema no existe aqui.
   - El pintado del estado en Ajustes (`pintarRespaldo`, `pintarEstadoRespaldo`):
     no hay pantalla de Ajustes hasta T009. `respaldarEstado()` ya devuelve el
     nombre de la carpeta para cuando la haya.

   API (todo cuelga de window.MimoComun):
     MimoComun.RESPALDO                 {handle, soportado, ultimo}
     MimoComun.respaldoSoportado()      hay selector de carpetas e IndexedDB
     MimoComun.elegirCarpetaRespaldo()  -> Promise (pide la carpeta y copia)
     MimoComun.respaldarAhora(manual)   -> Promise<boolean>
     MimoComun.respaldarEstado()        nombre de la carpeta o null
     MimoComun.respaldoAuto()           copia agrupada 3 s despues del cambio
     MimoComun.quitarCarpetaRespaldo()  -> Promise (deja de respaldar)
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var RESPALDO = { handle: null, soportado: false, ultimo: null };
  var RESPALDO_ARCHIVO = 'mimo-respaldo.json';
  var RESPALDO_BD = 'mimo-respaldo';
  var _tAuto = null;
  var _tInicio = null;

  function respaldoSoportado() {
    try {
      return typeof window.showDirectoryPicker === 'function' && !!window.indexedDB;
    } catch (e) { return false; }
  }

  /* ---- recordar la carpeta elegida entre sesiones (IndexedDB) ---- */
  function abrirBD() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(RESPALDO_BD, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('manejadores'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }

  function bdPoner(h) {
    return abrirBD().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('manejadores', 'readwrite');
        tx.objectStore('manejadores').put(h, 'carpeta');
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  function bdLeer() {
    return abrirBD().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('manejadores', 'readonly');
        var rq = tx.objectStore('manejadores').get('carpeta');
        rq.onsuccess = function () { res(rq.result || null); };
        rq.onerror = function () { rej(rq.error); };
      });
    });
  }

  function bdOlvidar() {
    return abrirBD().then(function (db) {
      return new Promise(function (res) {
        var tx = db.transaction('manejadores', 'readwrite');
        tx.objectStore('manejadores').delete('carpeta');
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { res(false); };
      });
    });
  }

  /* ---- escribir y leer dentro de una carpeta (handle) ---- */
  function escribirArchivoEn(dir, nombre, texto) {
    return dir.getFileHandle(nombre, { create: true }).then(function (fh) {
      return fh.createWritable();
    }).then(function (w) {
      return w.write(texto).then(function () { return w.close(); });
    });
  }

  function leerArchivoEn(dir, nombre) {
    return dir.getFileHandle(nombre).then(function (fh) {
      return fh.getFile();
    }).then(function (f) {
      return f.text();
    })['catch'](function () { return null; });
  }

  /* Rotacion de 3 versiones: la nueva al 0, la anterior al .1 y la de antes al
     .2. Se separa de RESPALDO.handle a proposito: asi se puede probar con
     cualquier carpeta (incluida la de pruebas del navegador) sin el dialogo. */
  function escribirEnCarpeta(dir, texto) {
    return leerArchivoEn(dir, RESPALDO_ARCHIVO + '.1').then(function (previo1) {
      if (previo1 === null) { return null; }
      return escribirArchivoEn(dir, RESPALDO_ARCHIVO + '.2', previo1);
    }).then(function () {
      return leerArchivoEn(dir, RESPALDO_ARCHIVO);
    }).then(function (previo0) {
      if (previo0 === null) { return null; }
      return escribirArchivoEn(dir, RESPALDO_ARCHIVO + '.1', previo0);
    }).then(function () {
      return escribirArchivoEn(dir, RESPALDO_ARCHIVO, texto);
    });
  }

  // El contenido del respaldo: el estado unificado, sin copiarlo ni recortarlo.
  function respaldoActual() { return Mimo.leer(); }

  function avisar(txt, ms) {
    if (typeof Mimo.mostrarAviso === 'function') { Mimo.mostrarAviso(txt, ms); }
  }

  function elegirCarpetaRespaldo() {
    if (!RESPALDO.soportado) {
      // Un aviso CORTO no sirve: el usuario se queda sin saber si es culpa suya
      // ni que hacer. Se dice POR QUE y COMO.
      avisar('Aqui no se puede elegir carpeta: este navegador no trae el selector de ' +
             'carpetas. Tus datos siguen guardados en este equipo.', 6000);
      return Promise.resolve(null);
    }
    return window.showDirectoryPicker({ mode: 'readwrite', id: 'mimo-respaldo' })
      .then(function (h) {
        return h.requestPermission({ mode: 'readwrite' }).then(function (permiso) {
          if (permiso !== 'granted') {
            avisar('No diste permiso para escribir en esa carpeta.');
            return null;
          }
          RESPALDO.handle = h;
          return bdPoner(h)['catch'](function () { return false; }).then(function () {
            return respaldarAhora(true);
          }).then(function () {
            avisar('Carpeta de respaldo lista');
            return h;
          });
        });
      })['catch'](function () {
        // Lo normal aqui es que el usuario cancelara el dialogo: no es un error
        // que haya que gritar.
        return null;
      });
  }

  function respaldarAhora(manual) {
    if (!RESPALDO.handle) { return Promise.resolve(false); }
    return new Promise(function (res, rej) {
      // Sin gesto del usuario el navegador no deja pedir permiso: solo se pide en manual.
      if (typeof RESPALDO.handle.queryPermission !== 'function') { res('granted'); return; }
      RESPALDO.handle.queryPermission({ mode: 'readwrite' }).then(res, rej);
    }).then(function (permiso) {
      if (permiso === 'granted') { return 'granted'; }
      if (!manual) { return 'sin-permiso'; }
      return RESPALDO.handle.requestPermission({ mode: 'readwrite' });
    }).then(function (permiso) {
      if (permiso !== 'granted') {
        RESPALDO.ultimo = { ok: false, error: 'permiso' };
        return false;
      }
      var texto = JSON.stringify(respaldoActual(), null, 1);
      return escribirEnCarpeta(RESPALDO.handle, texto).then(function () {
        RESPALDO.ultimo = { ok: true, cuando: new Date() };
        if (manual) {
          var donde = respaldarEstado();
          avisar(donde ? 'Copia guardada en ' + donde : 'Copia guardada');
        }
        return true;
      });
    })['catch'](function (e) {
      RESPALDO.ultimo = { ok: false, error: (e && e.name) || 'Error' };
      if (manual) { avisar('No se pudo guardar la copia'); }
      return false;
    });
  }

  function respaldoAuto() {
    // Se llama desde guardar() en cada cambio. Se agrupa para no escribir en
    // disco sin parar.
    if (!RESPALDO.handle) { return false; }
    if (_tAuto) { clearTimeout(_tAuto); }
    _tAuto = setTimeout(function () { _tAuto = null; respaldarAhora(false); }, 3000);
    return true;
  }

  function respaldarEstado() {
    if (RESPALDO.handle && RESPALDO.handle.name) { return RESPALDO.handle.name; }
    return null;
  }

  function quitarCarpetaRespaldo() {
    RESPALDO.handle = null;
    RESPALDO.ultimo = null;
    return bdOlvidar()['catch'](function () { return false; }).then(function () {
      avisar('Se dejo de respaldar en la carpeta');
      return true;
    });
  }

  /* Al arrancar se intenta reenganchar la carpeta recordada: si el permiso
     sigue concedido, la copia automatica vuelve sola sin volver a preguntar.
     Se hace en diferido para no retrasar el primer pintado. */
  function reenganchar() {
    if (!RESPALDO.soportado) { return; }
    _tInicio = setTimeout(function () {
      _tInicio = null;
      bdLeer().then(function (h) {
        if (!h) { return null; }
        var pedir = (typeof h.queryPermission === 'function')
          ? h.queryPermission({ mode: 'readwrite' })
          : Promise.resolve('granted');
        return pedir.then(function (p) {
          RESPALDO.handle = (p === 'granted') ? h : null;
          return null;
        });
      })['catch'](function () { /* sin IndexedDB no hay nada que reenganchar */ });
    }, 0);
  }

  RESPALDO.soportado = respaldoSoportado();
  reenganchar();

  Mimo.RESPALDO = RESPALDO;
  Mimo.respaldoSoportado = respaldoSoportado;
  Mimo.elegirCarpetaRespaldo = elegirCarpetaRespaldo;
  Mimo.respaldarAhora = respaldarAhora;
  Mimo.respaldarEstado = respaldarEstado;
  Mimo.respaldoAuto = respaldoAuto;
  Mimo.quitarCarpetaRespaldo = quitarCarpetaRespaldo;
})(MimoComun);
