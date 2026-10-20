/* ============================================================================
   bloques/tiempo/ui.js — pantalla del bloque Tiempo (iteración 4b · bloque T2)

   Forma tomada de bloques/malla/ui.js: IIFE con 'use strict', un solo global
   (window.MimoBloques.tiempo) y la superficie del shell como ÚNICA puerta.

   Lo que este fichero NO hace, a propósito:
   - No calcula: todo el tiempo sale de window.MimoTiempoMotor (T1, cerrado).
     Aquí solo se pregunta la cifra y se pinta; si el motor falta, se dice en
     pantalla y refrescar() reintenta, en vez de inventar ceros.
   - No escribe fuera de `raiz`: ni #panel, ni .marco, ni document.body. El
     panel contextual se devuelve como DATO y lo pinta el shell.
   - No escribe texto incrustado: todo pasa por ctx.t() con respaldo en español
     como último recurso (el respaldo es la red, no la fuente).

   La interfaz es nueva (decisión del dueño: se portan motores, el dibujo se
   rehace). Del viejo solo se miró QUÉ controles existían: reloj grande, tres
   modos, destino, registro y configuración del pomodoro. El dibujo, las clases
   y la disposición son de este prototipo, con sus tokens.

   Optimización de la pantalla, que es lo que pedía el encargo:
   - Un solo reloj grande y un botón primario que cambia de nombre según toque
     (Empezar / Pausar / Reanudar): no hay que buscar el botón en cada modo.
   - El registro está al lado del reloj, no en otra pantalla: se registra y se
     ve el total sin cambiar de vista.
   - Cada modo conserva SU reloj: cambiar de pestaña no borra el cronómetro ni
     la cuenta atrás (el estado vive en el motor, no en el DOM).
   ============================================================================ */
