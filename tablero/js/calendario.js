/* ============================================================================
   calendario.js — Mimo Nuevo · bloque Calendario (T008)

   QUE ES. La seccion Calendario del riel, portada de las cuatro piezas de la app
   anterior que el inventario de paridad pide (filas 62-67):
     `js/semestre/01-calendario.js`   la tabla semanal del semestre (semanas con
                                      receso y examen, columna de estudio, chips
                                      de evento y mini-barras)
     `js/semestre/02-editor-evento.js` el editor de evento (alta/edicion, ramo
                                      OPCIONAL que enlaza el evento con su nota)
     `js/semestre/03-calendario.js`   el calendario comercial mes/ano/semestre
                                      navegable y la marca del semestre por dia
     `js/ajustes/05-semestres.js`     los semestres extra (crear/editar/borrar/
                                      activar) con sus semanas
     `js/ajustes/07-ical.js`          exportar/importar iCal (.ics)

   DOS NAMESPACES, UNA FORMA FIJA. La estructura del semestre y los eventos van
   SEPARADOS (`E.semestre` y `E.calendario`), y su forma la declara
   `js/comun/almacen.js` (toque de este bloque): un namespace que no figure en
   `estadoInicial()`/`normalizar()` se pierde al recargar. Aqui se siembra la
   primera vez y no se espeja nada: los espejos dentro de `ajustes` siguen
   prohibidos (son de T009).

   EL MOTOR NO TOCA LA PANTALLA. `MimoCalendarioMotor` no nombra el objeto global
   del navegador (ni una vez): se puede medir sin abrir ventana. `MimoCalendarioUI`
   es el unico que pinta, dentro de `[data-calendario="bloque"]`.

   LA MALLA MANDA EN LOS RAMOS. El calendario NO inventa catalogo: los ramos del
   semestre y sus colores salen de `MimoComun.ramosDeSem()` (T004) y de
   `MimoEstudioMotor.colorDe()` (T005). Y las horas de la columna de estudio, de
   `MimoEstudioMotor.horasSemana()`: el mismo numero que ve Estudio, no una copia.

   EL IDIOMA ES DE T010. Este bloque NO toca `js/i18n.js`: sus rotulos van en el
   propio fichero, en espanol, sin atributos `data-i18n`. Un `data-i18n` con una
   clave que el diccionario no tiene se contaria como AUSENTE en el gate de
   idioma. HUECO declarado: el bloque no se traduce hasta T010.

   API DEL MOTOR (`window.MimoCalendarioMotor`)
     SEMESTRE
       semestres()                 la lista de semestres del usuario (copias)
       semActivo()                 el semestre activo, o null
       semEsEditable(id)           true solo para los creados por el usuario
       crearSemestre(opts)         {nombre, inicio, clases, recesos, examen}
       editarSemestre(id, opts)    regenera semanas y CONSERVA ramos y eventos
       borrarSemestre(id)          quita el semestre y su `sem[id]`; re-activa otro
       cambiarSemestre(id)         activa uno de los existentes
       semanasDe(sem)              sus semanas (copia)
       metaSemanal()               meta del semestre, en horas
     CALENDARIO
       hoy(), lunesDe(iso), periodo(), periodoTexto()
       fijarVista(v), navPeriodo(delta), irHoy(), grillaMes(anio, mes)
       todosEventos(), eventosDelDia(fecha), eventoPorId(id), chipsDe(dia)
       nuevaEvento([parcial]), guardarEvento(ev), borrarEvento(id), marcar(id)
       notaDe(id), ponerNota(id, n), prioridad(id)
       resetFiltros(), filtros()
       marcaSemestreDe(fecha), kpis(), tipos(), ramos()
       horasSemana(lunes), objetivoSemanal(), barraSemana(lunes), fmtMin(min)
       exportarIcal()              PURO: devuelve el texto .ics, no descarga
       importarIcal(texto)         PURO: parsea y anade; devuelve {n, eventos}

   API DE LA VISTA (`window.MimoCalendarioUI`)
     iniciar()                     engancha UNA vez, delegado en el documento
     pintar()                      repinta la caja, si existe
     abrirEditor(id), cerrarEditor()
   ============================================================================ */
