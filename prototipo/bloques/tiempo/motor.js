/* =============================================================== Tiempo · motor
   Calculo puro del bloque Tiempo (Iteracion 4b de Mimo Nuevo).

   Portado de la app Academics, SOLO el calculo:
     - pomo / pomoDur / pomoRestanteMs / pomoFaseSig / pomoTituloFase
       -> pomo(), pomoDurMs(), pomoRestanteMs(), pomoFaseSiguiente()  [tiempo/01-tiempo.js:7-32]
     - tiempoActualMs / estaCorriendo -> cronoMs(), tempRestanteMs(), pomoRestanteMs()
                                                                     [tiempo/01-tiempo.js:94-110]
     - cronoPlay / cronoPausa / cronoParar / cronoCero                [tiempo/01-tiempo.js:256-380]
     - segObjetivo                                                    [tiempo/01-tiempo.js:88-91]
     - el avance de fase del pomodoro dentro del setInterval          [tiempo/01-tiempo.js:441-467]
     - registrarMinutos + sesionesDeLaSemana + el agrupado por dia     [tiempo/01-tiempo.js:69-79, 353-368]
     - migrarTiempo (solo la parte del formato)                       [comun/03-catalogo.js:337-354]

   NO se porta: pintarReloj, renderTiempo, enlazarPomoConfig, alarmaTiempo, Notification,
   AudioContext, recordatorios de interfaz, avisos, recordatorios ni setInterval. Este fichero
   no conoce el DOM y no escribe ni una cadena de interfaz: devuelve datos y la UI decide.

   Dos decisiones de propiedad, porque el viejo guardaba la sesion FUERA de `tiempo`:
     1. El registro de sesiones vive DENTRO del objeto tiempo (`tiempo.registro`), que es lo que
        declara el catalogo en `datos.posee`. El viejo lo guardaba por semestre en
        `E.sem[<semestre>].sesiones`; ese sitio no es del bloque y no se toca.
     2. El viejo ademas imputaba los minutos a la rejilla del semestre
        (`s.minutos[semana][ramo] += min`). Eso NO se porta: los totales se calculan del registro.
        Queda anotado como HUECO en el README del bloque.

   Concesion (como Malla): el almacen se lee y se escribe SOLO por leer()/guardar(). Sin
   localStorage (Node, modo privado) queda el respaldo en memoria y el bloque sigue funcionando.
   La unica linea que asoma un global al navegador es la de exportacion, al final.
   ============================================================================ */