(function (global) {
  'use strict';

  var ID = 'tiempo';

  /* Los tres modos que esta pantalla ofrece. El motor admite además
     `recordatorios`, que no se pinta aquí: no hay diseño para él todavía y
     fingirlo sería peor que no ofrecerlo. Si un estado guardado trae ese modo,
     el motor lo respeta y esta pantalla cae al cronómetro para poder pintar. */
  var MODOS = ['cronometro', 'temporizador', 'pomodoro'];

  /* Instancia única: el bloque es UNA sección del shell. */
  var raiz = null;
  var ctx = null;
  var montada = false;
  var oyentes = [];
  var latidoId = null;          /* setInterval del reloj, o null si está parado */

  /* Nodos que el latido toca: se guardan para no recorrer el DOM cada 250 ms. */
  var refs = {};

  /* Borrador de la interfaz (lo que el usuario está escribiendo y aún no ha
     confirmado). Vive en memoria, no en el almacén: al cambiar de idioma se
     repinta la pantalla y esto evita perder lo escrito. */
  var borrador = { minutos: '25', respaldo: '' };

  /* ---------------------------------------------------------- 1. utilidades */

  function crear(tag, clase, texto) {
    var n = document.createElement(tag);
    if (clase) { n.className = clase; }
    if (texto !== undefined && texto !== null) { n.textContent = String(texto); }
    return n;
  }

  function escuchar(nodo, tipo, fn) {
    if (!nodo || !nodo.addEventListener) { return; }
    nodo.addEventListener(tipo, fn);
    oyentes.push([nodo, tipo, fn]);
  }

  function olvidarOyentes() {
    for (var i = 0; i < oyentes.length; i++) {
      oyentes[i][0].removeEventListener(oyentes[i][1], oyentes[i][2]);
    }
    oyentes = [];
  }

  /* i18n con respaldo: fuera del shell (banco de pruebas) ctx.t no existe y se
     usa el texto español. Nunca se pinta una clave cruda por gusto. */
  function tr(clave, params, respaldo) {
    if (ctx && typeof ctx.t === 'function') {
      try {
        var texto = ctx.t(clave, params, respaldo);
        if (texto && texto !== clave) { return texto; }
      } catch (e) { /* se usa el respaldo */ }
    }
    var out = String(respaldo === undefined ? clave : respaldo);
    if (params) {
      out = out.replace(/\{(\w+)\}/g, function (todo, nombre) {
        return (params[nombre] === undefined || params[nombre] === null) ? todo : String(params[nombre]);
      });
    }
    return out;
  }

  function avisar(texto, tipo, icono) {
    if (ctx && typeof ctx.aviso === 'function') {
      try { ctx.aviso(texto, tipo || '', icono || 'ic-info'); return; } catch (e) { /* sin aviso */ }
    }
    if (global.console && global.console.info) { global.console.info('[tiempo] ' + texto); }
  }

  function pedirPanel() {
    if (ctx && typeof ctx.pedirPanel === 'function') {
      try { ctx.pedirPanel(); } catch (e) { /* el panel no es imprescindible */ }
    }
  }

  function dos(n) {
    return (n < 10 ? '0' : '') + n;
  }

  /* ------------------------------------------------------- 2. puerta al motor */

  function motor() {
    var M = global.MimoTiempoMotor;
    return (M && typeof M.cronoMs === 'function' && typeof M.registrar === 'function') ? M : null;
  }

  /* El estado del motor es de solo lectura para la UI: se copia, se cambia el
     campo que toca y se guarda. Así no se muta el objeto vivo del bloque. */
  function copiaEstado() {
    var M = motor();
    if (!M) { return null; }
    try { return JSON.parse(JSON.stringify(M.leer())); } catch (e) { return null; }
  }

  function ponerModo(modo) {
    var M = motor();
    if (!M || MODOS.indexOf(modo) < 0) { return; }
    var d = copiaEstado();
    if (!d) { return; }
    d.modo = modo;
    try { M.guardar(d); } catch (e) { avisar(tr('tiempo.aviso.noGuarda', null, 'No se pudo guardar el estado')); }
  }

  function modoActual() {
    var M = motor();
    if (!M) { return 'cronometro'; }
    var m = '';
    try { m = String(M.leer().modo || ''); } catch (e) { m = ''; }
    return MODOS.indexOf(m) >= 0 ? m : 'cronometro';
  }

  function destinoActual() {
    if (refs.destino && refs.destino.value !== undefined) {
      var v = String(refs.destino.value).replace(/^\s+|\s+$/g, '');
      return v || null;
    }
    var d = copiaEstado();
    return (d && d.ramo) ? String(d.ramo) : null;
  }

  function guardarDestino(valor) {
    var M = motor();
    if (!M) { return; }
    var d = copiaEstado();
    if (!d) { return; }
    d.ramo = valor || null;
    try { M.guardar(d); } catch (e) { /* el almacén lleno no rompe la pantalla */ }
  }

  /* ------------------------------------------------------------ 3. formatos */

  function fmtReloj(ms, conHoras) {
    var s = Math.max(0, Math.round(Number(ms) / 1000));
    if (!isFinite(s)) { s = 0; }
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var seg = s % 60;
    /* Un cronómetro sin horas se lee mejor como MM:SS hasta la hora exacta; a
       partir de ahí las horas dejan de ser ruido y pasan a ser información. */
    if (conHoras || h > 0) { return dos(h) + ':' + dos(m) + ':' + dos(seg); }
    return dos(m) + ':' + dos(seg);
  }

  function fmtMinutos(min) {
    var n = Math.max(0, Math.round(Number(min) || 0));
    if (n >= 60) {
      var h = Math.floor(n / 60);
      var m = n % 60;
      if (m === 0) { return tr('tiempo.formato.hora', { h: h }, h + ' h'); }
      return tr('tiempo.formato.horas', { h: h, m: m }, h + ' h ' + m + ' min');
    }
    return tr('tiempo.formato.min', { m: n }, n + ' min');
  }

  /* ------------------------------------------------- 4. nombres de los textos */

  function nombreModo(modo) {
    var nombres = { cronometro: 'Cronómetro', temporizador: 'Temporizador', pomodoro: 'Pomodoro' };
    return tr('tiempo.modo.' + modo, null, nombres[modo] || modo);
  }

  function nombreFase(fase) {
    var nombres = { trabajo: 'Trabajo', descanso: 'Descanso corto', largo: 'Descanso largo' };
    return tr('tiempo.fase.' + fase, null, nombres[fase] || fase);
  }

  function estadoTexto() {
    return corriendo()
      ? tr('tiempo.estado.corriendo', null, 'En marcha')
      : tr('tiempo.estado.parado', null, 'Parado');
  }

  /* «1 sesión» / «3 sesiones»: el número no puede concordar mal en un aviso.
     El idioma decide la forma; el respaldo español es la red. */
  function fmtSesiones(n) {
    var v = Math.max(0, Math.round(Number(n) || 0));
    if (v === 1) { return tr('tiempo.sesion.una', null, '1 sesión'); }
    return tr('tiempo.sesion.varias', { n: v }, v + ' sesiones');
  }

  function nombreDestino(sesion) {
    var v = sesion && sesion.ramo ? String(sesion.ramo) : '';
    v = v.replace(/^\s+|\s+$/g, '');
    return v || tr('tiempo.destino.respaldo', null, 'Sin nombre');
  }

  /* ------------------------------------------------------- 5. estado del reloj */

  function corriendo() {
    var M = motor();
    if (!M) { return false; }
    try {
      var m = modoActual();
      if (m === 'temporizador') { return M.tempEstaCorriendo(); }
      if (m === 'pomodoro') { return M.pomoEstaCorriendo(); }
      return M.cronoEstaCorriendo();
    } catch (e) { return false; }
  }

  function cifraMs() {
    var M = motor();
    if (!M) { return 0; }
    try {
      var m = modoActual();
      if (m === 'temporizador') { return M.tempRestanteMs(); }
      if (m === 'pomodoro') { return M.pomoRestanteMs(); }
      return M.cronoMs();
    } catch (e) { return 0; }
  }

  function cifraConHoras() {
    return modoActual() === 'cronometro';
  }

  /* Pista del reloj: en cronómetro dice qué hace; en temporizador, desde cuánto
     cuenta; en pomodoro, la fase y su duración. Nunca se repite el número. */
  function pista() {
    var M = motor();
    if (!M) { return ''; }
    var m = modoActual();
    if (m === 'temporizador') {
      return tr('tiempo.reloj.pistaTemp',
        { min: fmtMinutos(M.tempObjetivoSeg() / 60) },
        'Cuenta atrás desde ' + fmtMinutos(M.tempObjetivoSeg() / 60) + '.');
    }
    if (m === 'pomodoro') {
      var p = M.pomo();
      var clave = 'tiempo.reloj.pistaPomo';
      var respaldo = 'Fase ' + nombreFase(p.fase) + ' · ' + fmtMinutos(M.pomoDurMs(p.fase) / 60000);
      if (p.fase === 'trabajo') {
        return tr(clave, { fase: nombreFase(p.fase), min: fmtMinutos(M.pomoDurMs(p.fase) / 60000) },
          'Fase ' + nombreFase(p.fase) + ' · ' + fmtMinutos(M.pomoDurMs(p.fase) / 60000) +
          ' · ' + tr('tiempo.ciclo', { n: (p.trabajos % p.config.cada) + 1, cada: p.config.cada },
            (p.trabajos % p.config.cada) + 1 + ' de ' + p.config.cada));
      }
      return tr(clave, { fase: nombreFase(p.fase), min: fmtMinutos(M.pomoDurMs(p.fase) / 60000) }, respaldo);
    }
    return tr('tiempo.reloj.pistaCrono', null,
      'Cuenta el tiempo que dedicas. Al pausar puedes registrarlo.');
  }

  /* --------------------------------------------------------- 6. marcado */

  function cabecera() {
    var cab = crear('div', 'sec-cab tiempo-cab');

    var txt = crear('div', 'sec-cab__txt');
    var h1 = crear('h1', 'sec-cab__tit', tr('tiempo.titulo', null, 'Tiempo'));
    h1.id = 'tiempo-titulo';
    txt.appendChild(h1);
    txt.appendChild(crear('p', 'sec-cab__sub', tr('tiempo.sub', null,
      'Cronómetro, temporizador, pomodoro y registro de sesiones.')));
    cab.appendChild(txt);

    /* La cabecera se queda con el título y su línea: el estado del reloj vive
       pegado al reloj, no en la esquina opuesta de la pantalla. */
    return cab;
  }

  function modos() {
    var caja = crear('div', 'tiempo-modos');
    caja.setAttribute('role', 'group');
    caja.setAttribute('aria-label', tr('tiempo.modo.leyenda', null, 'Modo de tiempo'));

    var actual = modoActual();
    for (var i = 0; i < MODOS.length; i++) {
      var b = crear('button', 'tiempo-modo', nombreModo(MODOS[i]));
      b.type = 'button';
      b.setAttribute('data-modo', MODOS[i]);
      b.setAttribute('aria-pressed', MODOS[i] === actual ? 'true' : 'false');
      caja.appendChild(b);
    }
    return caja;
  }

  /* Fila superior de la tarjeta: el modo a la izquierda y el estado a la
     derecha. Se ven juntos porque se leen juntos: qué reloj es y si corre. */
  function filaModos() {
    var fila = crear('div', 'tiempo-fila');
    fila.appendChild(modos());

    var pill = crear('span', 'pill pill--mini tiempo-pill', estadoTexto());
    pill.setAttribute('aria-live', 'polite');
    pill.setAttribute('data-pill', 'si');
    fila.appendChild(pill);

    refs.pill = pill;
    return fila;
  }

  function campoNumero(id, etiqueta, valor, min, max, paso, desactivado) {
    var lab = crear('label', 'tiempo-campo');
    lab.appendChild(crear('span', 'tiempo-et', etiqueta));
    var inp = crear('input', 'tiempo-entrada');
    inp.type = 'number';
    inp.id = id;
    inp.setAttribute('data-campo', id);
    inp.value = String(valor);
    inp.min = String(min);
    if (max) { inp.max = String(max); }
    inp.step = String(paso || 1);
    inp.setAttribute('inputmode', 'numeric');
    if (desactivado) { inp.disabled = true; }
    lab.appendChild(inp);
    return lab;
  }

  function boton(accion, texto, clase, aria) {
    var b = crear('button', 'btn' + (clase ? ' ' + clase : ''), texto);
    b.type = 'button';
    b.setAttribute('data-accion', accion);
    if (aria) { b.setAttribute('aria-label', aria); }
    return b;
  }

  function tarjetaReloj() {
    var t = crear('div', 'tiempo-tarjeta tiempo-reloj');

    t.appendChild(filaModos());

    var cuerpo = crear('div', 'tiempo-reloj__cuerpo');

    var cifra = crear('p', 'tiempo-cifra', fmtReloj(cifraMs(), cifraConHoras()));
    cifra.id = 'tiempo-cifra';
    cifra.setAttribute('role', 'timer');
    cifra.setAttribute('aria-live', 'off');
    cuerpo.appendChild(cifra);

    var p = crear('p', 'tiempo-pista', pista());
    cuerpo.appendChild(p);

    var acciones = crear('div', 'tiempo-acciones');
    acciones.appendChild(boton('principal', '', 'btn--solido'));
    acciones.appendChild(boton('secundario', ''));
    acciones.appendChild(boton('terciario', ''));
    cuerpo.appendChild(acciones);

    /* Temporizador: la duración se edita aquí, junto al reloj, y no en un
       diálogo aparte. Mientras corre está desactivada: cambiarla a mitad sería
       reiniciar la cuenta sin decirlo. */
    if (modoActual() === 'temporizador') {
      var caja = crear('div', 'tiempo-inline');
      var M = motor();
      var min = M ? Math.max(1, Math.round(M.tempObjetivoSeg() / 60)) : 25;
      caja.appendChild(campoNumero('objetivo', tr('tiempo.campo.duracion', null, 'Minutos'),
        min, 1, 600, 1, corriendo()));
      cuerpo.appendChild(caja);
    }

    t.appendChild(cuerpo);

    /* Configuración del pomodoro: solo aparece en su modo. No toca el ciclo en
       marcha (el motor lo garantiza), y por eso no hace falta confirmar. */
    if (modoActual() === 'pomodoro') {
      t.appendChild(configPomodoro());
    }

    refs.cifra = cifra;
    refs.pista = p;
    refs.principal = acciones.querySelector('[data-accion="principal"]');
    refs.secundario = acciones.querySelector('[data-accion="secundario"]');
    refs.terciario = acciones.querySelector('[data-accion="terciario"]');
    return t;
  }

  function configPomodoro() {
    var M = motor();
    var c = M ? M.pomoConfig() : { trabajo: 25, corto: 5, largo: 15, cada: 4 };
    var caja = crear('div', 'tiempo-config');
    caja.appendChild(crear('h2', 'tiempo-h', tr('tiempo.config.titulo', null,
      'Configuración del pomodoro')));
    var campos = crear('div', 'tiempo-campos');
    campos.appendChild(campoNumero('pomo-trabajo', tr('tiempo.config.trabajo', null, 'Trabajo'), c.trabajo, 1, 180, 1, false));
    campos.appendChild(campoNumero('pomo-corto', tr('tiempo.config.corto', null, 'Descanso corto'), c.corto, 1, 60, 1, false));
    campos.appendChild(campoNumero('pomo-largo', tr('tiempo.config.largo', null, 'Descanso largo'), c.largo, 1, 120, 1, false));
    campos.appendChild(campoNumero('pomo-cada', tr('tiempo.config.cada', null, 'Largo cada'), c.cada, 1, 12, 1, false));
    caja.appendChild(campos);
    return caja;
  }

  function tarjetaKpis() {
    var caja = crear('div', 'kpis tiempo-kpis');
    var M = motor();
    /* Los tres totales salen del registro (el motor no guarda agregados): si la
       lectura fallara, quedan en 0 y se ve un cero, no un dato inventado. */
    var totalHoy = 0;
    var totalSem = 0;
    var total = 0;
    if (M) {
      try {
        var hoy = M.hoy();
        totalHoy = M.minutosDia(hoy);
        totalSem = M.minutosSemana(M.lunesDe(hoy));
        total = M.sumaMinutos(M.sesiones());
      } catch (e) { totalHoy = 0; totalSem = 0; total = 0; }
    }
    var datos = [
      [tr('tiempo.kpi.hoy', null, 'Hoy'), fmtMinutos(totalHoy)],
      [tr('tiempo.kpi.semana', null, 'Esta semana'), fmtMinutos(totalSem)],
      [tr('tiempo.kpi.total', null, 'Total'), fmtMinutos(total)]
    ];

    for (var i = 0; i < datos.length; i++) {
      var k = crear('div', 'kpi');
      k.appendChild(crear('span', 'kpi__n', datos[i][1]));
      k.appendChild(crear('span', 'kpi__l', datos[i][0]));
      caja.appendChild(k);
    }
    refs.kpis = caja;
    return caja;
  }

  function tarjetaDestino() {
    var t = crear('div', 'tiempo-tarjeta');
    t.appendChild(crear('h2', 'tiempo-h', tr('tiempo.destino.titulo', null,
      '¿A qué dedicas el tiempo?')));

    var lab = crear('label', 'tiempo-campo');
    lab.appendChild(crear('span', 'tiempo-et', tr('tiempo.destino.etiqueta', null, 'Nombre')));
    var inp = crear('input', 'tiempo-entrada');
    inp.type = 'text';
    inp.id = 'tiempo-destino';
    inp.setAttribute('data-campo', 'destino');
    inp.maxLength = 60;
    inp.setAttribute('autocomplete', 'off');
    var d = copiaEstado();
    inp.value = (d && d.ramo) ? String(d.ramo) : '';
    inp.placeholder = tr('tiempo.destino.marcador', null, 'Un ramo, un proyecto, un cliente…');
    lab.appendChild(inp);
    t.appendChild(lab);
    t.appendChild(crear('p', 'tiempo-ayuda', tr('tiempo.destino.ayuda', null,
      'Lo que escribas aquí va en cada sesión que registres.')));

    refs.destino = inp;
    return t;
  }

  function tarjetaRegistro() {
    var t = crear('div', 'tiempo-tarjeta');
    t.appendChild(crear('h2', 'tiempo-h', tr('tiempo.registro.titulo', null, 'Registro de hoy')));

    var linea = crear('div', 'tiempo-linea');
    var lab = crear('label', 'tiempo-campo tiempo-campo--corto');
    lab.appendChild(crear('span', 'tiempo-et', tr('tiempo.registro.manual', null, 'Minutos')));
    var inp = crear('input', 'tiempo-entrada');
    inp.type = 'number';
    inp.id = 'tiempo-minutos';
    inp.setAttribute('data-campo', 'minutos');
    inp.min = '1';
    inp.max = '600';
    inp.step = '5';
    inp.value = borrador.minutos;
    inp.setAttribute('inputmode', 'numeric');
    lab.appendChild(inp);
    linea.appendChild(lab);
    linea.appendChild(boton('registrar-manual', tr('tiempo.registro.boton', null, 'Registrar')));
    t.appendChild(linea);

    var lista = crear('ul', 'tiempo-sesiones');
    t.appendChild(lista);
    refs.lista = lista;
    refs.minutos = inp;
    pintarLista();
    return t;
  }

  function cuerpo() {
    var rej = crear('div', 'tiempo-rejilla');

    /* Columna izquierda: el reloj y, justo debajo, lo que se registra. La
       acción de registrar cae al lado del número que la alimenta, sin cruzar la
       pantalla. Derecha: resumen, destino y respaldo, que se consultan menos. */
    var izq = crear('div', 'tiempo-col');
    izq.appendChild(tarjetaReloj());
    izq.appendChild(tarjetaRegistro());
    rej.appendChild(izq);

    var der = crear('div', 'tiempo-col');
    der.appendChild(tarjetaKpis());
    der.appendChild(tarjetaDestino());
    var resp = tarjetaRespaldo();
    if (resp) { der.appendChild(resp); }
    rej.appendChild(der);

    return rej;
  }

  /* Respaldo: el texto viaja por un área de texto, no por un diálogo del
     sistema. Así se puede copiar a mano, pegar de otra máquina y —lo que de
     verdad importa— se puede probar y volver a leer sin depender de permisos
     del navegador ni de una ventana nativa. Exportar e importar escriben y leen
     el MISMO cuadro: lo que se exporta es exactamente lo que se puede reimportar. */
  function tarjetaRespaldo() {
    var E = global.MimoTiempoExportar;
    var I = global.MimoTiempoImportar;
    if (!E || !I) { return null; }

    var t = crear('div', 'tiempo-tarjeta');
    t.appendChild(crear('h2', 'tiempo-h', tr('tiempo.respaldo.titulo', null, 'Respaldo')));

    var area = crear('textarea', 'tiempo-entrada tiempo-area');
    area.setAttribute('data-campo', 'respaldo');
    area.rows = 4;
    area.spellcheck = false;
    area.value = borrador.respaldo || '';
    area.setAttribute('aria-label', tr('tiempo.respaldo.etiqueta', null,
      'Texto del respaldo'));
    area.placeholder = tr('tiempo.respaldo.marcador', null,
      'Pulsa Exportar para sacar el respaldo, o pega aquí uno para importarlo.');
    t.appendChild(area);

    t.appendChild(crear('p', 'tiempo-ayuda', tr('tiempo.respaldo.ayuda', null,
      'Exportar e importar usan el mismo cuadro. Importar suma lo que traiga el respaldo, no borra lo que ya hay.')));

    var linea = crear('div', 'tiempo-linea tiempo-linea--fin');
    linea.appendChild(boton('exportar', tr('tiempo.respaldo.exportar', null, 'Exportar')));
    linea.appendChild(boton('importar', tr('tiempo.respaldo.importar', null, 'Importar')));
    t.appendChild(linea);

    refs.respaldo = area;
    return t;
  }

  function vacioMotor() {
    var caja = crear('div', 'tiempo-tarjeta tiempo-vacio');
    caja.appendChild(crear('p', null, tr('tiempo.faltaMotor', null,
      'Falta el motor del bloque (bloques/tiempo/motor.js): no se pinta ningún dato inventado.')));
    return caja;
  }

  /* Pinta la estructura entera. Se llama al montar y al refrescar (cambio de
     idioma); el latido, después, solo toca texto. */
  function pintarEstructura() {
    if (!raiz) { return; }
    raiz.innerHTML = '';
    refs = {};                     /* los nodos viejos se van con el innerHTML */
    raiz.classList.add('tiempo-pantalla');
    raiz.setAttribute('aria-labelledby', 'tiempo-titulo');

    raiz.appendChild(cabecera());
    if (!motor()) {
      raiz.appendChild(vacioMotor());
      return;
    }
    raiz.appendChild(cuerpo());
    pintarReloj();
  }

  /* ------------------------------------------------- 7. pintado del reloj */

  function pintarReloj() {
    var M = motor();
    if (!M || !refs.cifra) { return; }

    var ms = cifraMs();
    var texto = fmtReloj(ms, cifraConHoras());
    if (refs.cifra.textContent !== texto) { refs.cifra.textContent = texto; }

    var p = pista();
    if (refs.pista && refs.pista.textContent !== p) { refs.pista.textContent = p; }

    var andando = corriendo();
    var modo = modoActual();

    if (refs.pill) {
      var et = estadoTexto();
      if (refs.pill.textContent !== et) { refs.pill.textContent = et; }
      refs.pill.className = 'pill pill--mini tiempo-pill' + (andando ? ' pill--ok' : '');
    }

    /* El botón primario dice lo que va a pasar, no lo que está pasando. */
    var prin = andando
      ? tr('tiempo.acc.pausar', null, 'Pausar')
      : tr('tiempo.acc.empezar', null, 'Empezar');
    if (refs.principal && refs.principal.textContent !== prin) {
      refs.principal.textContent = prin;
      refs.principal.setAttribute('aria-label', prin + ' · ' + nombreModo(modo));
    }
    if (refs.principal) {
      refs.principal.setAttribute('data-estado', andando ? 'corriendo' : 'parado');
    }

    /* Secundario y terciario cambian con el modo. Se repintan solo si cambió el
       juego de acciones, para no robar el foco a quien está con el teclado. */
    var acciones = accionesDe(modo);
    pintarAcciones(acciones);

    /* La etiqueta del registro lleva el número dentro: «Registrar 7 min». Se
       actualiza cuando cambia el minuto, no en cada latido. */
    if (refs.registrar) {
      var min = Math.round(M.cronoMs() / 60000);
      if (refs.registrar.getAttribute('data-min') !== String(min)) {
        refs.registrar.setAttribute('data-min', String(min));
        refs.registrar.textContent = min >= 1
          ? tr('tiempo.acc.registrarMin', { min: min }, 'Registrar ' + min + ' min')
          : tr('tiempo.acc.registrar', null, 'Registrar');
        refs.registrar.setAttribute('aria-label', refs.registrar.textContent);
      }
    }
  }

  /* Juego de acciones de cada modo: [acción, texto, clase]. El primario va
     aparte porque cambia de nombre sin cambiar de sitio. */
  function accionesDe(modo) {
    if (modo === 'temporizador') {
      return [{ accion: 'reiniciar', texto: tr('tiempo.acc.reiniciar', null, 'Reiniciar'), clase: '' }];
    }
    if (modo === 'pomodoro') {
      return [
        { accion: 'registrar-pomo', texto: tr('tiempo.acc.registrarBloque', null, 'Registrar el bloque'), clase: '' },
        { accion: 'parar-pomo', texto: tr('tiempo.acc.parar', null, 'Parar'), clase: 'btn--peligro' }
      ];
    }
    return [
      { accion: 'registrar', texto: tr('tiempo.acc.registrar', null, 'Registrar'), clase: '' },
      { accion: 'cero', texto: tr('tiempo.acc.cero', null, 'Poner a cero'), clase: '' }
    ];
  }

  function pintarAcciones(acciones) {
    /* Secundario y terciario son dos huecos fijos: se rellenan sin recrear el
       nodo cuando el texto coincide. */
    var huecos = [refs.secundario, refs.terciario];
    for (var i = 0; i < huecos.length; i++) {
      var nodo = huecos[i];
      var dato = acciones[i];
      if (!nodo) { continue; }
      if (!dato) {
        nodo.hidden = true;
        nodo.removeAttribute('data-accion');
        nodo.textContent = '';
        continue;
      }
      nodo.hidden = false;
      nodo.className = 'btn' + (dato.clase ? ' ' + dato.clase : '');
      nodo.setAttribute('data-accion', dato.accion);
      if (nodo.textContent !== dato.texto) {
        nodo.textContent = dato.texto;
        nodo.setAttribute('aria-label', dato.texto);
      }
    }
    /* El «Registrar N min» del cronómetro es el secundario: se marca para que
       pintarReloj lo actualice por minuto. */
    refs.registrar = (modoActual() === 'cronometro') ? refs.secundario : null;
  }

  /* ------------------------------------------------------- 8. listas y totales */

  function pintarLista() {
    if (!refs.lista) { return; }
    var M = motor();
    var lista = refs.lista;
    lista.innerHTML = '';
    if (!M) { return; }

    var sesiones = [];
    try { sesiones = M.sesionesDeDia(M.hoy()); } catch (e) { sesiones = []; }

    if (!sesiones.length) {
      var vacio = crear('li', 'tiempo-vacio', tr('tiempo.registro.vacio', null,
        'Todavía no hay sesiones hoy.'));
      lista.appendChild(vacio);
      return;
    }

    for (var i = sesiones.length - 1; i >= 0; i--) {
      var s = sesiones[i];
      var li = crear('li', 'tiempo-sesion');
      var txt = crear('span', 'tiempo-sesion__t', nombreDestino(s));
      var meta = crear('span', 'tiempo-sesion__meta',
        String(s.hora || '') + ' · ' + fmtMinutos(s.minutos));
      var quitar = crear('button', 'tiempo-sesion__quitar', '×');
      quitar.type = 'button';
      quitar.setAttribute('data-sesion', String(s.id));
      quitar.setAttribute('aria-label', tr('tiempo.acc.quitar',
        { min: fmtMinutos(s.minutos) },
        'Quitar la sesión de ' + fmtMinutos(s.minutos)));
      li.appendChild(txt);
      li.appendChild(meta);
      li.appendChild(quitar);
      lista.appendChild(li);
    }
  }

  function refrescarTotales() {
    var M = motor();
    if (!M || !refs.kpis) { return; }
    var hoy = M.hoy();
    var valores = [
      fmtMinutos(M.minutosDia(hoy)),
      fmtMinutos(M.minutosSemana(M.lunesDe(hoy))),
      fmtMinutos(M.sumaMinutos(M.sesiones()))
    ];
    var nodos = refs.kpis.querySelectorAll('.kpi__n');
    for (var i = 0; i < nodos.length && i < valores.length; i++) {
      if (nodos[i].textContent !== valores[i]) { nodos[i].textContent = valores[i]; }
    }
  }

  function refrescarDatos() {
    pintarLista();
    refrescarTotales();
    pintarReloj();
    pedirPanel();
  }

  /* ---------------------------------------------------------- 9. acciones */

  function alternativa() {
    var M = motor();
    if (!M) { return; }
    var m = modoActual();
    if (m === 'temporizador') {
      if (M.tempEstaCorriendo()) { M.tempPausar(); } else { M.tempIniciar(); }
    } else if (m === 'pomodoro') {
      if (M.pomoEstaCorriendo()) { M.pomoPausar(); } else { M.pomoIniciar(); }
    } else {
      if (M.cronoEstaCorriendo()) { M.cronoPausar(); } else { M.cronoIniciar(); }
    }
    asegurarLatido();
    pintarReloj();
    pedirPanel();
  }

  function registrarCrono() {
    var M = motor();
    if (!M) { return null; }
    var min = Math.round(M.cronoMs() / 60000);
    if (min < 1) {
      avisar(tr('tiempo.aviso.nadaQueRegistrar', null,
        'El reloj no llega a un minuto: no hay nada que registrar.'));
      return null;
    }
    var s = M.registrar(min, { ramo: destinoActual() });
    if (!s) { return null; }
    /* Se pone a cero sin parar: registrar una sesión no corta la siguiente. */
    M.cronoPonerMs(0);
    avisar(tr('tiempo.aviso.registrada', { min: fmtMinutos(min) },
      'Sesión registrada: ' + fmtMinutos(min)), 'ok', 'ic-info');
    refrescarDatos();
    return s;
  }

  function registrarManual() {
    var M = motor();
    if (!M) { return; }
    var min = Math.round(Number(refs.minutos ? refs.minutos.value : 0));
    if (!(min >= 1)) {
      avisar(tr('tiempo.aviso.minutosInvalidos', null, 'Escribe los minutos que quieres registrar.'));
      return;
    }
    var s = M.registrar(min, { ramo: destinoActual() });
    if (!s) { return; }
    avisar(tr('tiempo.aviso.registrada', { min: fmtMinutos(min) },
      'Sesión registrada: ' + fmtMinutos(min)), 'ok', 'ic-info');
    refrescarDatos();
  }

  /* En pomodoro, «Registrar el bloque» guarda los minutos del bloque de trabajo
     en curso sin tocar el ciclo. Si está en descanso, no hay nada que registrar
     y se dice: un descanso no se imputa como trabajo. */
  function registrarBloquePomo() {
    var M = motor();
    if (!M) { return; }
    var p = M.pomo();
    if (p.fase !== 'trabajo') {
      avisar(tr('tiempo.aviso.pomoDescanso', null,
        'Estás en un descanso: no se registra como trabajo.'));
      return;
    }
    var min = Math.round(M.pomoDurMs('trabajo') / 60000);
    var s = M.registrar(min, { ramo: destinoActual() });
    if (!s) { return; }
    avisar(tr('tiempo.aviso.registrada', { min: fmtMinutos(min) },
      'Sesión registrada: ' + fmtMinutos(min)), 'ok', 'ic-info');
    refrescarDatos();
  }

  /* Exportar vuelca el texto en el cuadro (y lo guarda como borrador para que
     cambiar de idioma no lo borre). Importar lee ese mismo texto: si el JSON no
     vale, no se toca nada y se dice; el bloque no se queda a medias. */
  function exportarRespaldo() {
    var E = global.MimoTiempoExportar;
    if (!E || !refs.respaldo) { return; }
    var texto = E.comoTexto();
    refs.respaldo.value = texto;
    borrador.respaldo = texto;
    var r = E.resumen();
    avisar(tr('tiempo.aviso.exportado', { sesiones: fmtSesiones(r.sesiones), min: fmtMinutos(r.minutos) },
      'Respaldo listo · ' + fmtMinutos(r.minutos) + ' · ' + fmtSesiones(r.sesiones)), 'ok', 'ic-info');
  }

  function importarRespaldo() {
    var I = global.MimoTiempoImportar;
    if (!I || !refs.respaldo) { return; }
    var texto = String(refs.respaldo.value || '');
    if (!texto.replace(/\s+/g, '')) {
      avisar(tr('tiempo.aviso.respaldoVacio', null,
        'El cuadro está vacío: pega un respaldo o pulsa Exportar primero.'));
      return;
    }
    var r = I.importarTexto(texto);
    if (!r || !r.ok) {
      avisar(tr('tiempo.aviso.importFallo', null,
        'No se pudo importar: el texto no es un respaldo de Tiempo válido.'), 'bad', 'ic-info');
      return;
    }
    borrador.respaldo = texto;
    avisar(tr('tiempo.aviso.importado',
      { sesiones: fmtSesiones(r.informe.sesiones), min: fmtMinutos(r.informe.minutos) },
      'Respaldo importado · ' + fmtMinutos(r.informe.minutos) + ' · ' + fmtSesiones(r.informe.sesiones)),
      'ok', 'ic-info');
    refrescarDatos();
  }

  function alClic(ev) {
    var objetivo = ev.target;
    while (objetivo && objetivo !== raiz && !objetivo.getAttribute) { objetivo = objetivo.parentNode; }
    if (!objetivo || objetivo === raiz) { return; }

    var modo = objetivo.getAttribute('data-modo');
    if (modo) {
      ev.preventDefault();
      if (modoActual() !== modo) {
        ponerModo(modo);
        pintarEstructura();
        asegurarLatido();
        pedirPanel();
      }
      return;
    }

    var sesion = objetivo.getAttribute('data-sesion');
    if (sesion) {
      ev.preventDefault();
      var M = motor();
      if (M && M.quitarSesion(sesion)) {
        avisar(tr('tiempo.aviso.quitada', null, 'Sesión quitada del registro.'), '', 'ic-info');
        refrescarDatos();
      }
      return;
    }

    var accion = objetivo.getAttribute('data-accion');
    if (!accion) { return; }
    ev.preventDefault();

    if (accion === 'principal') { alternativa(); return; }
    if (accion === 'registrar') { registrarCrono(); return; }
    if (accion === 'cero') {
      var M2 = motor();
      if (M2) { M2.cronoCero(); }
      pintarReloj();
      pedirPanel();
      return;
    }
    if (accion === 'reiniciar') {
      var M3 = motor();
      if (M3) { M3.tempCero(); }
      pararLatido();
      pintarReloj();
      pedirPanel();
      return;
    }
    if (accion === 'registrar-pomo') { registrarBloquePomo(); return; }
    if (accion === 'parar-pomo') {
      var M4 = motor();
      if (M4) { M4.pomoParar(); }
      pararLatido();
      pintarReloj();
      pedirPanel();
      return;
    }
    if (accion === 'registrar-manual') { registrarManual(); return; }
    if (accion === 'exportar') { exportarRespaldo(); return; }
    if (accion === 'importar') { importarRespaldo(); return; }
  }

  function alCambiar(ev) {
    var campo = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-campo') : null;
    if (!campo) { return; }
    var M = motor();
    if (!M) { return; }

    if (campo === 'destino') {
      guardarDestino(String(ev.target.value || '').replace(/^\s+|\s+$/g, ''));
      pedirPanel();
      return;
    }
    if (campo === 'minutos') {
      borrador.minutos = String(ev.target.value || '');
      return;
    }
    if (campo === 'respaldo') {
      borrador.respaldo = String(ev.target.value || '');
      return;
    }
    if (campo === 'objetivo') {
      var min = Math.round(Number(ev.target.value));
      if (!(min >= 1)) { min = 1; }
      M.tempPonerMs(min * 60000);
      pararLatido();
      pintarReloj();
      pedirPanel();
      return;
    }
    if (campo === 'pomo-trabajo' || campo === 'pomo-corto' || campo === 'pomo-largo' || campo === 'pomo-cada') {
      var cambios = {};
      cambios[campo.slice(5)] = Math.round(Number(ev.target.value));
      M.pomoConfigurar(cambios);
      pintarReloj();
      pedirPanel();
    }
  }

  /* ------------------------------------------------------------ 10. latido */

  /* Un solo intervalo para los tres modos: 250 ms es suficiente para que la
     cifra no parpadee y no gasta como un rAF por fotograma. Se apaga solo
     cuando no queda nada corriendo: un bloque desmontado no deja timers. */
  function latido() {
    var M = motor();
    if (!M) { pararLatido(); return; }

    var finTemp = false;
    var finPomo = null;
    try { finTemp = M.tempTic(); } catch (e) { finTemp = false; }
    try { finPomo = M.pomoTic(); } catch (e) { finPomo = null; }

    if (finTemp) {
      var min = Math.round(M.tempObjetivoSeg() / 60);
      var s = M.registrar(min, { ramo: destinoActual() });
      avisar(s
        ? tr('tiempo.aviso.tempFinRegistro', { min: fmtMinutos(min) },
            'Se acabó el temporizador · sesión de ' + fmtMinutos(min) + ' registrada')
        : tr('tiempo.aviso.tempFin', null, 'Se acabó el temporizador'), 'ok', 'ic-info');
      refrescarDatos();
    } else if (finPomo) {
      if (finPomo.registrada) {
        avisar(tr('tiempo.aviso.pomoRegistro', { min: fmtMinutos(finPomo.registrada) },
          'Bloque de trabajo cumplido · ' + fmtMinutos(finPomo.registrada) + ' registrados'),
          'ok', 'ic-info');
      } else {
        avisar(tr('tiempo.aviso.pomoFin', { fase: nombreFase(finPomo.terminada) },
          'Se acabó: ' + nombreFase(finPomo.terminada)), '', 'ic-info');
      }
      refrescarDatos();
    } else {
      pintarReloj();
    }

    if (!corriendo()) { pararLatido(); }
  }

  function asegurarLatido() {
    if (latidoId !== null) { return; }
    if (!corriendo()) { return; }
    latidoId = global.setInterval(latido, 250);
  }

  function pararLatido() {
    if (latidoId !== null) {
      global.clearInterval(latidoId);
      latidoId = null;
    }
  }

  /* ------------------------------------------------------- 11. panel contextual */

  /* El shell pinta esto tal cual: {titulo, bloques:[{h, items:[{t, meta}]}]}.
     No se devuelve DOM a propósito (contrato §11). Si no hay selección posible
     en este bloque, se devuelve null y el shell pinta su vacío honesto. */
  function panel() {
    if (!montada) { return null; }
    var M = motor();
    if (!M) { return null; }

    var bloques = [];
    var modo = modoActual();
    var ahora = [
      { t: tr('tiempo.panel.modo', null, 'Modo'), meta: nombreModo(modo) },
      { t: tr('tiempo.panel.estado', null, 'Estado'), meta: estadoTexto() }
    ];
    if (modo === 'pomodoro') {
      var p = M.pomo();
      ahora.push({ t: tr('tiempo.panel.fase', null, 'Fase'), meta: nombreFase(p.fase) });
      ahora.push({ t: tr('tiempo.panel.bloques', null, 'Bloques de trabajo'), meta: String(p.trabajos) });
    }
    bloques.push({ h: tr('tiempo.panel.ahora', null, 'Ahora'), items: ahora });

    var hoy = '';
    var sesHoy = [];
    var sesSem = [];
    try {
      hoy = M.hoy();
      sesHoy = M.sesionesDeDia(hoy);
      sesSem = M.sesionesDeSemana(M.lunesDe(hoy));
    } catch (e) { sesHoy = []; sesSem = []; }

    bloques.push({
      h: tr('tiempo.panel.hoy', null, 'Hoy'),
      items: [
        { t: tr('tiempo.panel.total', null, 'Total'), meta: fmtMinutos(M.sumaMinutos(sesHoy)) },
        { t: tr('tiempo.panel.sesiones', null, 'Sesiones'), meta: String(sesHoy.length) }
      ]
    });

    bloques.push({
      h: tr('tiempo.panel.semana', null, 'Esta semana'),
      items: [
        { t: tr('tiempo.panel.total', null, 'Total'), meta: fmtMinutos(M.sumaMinutos(sesSem)) },
        { t: tr('tiempo.panel.sesiones', null, 'Sesiones'), meta: String(sesSem.length) }
      ]
    });

    var todas = [];
    try { todas = M.sesiones(); } catch (e) { todas = []; }
    var ultimas = [];
    for (var i = todas.length - 1; i >= 0 && ultimas.length < 5; i--) {
      var s = todas[i];
      ultimas.push({
        t: nombreDestino(s),
        meta: fmtMinutos(s.minutos) + ' · ' + String(s.fecha || '').slice(5)
      });
    }
    if (!ultimas.length) {
      ultimas = [{ t: tr('tiempo.panel.sinSesiones', null, 'Sin sesiones registradas'), meta: '' }];
    }
    bloques.push({ h: tr('tiempo.panel.ultimas', null, 'Últimas sesiones'), items: ultimas });

    return { titulo: tr('tiempo.panel.titulo', null, 'Tiempo'), bloques: bloques };
  }

  /* ------------------------------------------------------ 12. ciclo de vida */

  function montar(raizNueva, ctxNuevo) {
    if (!raizNueva || typeof raizNueva.appendChild !== 'function') { return false; }
    if (montada) { desmontar(); }

    raiz = raizNueva;
    ctx = ctxNuevo || {};
    montada = true;
    oyentes = [];
    refs = {};
    borrador = { minutos: '25', respaldo: '' };

    escuchar(raiz, 'click', alClic);
    escuchar(raiz, 'change', alCambiar);

    pintarEstructura();
    asegurarLatido();          /* si algo quedó corriendo, se retoma al montar */
    pedirPanel();
    return true;
  }

  function desmontar() {
    pararLatido();
    olvidarOyentes();
    if (raiz) {
      raiz.innerHTML = '';
      raiz.classList.remove('tiempo-pantalla');
      raiz.removeAttribute('aria-labelledby');
    }
    raiz = null;
    ctx = null;
    refs = {};
    montada = false;
  }

  function refrescar() {
    if (!montada || !raiz) { return false; }
    /* Se guarda lo escrito antes de repintar: cambiar de idioma no puede costar
       los minutos que el usuario tenía a medio teclear. */
    if (refs.minutos) { borrador.minutos = String(refs.minutos.value || borrador.minutos); }
    pintarEstructura();
    asegurarLatido();
    pedirPanel();
    return true;
  }

  /* ------------------------------------------------------------ 13. registro */

  global.MimoBloques = global.MimoBloques || {};
  global.MimoBloques[ID] = {
    id: ID,
    montar: montar,
    desmontar: desmontar,
    panel: panel,
    refrescar: refrescar
  };

}(window));
