/* ============================================================================
   tiempo.js — Mimo Nuevo · tablero · motor de los bloques de Tiempo (D6, v7)

   QUE SE PORTA Y DE DONDE
   Se porta `prototipo/bloques/tiempo/motor.js` (el del prototipo de este mismo
   proyecto), que a su vez ya porto el calculo de la app Academics
   (`referencia/mimo-app-53cc22d/js/tiempo/01-tiempo.js`). Se elige el del
   prototipo y no el de `referencia/` porque:
     - el de `referencia/` pinta (`pintarReloj`, `renderTiempo`), engancha
       `setInterval`, avisos del sistema y contexto de audio y escribe cadenas de
       interfaz: portarlo seria arrancar su interfaz, no su motor;
     - el del prototipo es calculo puro sobre un estado normalizado, con el
       almacen detras de leer()/guardar(), y ya trae el `tempTic()` que avisa
       UNA vez al cruzar el cero y el `pomoTic()` que encadena trabajo ->
       descanso sumando la sesion. Eso es exactamente lo que pide el gate.
   Lo que se anade al portar (y solo esto):
     1. `_escala` (ms por minuto del pomodoro). Por defecto 60000, como el
        original; el gancho de prueba `?prueba=1` la baja a 1000 para poder
        medir un ciclo completo sin esperar 25 minutos.
     2. `arranque()`: al cargar, el cronometro vuelve PARADO EN CERO (lo exige
        el gate) y temporizador y pomodoro se quedan parados, sin perder lo
        acumulado ni el registro.
     3. `detenerTodo()`: se llama al quitar un bloque y al cambiar de seccion,
        para que ningun temporizador siga corriendo fuera de su vista.
     4. `avisosTemp()`: contador en memoria de avisos del temporizador, para
        poder medir "avisa una vez".
   No se porta nada mas del prototipo: ni su UI (ui.js), ni importar/exportar,
   ni los recordatorios (aqui el bloque Alarmas sigue estatico, HUECO declarado).

   EL ALMACEN ES UNO Y VERSIONADO: localStorage['mimo.bloque.tiempo'] =
     {v:1, tiempo:{crono, temp, pomodoro, registro[], ...}}
   Los cuatro bloques leen y escriben ahi; no hay copias por bloque.
   ============================================================================ */
