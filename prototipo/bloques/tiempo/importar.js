/* ========================================================= Tiempo · importar
   Lectura de un respaldo al almacen propio del bloque Tiempo. No toca el DOM, no dibuja y no
   pinta avisos: devuelve un informe y la UI decide que hacer con el.

   Que acepta, en este orden:
     1 formato 2:  {formato:2, estado:{tiempo:{...}}}    (es el que emite exportar.js)
     2 formato viejo: {tiempo:{...}} en la raiz          (lo que resolvia migrarTiempo)
     3 nada de tiempo: se devuelve ok:false y NO se escribe NADA (ni se borra lo que hubiera)

   Reglas de propiedad:
     - Solo se escribe la clave del bloque (`mimo.bloque.tiempo`). El resto del respaldo no se
       toca ni se reescribe, y no se borra ningun dato de otro bloque.
     - Fusion PROFUNDA sobre lo que ya hay: un respaldo de la 1.0.2 (sin pomodoro, sin
       recordatorios) no borra esas ramas; quedan con su valor actual y solo se llena lo que trae.
       Los arrays (registro, recordatorios) se reemplazan solo si el respaldo los trae.
     - Se porta migrarTiempo (comun/03-catalogo.js:337-354): el estado viejo vivia en la raiz de
       `tiempo` (acumulado/corriendo/inicio/objetivo en MINUTOS) y se rescata a crono/temp en
       SEGUNDOS. `objetivo` no existe en la forma canonica: se convierte y se descarta.

   Sesiones: el viejo las guardaba por semestre, en `estado.sem[<id>].sesiones`, fuera de
   `tiempo`. Aqui el dueno del registro es el bloque, asi que se rescatan a `tiempo.registro`
   cuando el respaldo NO trae ya un registro, con deduplicacion por id (importar dos veces el
   mismo respaldo no duplica nada). NO se borran de `estado.sem`: ese dato no es de este bloque.
   ============================================================================ */
