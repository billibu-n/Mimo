/* ===================================================== Tiempo · banco de pruebas
   Banco versionado del motor de Tiempo. Se ejecuta con:
       node prototipo/bloques/tiempo/prueba-motor.js
   Una linea por caso (PASA / FALLA / OMITE) y exit 0 SOLO si no hay ninguna FALLA.

   No es un test de interfaz: el bloque T2 tendra su propio gate. Esto mide el calculo, el
   registro de sesiones, los agregados y el ida y vuelta del formato 2, que es lo que puede
   romperse sin que se vea en pantalla.

   El reloj se congela (MimoTiempoMotor.fijarReloj) para poder medir un pomodoro de 25 minutos
   sin esperarlos, y para que la fecha de las sesiones sea siempre la misma al repetir el banco
   dentro de un mes. Donde el resultado depende del dia, se calcula con la misma regla local que
   usa el motor (lunes..domingo), nunca con UTC.
   ============================================================================ */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var RAIZ = __dirname;
var RESPALDO = path.join(process.env.HOME || '', 'workspace', 'respaldo-mimo-2026-10-10.json');

// --- almacen falso: permite probar la persistencia sin navegador -----------------
var _almacen = {};
global.localStorage = {
  getItem: function (k) {
    return Object.prototype.hasOwnProperty.call(_almacen, k) ? _almacen[k] : null;
  },
  setItem: function (k, v) { _almacen[k] = String(v); },
  removeItem: function (k) { delete _almacen[k]; }
};

// --- carga de los ficheros del bloque, en el mismo orden del manifiesto ----------
function carga(nombre) {
  var ruta = path.join(RAIZ, nombre);
  vm.runInThisContext(fs.readFileSync(ruta, 'utf8'), { filename: ruta });
}
carga('motor.js');
carga('exportar.js');
carga('importar.js');

var M = MimoTiempoMotor;
var X = MimoTiempoExportar;
var I = MimoTiempoImportar;

// --- infraestructura minima -----------------------------------------------------
var N_PASA = 0, N_FALLA = 0, N_OMITE = 0;

function afirmar(cond, mensaje) {
  if (!cond) throw new Error(mensaje);
}
function igual(a, b, mensaje) {
  if (a !== b) throw new Error((mensaje || 'valor') + ': esperaba ' + JSON.stringify(b) + ', dio ' + JSON.stringify(a));
}
function clonar(v) { return JSON.parse(JSON.stringify(v)); }

// Comparacion profunda de verdad: recorre claves ordenadas y arrays. NO usa JSON.stringify de
// dos objetos enteros, que daria falso rojo por el orden de las claves.
function iguales(a, b, ruta) {
  ruta = ruta || 'tiempo';
  if (a === b) return true;
  if (typeof a !== typeof b) throw new Error(ruta + ': tipo ' + typeof a + ' frente a ' + typeof b);
  if (a === null || b === null) throw new Error(ruta + ': ' + JSON.stringify(a) + ' frente a ' + JSON.stringify(b));
  if (Array.isArray(a) !== Array.isArray(b)) throw new Error(ruta + ': uno es lista y el otro objeto');
  if (Array.isArray(a)) {
    if (a.length !== b.length) throw new Error(ruta + ': lista de ' + a.length + ' frente a ' + b.length);
    a.forEach(function (x, i) { iguales(x, b[i], ruta + '[' + i + ']'); });
    return true;
  }
  if (typeof a === 'object') {
    var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
    if (ka.join('|') !== kb.join('|')) {
      throw new Error(ruta + ': claves ' + ka.join(',') + ' frente a ' + kb.join(','));
    }
    ka.forEach(function (k) { iguales(a[k], b[k], ruta + '.' + k); });
    return true;
  }
  throw new Error(ruta + ': ' + JSON.stringify(a) + ' frente a ' + JSON.stringify(b));
}