var MimoCalendarioMotor = (function () {
  'use strict';

  var MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
                      'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  var DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  var VISTAS = ['mes', 'anio', 'sem'];
  var TIPOS = {
    tarea: 'Tarea',
    control: 'Control',
    prueba: 'Prueba',
    examen: 'Examen',
    entrega: 'Entrega',
    lectura: 'Lectura',
    personal: 'Personal'
  };
  var PALETA = ['var(--acento)', 'var(--fuerte)', 'var(--muted)'];
  var RANGO = { alta: 0, media: 1, baja: 2 };
  var _contador = 0;
  var _filtro = { activo: false, ramos: {}, tipos: {} };

  /* -------------------------------------------------------- 0. utilidades */

  function comun() {
    if (typeof MimoComun === 'undefined' || !MimoComun) { return null; }
    if (typeof MimoComun.leer !== 'function') { return null; }
    return MimoComun;
  }
  function estudio() {
    if (typeof MimoEstudioMotor === 'undefined' || !MimoEstudioMotor) { return null; }
    return MimoEstudioMotor;
  }
  function esObjeto(x) { return !!x && typeof x === 'object' && !(x instanceof Array); }
  function texto(v) {
    return String(v === undefined || v === null ? '' : v).replace(/^\s+|\s+$/g, '');
  }
  function numero(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : (def === undefined ? 0 : def);
  }
  function acota(n, a, b) { return Math.min(b, Math.max(a, n)); }
  function copia(x) {
    var M = comun();
    if (M && typeof M.copia === 'function') { return M.copia(x); }
    return JSON.parse(JSON.stringify(x));
  }
  function hoy() {
    var M = comun();
    return M && typeof M.hoy === 'function' ? M.hoy() : '';
  }
  function dos(n) {
    var M = comun();
    if (M && typeof M.dos === 'function') { return M.dos(n); }
    return (n < 10 ? '0' : '') + n;
  }
  function sumaDias(iso, n) {
    var M = comun();
    return M && typeof M.sumaDias === 'function' ? M.sumaDias(iso, n) : iso;
  }
  function aFecha(iso) {
    var M = comun();
    return M && typeof M.aFecha === 'function' ? M.aFecha(iso) : new Date(iso + 'T12:00:00');
  }
  function aISO(d) {
    var M = comun();
    if (M && typeof M.aISO === 'function') { return M.aISO(d); }
    return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate());
  }
  function rangoSemana(lunes) {
    var M = comun();
    return M && typeof M.rangoSemana === 'function' ? M.rangoSemana(lunes) : lunes;
  }
  function lunesDe(iso) {
    var base = texto(iso) || hoy();
    if (!base) { return ''; }
    var dias = (aFecha(base).getDay() + 6) % 7;      // 0 = lunes ... 6 = domingo
    return sumaDias(base, -dias);
  }

  /* ------------------------------------------------------ 1. estado vivo */

  function estadoNuevo() {
    return {
      semestre: { activo: null, extras: [], sem: {}, metas: { semanal: 0 } },
      calendario: {
        nuevas: [], hechas: {}, prioridades: {}, notas_evento: {},
        tipos: {}, fichas: {}, vista: 'sem', anio: 0, mes: 0
      }
    };
  }

  /* Una sola puerta al almacen. Garantiza las dos ramas: si el disco trae medio
     objeto se rellena vacio, no se adivina. `leer()` devuelve el objeto VIVO, asi
     que lo que se toca aqui lo escribe despues `guardar()`. */
  function E() {
    var M = comun();
    if (!M) { return estadoNuevo(); }
    var e = M.leer();
    if (!esObjeto(e.semestre)) { e.semestre = { activo: null, extras: [], sem: {}, metas: { semanal: 0 } }; }
    var s = e.semestre;
    if (!(s.extras instanceof Array)) { s.extras = []; }
    if (!esObjeto(s.sem)) { s.sem = {}; }
    if (!esObjeto(s.metas)) { s.metas = { semanal: 0 }; }
    if (!esObjeto(e.calendario)) {
      e.calendario = estadoNuevo().calendario;
    }
    var c = e.calendario;
    if (!(c.nuevas instanceof Array)) { c.nuevas = []; }
    if (!esObjeto(c.hechas)) { c.hechas = {}; }
    if (!esObjeto(c.prioridades)) { c.prioridades = {}; }
    if (!esObjeto(c.notas_evento)) { c.notas_evento = {}; }
    if (!esObjeto(c.tipos)) { c.tipos = {}; }
    if (!esObjeto(c.fichas)) { c.fichas = {}; }
    if (VISTAS.indexOf(c.vista) < 0) { c.vista = 'sem'; }
    if (!isFinite(Number(c.anio))) { c.anio = 0; }
    if (!isFinite(Number(c.mes)) || Number(c.mes) < 0 || Number(c.mes) > 11) { c.mes = 0; }
    return e;
  }

  function guardar(aviso) {
    var M = comun();
    if (M && typeof M.guardar === 'function') { M.guardar(aviso); }
  }

  /* --------------------------------------------------- 2. semestre */

  function semanasDe(sem) {
    if (!sem || !(sem.semanas instanceof Array)) { return []; }
    return copia(sem.semanas);
  }

  function limpiaRecesos(v, clases) {
    var lista = [];
    if (v instanceof Array) { lista = v.slice(); }
    else if (typeof v === 'string') { lista = v.split(','); }
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var n = Math.round(numero(lista[i], 0));
      if (n >= 1 && n <= clases && out.indexOf(n) < 0) { out.push(n); }
    }
    out.sort(function (a, b) { return a - b; });
    return out;
  }

  /* Las semanas se GENERAN, no se guardan a mano: la misma foto (inicio, clases,
     recesos, examen) da siempre las mismas semanas. Se guardan igualmente porque
     la tabla y los eventos las leen sin recalcular en cada pintado. */
  function generarSemanas(sem) {
    var cursor = sem.inicio, out = [], i;
    var recesos = sem.recesos || [];
    for (i = 1; i <= sem.clases; i++) {
      out.push({ etiqueta: 'S' + i, lunes: cursor, domingo: sumaDias(cursor, 6), tipo: 'clases' });
      cursor = sumaDias(cursor, 7);
      if (recesos.indexOf(i) >= 0) {
        out.push({ etiqueta: 'Receso', lunes: cursor, domingo: sumaDias(cursor, 6), tipo: 'receso' });
        cursor = sumaDias(cursor, 7);
      }
    }
    for (i = 1; i <= sem.examen; i++) {
      out.push({ etiqueta: 'Examen ' + i, lunes: cursor, domingo: sumaDias(cursor, 6), tipo: 'examen' });
      cursor = sumaDias(cursor, 7);
    }
    return out;
  }

  function normalizarSemestre(x) {
    x = esObjeto(x) ? x : {};
    var clases = Math.round(acota(numero(x.clases, 15), 1, 25));
    var examen = Math.round(acota(numero(x.examen, 0), 0, 8));
    var inicio = texto(x.inicio) || lunesDe(hoy());
    var sem = {
      id: texto(x.id) || ('sem' + Date.now() + (++_contador)),
      nombre: texto(x.nombre) || 'Semestre',
      inicio: inicio,
      clases: clases,
      recesos: limpiaRecesos(x.recesos, clases),
      examen: examen,
      creado: numero(x.creado, Date.now())
    };
    sem.semanas = generarSemanas(sem);
    return sem;
  }

  function semestrePorId(id) {
    var s = E().semestre;
    for (var i = 0; i < s.extras.length; i++) {
      if (s.extras[i] && s.extras[i].id === id) { return s.extras[i]; }
    }
    return null;
  }

  function semestres() {
    var s = E().semestre, out = [];
    for (var i = 0; i < s.extras.length; i++) { out.push(copia(s.extras[i])); }
    return out;
  }

  function semActivo() {
    var s = E().semestre;
    if (!s.activo) { return null; }
    return semestrePorId(s.activo);
  }

  function semEsEditable(id) {
    var s = E().semestre;
    for (var i = 0; i < s.extras.length; i++) {
      if (s.extras[i] && s.extras[i].id === id) { return true; }
    }
    return false;
  }

  function crearSemestre(opts) {
    opts = esObjeto(opts) ? opts : {};
    var s = E().semestre;
    var id = 'sem' + Date.now() + (++_contador);
    var sem = normalizarSemestre({
      id: id,
      nombre: texto(opts.nombre) || ('Semestre ' + (s.extras.length + 1)),
      inicio: opts.inicio,
      clases: opts.clases,
      recesos: opts.recesos,
      examen: opts.examen,
      creado: Date.now()
    });
    s.extras.push(sem);
    s.sem[id] = { ramos: [], notas: {} };
    s.activo = id;
    guardar('Semestre «' + sem.nombre + '» creado');
    return copia(sem);
  }

  /* Editar regenera semanas y CONSERVA lo que vive fuera del semestre: los
     eventos estan en `E.calendario.nuevas` y los ramos/notas del semestre en
     `E.semestre.sem[id]`, que no se toca. Es la regla de la app anterior. */
  function editarSemestre(id, opts) {
    opts = esObjeto(opts) ? opts : {};
    var s = E().semestre, i, actual = null;
    for (i = 0; i < s.extras.length; i++) {
      if (s.extras[i] && s.extras[i].id === id) { actual = s.extras[i]; break; }
    }
    if (!actual) { return null; }
    var sem = normalizarSemestre({
      id: id,
      nombre: opts.nombre !== undefined ? opts.nombre : actual.nombre,
      inicio: opts.inicio !== undefined ? opts.inicio : actual.inicio,
      clases: opts.clases !== undefined ? opts.clases : actual.clases,
      recesos: opts.recesos !== undefined ? opts.recesos : actual.recesos,
      examen: opts.examen !== undefined ? opts.examen : actual.examen,
      creado: actual.creado
    });
    s.extras[i] = sem;
    if (!esObjeto(s.sem[id])) { s.sem[id] = { ramos: [], notas: {} }; }
    guardar('Semestre «' + sem.nombre + '» actualizado');
    return copia(sem);
  }

  function borrarSemestre(id) {
    var s = E().semestre, i, habia = false;
    for (i = 0; i < s.extras.length; i++) {
      if (s.extras[i] && s.extras[i].id === id) { habia = true; break; }
    }
    if (!habia) { return false; }
    s.extras.splice(i, 1);
    delete s.sem[id];
    if (s.activo === id) { s.activo = s.extras.length ? s.extras[0].id : null; }
    guardar('Semestre borrado');
    return true;
  }

  function cambiarSemestre(id) {
    var s = E().semestre;
    if (!semEsEditable(id)) { return false; }
    s.activo = id;
    guardar();
    return true;
  }

  function metaSemanal() {
    return numero(E().semestre.metas.semanal, 0);
  }

  /* Los datos PROPIOS del semestre (ramos asignados y notas). La lista de ramos
     efectiva NO se copia aqui: sale de la malla, para que no haya dos verdades. */
  function datosDeSemestre(id) {
    var s = E().semestre;
    var clave = texto(id) || s.activo;
    if (!clave) { return { ramos: [], notas: {} }; }
    if (!esObjeto(s.sem[clave])) { s.sem[clave] = { ramos: [], notas: {} }; }
    return s.sem[clave];
  }

  /* ------------------------------------------------------ 3. fechas y periodo */

  function anioHoy() { return Number(hoy().slice(0, 4)) || new Date().getFullYear(); }
  function mesHoy() { return Number(hoy().slice(5, 7)) - 1; }

  /* El periodo visible. `anio: 0` en el almacen significa "sin tocar": se pinta
     el ano y el mes de hoy, para que el primer arranque no abra en enero. */
  function periodo() {
    var c = E().calendario;
    return {
      vista: c.vista,
      anio: c.anio || anioHoy(),
      mes: c.anio ? c.mes : mesHoy()
    };
  }

  function periodoTexto() {
    var p = periodo();
    if (p.vista === 'anio') { return String(p.anio); }
    if (p.vista === 'sem') {
      var sem = semActivo();
      return sem ? (texto(sem.nombre) || 'Semestre') : 'Sin semestre';
    }
    return MESES_LARGOS[p.mes] + ' ' + p.anio;
  }

  function fijarVista(v) {
    var c = E().calendario;
    c.vista = VISTAS.indexOf(v) >= 0 ? v : 'sem';
    guardar();
    return c.vista;
  }

  function vista() { return E().calendario.vista; }

  function navPeriodo(delta) {
    var d = numero(delta, 0) < 0 ? -1 : 1;
    var c = E().calendario;
    var p = periodo();
    if (p.vista === 'anio') {
      c.anio = p.anio + d;
      c.mes = p.mes;
    } else if (p.vista === 'sem') {
      var s = E().semestre;
      if (s.extras.length > 1) {
        var i = 0, k;
        for (k = 0; k < s.extras.length; k++) {
          if (s.extras[k].id === s.activo) { i = k; }
        }
        s.activo = s.extras[(i + d + s.extras.length) % s.extras.length].id;
      }
    } else {
      var mes = p.mes + d, anio = p.anio;
      if (mes < 0) { mes = 11; anio--; }
      if (mes > 11) { mes = 0; anio++; }
      c.anio = anio;
      c.mes = mes;
    }
    guardar();
    return periodo();
  }

  function irHoy() {
    var c = E().calendario;
    c.anio = 0;
    c.mes = 0;
    guardar();
    return periodo();
  }

  /* Las celdas de un mes, de lunes a domingo. Los huecos van como null para que
     la rejilla empiece en el dia de la semana correcto. */
  function grillaMes(anio, mes) {
    anio = Math.round(numero(anio, anioHoy()));
    mes = Math.round(acota(numero(mes, 0), 0, 11));
    var primero = new Date(anio, mes, 1);
    var desplazamiento = (primero.getDay() + 6) % 7;
    var dias = new Date(anio, mes + 1, 0).getDate();
    var celdas = [], i;
    for (i = 0; i < desplazamiento; i++) { celdas.push(null); }
    for (i = 1; i <= dias; i++) { celdas.push(aISO(new Date(anio, mes, i))); }
    return celdas;
  }

  /* --------------------------------------------------------- 4. eventos */

  function horaValida(v) {
    var s = texto(v);
    var m = /^(\d{1,2}):(\d{2})$/.exec(s);
    if (!m) { return ''; }
    var h = Math.round(numero(m[1], 0)), min = Math.round(numero(m[2], 0));
    if (h < 0 || h > 23 || min < 0 || min > 59) { return ''; }
    return dos(h) + ':' + dos(min);
  }

  function evento(x) {
    if (!esObjeto(x)) { return null; }
    var id = texto(x.id);
    var fecha = texto(x.fecha);
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { return null; }
    return {
      id: id,
      fecha: fecha,
      hora: horaValida(x.hora),
      texto: texto(x.texto),
      detalle: texto(x.detalle),
      ramo: texto(x.ramo).toUpperCase(),
      tipo: texto(x.tipo).toLowerCase() || 'tarea',
      duracion: Math.max(0, numero(x.duracion, 0)),
      origen: texto(x.origen) || 'calendario'
    };
  }

  function todosEventos() {
    var c = E().calendario, out = [];
    for (var i = 0; i < c.nuevas.length; i++) {
      var e = evento(c.nuevas[i]);
      if (e) { out.push(e); }
    }
    return out;
  }

  function tipos() {
    var c = E().calendario, out = {}, k;
    for (k in TIPOS) {
      if (Object.prototype.hasOwnProperty.call(TIPOS, k)) { out[k] = TIPOS[k]; }
    }
    for (k in c.tipos) {
      if (Object.prototype.hasOwnProperty.call(c.tipos, k)) {
        out[k] = texto(c.tipos[k]) || out[k] || k;
      }
    }
    return out;
  }

  /* Los ramos del semestre. La lista es la que el semestre declara; si no
     declara ninguna, se usan los ramos en curso de la malla. Cada codigo se
     RESUELVE contra el catalogo T004 (`ramoNuevo`): asi el cuadre es el de la
     malla y no se cuela un ramo que el catalogo no conozca. Un codigo huerfano
     no se inventa: se queda fuera, y el evento que lo use no se pinta. */
  function ramos() {
    var M = comun(), out = [], cods = [], i, r, lista;
    if (!M || typeof M.ramosDeSem !== 'function') { return out; }
    var s = semActivo();
    if (s) { cods = datosDeSemestre(s.id).ramos || []; }
    if (!cods.length) {
      lista = M.ramosDeSem() || [];
      for (i = 0; i < lista.length; i++) { cods.push(texto(lista[i].codigo)); }
    }
    for (i = 0; i < cods.length; i++) {
      r = (typeof M.ramoNuevo === 'function') ? M.ramoNuevo(cods[i]) : null;
      if (!r || !r.codigo) { continue; }
      out.push({
        codigo: texto(r.codigo).toUpperCase(),
        nombre: texto(r.nombre) || texto(r.codigo),
        creditos: numero(r.creditos, 0),
        nivel: numero(r.nivel, 99),
        color: colorDe(r.codigo)
      });
    }
    return out;
  }

  function colorDe(cod) {
    var E2 = estudio();
    if (E2 && typeof E2.colorDe === 'function') { return E2.colorDe(cod); }
    var s = texto(cod).toUpperCase(), h = 0;
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 997; }
    return PALETA[h % PALETA.length];
  }

  function eventoPorId(id) {
    var k = texto(id), lista = todosEventos();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === k) { return lista[i]; }
    }
    return null;
  }

  function resetFiltros() {
    var rs = ramos(), ts = tipos(), i, k;
    _filtro.ramos = {};
    _filtro.tipos = {};
    for (i = 0; i < rs.length; i++) { _filtro.ramos[rs[i].codigo] = true; }
    for (k in ts) { if (Object.prototype.hasOwnProperty.call(ts, k)) { _filtro.tipos[k] = true; } }
    _filtro.activo = true;
    return filtros();
  }

  function filtros() {
    return { activo: _filtro.activo, ramos: copia(_filtro.ramos), tipos: copia(_filtro.tipos) };
  }

  /* Un filtro se enciende y se apaga de uno en uno: es lo que hacen los botones
     de la barra. El estado vive en memoria y no en el almacen: un filtro es una
     lente para mirar, no un dato del calendario. */
  function alternarRamo(cod) {
    var k = texto(cod).toUpperCase();
    if (!k) { return false; }
    _filtro.ramos[k] = !_filtro.ramos[k];
    return !!_filtro.ramos[k];
  }

  function alternarTipo(t) {
    var k = texto(t).toLowerCase();
    if (!k) { return false; }
    _filtro.tipos[k] = !_filtro.tipos[k];
    return !!_filtro.tipos[k];
  }

  function pasaFiltro(e) {
    if (!_filtro.activo) { return true; }
    if (e.ramo && !_filtro.ramos[e.ramo]) { return false; }
    return !!_filtro.tipos[e.tipo];
  }

  function eventosDelDia(fecha) {
    var f = texto(fecha), out = [], lista = todosEventos();
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].fecha === f && pasaFiltro(lista[i])) { out.push(lista[i]); }
    }
    return out;
  }

  function ordenEventos(a, b) {
    var pa = RANGO[prioridad(a.id)];
    var pb = RANGO[prioridad(b.id)];
    pa = pa === undefined ? 3 : pa;
    pb = pb === undefined ? 3 : pb;
    if (pa !== pb) { return pa - pb; }
    if (a.hora !== b.hora) { return a.hora < b.hora ? -1 : 1; }
    return a.texto.localeCompare(b.texto);
  }

  function notaDe(id) {
    var n = E().calendario.notas_evento[texto(id)];
    return (n === undefined || n === null || n === '' || !isFinite(Number(n))) ? null : Number(n);
  }

  function prioridad(id) {
    var p = E().calendario.prioridades[texto(id)];
    return p === 'alta' || p === 'media' || p === 'baja' ? p : '';
  }

  function chipsDe(dia) {
    var lista = eventosDelDia(dia);
    lista.sort(ordenEventos);
    var ts = tipos(), out = [];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      out.push({
        id: e.id,
        fecha: e.fecha,
        texto: e.texto,
        hora: e.hora,
        tipo: e.tipo,
        tipoNombre: ts[e.tipo] || e.tipo,
        ramo: e.ramo,
        color: colorDe(e.ramo),
        hecha: !!E().calendario.hechas[e.id],
        prioridad: prioridad(e.id),
        nota: notaDe(e.id)
      });
    }
    return out;
  }

  function nuevoId(prefijo) {
    _contador++;
    return prefijo + Date.now() + _contador;
  }

  function nuevaEvento(parcial) {
    var p = esObjeto(parcial) ? parcial : {};
    var c = E().calendario;
    var ev = {
      id: nuevoId('n'),
      fecha: texto(p.fecha) || hoy(),
      hora: horaValida(p.hora),
      texto: texto(p.texto),
      detalle: texto(p.detalle),
      ramo: texto(p.ramo).toUpperCase(),
      tipo: texto(p.tipo) || 'tarea',
      duracion: Math.max(0, numero(p.duracion, 0)),
      origen: 'calendario'
    };
    c.nuevas.push(ev);
    guardar('Evento nuevo');
    return copia(ev);
  }

  /* Alta o edicion: si el id existe se actualiza EN SU SITIO; si no, se anade.
     Un campo que llega `undefined` no se toca; el que llega vacio se vacia. */
  function guardarEvento(ev) {
    ev = esObjeto(ev) ? ev : {};
    var c = E().calendario;
    var id = texto(ev.id) || nuevoId('n');
    var i, base = null;
    for (i = 0; i < c.nuevas.length; i++) {
      if (c.nuevas[i] && c.nuevas[i].id === id) { base = c.nuevas[i]; break; }
    }
    if (!base) {
      base = { id: id, fecha: hoy(), hora: '', texto: '', detalle: '',
               ramo: '', tipo: 'tarea', duracion: 0, origen: 'calendario' };
      c.nuevas.push(base);
    }
    if (ev.fecha !== undefined) { base.fecha = texto(ev.fecha) || base.fecha; }
    if (ev.hora !== undefined) { base.hora = horaValida(ev.hora); }
    if (ev.texto !== undefined) { base.texto = texto(ev.texto); }
    if (ev.detalle !== undefined) { base.detalle = texto(ev.detalle); }
    if (ev.ramo !== undefined) { base.ramo = texto(ev.ramo).toUpperCase(); }
    if (ev.tipo !== undefined) { base.tipo = texto(ev.tipo).toLowerCase() || 'tarea'; }
    if (ev.duracion !== undefined) { base.duracion = Math.max(0, numero(ev.duracion, 0)); }
    if (ev.origen !== undefined) { base.origen = texto(ev.origen) || 'calendario'; }
    if (ev.nota !== undefined) {
      if (ev.nota === null || ev.nota === '') { delete c.notas_evento[id]; }
      else { c.notas_evento[id] = acota(numero(ev.nota, 0), 1, 7); }
    }
    guardar('Evento guardado');
    return copia(evento(base));
  }

  function borrarEvento(id) {
    var k = texto(id), c = E().calendario, i, habia = false;
    for (i = 0; i < c.nuevas.length; i++) {
      if (c.nuevas[i] && c.nuevas[i].id === k) { c.nuevas.splice(i, 1); habia = true; break; }
    }
    delete c.hechas[k];
    delete c.prioridades[k];
    delete c.notas_evento[k];
    delete c.fichas[k];
    if (habia) { guardar('Evento borrado'); }
    return habia;
  }

  function marcar(id) {
    var k = texto(id), c = E().calendario;
    if (!k) { return false; }
    if (c.hechas[k]) { delete c.hechas[k]; } else { c.hechas[k] = true; }
    guardar();
    return !!c.hechas[k];
  }

  function ponerNota(id, n) {
    var k = texto(id), c = E().calendario;
    if (!k) { return null; }
    if (n === null || n === '' || n === undefined) { delete c.notas_evento[k]; }
    else { c.notas_evento[k] = acota(numero(n, 0), 1, 7); }
    guardar();
    return notaDe(k);
  }

  /* ------------------------------------------------ 5. marcas y estudio */

  function marcaSemestreDe(fecha) {
    var f = texto(fecha);
    if (!f) { return null; }
    var sem = semActivo();
    if (!sem || !(sem.semanas instanceof Array)) { return null; }
    for (var i = 0; i < sem.semanas.length; i++) {
      var w = sem.semanas[i];
      if (f >= w.lunes && f <= w.domingo) {
        return { tipo: w.tipo || 'clases', etiqueta: w.etiqueta || '' };
      }
    }
    return null;
  }

  function horasSemana(lunes) {
    var E2 = estudio();
    if (E2 && typeof E2.horasSemana === 'function') { return numero(E2.horasSemana(lunes), 0); }
    return 0;
  }

  function objetivoSemanal() {
    var E2 = estudio();
    var propio = E2 && typeof E2.objetivoSemanal === 'function'
      ? numero(E2.objetivoSemanal(), 0) : 0;
    return propio > 0 ? propio : metaSemanal();
  }

  function totalSemestre() {
    var E2 = estudio();
    return E2 && typeof E2.totalHoras === 'function' ? numero(E2.totalHoras(), 0) : 0;
  }

  function fmtMin(min) {
    var m = Math.round(numero(min, 0));
    if (m <= 0) { return '0h'; }
    var h = Math.floor(m / 60), r = m % 60;
    return (h ? h + 'h' : '') + (h && r ? ' ' : '') + (r ? r + 'm' : '');
  }

  /* El reparto por ramo de la semana: el ancho de la barra dice cuanto se
     estudio frente a la semana mas cargada del semestre y los tramos son los
     ramos. El gris es lo registrado sin ramo (OTROS). */
  function barraSemana(lunes) {
    var E2 = estudio();
    var m = (E2 && typeof E2.minutosDe === 'function') ? E2.minutosDe(lunes) : {};
    var rs = ramos(), seg = [], total = 0, i;
    for (i = 0; i < rs.length; i++) {
      var v = Math.max(0, numero(m[rs[i].codigo], 0));
      total += v;
      if (v > 0) { seg.push({ codigo: rs[i].codigo, minutos: v, color: rs[i].color }); }
    }
    var otros = Math.max(0, numero(m.OTROS, 0));
    if (otros > 0) {
      total += otros;
      seg.push({ codigo: 'OTROS', minutos: otros, color: 'var(--muted)' });
    }
    var tope = 1;
    var sem = semActivo();
    if (sem && sem.semanas instanceof Array) {
      for (i = 0; i < sem.semanas.length; i++) {
        var t = horasSemana(sem.semanas[i].lunes) * 60;
        if (t > tope) { tope = t; }
      }
    }
    for (i = 0; i < seg.length; i++) { seg[i].pct = total ? (seg[i].minutos / total * 100) : 0; }
    return { minutos: total, tope: tope, pct: Math.max(8, total / tope * 100), seg: seg };
  }

  function kpis() {
    var c = E().calendario, lista = todosEventos(), h = hoy(), i;
    var proximo = null;
    var pendientes = 0, altas = 0;
    for (i = 0; i < lista.length; i++) {
      var e = lista[i];
      if (c.hechas[e.id]) { continue; }
      if (e.fecha < h) { continue; }
      pendientes++;
      if (c.prioridades[e.id] === 'alta') { altas++; }
    }
    var controles = [];
    for (i = 0; i < lista.length; i++) {
      if (lista[i].tipo === 'control' && !c.hechas[lista[i].id] && lista[i].fecha >= h) {
        controles.push(lista[i]);
      }
    }
    controles.sort(function (a, b) { return a.fecha < b.fecha ? -1 : (a.fecha > b.fecha ? 1 : 0); });
    if (controles.length) { proximo = controles[0]; }
    return {
      horasSemana: horasSemana(lunesDe(h)),
      objetivo: objetivoSemanal(),
      proximo: proximo ? { id: proximo.id, fecha: proximo.fecha, texto: proximo.texto } : null,
      pendientes: pendientes,
      altas: altas,
      totalSemestre: totalSemestre()
    };
  }

  /* ------------------------------------------------------------- 6. iCal */

  function icalFecha(fecha, hora) {
    var d = aFecha(fecha);
    var base = String(d.getFullYear()) + dos(d.getMonth() + 1) + dos(d.getDate());
    if (!hora) { return base; }
    return base + 'T' + texto(hora).slice(0, 2) + (texto(hora).slice(3, 5) || '00') + '00';
  }

  function icalTexto(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
      .replace(/,/g, '\\,').replace(/;/g, '\\;');
  }

  function exportarIcal() {
    var lista = todosEventos(), t = tipos();
    var lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mimo//Panel de semestre//ES',
                  'CALSCALE:GREGORIAN'];
    for (var i = 0; i < lista.length; i++) {
      var e = lista[i];
      var tipoNombre = t[e.tipo] ? ' (' + t[e.tipo] + ')' : '';
      var ramoNombre = e.ramo ? ' — ' + e.ramo : '';
      lineas.push('BEGIN:VEVENT');
      lineas.push('UID:' + e.id + '@mimo');
      lineas.push('DTSTAMP:' + icalFecha(hoy(), ''));
      if (e.hora) {
        lineas.push('DTSTART:' + icalFecha(e.fecha, e.hora));
        lineas.push('DURATION:PT' + Math.round((e.duracion > 0 ? e.duracion : 1) * 60) + 'M');
      } else {
        lineas.push('DTSTART;VALUE=DATE:' + icalFecha(e.fecha, ''));
      }
      lineas.push('SUMMARY:' + icalTexto(e.texto || 'Evento') + icalTexto(tipoNombre + ramoNombre));
      if (e.detalle) { lineas.push('DESCRIPTION:' + icalTexto(e.detalle)); }
      lineas.push('END:VEVENT');
    }
    lineas.push('END:VCALENDAR');
    return lineas.join('\r\n');
  }

  /* Lee un bloque VEVENT ya separado. Portado de `07-ical.js:66`: desdobla las
     lineas plegadas y resuelve DTSTART/DURATION/DTEND. Sin DOM. */
  function parsearVevent(bloque) {
    var e = { texto: '', fecha: null, hora: null, duracion: 0, detalle: '', dtstart: null };
    var desdoblado = String(bloque || '').replace(/\r?\n[ \t]/g, '');
    var lineas = desdoblado.split(/\r?\n/);
    for (var i = 0; i < lineas.length; i++) {
      var l = lineas[i];
      var j = l.indexOf(':');
      if (j < 0) { continue; }
      var campo = l.slice(0, j).split(';')[0].toUpperCase();
      var val = l.slice(j + 1)
        .replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
      if (campo === 'SUMMARY') { e.texto = val; }
      else if (campo === 'DESCRIPTION') { e.detalle = val; }
      else if (campo === 'DTSTART') { e.dtstart = val; }
      else if (campo === 'DTEND') { e.dtend = val; }
      else if (campo === 'DURATION') {
        var mh = /(\d+)H/.exec(val), mm = /(\d+)M/.exec(val);
        var total = (mh ? Number(mh[1]) * 60 : 0) + (mm ? Number(mm[1]) : 0);
        e.duracion = Math.round(total / 60 * 10) / 10;
      }
    }
    if (e.dtstart) {
      var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/.exec(e.dtstart.replace(/[^\dT]/g, ''));
      if (m) {
        e.fecha = m[1] + '-' + m[2] + '-' + m[3];
        if (m[4]) { e.hora = m[4] + ':' + m[5]; }
      }
    }
    if (!e.duracion && e.dtend && e.dtstart && e.hora) {
      var me = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/.exec(e.dtend.replace(/[^\dT]/g, ''));
      if (me && me[4]) {
        var ms = (new Date(me[1] + '-' + me[2] + '-' + me[3] + 'T' + me[4] + ':' + me[5] + ':00')) -
                 (new Date(e.fecha + 'T' + e.hora + ':00'));
        if (ms > 0) { e.duracion = Math.round(ms / 3600000 * 10) / 10; }
      }
    }
    return e.fecha ? e : null;
  }

  /* Importar NO toca el DOM: recibe el texto y anade. Devuelve lo que anadio,
     para que la vista (o un instrumento) pueda comprobarlo sin releer el disco. */
  function importarIcal(fuente) {
    var t = String(fuente === null || fuente === undefined ? '' : fuente);
    var bloques = t.split('BEGIN:VEVENT').slice(1);
    var c = E().calendario, n = 0, out = [];
    for (var i = 0; i < bloques.length; i++) {
      var ev = parsearVevent(bloques[i]);
      if (!ev) { continue; }
      var reg = {
        id: nuevoId('ical'),
        fecha: ev.fecha,
        hora: horaValida(ev.hora),
        texto: ev.texto || '(sin título)',
        detalle: ev.detalle || '',
        ramo: '',
        tipo: 'tarea',
        duracion: numero(ev.duracion, 0),
        origen: 'ical'
      };
      c.nuevas.push(reg);
      out.push(copia(evento(reg)));
      n++;
    }
    if (n) { guardar('Importados ' + n + ' eventos del calendario'); }
    return { n: n, eventos: out };
  }

  return {
    /* constantes utiles para la vista y para los instrumentos */
    MESES_LARGOS: MESES_LARGOS,
    DIAS_CORTOS: DIAS_CORTOS,
    TIPOS: TIPOS,
    VISTAS: VISTAS,
    /* semestre */
    semestres: semestres,
    semActivo: semActivo,
    semEsEditable: semEsEditable,
    crearSemestre: crearSemestre,
    editarSemestre: editarSemestre,
    borrarSemestre: borrarSemestre,
    cambiarSemestre: cambiarSemestre,
    semanasDe: semanasDe,
    metaSemanal: metaSemanal,
    datosDeSemestre: datosDeSemestre,
    /* fechas y periodo */
    hoy: hoy,
    lunesDe: lunesDe,
    periodo: periodo,
    periodoTexto: periodoTexto,
    vista: vista,
    fijarVista: fijarVista,
    navPeriodo: navPeriodo,
    irHoy: irHoy,
    grillaMes: grillaMes,
    /* eventos */
    todosEventos: todosEventos,
    eventosDelDia: eventosDelDia,
    eventoPorId: eventoPorId,
    nuevaEvento: nuevaEvento,
    guardarEvento: guardarEvento,
    borrarEvento: borrarEvento,
    marcar: marcar,
    notaDe: notaDe,
    ponerNota: ponerNota,
    prioridad: prioridad,
    resetFiltros: resetFiltros,
    filtros: filtros,
    alternarRamo: alternarRamo,
    alternarTipo: alternarTipo,
    chipsDe: chipsDe,
    tipos: tipos,
    ramos: ramos,
    /* semestre, marcas y estudio */
    marcaSemestreDe: marcaSemestreDe,
    horasSemana: horasSemana,
    objetivoSemanal: objetivoSemanal,
    totalSemestre: totalSemestre,
    barraSemana: barraSemana,
    fmtMin: fmtMin,
    kpis: kpis,
    /* iCal */
    exportarIcal: exportarIcal,
    importarIcal: importarIcal
  };
})();

