/* ============================================================================
   i18n.js — Mimo Nuevo · tablero · motor de idioma (bloque D6, v7)

   Portado del motor que ya existe en `prototipo/js/i18n.js` (Iteracion 3) y del
   diccionario `prototipo/i18n/{es,en}.json`, con DOS cambios que impone el
   tablero:
     1. Los diccionarios van EMBEBIDOS aqui. El prototipo los pide con fetch();
        en `file://` fetch() de un JSON local da CORS y el idioma nunca carga.
     2. Las claves son las del ARMAZON y de los bloques de Tiempo, no las de las
        pantallas del prototipo: se conserva la forma (anidada, `t("a.b")`) y la
        caida al idioma base, y se deja fuera lo que este tablero no pinta.

   API:
     MimoI18n.t(clave[, {param}])        texto del idioma activo (o de `es`)
     MimoI18n.idiomaActual()             "es" | "en"
     MimoI18n.cambiar("en")              cambia, aplica al DOM, guarda, avisa
     MimoI18n.aplicar([raiz])            repinta el marcado con el idioma activo
     MimoI18n.alCambiar(fn)              suscribe; fn(idioma) al cambiar
     MimoI18n.diagnostico([raiz])        nodos marcados, claves ausentes y
                                         desajustes (lo que se mide, §f)
     MimoI18n.claves()                   numero de claves por idioma

   Convencion del marcado (la misma del prototipo, sin fetch):
     data-i18n="clave"                    textContent
     data-i18n-attr="aria-label:clave;title:clave"   atributos
     data-i18n-vars='{"n":"Tiempo"}'      parametros de la clave
   Regla del proyecto: si falta una clave NO se inventa texto; se devuelve la
   clave y se cuenta como ausente.
   ============================================================================ */