// Reloj congelado a un martes 2026-10-20, 12:00 LOCAL. Su lunes es 2026-10-19.
var T0 = new Date(2026, 9, 20, 12, 0, 0).getTime();

function reiniciar() {
  _almacen = {};
  M = MimoTiempoMotor;
  M.fijarReloj(T0);
  M.guardar(M.estadoInicial());
}
function conRamo(codigo) {
  var t = M.leer();
  t.ramo = codigo;
  M.guardar(t);
}
function caso(n, nombre, fn) {
  try {
    fn();
    N_PASA++;
    console.log('PASA  ' + n + '  ' + nombre);
  } catch (e) {
    N_FALLA++;
    console.log('FALLA ' + n + '  ' + nombre + ' -> ' + e.message);
  } finally {
    try { MimoTiempoMotor.fijarReloj(null); } catch (e2) { /* el motor no cargo */ }
  }
}

/* ------------------------------------------------------------------ casos ---- */

caso(1, 'cronometro: acumula mientras corre y se congela al pausar', function () {
  reiniciar();
  M.cronoIniciar();
  M.avanzarReloj(90000);
  igual(M.cronoMs(), 90000, 'tras 90 s');
  igual(M.cronoPausar(), 90000, 'pausar devuelve lo acumulado');
  M.avanzarReloj(5000);
  igual(M.cronoMs(), 90000, 'en pausa el reloj no puede seguir subiendo');
  M.cronoIniciar();
  M.avanzarReloj(10000);
  igual(M.cronoMs(), 100000, 'reanudar suma desde lo acumulado');
  igual(M.leer().crono.corriendo, true, 'queda corriendo');
});

caso(2, 'cronometro: poner a mano y volver a cero', function () {
  reiniciar();
  M.cronoPonerMs(3600000);
  igual(M.cronoMs(), 3600000, 'una hora a mano');
  M.cronoIniciar();
  M.cronoPonerMs(60000);
  M.avanzarReloj(5000);
  igual(M.cronoMs(), 65000, 'editar mientras corre reinicia el tramo');
  // El viejo (cronoCero) pone el acumulado a cero pero NO para el reloj si estaba corriendo.
  M.cronoCero();
  igual(M.cronoMs(), 0, 'cero');
  igual(M.cronoEstaCorriendo(), true, 'si corria, sigue corriendo desde cero');
  M.cronoPausar();
  M.avanzarReloj(5000);
  igual(M.cronoMs(), 0, 'y pausado se queda en cero');
  igual(M.cronoEstaCorriendo(), false, 'pausado queda parado');
});

caso(3, 'temporizador: descuenta, pausa y conserva lo que queda', function () {
  reiniciar();
  M.tempPonerMs(60000);
  igual(M.tempObjetivoSeg(), 60, 'objetivo en segundos');
  M.tempIniciar();
  M.avanzarReloj(25000);
  igual(M.tempRestanteMs(), 35000, 'tras 25 s de 60');
  igual(M.tempPausar(), 35000, 'pausar congela');
  M.avanzarReloj(5000);
  igual(M.tempRestanteMs(), 35000, 'en pausa no sigue bajando');
  M.tempIniciar();
  M.avanzarReloj(35000);
  igual(M.tempRestanteMs(), 0, 'llega a cero');
  igual(M.tempTic(), true, 'el tic detecta el cero');
  igual(M.tempTic(), false, 'y no lo repite');
  igual(M.tempEstaCorriendo(), false, 'queda parado en cero');
});

caso(4, 'temporizador: los segundos escritos no se redondean a minutos', function () {
  reiniciar();
  M.tempPonerMs(45000);
  igual(M.tempObjetivoSeg(), 45, '45 s se guardan como 45 s, no como 1 min');
  igual(M.tempRestanteMs(), 45000, 'queda lo escrito');
  var t = M.leer();
  igual(t.temp.objetivoSeg, 45, 'la duracion vive en temp.objetivoSeg');
  // El viejo admitia poner el reloj a cero: restante 0 y duracion minima de 1 s.
  M.tempPonerMs(0);
  igual(M.tempRestanteMs(), 0, 'el cero se admite');
  igual(M.tempObjetivoSeg(), 1, 'con duracion minima de 1 s');
  M.tempIniciar();
  igual(M.tempRestanteMs(), 1000, 'y el play vuelve a partir del objetivo');
});