var MimoTiempoMotor = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.tiempo';
  var VERSION = 1;

  // Modos del viejo. Si un estado trae otra cosa, el bloque cae al cronometro en vez de romperse.
  var MODOS = ['cronometro', 'temporizador', 'pomodoro', 'recordatorios'];
  var FASES = ['trabajo', 'descanso', 'largo'];

  var _datos = null;      // estado normalizado; null = todavia sin leer
  var _reloj = null;      // milisegundos fijos para el banco de pruebas; null = reloj real
  var _secuencia = 0;     // desempata ids de sesion cuando el reloj esta congelado

  /* ------------------------------------------------------------ utilidades */
  function texto(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }
  function numero(v, porDefecto) {
    var n = Number(v);
    return isFinite(n) ? n : porDefecto;
  }
  function esObjeto(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }
  function clonar(v) {
    return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v));
  }
  function dos(n) {
    return (n < 10 ? '0' : '') + n;
  }
  // Reloj propio: el banco de pruebas lo congela y asi el pomodoro se puede medir sin esperar
  // 25 minutos. Todo el motor pregunta la hora por aqui, nunca por Date.now() suelto.
  function ahora() {
    return _reloj === null ? Date.now() : _reloj;
  }
  function fijarReloj(ms) {
    if (ms === null || ms === undefined) { _reloj = null; return null; }
    var n = (ms instanceof Date) ? ms.getTime() : Number(ms);
    _reloj = isFinite(n) ? n : null;
    return _reloj;
  }
  function avanzarReloj(ms) {
    if (_reloj === null) _reloj = Date.now();
    _reloj += numero(ms, 0);
    return _reloj;
  }

  /* --------------------------------------------------------------- fechas */
  // Se trabaja con fecha local, no con toISOString(): en Chile el dia en UTC cambia a las 21:00
  // y una sesion de la noche se habria registrado en el dia siguiente.
  function isoDe(d) {
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function aFecha(f) {
    var p = texto(f).slice(0, 10).split('-');
    if (p.length !== 3) return null;
    var y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return null;
    var x = new Date(y, m - 1, d);
    return isNaN(x.getTime()) ? null : x;
  }
  function hoy() {
    return isoDe(new Date(ahora()));
  }
  function sumaDias(fecha, n) {
    var d = aFecha(fecha);
    if (!d) return texto(fecha);
    d.setDate(d.getDate() + numero(n, 0));
    return isoDe(d);
  }
  // Lunes de la semana ISO (lunes..domingo) a la que pertenece la fecha.
  function lunesDe(fecha) {
    var d = aFecha(fecha);
    if (!d) return texto(fecha);
    return sumaDias(fecha, -((d.getDay() + 6) % 7));
  }
  function diasDeLaSemana(lunes) {
    var out = [];
    for (var k = 0; k < 7; k++) out.push(sumaDias(lunes, k));
    return out;
  }

  /* ------------------------------------------------------- estado canonico */
  // La forma exacta de estadoInicial().tiempo en comun/03-catalogo.js:290-298, mas `registro`,
  // que es la clave que el catalogo le concede al bloque (`tiempo.registro`).
  function estadoInicial() {
    return {
      modo: 'cronometro',
      crono: { acumulado: 0, corriendo: false, inicio: null },
      temp: { objetivoSeg: 1500, restante: 0, corriendo: false, inicio: null },
      ramo: null, semana: null, dia: null,
      pomodoro: {
        fase: 'trabajo', restante: null, corriendo: false, inicio: null,
        trabajos: 0, racha: 0, hoy: null,
        config: { trabajo: 25, corto: 5, largo: 15, cada: 4 }
      },
      recordatorios: [],
      recSonido: 'propia',
      registro: []
    };
  }

  // Rellena solo lo que FALTA: lo que trae el estado manda, aunque valga null o 0. Se usa para
  // que un estado guardado por una version anterior no quede con huecos.
  function completar(obj, porDefecto) {
    var out = clonar(obj);
    Object.keys(porDefecto).forEach(function (k) {
      if (out[k] === undefined) out[k] = clonar(porDefecto[k]);
    });
    return out;
  }

  function normalizarSesion(s) {
    if (!esObjeto(s)) return null;
    var x = clonar(s);
    x.fecha = texto(x.fecha).slice(0, 10);
    if (!aFecha(x.fecha)) return null;             // sin fecha valida no hay sesion que agregar
    x.minutos = Math.max(0, Math.round(numero(x.minutos, 0)));
    // `lunes` lo escribia el viejo al registrar; si falta se deriva de la fecha.
    if (!texto(x.lunes)) x.lunes = lunesDe(x.fecha);
    if (x.id === undefined || x.id === null || texto(x.id) === '') {
      x.id = 's' + ahora() + '-' + (++_secuencia);
    }
    return x;
  }

  function normalizar(crudo) {
    var d = estadoInicial();
    var t = esObjeto(crudo) ? clonar(crudo) : {};

    t.modo = MODOS.indexOf(texto(t.modo)) >= 0 ? t.modo : d.modo;

    t.crono = esObjeto(t.crono) ? completar(t.crono, d.crono) : clonar(d.crono);
    t.crono.acumulado = Math.max(0, numero(t.crono.acumulado, 0));
    t.crono.corriendo = !!t.crono.corriendo;
    t.crono.inicio = (t.crono.inicio === undefined) ? null : t.crono.inicio;

    t.temp = esObjeto(t.temp) ? completar(t.temp, d.temp) : clonar(d.temp);
    // El viejo guardo la duracion en minutos (`objetivo`) antes de pasarla a segundos.
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

    t.ramo = (t.ramo === undefined) ? null : t.ramo;
    t.semana = (t.semana === undefined) ? null : t.semana;
    t.dia = (t.dia === undefined) ? null : t.dia;
    t.recordatorios = Array.isArray(t.recordatorios) ? clonar(t.recordatorios) : [];
    t.recSonido = texto(t.recSonido) || d.recSonido;

    var reg = Array.isArray(t.registro) ? t.registro : [];
    t.registro = reg.map(normalizarSesion).filter(function (x) { return !!x; });

    return t;
  }

  /* -------------------------------------------------------------- almacen */
  function almacen() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* modo privado o almacen bloqueado: se sigue en memoria */ }
    return null;
  }
  // Devuelve el objeto VIVO del bloque: quien lo reciba no lo muta; para cambiarlo, guardar().
  function leer() {
    if (_datos) return _datos;
    var crudo = null;
    var al = almacen();
    if (al) {
      try {
        var g = al.getItem(CLAVE);
        if (g) crudo = JSON.parse(g);
      } catch (e) { crudo = null; }
    }
    // Se acepta tanto lo que escribe este bloque ({v, tiempo:{...}}) como un tiempo suelto.
    if (esObjeto(crudo) && crudo.tiempo !== undefined) crudo = crudo.tiempo;
    _datos = normalizar(crudo);
    return _datos;
  }
  // Sin argumento persiste lo que hay; con argumento, reemplaza el estado y lo persiste.
  function guardar(tiempo) {
    if (tiempo !== undefined) _datos = normalizar(tiempo);
    else if (!_datos) _datos = normalizar(null);
    var al = almacen();
    if (al) {
      try {
        al.setItem(CLAVE, JSON.stringify({ v: VERSION, tiempo: _datos }));
      } catch (e) { /* cuota llena: el estado sigue en memoria y la UI avisa */ }
    }
    return _datos;
  }

  /* ----------------------------------------------------------- cronometro */
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
  // Pausar y parar congelan igual: la diferencia (preguntar si se registra) es de interfaz.
  function cronoPausar() {
    var c = leer().crono;
    c.acumulado = cronoMs();
    c.corriendo = false;
    c.inicio = null;
    guardar();
    return c.acumulado;
  }
  function cronoParar() {
    return cronoPausar();
  }
  // Poner el reloj a mano. En cronometro lo editado es lo ACUMULADO.
  function cronoPonerMs(ms) {
    var c = leer().crono;
    c.acumulado = Math.max(0, Math.round(numero(ms, 0)));
    c.inicio = c.corriendo ? ahora() : null;
    guardar();
    return c.acumulado;
  }
  function cronoCero() {
    return cronoPonerMs(0);
  }
  function cronoEstaCorriendo() {
    return !!leer().crono.corriendo;
  }

  /* --------------------------------------------------------- temporizador */
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
    // Si no habia restante (recien puesto o llego a cero), se parte del objetivo.
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
  // En temporizador lo que se edita es el tiempo QUE QUEDA, y la duracion se guarda en SEGUNDOS
  // para no perder los segundos que el usuario escribe (00:00:45 no es 1 min).
  function tempPonerMs(ms) {
    var tp = leer().temp;
    // Se admite el cero (el viejo lo admitia): deja restante 0 y una duracion minima de 1 s; al
    // darle al play, tempIniciar vuelve a partir del objetivo.
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
  // El viejo detectaba el cero dentro del setInterval. Aqui lo pregunta la UI (o la prueba):
  // devuelve true UNA vez, al cruzar el cero, y deja el reloj parado en 0.
  function tempTic() {
    var tp = leer().temp;
    if (!tp.corriendo) return false;
    if (tempRestanteMs() > 0) return false;
    tp.restante = 0;
    tp.corriendo = false;
    tp.inicio = null;
    guardar();
    return true;
  }
  function tempEstaCorriendo() {
    return !!leer().temp.corriendo;
  }

  /* -------------------------------------------------------------- pomodoro */
  function pomo() {
    return leer().pomodoro;
  }
  function pomoConfig() {
    return pomo().config;
  }
  // Cambia la configuracion SIN tocar el ciclo en marcha: el proximo bloque ya usa lo nuevo.
  function pomoConfigurar(cambios) {
    var p = pomo();
    if (!esObjeto(cambios)) return clonar(p.config);
    ['trabajo', 'corto', 'largo', 'cada'].forEach(function (k) {
      if (cambios[k] === undefined) return;
      var v = Math.round(numero(cambios[k], 0));
      if (v >= 1) p.config[k] = v;
    });
    if (!p.corriendo) p.restante = null;   // el reloj refleja la duracion nueva al instante
    guardar();
    return clonar(p.config);
  }
  function pomoDurMs(fase) {
    var c = pomo().config;
    var minutos = (fase === 'trabajo') ? c.trabajo : (fase === 'descanso') ? c.corto : c.largo;
    return Math.max(1, minutos) * 60000;
  }
  function pomoRestanteMs() {
    var p = pomo();
    var base = (p.restante === null || p.restante === undefined) ? pomoDurMs(p.fase) : numero(p.restante, 0);
    return Math.max(0, base - (p.corriendo && p.inicio ? Math.max(0, ahora() - p.inicio) : 0));
  }
  // Se llama DESPUES de incrementar trabajos: si los completados son multiplo de "cada", toca
  // descanso largo. Desde un descanso (corto o largo) siempre se vuelve a trabajo.
  function pomoFaseSiguiente() {
    var p = pomo();
    if (p.fase !== 'trabajo') return 'trabajo';
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
  // Parar el pomodoro deja la fase y la rellena desde su duracion (el viejo ponia restante=null).
  function pomoParar() {
    var p = pomo();
    p.restante = null;
    p.corriendo = false;
    p.inicio = null;
    guardar();
    return null;
  }
  /* Avance de fase, el corazon del pomodoro. El viejo lo hacia en el setInterval: aqui devuelve
     lo que paso y no pinta nada.
       - si sigue habiendo tiempo, null
       - si el bloque de trabajo se cumplio: suma trabajo y racha, y REGISTRA la sesion de
         config.trabajo minutos en el ramo elegido (igual que hacia el cronometro)
       - si se cumplio un descanso: no registra nada
       - en los dos casos elige la fase siguiente y deja el reloj PARADO en ella (trabajo ->
         descanso corto, cada N -> descanso largo, descanso -> trabajo); el viejo tampoco
         arrancaba sola la fase siguiente: "se encadenan" en el calculo, no en el reloj.
     La racha y el contador de trabajos se reinician al cambiar de dia. */
  function pomoTic() {
    var p = pomo();
    if (!p.corriendo) return null;
    if (pomoRestanteMs() > 0) return null;
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
    p.corriendo = false;
    p.inicio = null;
    guardar();
    return {
      terminada: terminada,
      fase: p.fase,
      registrada: registrada,
      sesion: sesion
    };
  }
  function pomoEstaCorriendo() {
    return !!pomo().corriendo;
  }

  /* ------------------------------------------------- regimen de sesiones */
  /* Registro de sesiones: la forma de la sesion es la del viejo
     {id, fecha, lunes, ramo, minutos, hora}. `lunes` se deriva de la fecha si no se indica, y
     `hora` es la local del momento de registrar. Los totales NO se guardan: se calculan del
     registro, que es la unica verdad (el viejo ademas escribia en la rejilla del semestre). */
  function registrarMinutos(min, opciones) {
    var t = leer();
    min = Math.round(numero(min, 0));
    if (min < 1) return null;
    var op = esObjeto(opciones) ? opciones : {};
    var fecha = texto(op.fecha) || texto(t.dia) || hoy();
    if (!aFecha(fecha)) fecha = hoy();
    var d = new Date(ahora());
    var sesion = {
      id: 's' + ahora() + '-' + (++_secuencia),
      fecha: fecha,
      lunes: texto(op.lunes) || lunesDe(fecha),
      ramo: (op.ramo !== undefined) ? op.ramo : t.ramo,
      minutos: min,
      hora: texto(op.hora) || (dos(d.getHours()) + ':' + dos(d.getMinutes()))
    };
    t.registro.push(sesion);
    guardar();
    return clonar(sesion);
  }
  // Alias con el nombre del viejo, para que la interfaz de T2 lo llame igual.
  function registrar(min, opciones) {
    return registrarMinutos(min, opciones);
  }
  // Deshacer una sesion: se quita del registro y no se toca nada mas (los totales son derivados).
  function quitarSesion(id) {
    var t = leer();
    var antes = t.registro.length;
    t.registro = t.registro.filter(function (s) { return texto(s.id) !== texto(id); });
    if (t.registro.length === antes) return false;
    guardar();
    return true;
  }
  function sesiones(filtro) {
    var reg = leer().registro;
    var f = esObjeto(filtro) ? filtro : null;
    return reg.filter(function (s) {
      if (!f) return true;
      if (f.fecha !== undefined && s.fecha !== f.fecha) return false;
      if (f.lunes !== undefined && s.lunes !== f.lunes) return false;
      if (f.ramo !== undefined && texto(s.ramo) !== texto(f.ramo)) return false;
      if (f.desde !== undefined && s.fecha < f.desde) return false;
      if (f.hasta !== undefined && s.fecha > f.hasta) return false;
      return true;
    });
  }
  function sesionesDeDia(fecha) {
    return sesiones({ fecha: texto(fecha) });
  }
  function sesionesDeSemana(lunes) {
    var dias = diasDeLaSemana(lunes);
    return sesiones().filter(function (s) { return dias.indexOf(s.fecha) >= 0; }).sort(function (a, b) {
      // Orden de lectura: por fecha y, dentro del dia, por hora (igual que el viejo).
      return a.fecha === b.fecha
        ? texto(a.hora).localeCompare(texto(b.hora))
        : a.fecha.localeCompare(b.fecha);
    });
  }
  function sumaMinutos(lista) {
    return (lista || []).reduce(function (n, s) { return n + numero(s.minutos, 0); }, 0);
  }

  /* ------------------------------------------------------------- agregados */
  // Los mismos tres cortes que el viejo ensenaba (dia, semana, ramo), pero derivados del registro.
  function agrupar(lista, clave) {
    var out = {};
    (lista || []).forEach(function (s) {
      var k = clave(s);
      out[k] = (out[k] || 0) + numero(s.minutos, 0);
    });
    return out;
  }
  function agregadosPorDia(lista) {
    return agrupar(lista || sesiones(), function (s) { return s.fecha; });
  }
  function agregadosPorSemana(lista) {
    return agrupar(lista || sesiones(), function (s) { return s.lunes || lunesDe(s.fecha); });
  }
  function agregadosPorRamo(lista) {
    return agrupar(lista || sesiones(), function (s) { return texto(s.ramo) || 'sin ramo'; });
  }
  function minutosDia(fecha) {
    return sumaMinutos(sesionesDeDia(fecha));
  }
  function minutosSemana(lunes) {
    return sumaMinutos(sesionesDeSemana(lunes));
  }
  function minutosRamo(ramo) {
    return sumaMinutos(sesiones({ ramo: ramo }));
  }
  function agregados() {
    var reg = sesiones();
    return {
      total: sumaMinutos(reg),
      sesiones: reg.length,
      porDia: agregadosPorDia(reg),
      porSemana: agregadosPorSemana(reg),
      porRamo: agregadosPorRamo(reg)
    };
  }

  return {
    CLAVE: CLAVE,
    VERSION: VERSION,
    MODOS: MODOS,
    FASES: FASES,
    estadoInicial: estadoInicial,
    normalizar: normalizar,
    leer: leer,
    guardar: guardar,
    // reloj (banco de pruebas)
    ahora: ahora,
    fijarReloj: fijarReloj,
    avanzarReloj: avanzarReloj,
    // fechas
    hoy: hoy,
    aFecha: aFecha,
    sumaDias: sumaDias,
    lunesDe: lunesDe,
    diasDeLaSemana: diasDeLaSemana,
    // cronometro
    cronoMs: cronoMs,
    cronoIniciar: cronoIniciar,
    cronoPausar: cronoPausar,
    cronoParar: cronoParar,
    cronoPonerMs: cronoPonerMs,
    cronoCero: cronoCero,
    cronoEstaCorriendo: cronoEstaCorriendo,
    // temporizador
    tempObjetivoSeg: tempObjetivoSeg,
    tempRestanteMs: tempRestanteMs,
    tempIniciar: tempIniciar,
    tempPausar: tempPausar,
    tempPonerMs: tempPonerMs,
    tempCero: tempCero,
    tempTic: tempTic,
    tempEstaCorriendo: tempEstaCorriendo,
    // pomodoro
    pomo: pomo,
    pomoConfig: pomoConfig,
    pomoConfigurar: pomoConfigurar,
    pomoDurMs: pomoDurMs,
    pomoRestanteMs: pomoRestanteMs,
    pomoFaseSiguiente: pomoFaseSiguiente,
    pomoIniciar: pomoIniciar,
    pomoPausar: pomoPausar,
    pomoParar: pomoParar,
    pomoTic: pomoTic,
    pomoEstaCorriendo: pomoEstaCorriendo,
    // sesiones y agregados
    registrar: registrar,
    registrarMinutos: registrarMinutos,
    quitarSesion: quitarSesion,
    sesiones: sesiones,
    sesionesDeDia: sesionesDeDia,
    sesionesDeSemana: sesionesDeSemana,
    sumaMinutos: sumaMinutos,
    minutosDia: minutosDia,
    minutosSemana: minutosSemana,
    minutosRamo: minutosRamo,
    agregadosPorDia: agregadosPorDia,
    agregadosPorSemana: agregadosPorSemana,
    agregadosPorRamo: agregadosPorRamo,
    agregados: agregados
  };
})();

// Unica linea que asoma el global al navegador: la exportacion (spec §1).
if (typeof window !== 'undefined') window.MimoTiempoMotor = MimoTiempoMotor;