var MimoTiempoImportar = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.tiempo';

  function texto(v) { return (v === null || v === undefined) ? '' : String(v); }
  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function clonar(v) { return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v)); }

  /* Fusion profunda: los objetos se combinan clave a clave, los arrays y las primitivas se
     reemplazan enteras. Un null donde ya habia un objeto NO borra la rama (un respaldo con
     `pomodoro:null` no puede dejar el bloque sin pomodoro); en cualquier otro sitio, el null que
     trae el respaldo es un valor y se respeta (p. ej. `ramo:null` = sin ramo elegido). */
  function fusionProfunda(base, encima) {
    if (!esObjeto(encima)) return clonar(encima);
    var out = esObjeto(base) ? clonar(base) : {};
    Object.keys(encima).forEach(function (k) {
      var vb = out[k], ve = encima[k];
      if (esObjeto(vb) && esObjeto(ve)) out[k] = fusionProfunda(vb, ve);
      else if (ve === null && esObjeto(vb)) return;
      else out[k] = clonar(ve);
    });
    return out;
  }

  function localizarTiempo(obj) {
    if (!esObjeto(obj)) return null;
    if (esObjeto(obj.estado) && esObjeto(obj.estado.tiempo)) {
      return { crudo: obj.estado.tiempo, via: 'estado.tiempo' };
    }
    if (esObjeto(obj.tiempo)) return { crudo: obj.tiempo, via: 'tiempo' };
    return null;
  }

  /* Porte de migrarTiempo. Trabaja sobre una copia y devuelve {tiempo, migrado}. */
  function migrarTiempo(crudo) {
    var t = clonar(crudo);
    var migrado = false;

    if (!esObjeto(t.crono)) {
      t.crono = { acumulado: 0, corriendo: false, inicio: null };
      migrado = true;
    }
    if (!esObjeto(t.temp)) {
      t.temp = { objetivoSeg: 1500, restante: 0, corriendo: false, inicio: null };
      migrado = true;
    }
    // La duracion paso de minutos (`objetivo`) a segundos (`objetivoSeg`). Si el respaldo es
    // anterior a ese cambio, se convierte; si ya trae segundos, mandan los segundos.
    if (t.temp.objetivoSeg === null || t.temp.objetivoSeg === undefined) {
      var min = Number(t.temp.objetivo);
      if (!isFinite(min) || min <= 0) min = Number(t.objetivo);
      if (!isFinite(min) || min <= 0) min = 25;
      t.temp.objetivoSeg = Math.round(min * 60);
      migrado = true;
    }
    if ('objetivo' in t.temp) { delete t.temp.objetivo; migrado = true; }

    // El estado muy viejo vivia en la raiz de `tiempo` y era del cronometro; se rescata sin
    // mezclarlo con el temporizador.
    if (t.acumulado !== undefined || t.corriendo !== undefined) {
      t.crono.acumulado = Number(t.acumulado) || 0;
      t.crono.corriendo = !!t.corriendo;
      t.crono.inicio = t.inicio || null;
      if (t.objetivo != null) t.temp.objetivoSeg = (Number(t.objetivo) || 25) * 60;
      delete t.acumulado; delete t.corriendo; delete t.inicio;
      migrado = true;
    }
    // La raiz ya no lleva `objetivo` en la forma canonica: si sobra, se descarta (ya se leyo).
    if ('objetivo' in t) { delete t.objetivo; migrado = true; }

    return { tiempo: t, migrado: migrado };
  }

  /* Sesiones que el respaldo viejo guardaba fuera de `tiempo`, por semestre (y en `personal`,
     que es un estadoSemestre mas). Se devuelven normalizadas por el motor: las que no tienen
     fecha valida se caen alli mismo. */
  function sesionesDelSemestre(obj) {
    var crudas = [];
    function meter(lista) {
      if (!Array.isArray(lista)) return;
      lista.forEach(function (s) { if (esObjeto(s)) crudas.push(s); });
    }
    var e = esObjeto(obj.estado) ? obj.estado : obj;
    if (esObjeto(e.sem)) Object.keys(e.sem).forEach(function (k) { meter(e.sem[k] && e.sem[k].sesiones); });
    if (esObjeto(e.personal)) meter(e.personal.sesiones);
    return crudas;
  }

  function unirPorId(primero, segundo) {
    var out = [], visto = {};
    (primero || []).concat(segundo || []).forEach(function (s) {
      var k = texto(s.id) || (texto(s.fecha) + '|' + texto(s.hora) + '|' + texto(s.ramo) + '|' + texto(s.minutos));
      if (visto[k]) return;
      visto[k] = true;
      out.push(s);
    });
    return out;
  }

  /* Extrae y fusiona sin escribir. Es la mitad pura, la que usa el banco de pruebas para el
     ida y vuelta. Devuelve {ok, tiempo, informe}. */
  function extraer(obj) {
    var loc = localizarTiempo(obj);
    if (!loc) {
      return {
        ok: false,
        motivo: 'sin tiempo',
        tiempo: null,
        informe: { via: null, clavesTraidas: 0, clavesSobreviven: 0, descartadas: [], migrado: false, sesionesRescatadas: 0 }
      };
    }

    // Las claves se cuentan ANTES de migrar: `objetivo` (minutos, estado viejo) se convierte en
    // `temp.objetivoSeg` y desaparece de la raiz, y eso tiene que verse en el informe.
    var traidas = Object.keys(loc.crudo);
    var mig = migrarTiempo(loc.crudo);
    var base = clonar(MimoTiempoMotor.leer());
    var fusionado = fusionProfunda(base, mig.tiempo);

    // Rescate de sesiones solo si el respaldo no trae ya un registro propio.
    var sesionesRescatadas = 0;
    if (!Array.isArray(mig.tiempo.registro)) {
      var viejas = sesionesDelSemestre(obj);
      if (viejas.length) {
        var limpias = MimoTiempoMotor.normalizar({ registro: viejas }).registro;
        var juntas = unirPorId(fusionado.registro, limpias);
        sesionesRescatadas = juntas.length - (fusionado.registro || []).length;
        fusionado.registro = juntas;
      }
    }

    var tiempo = MimoTiempoMotor.normalizar(fusionado);

    // Que claves traia el respaldo y cuales sobreviven en el resultado.
    var sobreviven = traidas.filter(function (k) { return tiempo[k] !== undefined; });
    var descartadas = traidas.filter(function (k) { return tiempo[k] === undefined; });

    return {
      ok: true,
      tiempo: tiempo,
      informe: {
        via: loc.via,
        clavesTraidas: traidas.length,
        clavesSobreviven: sobreviven.length,
        descartadas: descartadas,
        migrado: mig.migrado,
        sesionesRescatadas: sesionesRescatadas
      }
    };
  }

  /* Importa de verdad: fusiona y guarda en la clave del bloque. Devuelve el informe (nunca
     lanza; un respaldo raro sale como ok:false y sin tocar el almacen). */
  function importar(obj) {
    var r = extraer(obj);
    if (!r.ok) {
      return {
        ok: false,
        motivo: r.motivo,
        informe: r.informe,
        guardado: false
      };
    }
    var escrito = MimoTiempoMotor.guardar(r.tiempo);
    var informe = r.informe;
    informe.sesiones = escrito.registro.length;
    informe.minutos = MimoTiempoMotor.sumaMinutos(escrito.registro);
    return { ok: true, motivo: null, informe: informe, guardado: true, tiempo: r.tiempo };
  }

  // El mismo camino, desde el texto de un fichero. Un JSON roto no rompe el bloque.
  function importarTexto(txt) {
    var datos;
    try {
      datos = JSON.parse(texto(txt));
    } catch (e) {
      return { ok: false, motivo: 'json', informe: null, guardado: false };
    }
    return importar(datos);
  }

  return {
    CLAVE: CLAVE,
    localizarTiempo: localizarTiempo,
    migrarTiempo: migrarTiempo,
    fusionProfunda: fusionProfunda,
    sesionesDelSemestre: sesionesDelSemestre,
    extraer: extraer,
    importar: importar,
    importarTexto: importarTexto
  };
})();

// Unica linea que nombra `window`: la exportacion (spec §1).
if (typeof window !== 'undefined') window.MimoTiempoImportar = MimoTiempoImportar;