caso(5, 'pomodoro: trabajo -> descanso corto, y registra la sesion', function () {
  reiniciar();
  conRamo('MA2002');
  M.pomoIniciar();
  igual(M.pomoDurMs('trabajo'), 25 * 60000, 'bloque de trabajo de 25 min');
  M.avanzarReloj(25 * 60000);
  var r = M.pomoTic();
  afirmar(r, 'el tic tenia que devolver el fin del bloque');
  igual(r.terminada, 'trabajo', 'termino trabajo');
  igual(r.fase, 'descanso', 'encadena a descanso corto');
  igual(r.registrada, 25, 'registra los 25 min');
  igual(M.pomo().trabajos, 1, 'un trabajo completado');
  igual(M.pomo().racha, 1, 'racha 1');
  igual(M.pomo().restante, null, 'la fase nueva arranca con su duracion');
  igual(M.pomo().corriendo, false, 'el bloque siguiente espera al play');
  igual(M.pomoDurMs(r.fase), 5 * 60000, 'descanso corto de 5 min');
  var reg = M.leer().registro;
  igual(reg.length, 1, 'una sesion en el registro');
  igual(reg[0].minutos, 25, 'de 25 min');
  igual(reg[0].ramo, 'MA2002', 'en el ramo elegido');
  igual(reg[0].fecha, '2026-10-20', 'en el dia de hoy');
  igual(reg[0].lunes, '2026-10-19', 'con su lunes derivado de la fecha');
  // descanso corto: no registra y devuelve el turno al trabajo
  M.pomoIniciar();
  M.avanzarReloj(5 * 60000);
  var r2 = M.pomoTic();
  igual(r2.terminada, 'descanso', 'termino el descanso');
  igual(r2.fase, 'trabajo', 'vuelve a trabajo');
  igual(r2.registrada, 0, 'un descanso no registra');
  igual(M.leer().registro.length, 1, 'sigue habiendo una sola sesion');
  igual(M.pomo().trabajos, 1, 'los descansos no suman trabajos');
});

caso(6, 'pomodoro: descanso largo cada N (cada=4 por defecto, y cada=2 configurado)', function () {
  reiniciar();
  conRamo('FI2004');
  var fases = [];
  var k;
  function cerrarBloque() {
    // Corre el bloque entero del modo activo y devuelve el tic de su final.
    M.pomoIniciar();
    M.avanzarReloj(M.pomoDurMs(M.pomo().fase));
    return M.pomoTic();
  }
  for (k = 0; k < 4; k++) {
    fases.push(cerrarBloque().fase);          // fin de trabajo
    if (k < 3) fases.push(cerrarBloque().fase); // fin del descanso previo al siguiente
  }
  igual(fases.join('>'), 'descanso>trabajo>descanso>trabajo>descanso>trabajo>largo',
    'el cuarto trabajo encadena descanso largo');
  igual(M.pomo().trabajos, 4, 'cuatro trabajos');
  igual(M.leer().registro.length, 4, 'cuatro sesiones registradas');
  // con cada=2, el largo cae al segundo
  M.pomoConfigurar({ cada: 2 });
  igual(M.pomo().trabajos, 4, 'el contador no se reinicia al configurar');
  igual(M.pomoFaseSiguiente(), 'trabajo', 'desde un descanso siempre se vuelve a trabajo');
  M.pomoParar();
  // 4 trabajos ya hechos: el siguiente multiplo de 2 es 6, pero se comprueba desde cero
  reiniciar();
  conRamo('FI2004');
  M.pomoConfigurar({ cada: 2 });
  igual(cerrarBloque().fase, 'descanso', 'primer trabajo: corto');
  igual(cerrarBloque().fase, 'trabajo', 'fin del corto');
  igual(cerrarBloque().fase, 'largo', 'segundo trabajo: largo con cada=2');
});