var MimoTiempoMotor = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.tiempo';
  var VERSION = 1;
  var MODOS = ['cronometro', 'temporizador', 'pomodoro', 'recordatorios'];
  var FASES = ['trabajo', 'descanso', 'largo'];

  var _datos = null;       // estado normalizado; null = todavia sin leer
  var _reloj = null;       // reloj fijo para el banco de pruebas; null = real
  var _secuencia = 0;      // desempata ids cuando el reloj esta congelado
  var _escala = 60000;     // ms que dura un "minuto" de pomodoro (gancho de prueba)
  var _avisosTemp = 0;     // avisos dados por el temporizador en esta sesion

  /* ------------------------------------------------------------ utilidades */
  function texto(v) { return (v === null || v === undefined) ? '' : String(v); }
  function numero(v, porDefecto) {
    var n = Number(v);
    return isFinite(n) ? n : porDefecto;
  }
  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function clonar(v) { return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v)); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function ahora() { return _reloj === null ? Date.now() : _reloj; }
  function fijarReloj(ms) {
    if (ms === null || ms === undefined) { _reloj = null; return null; }
    var n = (ms instanceof Date) ? ms.getTime() : Number(ms);
    _reloj = isFinite(n) ? n : null;
    return _reloj;
  }
  function avanzarReloj(ms) {
    if (_reloj === null) { _reloj = Date.now(); }
    _reloj += numero(ms, 0);
    return _reloj;
  }
  function fijarEscala(ms) {
    var n = numero(ms, 60000);
    _escala = (n > 0) ? n : 60000;
    return _escala;
  }
  function escala() { return _escala; }

  /* EL RELOJ EDITABLE. La interfaz entrega horas, minutos y segundos; el motor
     los convierte a ms y los mete por los DOS puntos de entrada que ya existian
     (tempPonerMs / cronoPonerMs), asi editar a mano y contar comparten estado. */
  function partesMs(ms) {
    var n = Math.max(0, Math.round(numero(ms, 0)));
    return {
      h: Math.floor(n / 3600000),
      m: Math.floor(n / 60000) % 60,
      s: Math.floor(n / 1000) % 60,
      c: Math.floor(n / 10) % 100
    };
  }
  function msDeReloj(h, m, s) {
    h = Math.max(0, Math.min(99, Math.round(numero(h, 0))));
    m = Math.max(0, Math.min(59, Math.round(numero(m, 0))));
    s = Math.max(0, Math.min(59, Math.round(numero(s, 0))));
    return ((h * 60 + m) * 60 + s) * 1000;
  }
  function cronoPonerReloj(h, m, s) { return cronoPonerMs(msDeReloj(h, m, s)); }
  function tempPonerReloj(h, m, s) { return tempPonerMs(msDeReloj(h, m, s)); }

  /* --------------------------------------------------------------- fechas */
  // Fecha local, no toISOString(): en Chile el dia en UTC cambia a las 21:00.
  function isoDe(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function aFecha(f) {
    var p = texto(f).slice(0, 10).split('-');
    if (p.length !== 3) { return null; }
    var y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) { return null; }
    var x = new Date(y, m - 1, d);
    return isNaN(x.getTime()) ? null : x;
  }
  function hoy() { return isoDe(new Date(ahora())); }
  function sumaDias(fecha, n) {
    var d = aFecha(fecha);
    if (!d) { return texto(fecha); }
    d.setDate(d.getDate() + numero(n, 0));
    return isoDe(d);
  }
  function lunesDe(fecha) {
    var d = aFecha(fecha);
    if (!d) { return texto(fecha); }
    return sumaDias(fecha, -((d.getDay() + 6) % 7));
  }
  function diasDeLaSemana(lunes) {
    var out = [];
    for (var k = 0; k < 7; k++) { out.push(sumaDias(lunes, k)); }
    return out;
  }

  /* ------------------------------------------------------- estado canonico */
  function estadoInicial() {
    return {
      modo: 'cronometro', prueba: 0,
      crono: { acumulado: 0, corriendo: false, inicio: null },
      temp: { objetivoSeg: 1500, restante: 0, corriendo: false, inicio: null },
      pomodoro: {
        fase: 'trabajo', restante: null, corriendo: false, inicio: null,
        trabajos: 0, racha: 0, hoy: null,
        config: { trabajo: 25, corto: 5, largo: 15, cada: 4 }
      },
      registro: [],
      /* El cuarto modo: avisos por dia de la semana (0 = domingo) y hora.
         `ultimo` guarda la marca ISO del minuto ya avisado, para no repetir. */
      recordatorios: []
    };
  }

  function completar(obj, porDefecto) {
    var out = clonar(obj);
    Object.keys(porDefecto).forEach(function (k) {
      if (out[k] === undefined) { out[k] = clonar(porDefecto[k]); }
    });
    return out;
  }

  function normalizarSesion(s) {
    if (!esObjeto(s)) { return null; }
    var x = clonar(s);
    x.fecha = texto(x.fecha).slice(0, 10);
    if (!aFecha(x.fecha)) { return null; }
    x.minutos = Math.max(0, Math.round(numero(x.minutos, 0)));
    if (!texto(x.lunes)) { x.lunes = lunesDe(x.fecha); }
    if (x.id === undefined || x.id === null || texto(x.id) === '') {
      x.id = 's' + ahora() + '-' + (++_secuencia);
    }
    return x;
  }

  /* Un recordatorio valido es {dia:0..6, hora:'HH:MM', texto, sonido}. La hora se
     reescribe siempre a dos cifras; si no se entiende, el recordatorio se cae
     (mejor perder uno roto que avisar a una hora inventada). */
  function normalizarRecordatorio(r) {
    if (!esObjeto(r)) { return null; }
    var x = clonar(r);
    var m = /^(\d{1,2}):(\d{2})$/.exec(texto(x.hora));
    if (!m) { return null; }
    x.dia = Math.max(0, Math.min(6, Math.round(numero(x.dia, 0))));
    x.hora = dos(Math.min(23, Number(m[1]))) + ':' + dos(Math.min(59, Number(m[2])));
    x.texto = texto(x.texto).slice(0, 120);
    x.sonido = x.sonido !== false;
    x.ultimo = texto(x.ultimo);
    if (x.id === undefined || x.id === null || texto(x.id) === '') {
      x.id = 'r' + ahora() + '-' + (++_secuencia);
    }
    return x;
  }

  function normalizar(crudo) {
    var d = estadoInicial();
    var t = esObjeto(crudo) ? clonar(crudo) : {};

    t.modo = MODOS.indexOf(texto(t.modo)) >= 0 ? t.modo : d.modo;
    t.prueba = t.prueba ? 1 : 0;

    t.crono = esObjeto(t.crono) ? completar(t.crono, d.crono) : clonar(d.crono);
    t.crono.acumulado = Math.max(0, numero(t.crono.acumulado, 0));
    t.crono.corriendo = !!t.crono.corriendo;
    t.crono.inicio = (t.crono.inicio === undefined) ? null : t.crono.inicio;

    t.temp = esObjeto(t.temp) ? completar(t.temp, d.temp) : clonar(d.temp);
    if (t.temp.objetivoSeg === null || t.temp.objetivoSeg === undefined) {
      t.temp.objetivoSeg = Math.max(1, Math.round(numero(t.temp.objetivo, 25) * 60));
    }
    delete t.temp.objetivo;
    t.temp.objetivoSeg = Math.max(1, numero(t.temp.objetivoSeg, 1500));
    t.temp.corriendo = !!t.temp.corriendo;
    t.temp.restante = (t.temp.restante === undefined) ? 0 : t.temp.restante;
    t.temp.inicio = (t.temp.inicio === undefined) ? null : t.temp.inicio;

    t.pomodoro = esObjeto(t.pomodoro) ? completar(t.pomodoro, d.pomodoro) : clonar(d.pomodoro);
    t.pomodoro.fase = FASES.indexOf(texto(t.pomodoro.fase)) >= 0 ? t.pomodoro.fase : 'trabajo';
    t.pomodoro.config = esObjeto(t.pomodoro.config)
      ? completar(t.pomodoro.config, d.pomodoro.config)
      : clonar(d.pomodoro.config);
    ['trabajo', 'corto', 'largo', 'cada'].forEach(function (k) {
      t.pomodoro.config[k] = Math.max(1, Math.round(numero(t.pomodoro.config[k], d.pomodoro.config[k])));
    });
    t.pomodoro.trabajos = Math.max(0, Math.round(numero(t.pomodoro.trabajos, 0)));
    t.pomodoro.racha = Math.max(0, Math.round(numero(t.pomodoro.racha, 0)));
    t.pomodoro.restante = (t.pomodoro.restante === undefined) ? null : t.pomodoro.restante;
    t.pomodoro.corriendo = !!t.pomodoro.corriendo;
    t.pomodoro.inicio = (t.pomodoro.inicio === undefined) ? null : t.pomodoro.inicio;
    t.pomodoro.hoy = (t.pomodoro.hoy === undefined) ? null : t.pomodoro.hoy;

    var reg = Array.isArray(t.registro) ? t.registro : [];
    t.registro = reg.map(normalizarSesion).filter(function (x) { return !!x; });
    var recs = Array.isArray(t.recordatorios) ? t.recordatorios : [];
    t.recordatorios = recs.map(normalizarRecordatorio).filter(function (x) { return !!x; });
    t.dia = (t.dia === undefined) ? null : t.dia;

    return t;
  }

  /* -------------------------------------------------------------- almacen */
  function almacen() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) { return localStorage; }
    } catch (e) { /* modo privado o almacen bloqueado: se sigue en memoria */ }
    return null;
  }

  // Devuelve el objeto VIVO del bloque: quien lo reciba no lo muta; para cambiarlo, guardar().
  function leer() {
    if (_datos) { return _datos; }
    var crudo = null;
    var al = almacen();
    if (al) {
      try {
        var g = al.getItem(CLAVE);
        if (g) { crudo = JSON.parse(g); }
      } catch (e) { crudo = null; }
    }
    if (esObjeto(crudo) && crudo.tiempo !== undefined) { crudo = crudo.tiempo; }
    _datos = normalizar(crudo);
    return _datos;
  }

  function guardar(tiempo) {
    if (tiempo !== undefined) { _datos = normalizar(tiempo); }
    else if (!_datos) { _datos = normalizar(null); }
    var al = almacen();
    if (al) {
      try { al.setItem(CLAVE, JSON.stringify({ v: VERSION, tiempo: _datos })); } catch (e) { /* cuota */ }
    }
    return _datos;
  }

  function fijarModo(m) {
    if (MODOS.indexOf(texto(m)) < 0) { return leer().modo; }
    leer().modo = m;
    guardar();
    return m;
  }
  function modoActual() { return leer().modo; }

  /* ---------------------------------------------------------- cronometro */
  function cronoMs() {
    var c = leer().crono;
    var base = numero(c.acumulado, 0);
    return base + (c.corriendo && c.inicio ? Math.max(0, ahora() - c.inicio) : 0);
  }
  function cronoIniciar() {
    var c = leer().crono;
    if (!c.corriendo) { c.corriendo = true; c.inicio = ahora(); }
    guardar();
    return cronoMs();
  }
  function cronoPausar() {
    var c = leer().crono;
    c.acumulado = cronoMs();
    c.corriendo = false;
    c.inicio = null;
    guardar();
    return c.acumulado;
  }
  function cronoParar() { return cronoPausar(); }
  function cronoPonerMs(ms) {
    var c = leer().crono;
    c.acumulado = Math.max(0, Math.round(numero(ms, 0)));
    c.inicio = c.corriendo ? ahora() : null;
    guardar();
    return c.acumulado;
  }
  function cronoCero() { return cronoPonerMs(0); }
  function cronoEstaCorriendo() { return !!leer().crono.corriendo; }

  /* -------------------------------------------------------- temporizador */
  function tempObjetivoSeg() {
    var tp = leer().temp;
    return Math.max(1, numero(tp.objetivoSeg, 1500));
  }
  function tempRestanteMs() {
    var tp = leer().temp;
    var base = (tp.restante === null || tp.restante === undefined)
      ? tempObjetivoSeg() * 1000 : numero(tp.restante, 0);
    return Math.max(0, base - (tp.corriendo && tp.inicio ? Math.max(0, ahora() - tp.inicio) : 0));
  }
  function tempIniciar() {
    var tp = leer().temp;
    if (tp.restante === null || tp.restante === undefined || tp.restante <= 0) {
      tp.restante = tempObjetivoSeg() * 1000;
    }
    tp.corriendo = true;
    tp.inicio = ahora();
    guardar();
    return tempRestanteMs();
  }
  function tempPausar() {
    var tp = leer().temp;
    tp.restante = tempRestanteMs();
    tp.corriendo = false;
    tp.inicio = null;
    guardar();
    return tp.restante;
  }
  function tempPonerMs(ms) {
    var tp = leer().temp;
    var nuevo = Math.max(0, Math.round(numero(ms, 0)));
    tp.objetivoSeg = Math.max(1, Math.round(nuevo / 1000));
    tp.restante = nuevo;
    tp.corriendo = false;
    tp.inicio = null;
    guardar();
    return tp.restante;
  }
  function tempCero() {
    var tp = leer().temp;
    tp.restante = tempObjetivoSeg() * 1000;
    tp.corriendo = false;
    tp.inicio = null;
    guardar();
    return tp.restante;
  }
  // Devuelve true UNA vez, al cruzar el cero; deja el reloj parado en 0 (no sigue en negativo).
  function tempTic() {
    var tp = leer().temp;
    if (!tp.corriendo) { return false; }
    if (tempRestanteMs() > 0) { return false; }
    tp.restante = 0;
    tp.corriendo = false;
    tp.inicio = null;
    guardar();
    _avisosTemp++;
    return true;
  }
  function tempEstaCorriendo() { return !!leer().temp.corriendo; }
  function avisosTemp() { return _avisosTemp; }

  /* ------------------------------------------------------------- pomodoro */
  function pomo() { return leer().pomodoro; }
  function pomoConfig() { return pomo().config; }
  function pomoConfigurar(cambios) {
    var p = pomo();
    if (!esObjeto(cambios)) { return clonar(p.config); }
    ['trabajo', 'corto', 'largo', 'cada'].forEach(function (k) {
      if (cambios[k] === undefined) { return; }
      var v = Math.round(numero(cambios[k], 0));
      if (v >= 1) { p.config[k] = v; }
    });
    if (!p.corriendo) { p.restante = null; }
    guardar();
    return clonar(p.config);
  }
  function pomoDurMs(fase) {
    var c = pomo().config;
    var minutos = (fase === 'trabajo') ? c.trabajo : (fase === 'descanso') ? c.corto : c.largo;
    return Math.max(1, minutos) * _escala;
  }
  function pomoRestanteMs() {
    var p = pomo();
    var base = (p.restante === null || p.restante === undefined) ? pomoDurMs(p.fase) : numero(p.restante, 0);
    return Math.max(0, base - (p.corriendo && p.inicio ? Math.max(0, ahora() - p.inicio) : 0));
  }
  function pomoFaseSiguiente() {
    var p = pomo();
    if (p.fase !== 'trabajo') { return 'trabajo'; }
    var cada = Math.max(1, numero(p.config.cada, 4));
    return (p.trabajos % cada) === 0 ? 'largo' : 'descanso';
  }
  function pomoIniciar() {
    var p = pomo();
    if (p.restante === null || p.restante === undefined || p.restante <= 0) {
      p.restante = pomoDurMs(p.fase);
    }
    p.corriendo = true;
    p.inicio = ahora();
    guardar();
    return pomoRestanteMs();
  }
  function pomoPausar() {
    var p = pomo();
    p.restante = pomoRestanteMs();
    p.corriendo = false;
    p.inicio = null;
    guardar();
    return p.restante;
  }
  function pomoParar() {
    var p = pomo();
    p.restante = null;
    p.corriendo = false;
    p.inicio = null;
    guardar();
    return null;
  }
  // Avance de fase: si el bloque de trabajo se cumplio, suma trabajo y REGISTRA la sesion;
  // si se cumplio un descanso, no registra; en los dos casos deja el reloj parado en la fase
  // siguiente (trabajo -> descanso; cada N -> descanso largo; descanso -> trabajo).
  function pomoTic() {
    var p = pomo();
    if (!p.corriendo) { return null; }
    if (pomoRestanteMs() > 0) { return null; }
    var terminada = p.fase;
    var d = hoy();
    if (p.hoy !== d) { p.hoy = d; p.trabajos = 0; p.racha = 0; }
    var registrada = 0;
    var sesion = null;
    if (terminada === 'trabajo') {
      p.trabajos++;
      p.racha++;
      registrada = p.config.trabajo;
      sesion = registrarMinutos(registrada);
    }
    p.fase = pomoFaseSiguiente();
    p.restante = null;
    /* El ciclo se encadena SOLO: la fase siguiente arranca sin pulsar nada. El
       aviso de fin de fase lo da la interfaz una sola vez. */
    p.corriendo = true;
    p.inicio = ahora();
    guardar();
    return { terminada: terminada, fase: p.fase, registrada: registrada, sesion: sesion };
  }
  function pomoEstaCorriendo() { return !!pomo().corriendo; }

  /* -------------------------------------------------- regimen de sesiones */
  function registrarMinutos(min, opciones) {
    var t = leer();
    min = Math.round(numero(min, 0));
    if (min < 1) { return null; }
    var op = esObjeto(opciones) ? opciones : {};
    var fecha = texto(op.fecha) || texto(t.dia) || hoy();
    if (!aFecha(fecha)) { fecha = hoy(); }
    var d = new Date(ahora());
    var sesion = {
      id: 's' + ahora() + '-' + (++_secuencia),
      fecha: fecha,
      lunes: texto(op.lunes) || lunesDe(fecha),
      minutos: min,
      hora: texto(op.hora) || (dos(d.getHours()) + ':' + dos(d.getMinutes()))
    };
    t.registro.push(sesion);
    guardar();
    return clonar(sesion);
  }
  function quitarSesion(id) {
    var t = leer();
    var antes = t.registro.length;
    t.registro = t.registro.filter(function (s) { return texto(s.id) !== texto(id); });
    if (t.registro.length === antes) { return false; }
    guardar();
    return true;
  }
  function sesiones(filtro) {
    var reg = leer().registro;
    var f = esObjeto(filtro) ? filtro : null;
    return reg.filter(function (s) {
      if (!f) { return true; }
      if (f.fecha !== undefined && s.fecha !== f.fecha) { return false; }
      if (f.lunes !== undefined && s.lunes !== f.lunes) { return false; }
      if (f.desde !== undefined && s.fecha < f.desde) { return false; }
      if (f.hasta !== undefined && s.fecha > f.hasta) { return false; }
      return true;
    });
  }
  function sesionesDeDia(fecha) { return sesiones({ fecha: texto(fecha) }); }
  function sesionesDeSemana(lunes) {
    var dias = diasDeLaSemana(lunes);
    return sesiones().filter(function (s) { return dias.indexOf(s.fecha) >= 0; })
      .sort(function (a, b) {
        return a.fecha === b.fecha
          ? texto(a.hora).localeCompare(texto(b.hora))
          : a.fecha.localeCompare(b.fecha);
      });
  }
  function sumaMinutos(lista) {
    return (lista || []).reduce(function (n, s) { return n + numero(s.minutos, 0); }, 0);
  }
  function minutosDia(fecha) { return sumaMinutos(sesionesDeDia(fecha)); }
  function minutosSemana(lunes) { return sumaMinutos(sesionesDeSemana(lunes)); }

  /* CENSO SEMANAL: los siete dias de la semana en curso (lunes..domingo), con
     sus minutos y su numero de sesiones. El total se calcula sumando los dias,
     que es justo lo que se comprueba: que el censo cuadre con las sesiones. */
  function censoSemanal(lunes) {
    var lun = texto(lunes) || lunesDe(hoy());
    var dias = diasDeLaSemana(lun);
    var salida = [];
    var total = 0;
    for (var i = 0; i < dias.length; i++) {
      var lista = sesionesDeDia(dias[i]);
      var min = sumaMinutos(lista);
      total += min;
      salida.push({ fecha: dias[i], minutos: min, sesiones: lista.length });
    }
    return { lunes: lun, dias: salida, total: total };
  }

  /* ------------------------------------------------------- recordatorios */
  function recordatorios() { return leer().recordatorios; }
  function agregarRecordatorio(datos) {
    var r = normalizarRecordatorio(datos);
    if (!r) { return null; }
    leer().recordatorios.push(r);
    guardar();
    return clonar(r);
  }
  function quitarRecordatorio(id) {
    var t = leer();
    var antes = t.recordatorios.length;
    t.recordatorios = t.recordatorios.filter(function (r) { return texto(r.id) !== texto(id); });
    if (t.recordatorios.length === antes) { return false; }
    guardar();
    return true;
  }
  /* Se llama desde el tic de la interfaz, HAYA O NO cronometro en marcha. Avisa
     una sola vez por minuto: `ultimo` guarda la marca fecha+hora del aviso. */
  function revisarRecordatorios() {
    var t = leer();
    var d = new Date(ahora());
    var dia = d.getDay();
    var hora = dos(d.getHours()) + ':' + dos(d.getMinutes());
    var marca = isoDe(d) + ' ' + hora;
    var avisos = [];
    for (var i = 0; i < t.recordatorios.length; i++) {
      var r = t.recordatorios[i];
      if (r.dia === dia && r.hora === hora && r.ultimo !== marca) {
        r.ultimo = marca;
        avisos.push(clonar(r));
      }
    }
    if (avisos.length) { guardar(); }
    return avisos;
  }

  /* -------------------------------------------------------------- arranque */
  /* Al cargar la pagina: el cronometro vuelve PARADO EN CERO (gate), y los otros dos se quedan
     parados sin perder lo acumulado ni el registro. Si la URL trae ?prueba=1 se baja la escala
     del pomodoro a segundos y se acortan las duraciones; al cargar sin el gancho, se vuelve a
     la configuracion de fabrica. El gancho NO existe en produccion. */
  function arranque(prueba) {
    var t = leer();
    if (prueba && !t.prueba) {
      t.prueba = 1;
      t.pomodoro.config = { trabajo: 2, corto: 2, largo: 3, cada: 4 };
      t.pomodoro.restante = null;
      t.pomodoro.fase = 'trabajo';
      t.temp.objetivoSeg = 3;
      t.temp.restante = 0;
      t.temp.corriendo = false;
      t.temp.inicio = null;
    } else if (!prueba && t.prueba) {
      t.prueba = 0;
      t.pomodoro.config = { trabajo: 25, corto: 5, largo: 15, cada: 4 };
      t.pomodoro.restante = null;
      t.pomodoro.fase = 'trabajo';
      t.temp.objetivoSeg = 1500;
      t.temp.restante = 0;
    }
    fijarEscala(t.prueba ? 1000 : 60000);
    /* sin empezar, un temporizador parado no muestra 00:00: muestra lo que le
       queda por delante, que es su objetivo (y si iba a medias, lo que le queda) */
    var objetivoMs = tempObjetivoSeg() * 1000;
    var rTemp = tempRestanteMs();
    t.temp.restante = (rTemp > 0 && rTemp <= objetivoMs) ? rTemp : objetivoMs;
    t.temp.corriendo = false;
    t.temp.inicio = null;
    t.pomodoro.restante = pomoRestanteMs();
    t.pomodoro.corriendo = false;
    t.pomodoro.inicio = null;
    t.crono.acumulado = 0;
    t.crono.corriendo = false;
    t.crono.inicio = null;
    _avisosTemp = 0;
    guardar();
    return t;
  }

  // Para que ningun temporizador siga corriendo al quitar el bloque o cambiar de seccion.
  function detenerTodo() {
    var t = leer();
    if (t.crono.corriendo) { t.crono.acumulado = cronoMs(); t.crono.corriendo = false; t.crono.inicio = null; }
    if (t.temp.corriendo) { t.temp.restante = tempRestanteMs(); t.temp.corriendo = false; t.temp.inicio = null; }
    if (t.pomodoro.corriendo) { t.pomodoro.restante = pomoRestanteMs(); t.pomodoro.corriendo = false; t.pomodoro.inicio = null; }
    guardar();
    return t;
  }
  function hayMarcha() {
    return cronoEstaCorriendo() || tempEstaCorriendo() || pomoEstaCorriendo();
  }

  return {
    CLAVE: CLAVE, VERSION: VERSION, MODOS: MODOS, FASES: FASES,
    estadoInicial: estadoInicial, normalizar: normalizar, leer: leer, guardar: guardar,
    fijarModo: fijarModo, modoActual: modoActual,
    ahora: ahora, fijarReloj: fijarReloj, avanzarReloj: avanzarReloj,
    fijarEscala: fijarEscala, escala: escala,
    partesMs: partesMs, msDeReloj: msDeReloj,
    cronoPonerReloj: cronoPonerReloj, tempPonerReloj: tempPonerReloj,
    hoy: hoy, aFecha: aFecha, lunesDe: lunesDe, diasDeLaSemana: diasDeLaSemana, sumaDias: sumaDias,
    cronoMs: cronoMs, cronoIniciar: cronoIniciar, cronoPausar: cronoPausar, cronoParar: cronoParar,
    cronoPonerMs: cronoPonerMs, cronoCero: cronoCero, cronoEstaCorriendo: cronoEstaCorriendo,
    tempObjetivoSeg: tempObjetivoSeg, tempRestanteMs: tempRestanteMs, tempIniciar: tempIniciar,
    tempPausar: tempPausar, tempPonerMs: tempPonerMs, tempCero: tempCero, tempTic: tempTic,
    tempEstaCorriendo: tempEstaCorriendo, avisosTemp: avisosTemp,
    pomo: pomo, pomoConfig: pomoConfig, pomoConfigurar: pomoConfigurar, pomoDurMs: pomoDurMs,
    pomoRestanteMs: pomoRestanteMs, pomoFaseSiguiente: pomoFaseSiguiente, pomoIniciar: pomoIniciar,
    pomoPausar: pomoPausar, pomoParar: pomoParar, pomoTic: pomoTic, pomoEstaCorriendo: pomoEstaCorriendo,
    registrarMinutos: registrarMinutos, quitarSesion: quitarSesion, sesiones: sesiones,
    sesionesDeDia: sesionesDeDia, sesionesDeSemana: sesionesDeSemana, sumaMinutos: sumaMinutos,
    minutosDia: minutosDia, minutosSemana: minutosSemana, censoSemanal: censoSemanal,
    recordatorios: recordatorios, agregarRecordatorio: agregarRecordatorio,
    quitarRecordatorio: quitarRecordatorio, revisarRecordatorios: revisarRecordatorios,
    arranque: arranque, detenerTodo: detenerTodo, hayMarcha: hayMarcha
  };
})();