/* ============================================================================
   LA VISTA
   ============================================================================ */
var MimoCalendarioUI = (function () {
  'use strict';

  var D = (typeof document !== 'undefined') ? document : null;
  var M = MimoCalendarioMotor;
  var iniciado = false;
  var editando = null;        // id del evento abierto en el editor
  var panel = false;          // el panel de semestres esta abierto
  var semEditando = null;     // id del semestre precargado en el formulario

  function caja() { return D ? D.querySelector('[data-calendario="bloque"]') : null; }
  function esc(t) {
    if (typeof MimoComun !== 'undefined' && MimoComun && typeof MimoComun.esc === 'function') {
      return MimoComun.esc(t);
    }
    return String(t === null || t === undefined ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ver1(n) {
    if (typeof MimoComun !== 'undefined' && MimoComun && typeof MimoComun.ver1 === 'function') {
      return MimoComun.ver1(n);
    }
    return String(n);
  }
  function subirA(nodo, sel) {
    while (nodo && nodo !== D) {
      if (nodo.nodeType === 1 && nodo.matches && nodo.matches(sel)) { return nodo; }
      nodo = nodo.parentNode;
    }
    return null;
  }
  function dentroDeCalendario(nodo) {
    return !!subirA(nodo, '[data-calendario="bloque"]');
  }

  /* ------------------------------------------------------------ piezas */

  function kpiHtml(cifra, rotulo) {
    return '<div class="kpi"><b class="kpi__cifra">' + esc(cifra) + '</b>' +
      '<span class="kpi__rot">' + esc(rotulo) + '</span></div>';
  }

  function chipHtml(ch) {
    var clase = 'cal__chip' + (ch.hecha ? ' cal__chip--hecha' : '') +
      (ch.ramo ? ' cal__chip--ramo' : ' cal__chip--personal');
    var pri = ch.prioridad
      ? '<span class="cal__pri cal__pri--' + esc(ch.prioridad) + '">' +
        (ch.prioridad === 'alta' ? 'A' : ch.prioridad === 'media' ? 'M' : 'B') + '</span>'
      : '';
    var nota = ch.nota === null ? ''
      : '<span class="cal__chip-nota">' + esc(ver1(ch.nota)) + '</span>';
    return '<div class="' + clase + '" data-id="' + esc(ch.id) + '"' +
      ' data-ramo="' + esc(ch.ramo) + '" data-tipo="' + esc(ch.tipo) + '"' +
      ' data-hecha="' + (ch.hecha ? '1' : '0') + '"' +
      ' style="border-left-color:' + ch.color + '"' +
      ' title="' + esc(ch.texto + (ch.hora ? ' · ' + ch.hora : '')) + '">' +
      pri +
      '<span class="cal__chip-txt">' + esc(ch.texto || '(sin título)') + '</span>' +
      (ch.hora ? '<span class="cal__chip-hora">' + esc(ch.hora) + '</span>' : '') +
      nota +
      '</div>';
  }

  function barraHtml(barra) {
    if (!barra.minutos) { return ''; }
    var seg = '';
    for (var i = 0; i < barra.seg.length; i++) {
      seg += '<i style="width:' + barra.seg[i].pct.toFixed(1) + '%;background:' +
        barra.seg[i].color + '"></i>';
    }
    return '<div class="cal__barra" style="width:' + barra.pct.toFixed(1) + '%">' + seg + '</div>';
  }

  function kpisHtml() {
    var k = M.kpis();
    var horas = M.fmtMin(Math.round(k.horasSemana * 60));
    var objetivo = k.objetivo > 0 ? 'objetivo ' + M.fmtMin(Math.round(k.objetivo * 60)) : 'sin meta';
    var prox = k.proximo
      ? k.proximo.fecha.slice(8, 10) + ' ' +
        M.MESES_LARGOS[Number(k.proximo.fecha.slice(5, 7)) - 1].slice(0, 3) + ' · ' +
        (k.proximo.texto || 'Control')
      : '—';
    return kpiHtml(horas, 'esta semana · ' + objetivo) +
      kpiHtml(prox, k.proximo ? 'próximo control' : 'sin controles pendientes') +
      kpiHtml(String(k.pendientes) + (k.altas ? ' (' + k.altas + ')' : ''),
              'tareas por hacer' + (k.altas ? ' · ' + k.altas + ' de prioridad alta' : '')) +
      kpiHtml(M.fmtMin(Math.round(k.totalSemestre * 60)), 'estudio registrado en el semestre');
  }

  /* Los filtros: un boton por ramo y otro por tipo. Solo cambian la lente de la
     tabla y de la rejilla; el evento sigue en el almacen. */
  function filtrosHtml() {
    var f = M.filtros(), rs = M.ramos(), ts = M.tipos(), html = '', i, k;
    html += '<span class="cal__filtros-rot">Filtros</span>';
    for (i = 0; i < rs.length; i++) {
      html += '<button class="cal__filtro" type="button" data-filtro-ramo="' +
        esc(rs[i].codigo) + '" aria-pressed="' + (f.ramos[rs[i].codigo] ? 'true' : 'false') +
        '">' + esc(rs[i].codigo) + '</button>';
    }
    for (k in ts) {
      if (!Object.prototype.hasOwnProperty.call(ts, k)) { continue; }
      html += '<button class="cal__filtro" type="button" data-filtro-tipo="' + esc(k) +
        '" aria-pressed="' + (f.tipos[k] ? 'true' : 'false') + '">' + esc(ts[k]) + '</button>';
    }
    return '<div class="cal__filtros">' + html + '</div>';
  }

  function controlesHtml() {
    var p = M.periodo();
    var boton = function (v, rot) {
      return '<button class="cal__vista" type="button" data-vista="' + v + '"' +
        ' aria-pressed="' + (p.vista === v ? 'true' : 'false') + '">' + rot + '</button>';
    };
    return '<div class="cal__barra-controles">' +
      '<div class="cal__nav">' +
        '<button class="btn btn--mini" type="button" data-accion="anterior"' +
          ' aria-label="Período anterior">‹</button>' +
        '<span class="cal__periodo" data-calendario="periodo">' + esc(M.periodoTexto()) + '</span>' +
        '<button class="btn btn--mini" type="button" data-accion="siguiente"' +
          ' aria-label="Período siguiente">›</button>' +
        '<button class="btn btn--mini" type="button" data-accion="hoy">Hoy</button>' +
      '</div>' +
      '<div class="cal__vistas">' + boton('mes', 'Mes') + boton('anio', 'Año') +
        boton('sem', 'Semestre') + '</div>' +
      filtrosHtml() +
      '<div class="cal__acciones">' +
        '<button class="btn btn--mini btn--primario" type="button" data-accion="nuevo">' +
          'Nuevo evento</button>' +
        '<button class="btn btn--mini" type="button" data-accion="semestres">Semestres</button>' +
        '<button class="btn btn--mini" type="button" data-accion="exportar">Exportar .ics</button>' +
        '<button class="btn btn--mini" type="button" data-accion="importar">Importar .ics</button>' +
        '<input class="cal__fichero" type="file" accept=".ics,text/calendar"' +
          ' data-calendario="ics" aria-label="Fichero .ics para importar">' +
      '</div>' +
    '</div>';
  }

  function tablaSemanalHtml() {
    var sem = M.semActivo();
    if (!sem) {
      return '<div class="cal__vacio" data-calendario="vacio">' +
        '<p class="cal__pista">Todavía no hay ningún semestre. Crea uno con sus semanas y la ' +
        'tabla semanal aparece aquí; los eventos se pueden apuntar igual, sin semestre.</p>' +
        '<button class="btn btn--mini btn--primario" type="button" data-accion="semestres">' +
          'Crear un semestre</button></div>';
    }
    var h = M.hoy(), semanas = M.semanasDe(sem);
    var cabecera = '<tr><th class="cal__th">Semana</th>';
    for (var d = 0; d < 7; d++) { cabecera += '<th class="cal__th">' + M.DIAS_CORTOS[d] + '</th>'; }
    cabecera += '<th class="cal__th">Estudio</th></tr>';
    var filas = '';
    for (var i = 0; i < semanas.length; i++) {
      var w = semanas[i], dias = [], k;
      for (k = 0; k < 7; k++) { dias.push(MimoComun.sumaDias(w.lunes, k)); }
      var actual = dias.indexOf(h) >= 0;
      var pasada = dias[6] < h;
      var celdas = '';
      for (k = 0; k < 7; k++) {
        var chips = M.chipsDe(dias[k]);
        var html = '';
        for (var c = 0; c < chips.length; c++) { html += chipHtml(chips[c]); }
        celdas += '<td class="cal__dia" data-fecha="' + dias[k] + '">' + html + '</td>';
      }
      var horas = M.horasSemana(w.lunes);
      var meta = M.objetivoSemanal();
      var barra = M.barraSemana(w.lunes);
      var estadoMeta = meta > 0 ? (horas >= meta ? 'meta cumplida' : 'bajo la meta') : 'sin meta';
      var etiqueta = w.etiqueta || ('S' + (i + 1));
      filas += '<tr class="cal__fila' + (actual ? ' cal__fila--actual' : '') +
        (pasada ? ' cal__fila--pasada' : '') + '" data-semana="' + esc(etiqueta) +
        '" data-tipo="' + esc(w.tipo || 'clases') + '">' +
        '<th class="cal__semana" scope="row"><b>' + esc(etiqueta) + '</b>' +
          '<span class="cal__rango">' + esc(MimoComun.rangoSemana(w.lunes)) + '</span></th>' +
        celdas +
        '<td class="cal__est" data-horas="' + horas + '"><b class="cal__est-cifra">' +
          esc(M.fmtMin(Math.round(horas * 60))) + '</b>' +
          '<span class="cal__est-meta">' + esc(estadoMeta) + '</span>' +
          barraHtml(barra) + '</td></tr>';
    }
    return '<div class="cal__semana-caja" data-calendario="semana">' +
      '<table class="cal__tabla"><thead>' + cabecera + '</thead>' +
      '<tbody data-calendario="cuerpo">' + filas + '</tbody></table></div>';
  }

  function celdaMesHtml(iso) {
    if (!iso) { return '<div class="cal__celda cal__celda--fuera" aria-hidden="true"></div>'; }
    var chips = M.chipsDe(iso), marca = M.marcaSemestreDe(iso), html = '';
    for (var i = 0; i < chips.length; i++) { html += chipHtml(chips[i]); }
    return '<div class="cal__celda' + (iso === M.hoy() ? ' cal__celda--hoy' : '') +
      (marca ? ' cal__celda--' + esc(marca.tipo) : '') + '" data-fecha="' + iso + '"' +
      (marca ? ' data-marca="' + esc(marca.tipo) + '"' : '') + '>' +
      '<span class="cal__num">' + Number(iso.slice(8, 10)) + '</span>' +
      (marca ? '<span class="cal__marca">' + esc(marca.etiqueta) + '</span>' : '') +
      html + '</div>';
  }

  function mesHtml(anio, mes) {
    var celdas = M.grillaMes(anio, mes), html = '', i;
    for (i = 0; i < celdas.length; i++) { html += celdaMesHtml(celdas[i]); }
    var cab = '';
    for (i = 0; i < 7; i++) { cab += '<span class="cal__cab-dia">' + M.DIAS_CORTOS[i] + '</span>'; }
    return '<div class="cal__mes" data-calendario="mes" data-anio="' + anio + '" data-mes="' + mes + '">' +
      '<div class="cal__mes-cab">' + cab + '</div>' +
      '<div class="cal__rejilla-mes">' + html + '</div></div>';
  }

  function minimesHtml(anio, mes) {
    var celdas = M.grillaMes(anio, mes), html = '', i;
    for (i = 0; i < celdas.length; i++) {
      if (!celdas[i]) { html += '<span class="cal__minid cal__minid--fuera"></span>'; continue; }
      var marca = M.marcaSemestreDe(celdas[i]);
      html += '<span class="cal__minid' + (celdas[i] === M.hoy() ? ' cal__minid--hoy' : '') +
        (marca ? ' cal__minid--' + esc(marca.tipo) : '') + '" data-fecha="' + celdas[i] + '">' +
        Number(celdas[i].slice(8, 10)) + '</span>';
    }
    return '<div class="cal__minimes" data-mes="' + mes + '">' +
      '<p class="cal__minimes-tit">' + M.MESES_LARGOS[mes] + '</p>' +
      '<div class="cal__minimes-rej">' + html + '</div></div>';
  }

  function anioHtml(anio) {
    var html = '';
    for (var m = 0; m < 12; m++) { html += minimesHtml(anio, m); }
    return '<div class="cal__anio" data-calendario="anio" data-anio="' + anio + '">' + html + '</div>';
  }

  function editorHtml() {
    var ev = editando ? M.eventoPorId(editando) : null;
    if (!ev) { return ''; }
    var ts = M.tipos(), rs = M.ramos(), i;
    var opcionesTipo = '';
    for (var k in ts) {
      if (!Object.prototype.hasOwnProperty.call(ts, k)) { continue; }
      opcionesTipo += '<option value="' + esc(k) + '"' +
        (ev.tipo === k ? ' selected' : '') + '>' + esc(ts[k]) + '</option>';
    }
    var opcionesRamo = '<option value="">Sin ramo</option>';
    for (i = 0; i < rs.length; i++) {
      opcionesRamo += '<option value="' + esc(rs[i].codigo) + '"' +
        (ev.ramo === rs[i].codigo ? ' selected' : '') + '>' +
        esc(rs[i].codigo + ' · ' + rs[i].nombre) + '</option>';
    }
    var nota = M.notaDe(ev.id);
    return '<form class="cal__editor" data-calendario="editor" data-id="' + esc(ev.id) + '">' +
      '<h3 class="cal__tit">' + (ev.texto ? 'Editar evento' : 'Evento nuevo') + '</h3>' +
      '<div class="cal__rejilla">' +
        '<label class="cal__campo cal__campo--ancho"><span class="cal__rot">Nombre</span>' +
          '<input class="cal__entrada" type="text" data-evento="texto" maxlength="120"' +
          ' value="' + esc(ev.texto) + '" placeholder="Ej: Control 1 de Álgebra"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Fecha</span>' +
          '<input class="cal__entrada" type="date" data-evento="fecha" value="' + esc(ev.fecha) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Hora</span>' +
          '<input class="cal__entrada" type="time" data-evento="hora" value="' + esc(ev.hora) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Duración (h)</span>' +
          '<input class="cal__entrada" type="number" data-evento="duracion" min="0" max="12"' +
          ' step="0.5" value="' + esc(ev.duracion || 0) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Tipo</span>' +
          '<select class="cal__entrada" data-evento="tipo">' + opcionesTipo + '</select></label>' +
        '<label class="cal__campo"><span class="cal__rot">Ramo (opcional)</span>' +
          '<select class="cal__entrada" data-evento="ramo">' + opcionesRamo + '</select></label>' +
        '<label class="cal__campo"><span class="cal__rot">Nota de este evento (1,0 a 7,0)</span>' +
          '<input class="cal__entrada" type="number" data-evento="nota" min="1" max="7"' +
          ' step="0.1" value="' + (nota === null ? '' : nota) + '"></label>' +
        '<label class="cal__campo cal__campo--ancho"><span class="cal__rot">Detalle</span>' +
          '<textarea class="cal__entrada cal__texto" data-evento="detalle" rows="2">' +
          esc(ev.detalle) + '</textarea></label>' +
      '</div>' +
      '<p class="cal__pista">Si el evento lleva ramo y nota, la nota se ve en su tarjeta del ' +
      'calendario y queda enlazada al ramo. El vínculo es opcional.</p>' +
      '<div class="cal__acciones">' +
        '<button class="btn btn--mini btn--primario" type="button" data-accion="guardar-evento">' +
          'Guardar evento</button>' +
        '<button class="btn btn--mini" type="button" data-accion="borrar-evento">Borrar</button>' +
        '<button class="btn btn--mini" type="button" data-accion="cerrar-editor">Cancelar</button>' +
      '</div>' +
    '</form>';
  }

  function semestresHtml() {
    var lista = M.semestres(), activo = M.semActivo();
    var html = '';
    for (var i = 0; i < lista.length; i++) {
      var s = lista[i];
      var esActivo = !!(activo && activo.id === s.id);
      html += '<li class="cal__sem' + (esActivo ? ' cal__sem--activo' : '') + '" data-id="' + esc(s.id) + '">' +
        '<b class="cal__sem-nombre">' + esc(s.nombre) + '</b>' +
        '<span class="cal__sem-datos">' + (s.semanas ? s.semanas.length : 0) + ' semanas · ' +
          s.clases + ' de clases' + (esActivo ? ' · activo' : '') + '</span>' +
        '<span class="cal__sem-acciones">' +
          '<button class="btn btn--mini" type="button" data-accion="activar-semestre"' +
            ' data-id="' + esc(s.id) + '" aria-pressed="' + (esActivo ? 'true' : 'false') + '">Activar</button>' +
          '<button class="btn btn--mini" type="button" data-accion="editar-semestre"' +
            ' data-id="' + esc(s.id) + '">Editar</button>' +
          '<button class="btn btn--mini" type="button" data-accion="borrar-semestre"' +
            ' data-id="' + esc(s.id) + '">Borrar</button>' +
        '</span></li>';
    }
    if (!html) {
      html = '<li class="cal__sem"><span class="cal__pista">Ningún semestre todavía.</span></li>';
    }
    var ed = semEditando ? M.semActivo() : null;
    if (semEditando) {
      var ss = M.semestres();
      for (var j = 0; j < ss.length; j++) { if (ss[j].id === semEditando) { ed = ss[j]; } }
    }
    var nombre = ed ? ed.nombre : '';
    var inicio = ed ? ed.inicio : M.lunesDe(M.hoy());
    var clases = ed ? ed.clases : 15;
    var recesos = ed && ed.recesos ? ed.recesos.join(', ') : '';
    var examen = ed ? ed.examen : 0;
    return '<div class="cal__panel" data-calendario="semestres">' +
      '<h3 class="cal__tit">Semestres</h3>' +
      '<p class="cal__pista">Editar un semestre regenera sus semanas y conserva los ramos, ' +
      'las horas y los eventos: el calendario no borra lo que apuntaste.</p>' +
      '<ul class="cal__sem-lista">' + html + '</ul>' +
      '<form class="cal__rejilla" data-calendario="sem-form" data-id="' + esc(semEditando || '') + '">' +
        '<label class="cal__campo"><span class="cal__rot">Nombre</span>' +
          '<input class="cal__entrada" type="text" data-sem="nombre" value="' + esc(nombre) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Primer lunes de clases</span>' +
          '<input class="cal__entrada" type="date" data-sem="inicio" value="' + esc(inicio) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Semanas de clases</span>' +
          '<input class="cal__entrada" type="number" data-sem="clases" min="1" max="25" value="' +
          esc(clases) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Recesos tras las semanas (coma)</span>' +
          '<input class="cal__entrada" type="text" data-sem="recesos" value="' + esc(recesos) + '"></label>' +
        '<label class="cal__campo"><span class="cal__rot">Semanas de examen, al final</span>' +
          '<input class="cal__entrada" type="number" data-sem="examen" min="0" max="8" value="' +
          esc(examen) + '"></label>' +
        '<div class="cal__acciones cal__campo--ancho">' +
          '<button class="btn btn--mini btn--primario" type="button" data-accion="guardar-semestre">' +
            (semEditando ? 'Guardar cambios' : 'Crear semestre') + '</button>' +
          (semEditando ? '<button class="btn btn--mini" type="button" data-accion="nuevo-semestre">' +
            'Crear uno nuevo</button>' : '') +
          '<button class="btn btn--mini" type="button" data-accion="cerrar-semestres">Cerrar</button>' +
        '</div>' +
      '</form></div>';
  }

  function avisoHtml() {
    return '<p class="cal__aviso" data-calendario="aviso" role="status" aria-live="polite"></p>';
  }

  /* ----------------------------------------------------------- pintado */

  function pintar() {
    var c = caja();
    if (!c) { return; }
    if (!M.filtros().activo) { M.resetFiltros(); }
    var p = M.periodo();
    var cuerpo = '';
    if (p.vista === 'mes') { cuerpo = mesHtml(p.anio, p.mes); }
    else if (p.vista === 'anio') { cuerpo = anioHtml(p.anio); }
    else { cuerpo = tablaSemanalHtml(); }
    c.innerHTML =
      '<div class="cal__kpis">' + kpisHtml() + '</div>' +
      controlesHtml() +
      avisoHtml() +
      (panel ? semestresHtml() : '') +
      (editando ? editorHtml() : '') +
      cuerpo;
  }

  /* --------------------------------------------------------- acciones */

  function guardarAviso(t) {
    var c = caja();
    if (!c) { return; }
    var a = c.querySelector('[data-calendario="aviso"]');
    if (a) { a.textContent = t || ''; }
  }

  function abrirEditor(id) {
    editando = id;
    pintar();
    var c = caja();
    if (!c) { return; }
    var inp = c.querySelector('[data-evento="texto"]');
    if (inp) { inp.focus(); if (inp.select) { inp.select(); } }
  }

  function cerrarEditor() {
    var ev = editando ? M.eventoPorId(editando) : null;
    /* Cancelar un evento nuevo y vacio no deja basura: no hay nada que perder y
       un chip "(sin título)" en el calendario es ruido. */
    if (ev && !ev.texto && !ev.detalle && !ev.hora) { M.borrarEvento(ev.id); }
    editando = null;
    pintar();
  }

  function leerEditor() {
    var c = caja();
    if (!c) { return null; }
    var f = c.querySelector('[data-calendario="editor"]');
    if (!f) { return null; }
    function valor(campo) {
      var n = f.querySelector('[data-evento="' + campo + '"]');
      return n ? n.value : undefined;
    }
    return {
      id: f.getAttribute('data-id'),
      texto: valor('texto'),
      fecha: valor('fecha'),
      hora: valor('hora'),
      duracion: valor('duracion'),
      tipo: valor('tipo'),
      ramo: valor('ramo'),
      detalle: valor('detalle'),
      nota: valor('nota')
    };
  }

  function descargar(textoIcs) {
    if (!D || typeof URL === 'undefined' || typeof Blob === 'undefined') { return; }
    var a = D.createElement('a');
    a.href = URL.createObjectURL(new Blob([textoIcs], { type: 'text/calendar' }));
    a.download = 'mimo-calendario.ics';
    a.click();
    if (URL.revokeObjectURL) { URL.revokeObjectURL(a.href); }
  }

  function leerSemestreForm() {
    var c = caja();
    if (!c) { return {}; }
    var f = c.querySelector('[data-calendario="sem-form"]');
    if (!f) { return {}; }
    function v(campo) {
      var n = f.querySelector('[data-sem="' + campo + '"]');
      return n ? n.value : '';
    }
    return {
      id: f.getAttribute('data-id') || '',
      nombre: v('nombre'),
      inicio: v('inicio'),
      clases: v('clases'),
      recesos: v('recesos'),
      examen: v('examen')
    };
  }

  /* El clic se atiende UNA vez, delegado: las vistas se repintan enteras y los
     nodos viejos se llevan sus escuchas. Solo se actua dentro de la caja. */
  function clic(e) {
    if (!dentroDeCalendario(e.target)) { return; }
    var chip = subirA(e.target, '.cal__chip');
    /* OJO: se busca por CLASE, no por `[data-vista]`. El armazon envuelve el
       contenido de la seccion en un nodo con su propio `data-vista` (la vista de
       la estanteria: normal, angosta...), que es ancestro de esta caja; buscar
       por el atributo a secas devolvia ESE nodo y el clic acababa cambiando de
       vista del armazon en vez de la del calendario. La clase `.cal__vista` es
       solo de estos botones. */
    var vista = subirA(e.target, '.cal__vista');
    var fRamo = subirA(e.target, '[data-filtro-ramo]');
    var fTipo = subirA(e.target, '[data-filtro-tipo]');
    /* los filtros se miran antes que las vistas: comparten forma (pildora) y no
       deben confundirse con los botones mes/ano/semestre */
    var accion = subirA(e.target, '[data-accion]');
    if (chip) {
      abrirEditor(chip.getAttribute('data-id'));
      return;
    }
    if (fRamo) {
      M.alternarRamo(fRamo.getAttribute('data-filtro-ramo'));
      pintar();
      return;
    }
    if (fTipo) {
      M.alternarTipo(fTipo.getAttribute('data-filtro-tipo'));
      pintar();
      return;
    }
    if (vista) {
      M.fijarVista(vista.getAttribute('data-vista'));
      pintar();
      return;
    }
    if (!accion) { return; }
    var cual = accion.getAttribute('data-accion');
    if (cual === 'anterior') { M.navPeriodo(-1); pintar(); }
    else if (cual === 'siguiente') { M.navPeriodo(1); pintar(); }
    else if (cual === 'hoy') { M.irHoy(); pintar(); }
    else if (cual === 'nuevo') {
      var ev = M.nuevaEvento();
      abrirEditor(ev.id);
    } else if (cual === 'guardar-evento') {
      var campos = leerEditor();
      if (!campos) { return; }
      M.guardarEvento(campos);
      editando = null;
      pintar();
      guardarAviso('Evento guardado.');
    } else if (cual === 'borrar-evento') {
      if (editando) { M.borrarEvento(editando); }
      editando = null;
      pintar();
    } else if (cual === 'cerrar-editor') {
      cerrarEditor();
    } else if (cual === 'exportar') {
      var ics = M.exportarIcal();
      descargar(ics);
      guardarAviso('Calendario exportado (.ics): impórtalo en Google o Apple Calendar.');
    } else if (cual === 'importar') {
      var c2 = caja();
      var inp = c2 ? c2.querySelector('[data-calendario="ics"]') : null;
      if (inp) { inp.click(); }
    } else if (cual === 'semestres') {
      panel = true;
      semEditando = null;
      pintar();
    } else if (cual === 'cerrar-semestres') {
      panel = false;
      semEditando = null;
      pintar();
    } else if (cual === 'nuevo-semestre') {
      semEditando = null;
      pintar();
    } else if (cual === 'guardar-semestre') {
      var s = leerSemestreForm();
      if (s.id) { M.editarSemestre(s.id, s); } else { M.crearSemestre(s); }
      semEditando = null;
      pintar();
      guardarAviso('Semestre guardado.');
    } else if (cual === 'activar-semestre') {
      M.cambiarSemestre(accion.getAttribute('data-id'));
      pintar();
    } else if (cual === 'editar-semestre') {
      semEditando = accion.getAttribute('data-id');
      panel = true;
      pintar();
    } else if (cual === 'borrar-semestre') {
      M.borrarSemestre(accion.getAttribute('data-id'));
      if (semEditando === accion.getAttribute('data-id')) { semEditando = null; }
      pintar();
      guardarAviso('Semestre borrado. Los eventos y los ramos siguen ahí.');
    }
  }

  function cambio(e) {
    var inp = subirA(e.target, '[data-calendario="ics"]');
    if (!inp || !inp.files || !inp.files.length) { return; }
    var archivo = inp.files[0];
    if (typeof FileReader === 'undefined') { return; }
    var lector = new FileReader();
    lector.onload = function () {
      var r = M.importarIcal(String(lector.result || ''));
      pintar();
      guardarAviso(r.n ? ('Se importaron ' + r.n + ' eventos del calendario.') : 'No hay eventos en ese .ics.');
    };
    lector.readAsText(archivo);
  }

  function iniciar() {
    if (iniciado || !D) { return; }
    iniciado = true;
    D.addEventListener('click', clic);
    D.addEventListener('change', cambio);
  }

  return {
    iniciar: iniciar,
    pintar: pintar,
    abrirEditor: abrirEditor,
    cerrarEditor: cerrarEditor
  };
})();

if (typeof window !== 'undefined') {
  window.MimoCalendarioMotor = MimoCalendarioMotor;
  window.MimoCalendarioUI = MimoCalendarioUI;
}