caso(7, 'pomodoro: cambiar la configuracion no toca el bloque en marcha', function () {
  reiniciar();
  M.pomoIniciar();
  M.avanzarReloj(5 * 60000);
  igual(M.pomoRestanteMs(), 20 * 60000, 'quedan 20 de 25');
  M.pomoConfigurar({ trabajo: 50, corto: 10, largo: 30, cada: 3 });
  igual(M.pomoRestanteMs(), 20 * 60000, 'el bloque en marcha sigue con 25');
  igual(M.pomoDurMs('trabajo'), 50 * 60000, 'el proximo trabajo usara 50');
  igual(M.pomoDurMs('descanso'), 10 * 60000, 'y el proximo descanso corto 10');
  igual(M.pomoDurMs('largo'), 30 * 60000, 'y el proximo descanso largo 30');
  M.avanzarReloj(20 * 60000);
  var r = M.pomoTic();
  igual(r.registrada, 50, 'al completarse, registra la duracion nueva');
  igual(M.pomoConfig().trabajo, 50, 'la configuracion queda guardada');
});

caso(8, 'sesiones: registrar y deshacer', function () {
  reiniciar();
  var s = M.registrarMinutos(40, { fecha: '2026-10-20', ramo: 'MA2002', hora: '21:35' });
  afirmar(s && s.id, 'la sesion tiene id');
  igual(s.fecha, '2026-10-20', 'fecha');
  igual(s.lunes, '2026-10-19', 'lunes derivado');
  igual(s.minutos, 40, 'minutos');
  igual(s.ramo, 'MA2002', 'ramo');
  igual(s.hora, '21:35', 'hora');
  igual(M.leer().registro.length, 1, 'una en el registro');
  igual(M.quitarSesion(s.id), true, 'deshacer la encuentra');
  igual(M.leer().registro.length, 0, 'y la quita');
  igual(M.quitarSesion(s.id), false, 'deshacer dos veces no rompe');
  igual(M.registrarMinutos(0), null, 'menos de un minuto no registra');
  igual(M.leer().registro.length, 0, 'y no deja sesion vacia');
});

caso(9, 'agregados: por dia, por semana y por ramo', function () {
  reiniciar();
  M.registrarMinutos(40, { fecha: '2026-10-20', ramo: 'MA2002', hora: '10:00' });
  M.registrarMinutos(20, { fecha: '2026-10-20', ramo: 'FI2004', hora: '11:00' });
  M.registrarMinutos(30, { fecha: '2026-10-21', ramo: 'MA2002', hora: '09:00' });
  M.registrarMinutos(15, { fecha: '2026-09-29', ramo: 'FI2004', hora: '12:00' });
  igual(M.minutosDia('2026-10-20'), 60, 'dia 2026-10-20');
  igual(M.minutosSemana('2026-10-19'), 90, 'semana del 2026-10-19');
  igual(M.minutosSemana('2026-09-28'), 15, 'semana del 2026-09-28');
  igual(M.minutosRamo('MA2002'), 70, 'ramo MA2002');
  igual(M.minutosRamo('FI2004'), 35, 'ramo FI2004');
  var ag = M.agregados();
  igual(ag.total, 105, 'total');
  igual(ag.sesiones, 4, 'cuatro sesiones');
  igual(ag.porDia['2026-10-20'], 60, 'por dia');
  igual(ag.porSemana['2026-10-19'], 90, 'por semana');
  igual(ag.porRamo['MA2002'], 70, 'por ramo');
  igual(M.sesionesDeSemana('2026-10-19').length, 3, 'tres sesiones en la semana');
  var semana = M.sesionesDeSemana('2026-10-19');
  igual(semana[0].fecha + ' ' + semana[0].hora, '2026-10-20 10:00', 'ordenadas por fecha y despues por hora');
  igual(semana[2].fecha + ' ' + semana[2].hora, '2026-10-21 09:00', 'la del dia siguiente va despues aunque su hora sea menor');
});