/* ============================================================================
   LA CAPA DE INTERFAZ del tablero. No sabe de idioma ni de marcado: recibe `t`
   y escribe en los nodos que el armazon genera con estos ganchos:
     [data-tiempo="crono-cifra"|"crono-estado"|"temp-cifra"|"temp-estado"
                   |"temp-live"|"pomo-cifra"|"pomo-fase"|"pomo-sesion"
                   |"reg-total"|"reg-fase"|"reg-lista"]
     [data-accion="crono-empezar"|"crono-reiniciar"|"crono-guardar"
                  |"temp-empezar"|"temp-reiniciar"|"temp-menos"|"temp-mas"
                  |"pomo-empezar"|"pomo-reiniciar"]
   Un solo bucle de 50 ms mientras algo corre; parado, no queda intervalo vivo.
   ============================================================================ */
var MimoTiempoUI = (function () {
  'use strict';

  /* El motor de arriba es calculo puro: no toca el DOM. La interfaz SI, y por
     eso el documento se toma UNA vez aqui; asi el motor no nombra `document`
     ni por error y se puede probar sin pantalla. */
  var D = (typeof window !== 'undefined' && window.document) ? window.document : null;

  var M = MimoTiempoMotor;
  var _t = function (k) { return k; };
  var _alCambiar = null;
  var _intervalo = null;
  var _tempAvisado = false;
  var _firmaReg = '';
  var _ultimoAvisoRec = '';
  var _intervaloRec = null;

  /* ------------------------------------------------------------ formato */
  function reloj(ms) {
    var n = Math.max(0, ms);
    var m = Math.floor(n / 60000);
    var s = Math.floor(n / 1000) % 60;
    var c = Math.floor(n / 10) % 100;
    var sep = _t('unidad.decimal');
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s + sep + (c < 10 ? '0' : '') + c;
  }
  // cuenta atras: se redondea hacia arriba para que el ultimo segundo se vea entero
  function cuenta(ms) {
    var seg = Math.ceil(Math.max(0, ms) / 1000);
    var m = Math.floor(seg / 60);
    var s = seg % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function dur(seg) {
    if (seg >= 60 && seg % 60 === 0) { return _t('unidad.min', { n: seg / 60 }); }
    if (seg >= 60) { return _t('unidad.min', { n: Math.round(seg / 60 * 10) / 10 }); }
    return _t('unidad.seg', { n: seg });
  }
  function fechaCorta(iso) {
    var p = String(iso || '').split('-');
    return p.length === 3 ? (p[2] + '-' + p[1]) : String(iso || '');
  }

  /* ------------------------------------------------------- escritura DOM */
  function nodos(nombre) {
    return D.querySelectorAll('[data-tiempo="' + nombre + '"]');
  }
  function valor(nombre, texto) {
    var l = nodos(nombre);
    for (var i = 0; i < l.length; i++) {
      if (l[i].textContent !== texto) { l[i].textContent = texto; }
    }
  }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function esc(v) {
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* El reloj visible son TRES input hh/mm/ss. Se escribe su value (nunca su
     textContent) y se respeta el que tiene el foco: si el dueño esta tecleando,
     el tic no le borra lo que escribe. Las centesimas siguen en el nodo .sr
     [data-tiempo="...-cifra"], que es el que leen las medidas. */
  function escribirReloj(prefijo, ms) {
    var p = M.partesMs(ms);
    var partes = { h: p.h, m: p.m, s: p.s };
    Object.keys(partes).forEach(function (k) {
      var l = nodos(prefijo + '-' + k);
      var v = dos(partes[k]);
      for (var i = 0; i < l.length; i++) {
        if (D.activeElement === l[i]) { continue; }
        if (l[i].value !== v) { l[i].value = v; }
      }
    });
  }

  /* Los estados deshabilitados de play/pausa/parar: se ponen en el atributo
     (no solo en una clase) para que el navegador no deje pulsarlos. */
  function deshabilitar(accion, si) {
    var l = D.querySelectorAll('[data-accion="' + accion + '"]');
    for (var i = 0; i < l.length; i++) {
      if (si) { l[i].setAttribute('disabled', 'disabled'); }
      else { l[i].removeAttribute('disabled'); }
      l[i].setAttribute('aria-disabled', si ? 'true' : 'false');
    }
  }

  /* El sonido lo pone SOLO la interfaz: el motor no reproduce nada. Se dispara una
     vez por aviso; si el navegador bloquea la reproduccion, queda el texto. */
  function sonar() {
    var a = D.getElementById('audio-alarma');
    if (!a) { return; }
    try {
      a.currentTime = 0;
      var p = a.play();
      if (p && p.catch) { p.catch(function () { /* sin permiso de audio */ }); }
    } catch (e) { /* queda el aviso en pantalla */ }
  }

  function nombreDia(d) { return _t('rec.dia' + d); }

  function pintarRecordatorios() {
    var caja = nodos('rec-lista');
    var todos = M.recordatorios();
    var html = '';
    for (var i = 0; i < todos.length; i++) {
      var r = todos[i];
      html += '<li class="ctx__item" data-rec-item="' + esc(r.id) + '">' +
        '<span class="ctx__t">' + esc(r.texto) + '</span>' +
        '<span class="ctx__meta">' + esc(nombreDia(r.dia)) + ' · ' + esc(r.hora) + '</span>' +
        '<button class="btn btn--mini" type="button" data-rec-quitar="' + esc(r.id) + '">' +
          esc(_t('rec.quitar')) + '</button></li>';
    }
    if (!html) {
      html = '<li class="ctx__item"><span class="ctx__t">' + esc(_t('rec.vacio')) + '</span></li>';
    }
    for (var j = 0; j < caja.length; j++) { caja[j].innerHTML = html; }
    /* La clave lleva {n}: si se escribe el texto con valor() y no se actualizan
       sus parametros, el nodo queda con los de la plantilla (n: 0) y
       diagnostico() lo cuenta como desajuste en cuanto hay un recordatorio.
       rotulo() deja texto y parametros a la vez. */
    rotulo('rec-fase', 'rec.fase', { n: todos.length });
    valor('rec-live', _ultimoAvisoRec ? _t('rec.aviso', { texto: _ultimoAvisoRec }) : '');
  }

  function pintarCenso() {
    var caja = nodos('reg-censo');
    if (!caja.length) { return; }
    var c = M.censoSemanal(M.lunesDe(M.hoy()));
    var html = '';
    for (var i = 0; i < c.dias.length; i++) {
      var d = c.dias[i];
      var dia = new Date(d.fecha + 'T00:00:00').getDay();
      html += '<li class="ctx__item" data-min="' + d.minutos + '" data-fecha="' + d.fecha + '">' +
        '<span class="ctx__t">' + esc(nombreDia(dia)) + '</span>' +
        '<span class="ctx__meta">' + esc(_t('reg.censoDia', { min: d.minutos, n: d.sesiones })) +
        '</span></li>';
    }
    for (var j = 0; j < caja.length; j++) {
      caja[j].innerHTML = html;
      caja[j].setAttribute('data-total', String(c.total));
    }
    valor('reg-censo-total', _t('reg.censoTotal', { min: c.total }));
  }

  function pintarPomoConfig() {
    var c = M.pomoConfig();
    ['trabajo', 'corto', 'largo', 'cada'].forEach(function (k) {
      var l = D.querySelectorAll('[data-pomo="' + k + '"]');
      for (var i = 0; i < l.length; i++) {
        if (D.activeElement === l[i]) { continue; }
        if (String(l[i].value) !== String(c[k])) { l[i].value = c[k]; }
      }
    });
  }
  // rotulo traducible: deja la clave y sus parametros en el nodo, para que aplicar() lo repinte
  function rotulo(nombre, clave, vars) {
    var l = nodos(nombre);
    for (var i = 0; i < l.length; i++) {
      var el = l[i];
      el.setAttribute('data-i18n', clave);
      if (vars) { el.setAttribute('data-i18n-vars', JSON.stringify(vars)); }
      else { el.removeAttribute('data-i18n-vars'); }
      var txt = _t(clave, vars);
      if (el.textContent !== txt) { el.textContent = txt; }
    }
  }
  function boton(accion, clave, vars) {
    var l = D.querySelectorAll('[data-accion="' + accion + '"]');
    var pulsado = null;
    if (accion === 'crono-empezar') { pulsado = M.cronoEstaCorriendo(); }
    else if (accion === 'temp-empezar') { pulsado = M.tempEstaCorriendo(); }
    else if (accion === 'pomo-empezar') { pulsado = M.pomoEstaCorriendo(); }
    for (var i = 0; i < l.length; i++) {
      var el = l[i];
      el.setAttribute('data-i18n', clave);
      if (vars) { el.setAttribute('data-i18n-vars', JSON.stringify(vars)); }
      else { el.removeAttribute('data-i18n-vars'); }
      var txt = _t(clave, vars);
      if (el.textContent !== txt) { el.textContent = txt; }
      if (pulsado !== null) { el.setAttribute('aria-pressed', pulsado ? 'true' : 'false'); }
    }
  }

  /* DD-MM desde la fecha ISO del registro (fechaCorta() de este módulo recibe
     un Date, para la cabecera; no sirve aquí). */
  function diaCorto(iso) {
    var t = String(iso || '').split('-');
    return t.length === 3 ? (t[2] + '-' + t[1]) : String(iso || '');
  }

  /* --------------------------------------------------------- el registro */
  function pintarRegistro() {
    var caja = nodos('reg-lista');
    if (!caja.length) { return; }
    var hoy = M.hoy();
    var lista = M.sesionesDeDia(hoy).slice().sort(function (a, b) {
      return String(a.hora).localeCompare(String(b.hora));
    });
    var firma = _t('reg.fase') + '|' + hoy + '|' + lista.map(function (s) { return s.id + ':' + s.minutos; }).join(',');
    valor('reg-total', String(M.minutosDia(hoy)));
    rotulo('reg-fase', 'reg.fase');
    /* la firma evita rehacer la lista en cada tic, pero si la vista se acaba de
       rehacer (la estantería cambia de bloque) el nodo está vacío: entonces la
       firma no vale y hay que volver a escribirla */
    if (firma === _firmaReg && caja[0].childElementCount > 0) { return; }
    _firmaReg = firma;
    var html = '';
    for (var i = lista.length - 1; i >= 0; i--) {
      var s = lista[i];
      var vh = { hora: String(s.hora) };
      var vf = { min: s.minutos, fecha: diaCorto(s.fecha) };
      html += '<li class="ctx__item"><span class="ctx__t" data-i18n="reg.sesion" data-i18n-vars=\'' +
        JSON.stringify(vh).replace(/"/g, '&quot;') + '\'>' + _t('reg.sesion', vh) + '</span>' +
        '<span class="ctx__meta" data-i18n="reg.meta" data-i18n-vars=\'' +
        JSON.stringify(vf).replace(/"/g, '&quot;') + '\'>' + _t('reg.meta', vf) + '</span></li>';
    }
    if (!html) { html = '<li class="ctx__item"><span class="ctx__t" data-i18n="reg.sinSesiones">' +
      _t('reg.sinSesiones') + '</span></li>'; }
    for (var j = 0; j < caja.length; j++) { caja[j].innerHTML = html; }
  }

  /* --------------------------------------------------------------- pintar */
  function estadoCrono() {
    if (M.cronoEstaCorriendo()) { return 'crono.marcha'; }
    return M.cronoMs() > 0 ? 'crono.pausado' : 'crono.parado';
  }
  function estadoTemp() {
    if (M.tempEstaCorriendo()) { return 'temp.marcha'; }
    if (_tempAvisado) { return 'temp.cumplido'; }
    var r = M.tempRestanteMs();
    var obj = M.tempObjetivoSeg() * 1000;
    return (r > 0 && r < obj) ? 'temp.pausado' : null;
  }
  function fasePomo() {
    var p = M.pomo();
    var clave = p.fase === 'trabajo' ? 'pomo.trabajo'
      : (p.fase === 'descanso' ? 'pomo.descanso' : 'pomo.largo');
    var seg = Math.round(M.pomoDurMs(p.fase) / 1000);
    return { clave: clave, vars: { dur: dur(seg) } };
  }

  function pintar() {
    var cC = M.cronoEstaCorriendo();
    // cronometro: el reloj se puede editar a mano; las centesimas van al .sr
    escribirReloj('crono', M.cronoMs());
    valor('crono-cifra', reloj(M.cronoMs()));
    rotulo('crono-estado', estadoCrono());
    boton('crono-empezar', 'crono.empezar');
    deshabilitar('crono-empezar', cC);
    deshabilitar('crono-pausa', !cC);
    deshabilitar('crono-parar', !cC);

    // temporizador
    var cT = M.tempEstaCorriendo();
    escribirReloj('temp', M.tempRestanteMs());
    valor('temp-cifra', cuenta(M.tempRestanteMs()));
    var et = estadoTemp();
    if (et) { rotulo('temp-estado', et); }
    else {
      var seg = M.tempObjetivoSeg();
      rotulo('temp-estado', 'temp.fase', { dur: dur(seg) });
    }
    boton('temp-empezar', 'temp.empezar');
    deshabilitar('temp-empezar', cT);
    deshabilitar('temp-pausa', !cT);
    deshabilitar('temp-parar', !cT);
    deshabilitar('temp-descartar', !_tempAvisado);
    var aviso = D.querySelectorAll('[data-tiempo="temp-live"]');
    for (var i = 0; i < aviso.length; i++) {
      aviso[i].textContent = _tempAvisado ? _t('temp.aviso') : '';
    }

    // pomodoro
    valor('pomo-cifra', cuenta(M.pomoRestanteMs()));
    var fp = fasePomo();
    rotulo('pomo-fase', fp.clave, fp.vars);
    var p = M.pomo();
    var cada = Math.max(1, p.config.cada);
    rotulo('pomo-sesion', 'pomo.sesion', { n: (p.trabajos % cada) + 1, cada: cada });
    var cP = M.pomoEstaCorriendo();
    boton('pomo-empezar', 'pomo.empezar');
    deshabilitar('pomo-empezar', cP);
    deshabilitar('pomo-pausa', !cP);
    deshabilitar('pomo-parar', !cP && p.restante === null);

    // registro, censo, configuracion y recordatorios
    pintarRegistro();
    pintarCenso();
    pintarPomoConfig();
    pintarRecordatorios();

    /* la vista abierta manda sobre el modo; Alarmas es el modo Recordatorios y
       su vista no tiene reloj ni controles de reloj (los oculta el CSS). */
    var activa = D.querySelector('.vista--bloque:not([hidden])');
    var cual = activa ? activa.getAttribute('data-bloque') : '';
    if (D.body) { D.body.setAttribute('data-modo-tiempo', cual); }
  }

  /* ------------------------------------------------------------- acciones */
  var ACCIONES = {
    'crono-empezar': function () { M.cronoIniciar(); M.fijarModo('cronometro'); },
    'crono-pausa': function () { M.cronoPausar(); },
    'crono-parar': function () { M.cronoParar(); },
    'crono-reiniciar': function () { M.cronoPausar(); M.cronoCero(); },
    'crono-guardar': function () {
      var min = Math.round(M.cronoMs() / 60000);
      M.cronoPausar();
      if (min >= 1) { M.registrarMinutos(min); }
      M.cronoCero();
    },
    'temp-empezar': function () {
      _tempAvisado = false;
      M.tempIniciar();
      M.fijarModo('temporizador');
    },
    'temp-pausa': function () { M.tempPausar(); },
    'temp-parar': function () { M.tempPausar(); },
    /* Se descarta el aviso SIN registrar nada: el temporizador no apunta
       sesiones, solo el cronometro y el pomodoro. */
    'temp-descartar': function () { _tempAvisado = false; M.tempCero(); },
    'temp-reiniciar': function () { M.tempPausar(); M.tempCero(); _tempAvisado = false; },
    'temp-menos': function () { M.tempPonerMs(M.tempObjetivoSeg() * 1000 - 60000); _tempAvisado = false; },
    'temp-mas': function () { M.tempPonerMs(M.tempObjetivoSeg() * 1000 + 60000); _tempAvisado = false; },
    'pomo-empezar': function () { M.pomoIniciar(); M.fijarModo('pomodoro'); },
    'pomo-pausa': function () { M.pomoPausar(); },
    'pomo-parar': function () { M.pomoParar(); },
    'pomo-reiniciar': function () { M.pomoParar(); },
    'rec-agregar': function () {
      var dia = D.querySelector('[data-rec="dia"]');
      var hora = D.querySelector('[data-rec="hora"]');
      var texto = D.querySelector('[data-rec="texto"]');
      var sonido = D.querySelector('[data-rec="sonido"]');
      var r = M.agregarRecordatorio({
        dia: dia ? dia.value : 0,
        hora: hora ? hora.value : '',
        texto: texto ? texto.value : '',
        sonido: sonido ? sonido.checked : true
      });
      if (r) {
        if (texto) { texto.value = ''; }
        _ultimoAvisoRec = '';
        M.fijarModo('recordatorios');
      }
    }
  };

  function clic(e) {
    var q = (e.target && e.target.closest) ? e.target.closest('[data-rec-quitar]') : null;
    if (q) {
      M.quitarRecordatorio(q.getAttribute('data-rec-quitar'));
      pintar();
      return;
    }
    var b = e.target && e.target.closest ? e.target.closest('[data-accion]') : null;
    if (!b) { return; }
    var accion = b.getAttribute('data-accion');
    if (!ACCIONES[accion]) { return; }
    ACCIONES[accion]();
    pintar();
    arrancarBucle();
    if (_alCambiar) { _alCambiar(); }
  }

  /* Editar el reloj a mano (tres input hh/mm/ss) y la configuracion del
     pomodoro: el `change` llega al soltar el campo o con Enter. */
  function cambio(e) {
    var el = e.target;
    if (!el || !el.matches) { return; }
    if (el.matches('[data-reloj] input')) {
      var caja = el.closest('[data-reloj]');
      var pre = caja.getAttribute('data-reloj');
      var h = caja.querySelector('[data-tiempo="' + pre + '-h"]');
      var m = caja.querySelector('[data-tiempo="' + pre + '-m"]');
      var s = caja.querySelector('[data-tiempo="' + pre + '-s"]');
      if (pre === 'crono') { M.cronoPonerReloj(h.value, m.value, s.value); M.fijarModo('cronometro'); }
      else { M.tempPonerReloj(h.value, m.value, s.value); _tempAvisado = false; M.fijarModo('temporizador'); }
      pintar();
      if (_alCambiar) { _alCambiar(); }
      return;
    }
    if (el.matches('[data-pomo]')) {
      var c = {};
      c[el.getAttribute('data-pomo')] = el.value;
      M.pomoConfigurar(c);
      pintar();
      if (_alCambiar) { _alCambiar(); }
    }
  }

  /* ------------------------------------------------------------ el bucle */
  function tic() {
    var aviso = M.tempTic();
    if (aviso) { _tempAvisado = true; sonar(); }
    var paso = M.pomoTic();
    if (paso) { sonar(); }
    pintar();
    if (aviso || paso) { if (_alCambiar) { _alCambiar(); } }
    arrancarBucle();
  }
  /* Los recordatorios se revisan SIEMPRE, con reloj corriendo o sin el: este
     intervalo no depende de hayMarcha(). El motor garantiza un aviso por minuto. */
  function revisar() {
    var avisos = M.revisarRecordatorios();
    if (!avisos.length) { return; }
    var r = avisos[0];
    _ultimoAvisoRec = r.texto || _t('rec.titulo');
    if (r.sonido) { sonar(); }
    pintarRecordatorios();
    if (_alCambiar) { _alCambiar(); }
  }
  function arrancarBucle() {
    if (M.hayMarcha()) {
      if (!_intervalo) { _intervalo = window.setInterval(tic, 50); }
    } else if (_intervalo) {
      window.clearInterval(_intervalo);
      _intervalo = null;
    }
  }

  function iniciar(opciones) {
    opciones = opciones || {};
    if (opciones.t) { _t = opciones.t; }
    _alCambiar = opciones.alCambiar || null;
    M.arranque(opciones.prueba === true);
    _tempAvisado = false;
    _firmaReg = '';
    _ultimoAvisoRec = '';
    D.addEventListener('click', clic);
    D.addEventListener('change', cambio);
    pintar();
    arrancarBucle();
    revisar();
    if (_intervaloRec) { window.clearInterval(_intervaloRec); }
    _intervaloRec = window.setInterval(revisar, 5000);
  }

  return {
    iniciar: iniciar,
    pintar: pintar,
    /* detener('cronometro') para SOLO ese bloque (al quitarlo); sin argumento,
       para todos (al cambiar de sección). */
    detener: function (id) {
      if (id === 'cronometro') { M.cronoPausar(); }
      else if (id === 'temporizador') { M.tempPausar(); }
      else if (id === 'pomodoro') { M.pomoPausar(); }
      else { M.detenerTodo(); }
      pintar();
      arrancarBucle();
    },
    estadoCrono: estadoCrono,
    estadoTemp: estadoTemp,
    revisar: revisar,
    estaCorriendo: function () { return M.hayMarcha(); },
    /* La vista abierta fija el modo: Alarmas entra en el cuarto modo y su vista
       no pinta reloj ni controles de reloj. */
    fijarVista: function (id) {
      var m = id === 'alarmas' ? 'recordatorios' : id;
      if (M.MODOS.indexOf(m) >= 0) { M.fijarModo(m); }
      pintar();
    }
  };
})();

if (typeof window !== 'undefined') {
  window.MimoTiempoMotor = MimoTiempoMotor;
  window.MimoTiempoUI = MimoTiempoUI;
}
