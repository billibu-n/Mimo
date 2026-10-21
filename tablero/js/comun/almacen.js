/* ============================================================================
   almacen.js — Mimo Nuevo · sustrato comun · EL ALMACEN UNICO Y VERSIONADO
   (bloque T003; el corazon se porta de
    `referencia/mimo-app-53cc22d/js/comun/03-catalogo.js:278-372`)

   QUE PROBLEMA RESUELVE
   Hasta T002 cada pieza guardaba en su propio cajon: el armazon en
   `mimo.armazon.v1`, el motor de Tiempo en `mimo.bloque.tiempo` y el idioma en
   `mimo.idioma`. Tres cajones son tres verdades: el respaldo copiaba uno, el
   idioma se perdia al exportar, y cualquier bloque nuevo inventaba el cuarto.
   Aqui hay UN cajon con UNA version:

       localStorage['mimo.datos.v1'] = {
         v: 1,
         armazon:  {...} | null,   // seccion y bloques instalados (armazon-paneles.html)
         tiempo:   {...} | null,   // crono, temp, pomodoro, registro, recordatorios
         idioma:   'es' | 'en',
         catalogo: {},             // ramos propios; los de fabrica llegan en T004
         malla:    {...} | null,   // reticula, semestre y aprobados (T004)
         estudio:  {minutos, metas, metas_ramo, metas_semana, descartes,
                    notas_otros},  // horas y metas del semestre (T005)
         calificaciones: {cats, comps, examen, exim, estado,
                    colores},      // notas por ramo (T005)
         tareas:   {nuevas, hechas, prioridades},  // tablero de Tareas (T007)
         semestre: {activo, extras, sem, metas}, // estructura del semestre (T008)
         calendario: {nuevas, hechas, prioridades, notas_evento, tipos, fichas,
                    vista, anio, mes},          // eventos y navegacion (T008)
         ajustes:  {},             // T009
         respaldo: {},             // estado del respaldo en carpeta
         migrado:  {de: [...], cuando: ms}   // marca de la migracion, para poder mirarla
       }

   LOS DOS NAMESPACES DE T005 (estudio y calificaciones) van aqui porque el
   almacen es la UNICA puerta: un estado de primer nivel que no figure en
   `estadoInicial()`/`normalizar()` se pierde al recargar (no se escribe, o se
   escribe y `normalizar` lo tira). Cada uno tiene su forma fija y sus hijos se
   garantizan objeto a objeto: un hijo que falte no rompe el bloque, se crea
   vacio. Los espejos dentro de `ajustes` estan prohibidos: `ajustes` es de T009.

   LA MIGRACION ES DE UNA SOLA VIA Y NO BORRA NADA
   Al faltar `mimo.datos.v1` (primer arranque de esta version, o un perfil
   nuevo) se leen las TRES claves viejas UNA vez, se anidan en
   `armazon`/`tiempo`/`idioma`, se escribe la nueva y las viejas se dejan
   INTACTAS: son la copia de rescate si hay que volver a la version anterior.
   Al existir ya la nueva, la migracion no se vuelve a ejecutar: una segunda
   recarga no duplica ni pisa nada.

   `reset()` SI es un borrado de verdad: quita la clave nueva y deja escrita la
   foto de fabrica, para que un "restablecer todo" no resucite los datos viejos
   por la puerta de la migracion.

   EL MARCADOR `fallo`
   Si el navegador no deja escribir (cuota llena, modo privado, almacen
   bloqueado) los cambios viven SOLO en memoria. Eso hay que decirlo, no
   fingir que se guardo: `MimoComun.ALMACEN.fallo` guarda el nombre del error
   (o null) y el pie del armazon lo puede leer.

   API (todo cuelga de window.MimoComun):
     MimoComun.CLAVE                      'mimo.datos.v1'
     MimoComun.VERSION                    1
     MimoComun.CLAVES_VIEJAS              {armazon, tiempo, idioma}
     MimoComun.ALMACEN                    {fallo}
     MimoComun.estadoInicial()            la foto de fabrica
     MimoComun.migrar(e)                  anida las claves viejas en `e` (no escribe)
     MimoComun.leer()                     el estado VIVO (migra y escribe si falta)
     MimoComun.guardar([aviso])           escribe; avisa y llama al respaldo
     MimoComun.reset()                    borra la clave y deja la foto de fabrica
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var CLAVE = 'mimo.datos.v1';
  var VERSION = 1;
  var CLAVES_VIEJAS = {
    armazon: 'mimo.armazon.v1',
    tiempo: 'mimo.bloque.tiempo',
    idioma: 'mimo.idioma'
  };

  var _datos = null;                 // estado vivo; null = todavia sin leer
  var ALMACEN = { fallo: null };     // por que no se pudo guardar, si no se pudo

  function almacen() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) { return localStorage; }
    } catch (e) { /* modo privado o almacen bloqueado: se sigue en memoria */ }
    return null;
  }

  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  function estadoInicial() {
    return {
      v: VERSION,
      armazon: null,
      tiempo: null,
      idioma: 'es',
      catalogo: {},
      malla: null,
      estudio: {
        minutos: {},          // lunes -> {CODIGO: minutos, OTROS: registrado sin repartir}
        metas: { semanal: 0 },// meta base semanal, en horas
        metas_ramo: {},       // CODIGO -> {horas, nota_min}
        metas_semana: {},     // lunes -> horas; manda sobre la base
        descartes: {},        // lunes -> {CODIGO: true} (el aviso no se repite)
        notas_otros: {}       // lunes -> nota libre del usuario
      },
      calificaciones: {
        cats: {},             // CODIGO -> [{nombre, peso}]
        comps: {},            // CODIGO -> [{nombre, categoria, peso, nota, fecha}]
        examen: {},           // CODIGO -> {activo, peso, reemplaza}
        exim: {},             // CODIGO -> {activa, modo, condiciones}
        estado: {},           // CODIGO -> 'aprobado' (marca manual; manda sobre el calculo)
        colores: {}           // reservado para el color por categoria
      },
      /* T007. Las tareas sueltas y sus dos mapas por id. `nuevas` es la lista
         (una tarea es {id, fecha, hora, texto, ramo, origen}); `hechas` e
         `prioridades` se indexan por el id de la tarea O del evento, como en la
         app anterior, para que un evento del calendario se pueda marcar sin
         duplicarlo. Un namespace de primer nivel: los espejos dentro de
         `ajustes` siguen prohibidos. */
      tareas: {
        nuevas: [],
        hechas: {},
        prioridades: {}
      },
      /* T008. El calendario tiene DOS ramas y van separadas a proposito:
         `semestre` es la ESTRUCTURA (que semestre esta activo, cuales se creo el
         usuario, sus semanas y su meta semanal) y `calendario` son los EVENTOS y
         la navegacion (que dia se esta mirando). Un semestre borrado se lleva su
         `sem[id]`, no los eventos: borrar el calendario de clases no borra lo que
         el usuario apunto en el. */
      semestre: {
        activo: null,         // id del semestre activo, o null
        extras: [],           // semestres creados por el usuario, con sus semanas
        sem: {},              // id -> {ramos, notas} del semestre (no se toca al editar)
        metas: { semanal: 0 } // meta semanal propia del semestre, en horas
      },
      calendario: {
        nuevas: [],           // eventos sueltos {id, fecha, hora, texto, ramo, tipo, ...}
        hechas: {},           // id -> true
        prioridades: {},      // id -> 'alta' | 'media' | 'baja'
        notas_evento: {},     // id -> nota (1,0 a 7,0) del evento
        tipos: {},            // codigo -> etiqueta propia del usuario
        fichas: {},           // id -> {detalle, temario} de la ficha del evento
        vista: 'sem',         // 'mes' | 'anio' | 'sem'
        anio: 0,              // 0 = el ano de hoy; si no, el ano visible
        mes: 0                // mes visible (0..11) en la vista de mes
      },
      ajustes: {},
      respaldo: {},
      migrado: { de: [], cuando: null }
    };
  }

  /* Los dos namespaces de T005, normalizados con guardas. Se garantiza la forma
     entera: si el disco trae medio objeto, el bloque no adivina, rellena vacio. */
  function normalizarEstudio(v) {
    v = esObjeto(v) ? v : {};
    var semanal = (esObjeto(v.metas) && isFinite(Number(v.metas.semanal)))
      ? Number(v.metas.semanal) : 0;
    return {
      minutos: esObjeto(v.minutos) ? v.minutos : {},
      metas: { semanal: semanal },
      metas_ramo: esObjeto(v.metas_ramo) ? v.metas_ramo : {},
      metas_semana: esObjeto(v.metas_semana) ? v.metas_semana : {},
      descartes: esObjeto(v.descartes) ? v.descartes : {},
      notas_otros: esObjeto(v.notas_otros) ? v.notas_otros : {}
    };
  }

  /* T007: la lista se garantiza array y los dos mapas, objeto. Las tareas se
     dejan tal cual (su forma la valida el bloque); aqui solo se impide que un
     disco roto deje `nuevas` como objeto o `hechas` como lista. */
  function normalizarTareas(v) {
    v = esObjeto(v) ? v : {};
    return {
      nuevas: Array.isArray(v.nuevas) ? v.nuevas : [],
      hechas: esObjeto(v.hechas) ? v.hechas : {},
      prioridades: esObjeto(v.prioridades) ? v.prioridades : {}
    };
  }

  function normalizarCalificaciones(v) {
    v = esObjeto(v) ? v : {};
    return {
      cats: esObjeto(v.cats) ? v.cats : {},
      comps: esObjeto(v.comps) ? v.comps : {},
      examen: esObjeto(v.examen) ? v.examen : {},
      exim: esObjeto(v.exim) ? v.exim : {},
      estado: esObjeto(v.estado) ? v.estado : {},
      colores: esObjeto(v.colores) ? v.colores : {}
    };
  }

  /* T008: las dos ramas del calendario. `extras` son los semestres del usuario;
     cada uno se deja tal cual si es objeto con id (su forma la valida el bloque),
     y los que no lo son se caen: un semestre sin id no se puede activar ni
     borrar. `sem` y los mapas se garantizan objeto para que una recarga a medias
     no rompa el bloque. */
  function normalizarSemestre(v) {
    v = esObjeto(v) ? v : {};
    var extras = [], vistos = {};
    if (Array.isArray(v.extras)) {
      for (var i = 0; i < v.extras.length; i++) {
        var x = v.extras[i];
        if (!esObjeto(x) || !x.id || vistos[x.id]) { continue; }
        vistos[x.id] = true;
        extras.push(x);
      }
    }
    var activo = (v.activo && vistos[v.activo]) ? v.activo : (extras.length ? extras[0].id : null);
    return {
      activo: activo,
      extras: extras,
      sem: esObjeto(v.sem) ? v.sem : {},
      metas: { semanal: (esObjeto(v.metas) && isFinite(Number(v.metas.semanal)))
        ? Number(v.metas.semanal) : 0 }
    };
  }

  function normalizarCalendario(v) {
    v = esObjeto(v) ? v : {};
    var vista = (v.vista === 'mes' || v.vista === 'anio' || v.vista === 'sem') ? v.vista : 'sem';
    var anio = isFinite(Number(v.anio)) ? Math.round(Number(v.anio)) : 0;
    var mes = isFinite(Number(v.mes)) ? Math.round(Number(v.mes)) : 0;
    if (mes < 0 || mes > 11) { mes = 0; }
    return {
      nuevas: Array.isArray(v.nuevas) ? v.nuevas : [],
      hechas: esObjeto(v.hechas) ? v.hechas : {},
      prioridades: esObjeto(v.prioridades) ? v.prioridades : {},
      notas_evento: esObjeto(v.notas_evento) ? v.notas_evento : {},
      tipos: esObjeto(v.tipos) ? v.tipos : {},
      fichas: esObjeto(v.fichas) ? v.fichas : {},
      vista: vista,
      anio: (anio > 1900 && anio < 2200) ? anio : 0,
      mes: mes
    };
  }

  /* Normaliza lo que venga del disco: un cajon con una version que no es la
     nuestra, o con basura, se descarta entero (mejor arrancar de fabrica que
     arrancar a medias). Los tres hijos que usa la interfaz se garantizan. */
  function normalizar(s) {
    var e = estadoInicial();
    if (!esObjeto(s) || s.v !== VERSION) { return e; }
    e.guardadoEn = (typeof s.guardadoEn === 'number') ? s.guardadoEn : null;
    e.armazon = esObjeto(s.armazon) ? s.armazon : null;
    e.tiempo = esObjeto(s.tiempo) ? s.tiempo : null;
    e.idioma = (s.idioma === 'en') ? 'en' : 'es';
    e.catalogo = esObjeto(s.catalogo) ? s.catalogo : {};
    /* `malla` se sumo en T004. El espejo en `ajustes.malla` lo dejo escrito el
       hijo cuando este fichero no estaba en su lista de permitidos: se rescata
       aqui una vez y a partir de ahora manda el campo de primer nivel. */
    e.malla = esObjeto(s.malla) ? s.malla
      : (esObjeto(s.ajustes) && esObjeto(s.ajustes.malla) ? s.ajustes.malla : null);
    e.estudio = normalizarEstudio(s.estudio);
    e.calificaciones = normalizarCalificaciones(s.calificaciones);
    e.tareas = normalizarTareas(s.tareas);
    e.semestre = normalizarSemestre(s.semestre);
    e.calendario = normalizarCalendario(s.calendario);
    e.ajustes = esObjeto(s.ajustes) ? s.ajustes : {};
    e.respaldo = esObjeto(s.respaldo) ? s.respaldo : {};
    e.migrado = esObjeto(s.migrado) ? s.migrado : { de: [], cuando: null };
    return e;
  }

  function leerVieja(al, clave) {
    try {
      var crudo = al.getItem(clave);
      if (crudo === null || crudo === undefined) { return null; }
      try { return JSON.parse(crudo); } catch (e) { return crudo; }   // el idioma es cadena cruda
    } catch (e) { return null; }
  }

  /* La migracion. Lee las TRES claves viejas una sola vez, las anida y deja
     constancia en `migrado` de cuales habia (para poder decirlo en la
     evidencia). No escribe: de eso se encarga `leer()`. */
  function migrar(e) {
    if (!esObjeto(e)) { e = estadoInicial(); }
    var de = [];
    var al = almacen();
    if (al) {
      var arm = leerVieja(al, CLAVES_VIEJAS.armazon);
      if (esObjeto(arm)) { e.armazon = arm; de.push(CLAVES_VIEJAS.armazon); }

      var tie = leerVieja(al, CLAVES_VIEJAS.tiempo);
      if (esObjeto(tie)) {
        e.tiempo = esObjeto(tie.tiempo) ? tie.tiempo : tie;
        de.push(CLAVES_VIEJAS.tiempo);
      }

      var idi = leerVieja(al, CLAVES_VIEJAS.idioma);
      if (idi === 'es' || idi === 'en') { e.idioma = idi; de.push(CLAVES_VIEJAS.idioma); }
    }
    e.migrado = { de: de, cuando: Date.now() };
    return e;
  }

  function escribir() {
    var al = almacen();
    if (!al) { ALMACEN.fallo = 'sin-almacen'; return false; }
    try {
      al.setItem(CLAVE, JSON.stringify(_datos));
      ALMACEN.fallo = null;
      return true;
    } catch (err) {
      ALMACEN.fallo = (err && err.name) || 'Error';
      return false;
    }
  }

  // Devuelve el objeto VIVO: quien lo reciba puede mutarlo; para que se guarde,
  // hay que llamar a guardar(). Los bloques escriben su rama y guardan una vez.
  function leer() {
    if (_datos) { return _datos; }
    var al = almacen();
    var crudo = null;
    if (al) {
      try { crudo = al.getItem(CLAVE); } catch (e) { crudo = null; }
    }
    if (crudo === null || crudo === undefined) {
      // Falta la nueva: primer arranque de esta version o reset. Se migra.
      _datos = migrar(estadoInicial());
      _datos.guardadoEn = Date.now();
      escribir();
      return _datos;
    }
    var s = null;
    try { s = JSON.parse(crudo); } catch (e) { s = null; }
    _datos = normalizar(s);
    return _datos;
  }

  function guardar(aviso) {
    if (!_datos) { _datos = estadoInicial(); }
    _datos.v = VERSION;
    _datos.guardadoEn = Date.now();
    escribir();
    if (aviso && typeof Mimo.mostrarAviso === 'function') { Mimo.mostrarAviso(aviso); }
    // El respaldo en carpeta se carga DESPUES de este fichero: el typeof es
    // porque en los guardados mas tempranos todavia no existe.
    if (typeof Mimo.respaldoAuto === 'function') { Mimo.respaldoAuto(); }
    return _datos;
  }

  function reset() {
    _datos = estadoInicial();
    _datos.guardadoEn = Date.now();
    var al = almacen();
    if (al) { try { al.removeItem(CLAVE); } catch (e) { /* sin almacen: solo memoria */ } }
    // Se deja escrita la foto de fabrica A PROPOSITO: si no, el siguiente
    // `leer()` veria la clave nueva ausente y re-migraria los datos viejos.
    escribir();
    return _datos;
  }

  function fallo() { return ALMACEN.fallo; }

  Mimo.CLAVE = CLAVE;
  Mimo.VERSION = VERSION;
  Mimo.CLAVES_VIEJAS = CLAVES_VIEJAS;
  Mimo.ALMACEN = ALMACEN;
  Mimo.estadoInicial = estadoInicial;
  Mimo.migrar = migrar;
  Mimo.leer = leer;
  Mimo.guardar = guardar;
  Mimo.reset = reset;
  Mimo.fallo = fallo;
})(MimoComun);