caso(10, 'ida y vuelta: exportar -> importar devuelve el mismo objeto', function () {
  reiniciar();
  M.registrarMinutos(40, { fecha: '2026-10-20', ramo: 'MA2002', hora: '10:00' });
  M.pomoConfigurar({ trabajo: 50, corto: 10, largo: 20, cada: 3 });
  M.tempPonerMs(45000);
  M.cronoPonerMs(125000);
  M.cronoIniciar();
  M.avanzarReloj(5000);
  M.cronoPausar();
  var t = M.leer();
  t.modo = 'pomodoro';
  t.recSonido = 'archivo';
  M.guardar(t);

  var antes = clonar(M.leer());
  var exportado = X.aFormato2();
  igual(exportado.formato, 2, 'formato 2');
  afirmar(exportado.estado && exportado.estado.tiempo, 'el tiempo viaja en estado.tiempo');
  igual(JSON.parse(X.comoTexto()).formato, 2, 'el texto es JSON de formato 2');

  M.guardar(M.estadoInicial());   // se borra todo: la vuelta tiene que reconstruirlo
  igual(M.leer().registro.length, 0, 'partida limpia');

  var r = I.extraer(exportado);
  afirmar(r.ok, 'la importacion tiene que aceptar lo que exporta el propio bloque');
  igual(r.informe.via, 'estado.tiempo', 'se lee del sitio del formato 2');
  iguales(antes, r.tiempo);       // comparacion profunda, no texto

  // y guardado de verdad, el estado vivo queda igual
  M.guardar(M.estadoInicial());
  I.importar(exportado);
  iguales(antes, M.leer());
});

caso(11, 'importar formato viejo: fusion profunda y minutos -> segundos', function () {
  reiniciar();
  var actual = M.leer();
  actual.pomodoro.config.trabajo = 50;
  actual.recSonido = 'archivo';
  M.guardar(actual);

  var viejo = {
    tiempo: {
      modo: 'temporizador',
      temp: { objetivo: 130, restante: 60000, corriendo: false, inicio: null },
      ramo: 'FI2004'
    }
  };
  var r = I.importar(viejo);
  afirmar(r.ok, 'el formato viejo se acepta');
  igual(r.informe.via, 'tiempo', 'se lee de la raiz');
  igual(r.informe.migrado, true, 'se migra');
  igual(M.leer().modo, 'temporizador', 'el modo del respaldo manda');
  igual(M.leer().ramo, 'FI2004', 'el ramo del respaldo manda');
  igual(M.leer().temp.objetivoSeg, 130 * 60, '130 min pasan a segundos');
  igual(M.leer().pomodoro.config.trabajo, 50, 'un respaldo sin pomodoro NO borra el pomodoro');
  igual(M.leer().recSonido, 'archivo', 'ni el sonido elegido');
  igual(M.leer().crono.acumulado, 0, 'el cronometro sigue existiendo');

  // un null donde va un objeto tampoco borra la rama
  var r2 = I.extraer({ formato: 2, estado: { tiempo: { pomodoro: null } } });
  afirmar(r2.ok, 'un pomodoro nulo no invalida el respaldo');
  igual(r2.tiempo.pomodoro.config.trabajo, 50, 'la rama del pomodoro sobrevive al null');
});