var MimoI18n = (function () {
  'use strict';

  var CLAVE_ALMACEN = 'mimo.idioma';
  var IDIOMA_BASE = 'es';
  var IDIOMAS = ['es', 'en'];

  /* ------------------------------------------------------- 1. DICCIONARIOS */
  var DICC = {
    es: {
      cab: {
        panelIzq: 'Panel de bloques',
        marca: 'Mimo Academics',
        herramientas: 'Herramientas de la aplicación',
        ajustes: 'Ajustes',
        apariencia: 'Apariencia',
        edicion: 'Edición',
        mas: 'Más opciones',
        panelDer: 'Panel contextual'
      },
      riel: {
        etiqueta: 'Riel de secciones',
        secciones: 'Secciones',
        anadir: 'Añadir bloque'
      },
      losa: { etiqueta: 'Bloque abierto' },
      estanteria: { etiqueta: 'Vistas de {seccion}' },
      seccion: {
        calendario: { nombre: 'Calendario' },
        malla: { nombre: 'Malla' },
        tiempo: { nombre: 'Tiempo' },
        estudio: { nombre: 'Estudio' },
        calificaciones: { nombre: 'Calificaciones' }
      },
      bloque: {
        cronometro: {
          nombre: 'Cronómetro',
          desc: 'Cuenta el tiempo hacia arriba.'
        },
        temporizador: {
          nombre: 'Temporizador',
          desc: 'Cuenta hacia atrás y avisa al llegar a cero.'
        },
        pomodoro: {
          nombre: 'Pomodoro',
          desc: 'Trabajo y descanso en ciclos de 25 minutos.'
        },
        registro: {
          nombre: 'Registro',
          desc: 'Las sesiones que ya hiciste, con su duración.'
        },
        alarmas: {
          nombre: 'Alarmas',
          desc: 'Avisos a una hora concreta del día.'
        },
        estudio: {
          nombre: 'Estudio',
          desc: 'Horas por ramo y semana contra su meta, y la dedicación del semestre.'
        },
        calificaciones: {
          nombre: 'Calificaciones',
          desc: 'Categorías, componentes, examen, eximición y nota final por ramo.'
        }
      },
      vacia: {
        titulo: 'Añade un bloque a {seccion}',
        textoSi: 'Esta sección está vacía. El gabinete instala aquí: {lista}.',
        textoNo: 'Esta sección todavía no tiene bloques instalables.',
        notaSi: 'El riel lista secciones; los bloques viven dentro de la sección abierta.',
        notaNo: 'El riel lista secciones. Cuando lleguen sus motores, aparecerán aquí.',
        abrir: 'Abrir el gabinete'
      },
      apariencia: {
        titulo: 'Apariencia',
        texto: 'Seis temas. Cada uno con su fondo, su superficie, su tinta y su acento.',
        fondo: 'Fondo',
        superficie: 'Superficie',
        tinta: 'Tinta',
        acento: 'Acento',
        temaTitulo: 'Tema de la aplicación',
        papel: 'Papel',
        arena: 'Arena',
        marea: 'Marea',
        grafito: 'Grafito',
        medianoche: 'Medianoche',
        contraste: 'Alto contraste'
      },
      tema: { claro: 'claro', oscuro: 'oscuro', botonClaro: 'Tema claro', botonOscuro: 'Tema oscuro' },
      ajustes: {
        titulo: 'Ajustes',
        texto: 'El pie de página se oculta desde aquí, no desde el pie.',
        pie: 'Pie de página',
        visible: 'Visible',
        oculto: 'Oculto',
        nota: 'Versión 1.0.0 · el armazón guarda solo; aquí no hay nada que confirmar.',
        idioma: 'Idioma'
      },
      idioma: {
        cambiar: 'English',
        nombre: 'es'
      },
      panel: {
        etiqueta: 'Panel derecho',
        contexto: 'Contexto',
        gabinete: 'Gabinete',
        cerrar: 'Cerrar el panel contextual'
      },
      ctx: {
        ahora: 'Ahora',
        hoy: 'Hoy',
        semana: 'Esta semana',
        ultimas: 'Últimas sesiones',
        modo: 'Modo',
        estado: 'Estado',
        total: 'Total',
        sesiones: 'Sesiones',
        parado: 'Parado',
        enMarcha: 'En marcha',
        pausado: 'Pausado',
        sinNombre: 'Sin nombre',
        sinSesiones: 'Sin sesiones'
      },
      gab: {
        intro: 'Instala bloques en {seccion}.',
        instalarEn: 'Para instalar en {seccion}',
        enSeccion: 'En {seccion}',
        instalar: 'Instalar',
        quitar: 'Quitar',
        noQuedan: 'No quedan bloques por instalar en esta sección.',
        ninguno: 'Ninguno todavía.'
      },
      pie: {
        guardado: ' · guardado hace 2 s',
        idioma: '{idioma} · {tema}',
        sinBloques: 'Sin bloques'
      },
      crono: {
        parado: 'Cronómetro · parado',
        marcha: 'Cronómetro · en marcha',
        pausado: 'Cronómetro · pausado',
        empezar: 'Empezar',
        pausar: 'Pausar',
        parar: 'Parar',
        reiniciar: 'Reiniciar',
        guardar: 'Guardar sesión'
      },
      temp: {
        fase: 'Temporizador · {dur}',
        marcha: 'Temporizador · en marcha',
        pausado: 'Temporizador · pausado',
        cumplido: 'Tiempo cumplido',
        aviso: 'El temporizador llegó a cero.',
        empezar: 'Empezar',
        pausar: 'Pausar',
        parar: 'Parar',
        descartar: 'Descartar aviso',
        reiniciar: 'Reiniciar',
        menos: 'Un minuto menos',
        mas: 'Un minuto más'
      },
      pomo: {
        trabajo: 'Trabajo · {dur}',
        descanso: 'Descanso · {dur}',
        largo: 'Descanso largo · {dur}',
        sesion: 'Sesión {n} de {cada}',
        empezar: 'Empezar',
        pausar: 'Pausar',
        parar: 'Parar',
        reiniciar: 'Reiniciar',
        trabajoMin: 'Trabajo',
        cortoMin: 'Descanso corto',
        largoMin: 'Descanso largo',
        cadaN: 'Cada N trabajos'
      },
      unidad: { min: '{n} min', seg: '{n} s', decimal: ',' },
      reg: {
        fase: 'Registro · sesiones de hoy',
        sesion: 'Sesión {hora}',
        meta: '{min} min · {fecha}',
        min: '{min} min',
        sinSesiones: 'Sin sesiones todavía.',
        censoDia: '{min} min · {n} sesiones',
        censoTotal: 'Total de la semana: {min} min',
        censoTotalVacio: 'Censo de la semana'
      },
      rec: {
        titulo: 'Recordatorios',
        fase: 'Recordatorios · {n}',
        texto: 'Texto del recordatorio',
        dia: 'Día',
        hora: 'Hora',
        sonido: 'Con sonido',
        agregar: 'Añadir',
        quitar: 'Quitar',
        vacio: 'Sin recordatorios todavía.',
        aviso: 'Recordatorio: {texto}',
        dia0: 'Domingo',
        dia1: 'Lunes',
        dia2: 'Martes',
        dia3: 'Miércoles',
        dia4: 'Jueves',
        dia5: 'Viernes',
        dia6: 'Sábado'
      },
      reloj: {
        h: 'Horas',
        m: 'Minutos',
        s: 'Segundos',
        etiquetaCrono: 'Reloj editable del cronómetro',
        etiquetaTemp: 'Reloj editable del temporizador'
      },
      alarmas: { fase: 'Alarmas · ninguna programada' },
      /* T005: Estudio y Calificaciones. Las claves van despues de las 153 de
         T002/T003; no se renombra ni se borra ninguna de las que ya estaban. */
      estudio: {
        barras: 'Horas por ramo y semana',
        puntos: 'Horas por semana',
        kpis: 'Resumen del semestre',
        total: 'Total estudiado',
        promedio: 'Promedio de las semanas con registro',
        sobreMeta: 'Semanas sobre su meta',
        objetivo: 'Objetivo semanal',
        sinRepartir: 'Sin repartir',
        semanas: '{n} semanas con registro',
        metaBase: 'Meta base semanal (horas)',
        metaBaseCorta: 'meta base',
        metaPropia: 'Meta de esta semana (horas)',
        metaPropiaCorta: 'meta propia',
        meta: 'Meta',
        semana: 'Semana',
        totalCorto: 'Total',
        nota: 'Nota libre',
        horas: 'Horas',
        sinDatos: 'Todavía no hay horas repartidas entre los ramos.',
        sinRamos: 'El catálogo está vacío: crea ramos en Malla.',
        tabla: 'Horas y metas de cada semana',
        ramo: 'Ramo',
        dedicacion: 'Te queda poco tiempo en',
        dedicacionTexto: 'Estos ramos llevan menos de la mitad de su meta de esta semana.',
        descartar: 'Es válido, déjalo así',
        sumar: 'Le dedicaré tiempo',
        cantidad: 'Cuánto tiempo (2h 30m)',
        guardar: 'Guardar',
        cancelar: 'Cancelar',
        anadido: 'Sumados {min} a {ramo}.',
        actual: 'La semana en curso va resaltada.',
        leyendaHoras: 'horas realizadas',
        leyendaObjetivo: 'objetivo semanal',
        prioridad: 'Ramos que más abren'
      },
      calificaciones: {
        lista: 'Ramos',
        detalle: 'Detalle del ramo',
        presentacion: 'Nota de presentación',
        final: 'Nota final',
        aprobado: 'aprobado',
        reprobado: 'reprobado',
        eximido: 'eximido',
        aExamen: 'a examen',
        faltan: 'faltan datos',
        notaMinima: 'Nota mínima para aprobar',
        categorias: 'Categorías',
        componentes: 'Componentes',
        examen: 'Examen',
        eximicion: 'Eximición',
        simulador: 'Simulador de examen',
        peso: 'Peso',
        promedio: 'Promedio',
        nota: 'Nota',
        nombre: 'Nombre',
        categoria: 'Categoría',
        fecha: 'Fecha',
        activa: 'Este ramo se puede eximir',
        modo: 'Deben cumplirse',
        todas: 'Todas',
        alguna: 'Alguna',
        sinCategorias: 'Sin categorías todavía.',
        sinComponentes: 'Sin componentes todavía.',
        sinCondiciones: 'Sin condiciones todavía.',
        agregarCategoria: '+ Categoría',
        agregarComponente: '+ Componente',
        agregarCondicion: '+ Condición',
        examenActivo: 'Este ramo tiene examen',
        pesoExamen: 'Cuánto pesa en la nota final (%)',
        reemplaza: 'Ocupa el lugar de',
        noReemplaza: 'Va aparte',
        apuntas: 'apuntas a',
        necesitas: 'Para aprobar necesitas',
        conExamen: 'Con esa nota, la final queda en',
        sinNota: 'sin nota',
        simulacro: 'nota de examen simulada',
        cumple: 'Con estas notas, ya te eximes.',
        noCumple: 'Con estas notas, todavía no te eximes.',
        faltanNotas: 'Faltan notas para saber si te eximes.',
        sinDatosCond: 'todavía sin nota',
        empezar: 'Elige un ramo de la lista para ver y editar sus notas.',
        estado: 'Estado',
        umbral: 'Corte'
      }
    },

    en: {
      cab: {
        panelIzq: 'Block panel',
        marca: 'Mimo Academics',
        herramientas: 'Application tools',
        ajustes: 'Settings',
        apariencia: 'Appearance',
        edicion: 'Editing',
        mas: 'More options',
        panelDer: 'Context panel'
      },
      riel: {
        etiqueta: 'Section rail',
        secciones: 'Sections',
        anadir: 'Add block'
      },
      losa: { etiqueta: 'Open block' },
      estanteria: { etiqueta: 'Views of {seccion}' },
      seccion: {
        calendario: { nombre: 'Calendar' },
        malla: { nombre: 'Grid' },
        tiempo: { nombre: 'Time' },
        estudio: { nombre: 'Study' },
        calificaciones: { nombre: 'Grades' }
      },
      bloque: {
        cronometro: {
          nombre: 'Stopwatch',
          desc: 'Counts time up.'
        },
        temporizador: {
          nombre: 'Timer',
          desc: 'Counts down and alerts at zero.'
        },
        pomodoro: {
          nombre: 'Pomodoro',
          desc: 'Work and rest in 25-minute cycles.'
        },
        registro: {
          nombre: 'Log',
          desc: 'The sessions you have done, with their length.'
        },
        alarmas: {
          nombre: 'Alarms',
          desc: 'Alerts at a set time of day.'
        },
        estudio: {
          nombre: 'Study',
          desc: 'Hours per course and week against their goal, and the term load.'
        },
        calificaciones: {
          nombre: 'Grades',
          desc: 'Categories, components, exam, exemption and final grade per course.'
        }
      },
      vacia: {
        titulo: 'Add a block to {seccion}',
        textoSi: 'This section is empty. The cabinet can install here: {lista}.',
        textoNo: 'This section has no installable blocks yet.',
        notaSi: 'The rail lists sections; blocks live inside the open section.',
        notaNo: 'The rail lists sections. When their engines arrive, they will appear here.',
        abrir: 'Open the cabinet'
      },
      apariencia: {
        titulo: 'Appearance',
        texto: 'Six themes. Each with its background, surface, ink and accent.',
        fondo: 'Background',
        superficie: 'Surface',
        tinta: 'Ink',
        acento: 'Accent',
        temaTitulo: 'Application theme',
        papel: 'Paper',
        arena: 'Sand',
        marea: 'Tide',
        grafito: 'Graphite',
        medianoche: 'Midnight',
        contraste: 'High contrast'
      },
      tema: { claro: 'light', oscuro: 'dark', botonClaro: 'Light theme', botonOscuro: 'Dark theme' },
      ajustes: {
        titulo: 'Settings',
        texto: 'The footer is hidden from here, not from the footer.',
        pie: 'Footer',
        visible: 'Visible',
        oculto: 'Hidden',
        nota: 'Version 1.0.0 · the frame saves by itself; there is nothing to confirm here.',
        idioma: 'Language'
      },
      idioma: {
        cambiar: 'Español',
        nombre: 'en'
      },
      panel: {
        etiqueta: 'Right panel',
        contexto: 'Context',
        gabinete: 'Cabinet',
        cerrar: 'Close the context panel'
      },
      ctx: {
        ahora: 'Now',
        hoy: 'Today',
        semana: 'This week',
        ultimas: 'Latest sessions',
        modo: 'Mode',
        estado: 'State',
        total: 'Total',
        sesiones: 'Sessions',
        parado: 'Stopped',
        enMarcha: 'Running',
        pausado: 'Paused',
        sinNombre: 'Untitled',
        sinSesiones: 'No sessions'
      },
      gab: {
        intro: 'Install blocks in {seccion}.',
        instalarEn: 'To install in {seccion}',
        enSeccion: 'In {seccion}',
        instalar: 'Install',
        quitar: 'Remove',
        noQuedan: 'No blocks left to install in this section.',
        ninguno: 'None yet.'
      },
      pie: {
        guardado: ' · saved 2 s ago',
        idioma: '{idioma} · {tema}',
        sinBloques: 'No blocks'
      },
      crono: {
        parado: 'Stopwatch · stopped',
        marcha: 'Stopwatch · running',
        pausado: 'Stopwatch · paused',
        empezar: 'Start',
        pausar: 'Pause',
        parar: 'Stop',
        reiniciar: 'Reset',
        guardar: 'Save session'
      },
      temp: {
        fase: 'Timer · {dur}',
        marcha: 'Timer · running',
        pausado: 'Timer · paused',
        cumplido: 'Time is up',
        aviso: 'The timer reached zero.',
        empezar: 'Start',
        pausar: 'Pause',
        parar: 'Stop',
        descartar: 'Dismiss alert',
        reiniciar: 'Reset',
        menos: 'One minute less',
        mas: 'One minute more'
      },
      pomo: {
        trabajo: 'Work · {dur}',
        descanso: 'Break · {dur}',
        largo: 'Long break · {dur}',
        sesion: 'Session {n} of {cada}',
        empezar: 'Start',
        pausar: 'Pause',
        parar: 'Stop',
        reiniciar: 'Reset',
        trabajoMin: 'Work',
        cortoMin: 'Short break',
        largoMin: 'Long break',
        cadaN: 'Every N work blocks'
      },
      unidad: { min: '{n} min', seg: '{n} s', decimal: '.' },
      reg: {
        fase: 'Log · today\'s sessions',
        sesion: 'Session {hora}',
        meta: '{min} min · {fecha}',
        min: '{min} min',
        sinSesiones: 'No sessions yet.',
        censoDia: '{min} min · {n} sessions',
        censoTotal: 'Week total: {min} min',
        censoTotalVacio: 'Week census'
      },
      rec: {
        titulo: 'Reminders',
        fase: 'Reminders · {n}',
        texto: 'Reminder text',
        dia: 'Day',
        hora: 'Time',
        sonido: 'With sound',
        agregar: 'Add',
        quitar: 'Remove',
        vacio: 'No reminders yet.',
        aviso: 'Reminder: {texto}',
        dia0: 'Sunday',
        dia1: 'Monday',
        dia2: 'Tuesday',
        dia3: 'Wednesday',
        dia4: 'Thursday',
        dia5: 'Friday',
        dia6: 'Saturday'
      },
      reloj: {
        h: 'Hours',
        m: 'Minutes',
        s: 'Seconds',
        etiquetaCrono: 'Editable stopwatch clock',
        etiquetaTemp: 'Editable timer clock'
      },
      alarmas: { fase: 'Alarms · none scheduled' },
      /* T005: Study and Grades. Added after the 153 keys of T002/T003; none of
         the existing keys is renamed or removed. */
      estudio: {
        barras: 'Hours per course and week',
        puntos: 'Hours per week',
        kpis: 'Term summary',
        total: 'Total studied',
        promedio: 'Average of the weeks with a log',
        sobreMeta: 'Weeks over their goal',
        objetivo: 'Weekly goal',
        sinRepartir: 'Unassigned',
        semanas: '{n} weeks with a log',
        metaBase: 'Base weekly goal (hours)',
        metaBaseCorta: 'base goal',
        metaPropia: 'Goal of this week (hours)',
        metaPropiaCorta: 'own goal',
        meta: 'Goal',
        semana: 'Week',
        totalCorto: 'Total',
        nota: 'Free note',
        horas: 'Hours',
        sinDatos: 'No hours assigned to courses yet.',
        sinRamos: 'The catalogue is empty: create courses in Malla.',
        tabla: 'Hours and goals of each week',
        ramo: 'Course',
        dedicacion: 'Running short of time in',
        dedicacionTexto: 'These courses have less than half of their goal this week.',
        descartar: 'It is fine, leave it',
        sumar: 'I will spend time on it',
        cantidad: 'How much time (2h 30m)',
        guardar: 'Save',
        cancelar: 'Cancel',
        anadido: 'Added {min} to {ramo}.',
        actual: 'The current week is highlighted.',
        leyendaHoras: 'hours done',
        leyendaObjetivo: 'weekly goal',
        prioridad: 'Courses that open the most'
      },
      calificaciones: {
        lista: 'Courses',
        detalle: 'Course detail',
        presentacion: 'Coursework grade',
        final: 'Final grade',
        aprobado: 'passed',
        reprobado: 'failed',
        eximido: 'exempt',
        aExamen: 'exam pending',
        faltan: 'missing data',
        notaMinima: 'Minimum grade to pass',
        categorias: 'Categories',
        componentes: 'Components',
        examen: 'Exam',
        eximicion: 'Exemption',
        simulador: 'Exam simulator',
        peso: 'Weight',
        promedio: 'Average',
        nota: 'Grade',
        nombre: 'Name',
        categoria: 'Category',
        fecha: 'Date',
        activa: 'This course can be exempted',
        modo: 'Must meet',
        todas: 'All',
        alguna: 'Any',
        sinCategorias: 'No categories yet.',
        sinComponentes: 'No components yet.',
        sinCondiciones: 'No conditions yet.',
        agregarCategoria: '+ Category',
        agregarComponente: '+ Component',
        agregarCondicion: '+ Condition',
        examenActivo: 'This course has an exam',
        pesoExamen: 'How much it weighs on the final grade (%)',
        reemplaza: 'It replaces',
        noReemplaza: 'It is separate',
        apuntas: 'aiming for',
        necesitas: 'To pass you need',
        conExamen: 'With that grade, the final is',
        sinNota: 'no grade',
        simulacro: 'simulated exam grade',
        cumple: 'With these grades, you are already exempt.',
        noCumple: 'With these grades, you are not exempt yet.',
        faltanNotas: 'Grades are missing to know if you are exempt.',
        sinDatosCond: 'no grade yet',
        empezar: 'Pick a course from the list to see and edit its grades.',
        estado: 'Status',
        umbral: 'Cut-off'
      }
    }
  };

  /* ------------------------------------------------------------- 2. ESTADO */
  var idioma = IDIOMA_BASE;
  var oyentes = [];

  function almacen() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) { return localStorage; }
    } catch (e) { /* almacen bloqueado: se sigue en memoria */ }
    return null;
  }

  function normalizarIdioma(v) {
    v = String(v || '').toLowerCase().slice(0, 2);
    return IDIOMAS.indexOf(v) >= 0 ? v : IDIOMA_BASE;
  }

  function buscar(d, clave) {
    var partes = String(clave).split('.');
    var nodo = d;
    for (var i = 0; i < partes.length; i++) {
      if (nodo === null || nodo === undefined || typeof nodo !== 'object') { return null; }
      nodo = nodo[partes[i]];
    }
    return (typeof nodo === 'string') ? nodo : null;
  }

  function sustituir(texto, params) {
    if (!params) { return texto; }
    return texto.replace(/\{(\w+)\}/g, function (todo, nombre) {
      return (params[nombre] === undefined || params[nombre] === null) ? todo : String(params[nombre]);
    });
  }

  /* --------------------------------------------------------------- 3. t() */
  function t(clave, params) {
    var texto = buscar(DICC[idioma], clave);
    if (texto === null) { texto = buscar(DICC[IDIOMA_BASE], clave); }   /* caida al base */
    if (texto === null) { return String(clave); }                      /* no se inventa texto */
    return sustituir(texto, params);
  }

  function idiomaActual() { return idioma; }

  /* ----------------------------------------------------- 4. aplicar al DOM */
  function varsDe(el) {
    var crudo = el.getAttribute('data-i18n-vars');
    if (!crudo) { return null; }
    try { return JSON.parse(crudo); } catch (e) { return null; }
  }

  function aplicar(raiz) {
    var caja = raiz || document;
    var nodos = caja.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodos.length; i++) {
      var el = nodos[i];
      el.textContent = t(el.getAttribute('data-i18n'), varsDe(el));
    }
    var conAttr = caja.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < conAttr.length; j++) {
      var nodo = conAttr[j];
      var pares = String(nodo.getAttribute('data-i18n-attr') || '').split(';');
      for (var k = 0; k < pares.length; k++) {
        var par = pares[k].split(':');
        if (par.length !== 2) { continue; }
        var attr = par[0].replace(/^\s+|\s+$/g, '');
        var clave = par[1].replace(/^\s+|\s+$/g, '');
        if (attr && clave) { nodo.setAttribute(attr, t(clave, varsDe(nodo))); }
      }
    }
    if (caja === document || caja === document.documentElement) {
      document.documentElement.setAttribute('lang', idioma);
    }
    return nodos.length + conAttr.length;
  }

  /* -------------------------------------------------- 5. cambio de idioma */
  function avisar() {
    for (var i = 0; i < oyentes.length; i++) {
      try { oyentes[i](idioma); } catch (e) { /* un oyente roto no tumba el cambio */ }
    }
  }

  function cambiar(lang) {
    var nuevo = normalizarIdioma(lang);
    if (nuevo === idioma) { aplicar(); return idioma; }
    idioma = nuevo;
    guardarIdioma(idioma);
    aplicar();
    avisar();
    return idioma;
  }

  function alCambiar(fn) {
    if (typeof fn === 'function') { oyentes.push(fn); }
  }

  /* ------------------------------------------------------- 6. diagnostico */
  function clavesDe(d, prefijo, salida) {
    Object.keys(d).forEach(function (k) {
      var v = d[k];
      var clave = prefijo ? prefijo + '.' + k : k;
      if (typeof v === 'string') { salida.push(clave); } else if (v && typeof v === 'object') { clavesDe(v, clave, salida); }
    });
    return salida;
  }

  function claves() {
    return { es: clavesDe(DICC.es, '', []).length, en: clavesDe(DICC.en, '', []).length };
  }

  function faltan() {
    var a = clavesDe(DICC.es, '', []);
    var b = clavesDe(DICC.en, '', []);
    var salida = [];
    a.forEach(function (k) { if (b.indexOf(k) < 0) { salida.push('en:' + k); } });
    b.forEach(function (k) { if (a.indexOf(k) < 0) { salida.push('es:' + k); } });
    return salida;
  }

  function diagnostico(raiz) {
    var caja = raiz || document;
    var nodos = caja.querySelectorAll('[data-i18n]');
    var attrs = caja.querySelectorAll('[data-i18n-attr]');
    var ausentes = [];
    var desajustes = [];
    for (var i = 0; i < nodos.length; i++) {
      var el = nodos[i];
      var clave = el.getAttribute('data-i18n');
      if (buscar(DICC[idioma], clave) === null && buscar(DICC[IDIOMA_BASE], clave) === null) {
        ausentes.push(clave);
        continue;
      }
      var esperado = t(clave, varsDe(el));
      if (el.textContent !== esperado) {
        desajustes.push({ clave: clave, nodo: el.textContent, esperado: esperado });
      }
    }
    var clavesAttr = 0;
    for (var j = 0; j < attrs.length; j++) {
      var pares = String(attrs[j].getAttribute('data-i18n-attr') || '').split(';');
      clavesAttr += pares.length;
      for (var k = 0; k < pares.length; k++) {
        var clave2 = (pares[k].split(':')[1] || '').replace(/^\s+|\s+$/g, '');
        if (clave2 && buscar(DICC[idioma], clave2) === null && buscar(DICC[IDIOMA_BASE], clave2) === null) {
          ausentes.push(clave2);
        }
      }
    }
    return {
      idioma: idioma,
      lang: document.documentElement.getAttribute('lang'),
      nodos: nodos.length,
      atributos: clavesAttr,
      ausentes: ausentes,
      desajustes: desajustes,
      totalClaves: claves()
    };
  }

  /* ------------------------------------------------------------- 7. arranque */
  /* DESDE T003 EL IDIOMA VIVE EN EL ALMACÉN ÚNICO: `E.idioma` de
     `mimo.datos.v1` (js/comun/almacen.js), no en `mimo.idioma`. La clave vieja
     se sigue leyendo como respaldo —y la migración la copia una sola vez— para
     que este motor funcione también en una página que no cargue el sustrato.
     Los diccionarios no se tocan: 153 claves de T002/T003, más las de T005 de
     Estudio y Calificaciones, simétricas en los dos idiomas. Ni una se renombra. */
  function comun() {
    if (typeof MimoComun === 'undefined' || !MimoComun) { return null; }
    if (typeof MimoComun.leer !== 'function') { return null; }
    return MimoComun;
  }

  function idiomaGuardado() {
    var M = comun();
    if (M) {
      try {
        var e = M.leer();
        if (e && (e.idioma === 'es' || e.idioma === 'en')) { return e.idioma; }
      } catch (err) { /* sin almacén: se cae a la clave vieja */ }
    }
    var al = almacen();
    if (al) { try { return al.getItem(CLAVE_ALMACEN); } catch (e) { return null; } }
    return null;
  }

  function guardarIdioma(lang) {
    var M = comun();
    if (M) {
      try { M.leer().idioma = lang; M.guardar(); return; } catch (e) { /* cuota */ }
    }
    var al = almacen();
    if (al) { try { al.setItem(CLAVE_ALMACEN, lang); } catch (e) { /* sin cuota */ } }
  }

  function arranque() {
    var guardado = idiomaGuardado();
    idioma = normalizarIdioma(guardado || IDIOMA_BASE);
    aplicar();
  }
  arranque();

  return {
    t: t,
    idiomaActual: idiomaActual,
    cambiar: cambiar,
    aplicar: aplicar,
    alCambiar: alCambiar,
    diagnostico: diagnostico,
    claves: claves,
    faltan: faltan,
    idiomas: IDIOMAS,
    CLAVE: CLAVE_ALMACEN
  };
})();