caso(12, 'importar sin tiempo: no rompe y no borra nada', function () {
  reiniciar();
  M.registrarMinutos(30, { fecha: '2026-10-20', ramo: 'MA2002', hora: '19:00' });
  var antes = clonar(M.leer());

  var r = I.importar({ formato: 2, estado: { v: 3 } });
  igual(r.ok, false, 'sin tiempo no se importa');
  igual(r.motivo, 'sin tiempo', 'se dice por que');
  igual(r.guardado, false, 'no se escribe');
  iguales(antes, M.leer(), 'el estado del bloque queda intacto');

  var roto = I.importarTexto('{ esto no es json');
  igual(roto.ok, false, 'un JSON roto no lanza');
  igual(roto.motivo, 'json', 'y se distingue del caso sin tiempo');
  iguales(antes, M.leer(), 'tampoco borra al fallar el JSON');

  igual(I.importar(null).ok, false, 'null tampoco rompe');
  iguales(antes, M.leer(), 'ni borra');
});

caso(13, 'respaldo real del dueno: se importa y conserva su tiempo', function () {
  if (!fs.existsSync(RESPALDO)) {
    N_OMITE++;
    console.log('OMITE 13  no esta el respaldo real: ' + RESPALDO);
    return;
  }
  var datos = JSON.parse(fs.readFileSync(RESPALDO, 'utf8'));
  reiniciar();
  var r = I.importar(datos);   // si lanza, el caso falla: eso es lo que se mide
  afirmar(r.ok, 'el respaldo real tiene que importarse');
  var inf = r.informe;
  console.log('      informe: traia ' + inf.clavesTraidas + ' claves de tiempo, sobreviven ' +
    inf.clavesSobreviven + (inf.descartadas.length ? ' (se descarta: ' + inf.descartadas.join(',') + ')' : '') +
    '; sesiones rescatadas: ' + inf.sesionesRescatadas + '; total ' + r.tiempo.registro.length +
    ' sesiones y ' + M.sumaMinutos(r.tiempo.registro) + ' min');
  igual(inf.via, 'estado.tiempo', 'viene en el sitio del formato 2');
  igual(inf.clavesTraidas, 10, 'el respaldo trae 10 claves de tiempo');
  igual(inf.clavesSobreviven, 9, 'sobreviven 9: `objetivo` es estado viejo en minutos');
  igual(inf.descartadas.join(','), 'objetivo', 'la descartada es `objetivo`');
  igual(M.leer().temp.objetivoSeg, 6300, 'la duracion del respaldo se conserva en segundos');
  igual(M.leer().pomodoro.config.cada, 4, 'el pomodoro del respaldo entra entero');
  afirmar(M.leer().registro.length >= 54, 'las sesiones por semestre se rescatan al registro');
  afirmar(M.sumaMinutos(M.leer().registro) > 0, 'y suman minutos');
});

caso(14, 'persistencia: guardar escribe la clave del bloque y el motor la relee', function () {
  reiniciar();
  M.registrarMinutos(25, { fecha: '2026-10-20', ramo: 'MA2002', hora: '08:00' });
  var crudo = localStorage.getItem('mimo.bloque.tiempo');
  afirmar(crudo, 'tiene que existir la clave mimo.bloque.tiempo');
  var guardado = JSON.parse(crudo);
  igual(guardado.v, 1, 'con su version');
  igual(guardado.tiempo.registro.length, 1, 'y su registro dentro');
  // recargar el bloque (como al abrir la app) y comprobar que sigue ahi
  carga('motor.js');
  carga('exportar.js');
  carga('importar.js');
  M = MimoTiempoMotor;
  X = MimoTiempoExportar;
  I = MimoTiempoImportar;
  igual(M.leer().registro.length, 1, 'el motor recargado relee la sesion');
  igual(M.leer().registro[0].ramo, 'MA2002', 'con su ramo');
});

/* ---------------------------------------------------------------- resumen ---- */
console.log('');
console.log('RESUMEN: ' + N_PASA + ' PASA, ' + N_FALLA + ' FALLA, ' + N_OMITE + ' OMITE');
process.exit(N_FALLA === 0 ? 0 : 1);
