/* ---------------------------------------------------------------- tiempo */
// ---- pomodoro -------------------------------------------------------------
// Un modo mas de Tiempo: bloques de trabajo y descanso que se encadenan solos.
// Reusa la misma alarma y el mismo estado E.tiempo; nada se repite. Al terminar
// un bloque de trabajo, se registra una sesion de estudio en el ramo elegido
// (igual que el cronometro), y cada N trabajos cae un descanso largo.
function pomo(){
  const p = E.tiempo.pomodoro || (E.tiempo.pomodoro = {fase:'trabajo', restante:null, corriendo:false,
    inicio:null, trabajos:0, racha:0, hoy:null, config:{trabajo:25, corto:5, largo:15, cada:4}});
  p.config = p.config || {trabajo:25, corto:5, largo:15, cada:4};
  return p;
}
function pomoDur(fase){
  const c = pomo().config;
  return (fase === 'trabajo' ? c.trabajo : fase === 'descanso' ? c.corto : c.largo) * 60000;
}
function pomoRestanteMs(){
  const p = pomo();
  const base = p.restante != null ? p.restante : pomoDur(p.fase);
  return Math.max(0, base - (p.corriendo && p.inicio ? Date.now() - p.inicio : 0));
}
function pomoFaseSig(){
  const p = pomo();
  if (p.fase !== 'trabajo') return 'trabajo';
  // Se llama DESPUES de incrementar p.trabajos: si el numero de trabajos
  // completados es multiplo de "cada", toca descanso largo.
  const c = p.config;
  return (p.trabajos % (c.cada || 4)) === 0 ? 'largo' : 'descanso';
}
function pomoTituloFase(fase){
  return fase === 'trabajo' ? 'trabajo' : fase === 'descanso' ? 'descanso corto' : 'descanso largo';
}

/* La configuracion del pomodoro (trabajo, descanso corto, descanso largo, cada N). Sincroniza los
   campos con E.tiempo.pomodoro.config y, al cambiarlos, guarda. No toca el ciclo en marcha: el
   proximo bloque ya usa el valor nuevo. */
function enlazarPomoConfig(){
  const p = pomo();
  const c = p.config;
  const pares = [['pomo-trabajo','trabajo'], ['pomo-corto','corto'], ['pomo-largo','largo'], ['pomo-cada','cada']];
  pares.forEach(par => {
    const el = document.getElementById(par[0]);
    if (!el) return;
    // solo se pisa el valor si no coincide, para no perder el foco al escribir
    if (Number(el.value) !== c[par[1]]) el.value = c[par[1]];
    if (!el.__pomoArray) {
      el.__pomoArray = true;
      el.onchange = () => {
        const v = Math.max(1, parseInt(el.value, 10) || 1);
        c[par[1]] = v;
        guardar('Pomodoro configurado');
        // si no hay bloque en marcha, el reloj refleja la duracion nueva al instante
        if (!p.corriendo) { p.restante = null; }
        pintarReloj();
      };
    }
  });
}

// Los 7 dias de la semana seleccionada (lunes..domingo), como fechas ISO.
function diasDeLaSemana(lunes){
  const out = [];
  for (let k = 0; k < 7; k++) out.push(sumaDias(lunes, k));
  return out;
}
// Los mismos 7 dias, pero con el de HOY primero (si cae en la semana): la semana se lee de hoy
// hacia adelante y luego lo que queda. Es lo que hace que "la sesion actual se vea primero" y que
// la semana se muestre, por ejemplo, de martes a lunes en vez de lunes a domingo.
function diasConHoyPrimero(dias){
  const i = dias.indexOf(hoy());
  return i <= 0 ? dias.slice() : dias.slice(i).concat(dias.slice(0, i));
}
// Las sesiones que caen dentro de la semana seleccionada, ordenadas por fecha y hora.
function sesionesDeLaSemana(lunes){
  const dias = diasDeLaSemana(lunes);
  return est().sesiones
    .filter(s => dias.includes(s.fecha))
    .sort((a, b) => a.fecha === b.fecha ? (a.hora || '').localeCompare(b.hora || '') : a.fecha.localeCompare(b.fecha));
}
// Nombre legible de un dia de la semana (lunes..domingo -> "Lunes 21 de Septiembre").
const NOMBRES_DIA = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
function etiquetaDia(fecha){
  const d = aFecha(fecha);
  return NOMBRES_DIA[(d.getDay() + 6) % 7] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()];
}
// Duracion del temporizador, en SEGUNDOS. Se guarda ahi, y no en minutos, para no perder los
// segundos que el usuario escribe en el reloj. Si un estado viejo traia minutos, se convierte.
function segObjetivo(tp){
  if (tp && tp.objetivoSeg != null) return tp.objetivoSeg;
  return ((tp && tp.objetivo) || 25) * 60;
}
// El tiempo "actual" del modo activo, en milisegundos. Para el cronometro es lo acumulado (sube);
// para el temporizador es lo que queda por correr (baja). Cada uno usa SU estado, no se pisan.
function tiempoActualMs(){
  const t = E.tiempo;
  if (t.modo === 'pomodoro') return pomoRestanteMs();
  if (t.modo === 'temporizador'){
    const tp = t.temp || (t.temp = {objetivo:25, restante:null, corriendo:false, inicio:null});
    const base = tp.restante != null ? tp.restante : segObjetivo(tp) * 1000;
    return Math.max(0, base - (tp.corriendo && tp.inicio ? Date.now() - tp.inicio : 0));
  }
  const c = t.crono || (t.crono = {acumulado:0, corriendo:false, inicio:null});
  return (c.acumulado || 0) + (c.corriendo && c.inicio ? Date.now() - c.inicio : 0);
}
function estaCorriendo(){
  const t = E.tiempo;
  if (t.modo === 'pomodoro') return !!pomo().corriendo;
  if (t.modo === 'temporizador') return !!(t.temp && t.temp.corriendo);
  return !!(t.crono && t.crono.corriendo);
}
function renderTiempo(){
  const t = E.tiempo;
  enlazarSonido();
  const ms = tiempoActualMs();
  const reloj = document.getElementById('crono-reloj');
  document.querySelectorAll('.modo').forEach(b => b.classList.toggle('on', b.dataset.modo === t.modo));
  pintarReloj();
  const extra = document.getElementById('crono-extra');
  const recPanel = document.getElementById('rec-panel');
  if (t.modo === 'recordatorios'){
    if (recPanel) recPanel.hidden = false;
    if (extra) extra.innerHTML = '';
    // en modo recordatorios el reloj no cuenta: se oculta el reloj y los controles play/pausa/parar
    document.getElementById('crono-reloj').textContent = 'Recordatorios';
    pintarRecordatorios();
    enlazarRecordatorios();
    // ocultar campos de ramo/semana/dia (no aplican a recordatorios)
    ['crono-ramo','crono-semana','crono-dia'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.closest('.campo')) el.closest('.campo').style.display = 'none';
    });
    const controles = document.getElementById('crono-play') && document.getElementById('crono-play').closest('.controles');
    if (controles) controles.style.display = 'none';
    const sesiones = document.querySelector('.sesiones');
    if (sesiones) sesiones.style.display = 'none';
    return;
  } else {
    if (recPanel) recPanel.hidden = true;
    const controles = document.getElementById('crono-play') && document.getElementById('crono-play').closest('.controles');
    if (controles) controles.style.display = '';
    const sesiones = document.querySelector('.sesiones');
    if (sesiones) sesiones.style.display = '';
    ['crono-ramo','crono-semana','crono-dia'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.closest('.campo')) el.closest('.campo').style.display = '';
    });
  }
  if (t.modo === 'pomodoro'){
    const p = pomo();
    extra.innerHTML = '<div class="destino">' + esc(pomoTituloFase(p.fase)) +
      ' · ' + p.trabajos + ' trabajo(s) hoy · racha ' + p.racha + '</div>';
    // la configuracion del pomodoro aparece solo aca
    const pc = document.getElementById('pomo-config');
    if (pc) { pc.hidden = false; enlazarPomoConfig(); }
  } else {
    const pc = document.getElementById('pomo-config');
    if (pc) pc.hidden = true;
    extra.innerHTML = t.modo === 'temporizador'
      ? '<div class="destino">Cuenta atrás desde ' + fmtHM(segObjetivo(t.temp) / 60) +
        '. Al llegar a cero se detiene sola.</div>'
      : '';
  }
  pintarControles();
  const ramoSel = document.getElementById('crono-ramo'), semSel = document.getElementById('crono-semana'),
        diaSel = document.getElementById('crono-dia');
  const ramos = ramosH();
  if (ramoSel.options.length !== ramos.length) {
    ramoSel.innerHTML = ramos.map(r => '<option value="' + r.codigo + '">' + esc(r.alias) + '</option>').join('');
  }
  t.ramo = t.ramo && ramos.some(r => r.codigo === t.ramo) ? t.ramo : ramos[0].codigo;
  ramoSel.value = t.ramo;
  const semanas = semActivo().semanas;
  if (semSel.options.length !== semanas.length) {
    semSel.innerHTML = semanas.map(w => '<option value="' + w.lunes + '">' + esc(w.etiqueta) + ' · ' +
      rangoSemana(w.lunes) + '</option>').join('');
  }
  t.semana = t.semana && semanas.some(w => w.lunes === t.semana) ? t.semana : semanaDe(hoy());
  semSel.value = t.semana;
  // Sin semestre no hay semanas ni dias que elegir: se deja el hueco vacio y se avisa, sin romper.
  if (!semanas.length || !t.semana) {
    if (diaSel.options.length !== 0) diaSel.innerHTML = '';
    document.getElementById('crono-sesiones').innerHTML =
      '<p class="ayuda">Crea un semestre para empezar a registrar tus sesiones.</p>';
    return;
  }
  // Los 7 dias de la semana elegida, para el selector de dia y para agrupar las sesiones. Van con
  // HOY primero: lo actual arriba, y el resto detras.
  const dias = diasConHoyPrimero(diasDeLaSemana(t.semana));
  // El selector de dia se rehace cuando cambia la semana (o su orden). Antes se comparaba solo el
  // NUMERO de opciones, que siempre es 7: al cambiar de semana las etiquetas se quedaban viejas.
  const firma = dias.join('|');
  if (diaSel.dataset.dias !== firma) {
    diaSel.innerHTML = dias.map(f => '<option value="' + f + '">' + esc(etiquetaDia(f)) + '</option>').join('');
    diaSel.dataset.dias = firma;
  }
  // El dia por defecto es HOY si cae dentro de la semana; si no, el lunes. El valor efectivo se
  // persiste en registrarMinutos() (cuando de verdad se registra) para no guardar a cada render.
  t.dia = t.dia && dias.includes(t.dia) ? t.dia : (dias.includes(hoy()) ? hoy() : dias[0]);
  diaSel.value = t.dia;

  // Sesiones de la semana, agrupadas por dia, cada dia con su total. El orden es el de `dias`,
  // que lleva HOY primero: la sesion actual (y su dia) encabezan la lista.
  const orden = {};
  dias.forEach((f, i) => { orden[f] = i; });
  const lista = sesionesDeLaSemana(t.semana)
    .sort((a, b) => (orden[a.fecha] - orden[b.fecha]) || (a.hora || '').localeCompare(b.hora || ''));
  // Se agrupan las sesiones por dia y se suman sus minutos. OJO: la clase del total se escribe SIN
  // tilde (`.sesion`), que es como la define la hoja de estilos. Antes decia `sesión`, con tilde,
  // y esa regla NO coincidia nunca: el total se quedaba sin su separacion ni su alineacion.
  const grupos = [];
  lista.forEach(x => {
    let g = grupos[grupos.length - 1];
    if (!g || g.fecha !== x.fecha) { g = {fecha: x.fecha, minutos: 0, sesiones: []}; grupos.push(g); }
    g.minutos += x.minutos; g.sesiones.push(x);
  });
  const filaSes = x =>
    '<div class="sesion"><span>' + (x.hora ? x.hora + ' · ' : '') + esc(aliasDe(x.ramo)) + '</span>' +
    '<span class="h">' + x.minutos + ' min <button class="quitar" data-sesion="' + x.id +
    '" style="margin-left:6px">×</button></span></div>';
  const filaTotal = g =>
    '<div class="sesion total"><span>Total del día</span><span class="h">' + fmtHM(g.minutos) + '</span></div>';
  // El dia de HOY (si cae en esta semana) va ARRIBA y destacado, con su propio total; el resto de
  // dias de la semana va debajo, mas apagado. Se mantiene el color de la seccion (el acento).
  let html = '';
  const hayHoy = grupos.length && grupos[0].fecha === hoy();
  if (hayHoy) {
    const g = grupos[0];
    html += '<div class="hoy-caja"><div class="hoy-tit"><b>Hoy · ' + esc(etiquetaDia(g.fecha)) +
      '</b><span class="h">' + fmtHM(g.minutos) + '</span></div>' +
      g.sesiones.map(filaSes).join('') + '</div>';
  }
  if (grupos.length > (hayHoy ? 1 : 0)) {
    if (hayHoy) html += '<div class="resto-tit">Resto de la semana</div>';
    (hayHoy ? grupos.slice(1) : grupos).forEach(g => {
      html += '<div class="dia-titulo">' + esc(etiquetaDia(g.fecha)) + '</div>' +
        g.sesiones.map(filaSes).join('') + filaTotal(g);
    });
  }
  document.getElementById('crono-sesiones').innerHTML = html ||
    '<p class="ayuda">Todavía no registras sesiones en esta semana.</p>';
  document.querySelectorAll('[data-sesion]').forEach(el => el.onclick = () => {
    const s = est();
    const i = s.sesiones.findIndex(x => String(x.id) === el.dataset.sesion);
    if (i < 0) return;
    const x = s.sesiones[i];
    if (s.minutos[x.lunes] && s.minutos[x.lunes][x.ramo] !== undefined)
      s.minutos[x.lunes][x.ramo] = Math.max(0, s.minutos[x.lunes][x.ramo] - x.minutos);
    s.sesiones.splice(i, 1);
    guardar('Sesión deshecha'); renderTodo(); renderTiempo();
  });
}
function aliasDe(cod){
  const r = ramosH().find(x => x.codigo === cod);
  return r ? r.alias : cod;
}
function cronoPlay(){
  const t = E.tiempo;
  esconderAvisoRegistro();
  if (t.modo === 'pomodoro'){
    const p = pomo();
    if (p.restante == null || p.restante <= 0) p.restante = pomoDur(p.fase);
    p.corriendo = true; p.inicio = Date.now();
  } else if (t.modo === 'temporizador'){
    const tp = t.temp;
    // si no hay restante guardado (recien iniciado o llego a cero), parte del objetivo
    if (tp.restante == null || tp.restante <= 0) tp.restante = segObjetivo(tp) * 1000;
    tp.corriendo = true; tp.inicio = Date.now();
  } else {
    const c = t.crono;
    c.corriendo = true; c.inicio = Date.now();
  }
  guardar(); renderTiempo();
}
function cronoPausa(){
  const t = E.tiempo;
  if (t.modo === 'pomodoro'){
    const p = pomo();
    p.restante = pomoRestanteMs(); p.corriendo = false; p.inicio = null;
  } else if (t.modo === 'temporizador'){
    const tp = t.temp;
    tp.restante = tiempoActualMs();
    tp.corriendo = false; tp.inicio = null;
  } else {
    const c = t.crono;
    c.acumulado = tiempoActualMs();
    c.corriendo = false; c.inicio = null;
  }
  guardar(); renderTiempo();
}
// Parar: congela el tiempo y, si hay algo por registrar (>= 1 min), pregunta antes de
// registrar o descartar. Aplica a los DOS modos: al cronometro no hay que olvidarlo, y al
// temporizador igual se le pregunta si lo detuviste antes de llegar a cero.
function cronoParar(){
  const t = E.tiempo;
  const min = minutosActuales();
  if (t.modo === 'pomodoro'){
    const p = pomo();
    p.restante = null; p.corriendo = false; p.inicio = null;
    guardar(); renderTiempo();
    return;   // el pomodoro no pregunta por registro: se encadena solo
  }
  if (t.modo === 'temporizador'){
    const tp = t.temp;
    tp.restante = tiempoActualMs();
    tp.corriendo = false; tp.inicio = null;
  } else {
    const c = t.crono;
    c.acumulado = tiempoActualMs();
    c.corriendo = false; c.inicio = null;
  }
  guardar(); renderTiempo();
  if (min < 1) { mostrarAviso('Menos de un minuto: no hay nada que registrar'); return; }
  mostrarAvisoRegistro(min);
}
// Cuantos minutos llego a correr el modo activo en este momento, redondeado.
function minutosActuales(){
  const t = E.tiempo;
  if (t.modo === 'pomodoro') return 0;   // el pomodoro registra solo al completar una fase
  if (t.modo === 'temporizador'){
    const tp = t.temp;
    const transcurrido = segObjetivo(tp) * 1000 - tiempoActualMs();
    return Math.round(transcurrido / 60000);
  }
  return Math.round(tiempoActualMs() / 60000);
}
// Muestra el aviso "¿registrar estos X min?" con el ramo y los botones.
function mostrarAvisoRegistro(min){
  const t = E.tiempo;
  const caja = document.getElementById('crono-aviso');
  const texto = document.getElementById('crono-aviso-texto');
  if (caja) caja.hidden = false;
  if (texto) texto.textContent = '¿Registrar estos ' + min + ' min en ' + aliasDe(t.ramo) + '?';
}
function esconderAvisoRegistro(){
  const caja = document.getElementById('crono-aviso');
  if (caja) caja.hidden = true;
}
// El "Registrar" del aviso: guarda los minutos en la semana y cierra el aviso.
function avisoRegistrarSi(){
  const t = E.tiempo;
  const min = minutosActuales();
  esconderAvisoRegistro();
  if (min < 1) return;
  registrarMinutos(min);
}
// El "Descartar" del aviso: no registra; solo cierra el aviso y deja el reloj en cero.
function avisoRegistrarNo(){
  esconderAvisoRegistro();
  cronoCero();
}
// Suma los minutos al ramo/dia/semana elegidos y crea la sesion (lo que antes hacia
// cronoRegistrar con el boton "Registrar en la semana").
function registrarMinutos(min){
  const t = E.tiempo;
  const s = est();
  // El dia elegido es el que vale; si quedo fuera de la semana (por cambiar de semana sin tocar el
  // dia), se reacomoda al lunes de la semana. Se persiste aqui, en el momento de registrar, para que
  // la sesion quede en el dia exacto y no caiga a hoy/el lunes al recargar.
  if (!t.dia || !diasDeLaSemana(t.semana).includes(t.dia)) t.dia = diasDeLaSemana(t.semana)[0];
  s.minutos[t.semana] = s.minutos[t.semana] || {};
  s.minutos[t.semana][t.ramo] = (Number(s.minutos[t.semana][t.ramo]) || 0) + min;
  const d = new Date();
  s.sesiones.push({id:'s' + Date.now(), fecha:t.dia, lunes:t.semana, ramo:t.ramo, minutos:min,
                   hora:dos(d.getHours()) + ':' + dos(d.getMinutes())});
  cronoCero();
  guardar('Registrados ' + min + ' min en ' + aliasDe(t.ramo));
  renderTodo(); renderTiempo();
}
function cronoCero(){
  const t = E.tiempo;
  esconderAvisoRegistro();
  if (t.modo === 'temporizador'){
    t.temp.restante = segObjetivo(t.temp) * 1000;
    t.temp.corriendo = false; t.temp.inicio = null;
  } else {
    t.crono.acumulado = 0;
    t.crono.inicio = t.crono.corriendo ? Date.now() : null;
  }
  guardar(); renderTiempo();
}
function cronoRegistrar(){
  // Se conserva por compatibilidad: registra lo que corrio de inmediato, sin aviso.
  const t = E.tiempo;
  const min = minutosActuales();
  if (min < 1) { mostrarAviso('Menos de un minuto: no hay nada que registrar'); return; }
  registrarMinutos(min);
}
function pintarReloj(){
  const t = E.tiempo;
  const ms = tiempoActualMs();
  const reloj = document.getElementById('crono-reloj');
  if (!reloj) return;
  // Reloj editable: se ve como texto, pero cada parte (hh, mm, ss) es un input.
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const seg = Math.floor((ms % 60000) / 1000);
  if (document.activeElement && document.activeElement.classList &&
      document.activeElement.classList.contains('rlj')) return;   // no pisar al que edita
  reloj.innerHTML = '<input type="number" class="rlj" data-parte="h" min="0" max="99" value="' + dos(h) + '">' +
    ':' + '<input type="number" class="rlj" data-parte="m" min="0" max="59" value="' + dos(m) + '">' +
    ':' + '<input type="number" class="rlj" data-parte="s" min="0" max="59" value="' + dos(seg) + '">';
  reloj.className = 'reloj' + (estaCorriendo() ? ' corriendo' : '') +
                     (t.modo === 'temporizador' ? ' modo-temporizador' : '');
  reloj.querySelectorAll('.rlj').forEach(inp => inp.onchange = () => {
    const hh = parseInt(reloj.querySelector('[data-parte=h]').value || '0', 10) || 0;
    const mm = parseInt(reloj.querySelector('[data-parte=m]').value || '0', 10) || 0;
    const ss = parseInt(reloj.querySelector('[data-parte=s]').value || '0', 10) || 0;
    const nuevoMs = (hh * 3600 + mm * 60 + ss) * 1000;
    // En temporizador, lo que se edita es el tiempo QUE QUEDA; en cronometro, el acumulado.
    if (t.modo === 'temporizador') {
      // La duracion se guarda en SEGUNDOS: antes se redondeaba a minutos y los segundos que el
      // usuario escribia en el reloj se perdian (p. ej. 00:00:45 se volvian 1 min).
      t.temp.objetivoSeg = Math.max(1, Math.round(nuevoMs / 1000));
      t.temp.restante = nuevoMs;
      t.temp.corriendo = false; t.temp.inicio = null;
    } else {
      t.crono.acumulado = nuevoMs;
      t.crono.inicio = t.crono.corriendo ? Date.now() : null;
    }
    guardar('Tiempo ajustado a mano'); renderTiempo(); renderTodo();
  });
  pintarControles();
}
// Habilita/deshabilita los tres controles segun el estado: corriendo -> Pausa y Parar activos,
// Play apagado; detenido/pausado -> Play activo, Pausa y Parar apagados (salvo Parar si hay algo
// que parar). Los botones tienen icono fijo, no cambian de texto.
function pintarControles(){
  const corriendo = estaCorriendo();
  const play = document.getElementById('crono-play');
  const pausa = document.getElementById('crono-pausa');
  const parar = document.getElementById('crono-parar');
  if (play) play.disabled = corriendo;
  if (pausa) pausa.disabled = !corriendo;
  if (parar) parar.disabled = !corriendo;
}
setInterval(() => {
  const t = E.tiempo;
  // los recordatorios se revisan SIEMPRE, esten o no corriendo un cronometro: suenan por hora.
  if (typeof revisarRecordatorios === 'function'){ try { revisarRecordatorios(); } catch(e){} }
  if (!estaCorriendo()) return;
  if (t.modo === 'pomodoro'){
    if (pomoRestanteMs() <= 0){
      const p = pomo();
      const faseTerminada = p.fase;
      const hoyStr = hoy();
      if (p.hoy !== hoyStr){ p.hoy = hoyStr; p.trabajos = 0; p.racha = 0; }
      if (faseTerminada === 'trabajo'){
        p.trabajos++;
        p.racha++;
        try { registrarMinutos(p.config.trabajo); } catch(e){}
        guardar('Pomodoro: trabajo completado (' + p.config.trabajo + ' min)');
      } else {
        guardar('Pomodoro: descanso terminado');
      }
      p.fase = pomoFaseSig();
      p.restante = null; p.corriendo = false; p.inicio = null;
      alarmaTiempo();
      renderTiempo();
      return;
    }
  }
  if (t.modo === 'temporizador' && tiempoActualMs() <= 0) {
    t.temp.restante = 0; t.temp.corriendo = false; t.temp.inicio = null;
    guardar('Tiempo cumplido'); alarmaTiempo();
    renderTiempo();
    return;
  }
  if (document.querySelector('.seccion[data-seccion="tiempo"]') &&
      !document.querySelector('.seccion[data-seccion="tiempo"]').hasAttribute('hidden')) pintarReloj();
}, 500);

/* Avisa que se cumplio el tiempo. Tres cosas a la vez, porque el alumno esta estudiando y no
   mirando la pantalla: suena, sale el aviso en pantalla, y si el navegador lo permite, una
   notificacion del sistema.

   El sonido es un archivo (alarma.mp3), que se reproduce al cumplirse el temporizador. Se reusa un
   solo elemento <audio> para no crear uno nuevo en cada aviso. */
function alarmaTiempo(){
  mostrarAviso('Se cumplió el tiempo del temporizador');
  if (E.ajustes && E.ajustes.sonido === false) return;
  try {
    // Un solo <audio> reutilizado: se busca, y si no existe se crea apuntando al mp3.
    let a = document.getElementById('audio-alarma');
    if (!a) {
      a = document.createElement('audio');
      a.id = 'audio-alarma';
      a.src = 'sonido/alarma.mp3';
      a.preload = 'auto';
      document.body.appendChild(a);
    }
    a.currentTime = 0;
    const p = a.play();
    // "play" devuelve una promesa: si el navegador lo bloquea (file:// sin interaccion previa),
    // queda la notificacion y el aviso en pantalla como red de seguridad.
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* si el navegador no deja sonar, queda el aviso en pantalla */ }
  try {
    if (!window.Notification) return;
    if (Notification.permission === 'granted') {
      new Notification('Se cumplió el tiempo', {body: 'El temporizador llegó a cero.'});
    } else if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (e) { /* abriendo el archivo desde el disco, el navegador puede no dejar notificar */ }
}

/* ---- recordatorios (cuarto modo) -----------------------------------------
   Recordatorios por hora: suenan solo si la app esta ABIERTA en ese momento.
   Si estaba cerrada, se saltan sin aviso (no se acumulan). Tipos:
   - 'una': hora + dia concreto, se borra tras sonar.
   - 'prog': varias horas + dias marcados (L..D), suena cada dia marcado.
   El sonido es configurable: propia (alarma.mp3), subida (archivo del usuario) o
   del navegador (beep por Web Audio). Persistido en E.tiempo.recordatorios + recSonido. */

function recordatorios(){
  if (!Array.isArray(E.tiempo.recordatorios)) E.tiempo.recordatorios = [];
  return E.tiempo.recordatorios;
}

function recHoyISO(){ return hoy(); }

function pintarRecordatorios(){
  const lista = document.getElementById('rec-lista');
  const recs = recordatorios();
  if (!lista) return;
  if (!recs.length){
    lista.innerHTML = '<p class="ayuda">Todavía no hay recordatorios. Agrega uno arriba.</p>';
    return;
  }
  lista.innerHTML = recs.map(r => {
    let detalle;
    if (r.tipo === 'una'){
      detalle = 'una vez · ' + etiquetaDia(r.fecha);
    } else {
      const nombres = ['L','M','X','J','V','S','D'];
      const dias = (r.dias || []).map(d => nombres[d]).join(' ');
      detalle = 'programado · ' + (r.horas || []).join(', ') + ' · ' + dias;
    }
    const sonido = r.sonido === 'sistema' ? 'pitido'
      : r.sonido === 'subida' ? 'timbre propio' : 'alarma de mimo';
    return '<div class="rec-item">' +
      '<span class="rec-hora">' + esc((r.horas || []).join(', ') || r.hora) + '</span>' +
      '<span class="rec-txt">' + esc(r.texto) + '</span>' +
      '<span class="rec-det">' + detalle + ' · ' + sonido + '</span>' +
      '<button class="quitar rec-quitar" data-rec="' + r.id + '">×</button></div>';
  }).join('');
  document.querySelectorAll('[data-rec]').forEach(el => el.onclick = () => {
    const recs = recordatorios();
    const i = recs.findIndex(x => String(x.id) === el.dataset.rec);
    if (i < 0) return;
    recs.splice(i, 1);
    guardar('Recordatorio quitado'); pintarRecordatorios();
  });
}

function agregarRecordatorio(){
  const tipo = document.getElementById('rec-tipo-una').classList.contains('on') ? 'una' : 'prog';
  const texto = (document.getElementById('rec-texto').value || '').trim();
  const horasRaw = (document.getElementById('rec-horas').value || '').trim();
  if (!texto){ mostrarAviso('Escribe qué quieres recordar'); return; }
  if (!horasRaw){ mostrarAviso('Escribe al menos una hora (ej. 22:00)'); return; }
  const horas = horasRaw.split(',').map(h => h.trim()).filter(h => /^\d{1,2}:\d{2}$/.test(h))
    .map(h => { const [hh,mm] = h.split(':'); return String(hh).padStart(2,'0') + ':' + mm; });
  if (!horas.length){ mostrarAviso('La hora debe tener el formato HH:MM'); return; }
  const sonido = E.tiempo.recSonido || 'propia';
  let r = { id: Date.now(), tipo: tipo, horas: horas, texto: texto, sonido: sonido };
  if (tipo === 'una'){
    const fecha = document.getElementById('rec-fecha').value;
    if (!fecha){ mostrarAviso('Elige el día para "una vez"'); return; }
    r.fecha = fecha;
    r.dias = [];
  } else {
    r.dias = Array.from(document.querySelectorAll('.rec-dia.on')).map(b => parseInt(b.dataset.dia, 10));
    if (!r.dias.length){ mostrarAviso('Marca al menos un día'); return; }
    r.fecha = null;
  }
  recordatorios().push(r);
  guardar('Recordatorio agregado');
  pintarRecordatorios();
  // limpiar solo el texto, dejar horas para repetir
  document.getElementById('rec-texto').value = '';
}

function enlazarRecordatorios(){
  document.querySelectorAll('.rec-tipo-btn').forEach(b => b.onclick = () => {
    document.querySelectorAll('.rec-tipo-btn').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    const esUna = b.dataset.tipo === 'una';
    document.getElementById('rec-campo-fecha').style.display = esUna ? '' : 'none';
    document.getElementById('rec-campo-dias').style.display = esUna ? 'none' : '';
  });
  document.querySelectorAll('.rec-dia').forEach(b => b.onclick = () => b.classList.toggle('on'));
  const agr = document.getElementById('rec-agregar');
  if (agr) agr.onclick = agregarRecordatorio;

}

/* El sonido y el aviso del sistema se enlazan SIEMPRE al pintar Tiempo. Antes vivian dentro de
   enlazarRecordatorios(), que solo se llama en el modo recordatorios: por eso los botones del panel
   de ajustes no respondian si no estabas en ese modo. */
function enlazarSonido(){
  let sonActual = E.tiempo.recSonido || 'propia';
  const raizSon = document.getElementById('p-ajustes') || document;
  const pintarSon = () => {
    raizSon.querySelectorAll('.rec-son-btn').forEach(b => b.classList.toggle('on', b.dataset.sonido === sonActual));
    const campoArchivo = document.getElementById('rec-campo-archivo');
    if (campoArchivo) campoArchivo.hidden = sonActual !== 'archivo';
    const nom = document.getElementById('rec-archivo-nom');
    if (nom && !E.tiempo.recTimbre && typeof window.t === 'function') nom.textContent = window.t('tiempo.sin.archivo');
  };
  raizSon.querySelectorAll('.rec-son-btn').forEach(b => b.onclick = () => {
    sonActual = b.dataset.sonido;
    E.tiempo.recSonido = sonActual;
    guardar('Sonido del aviso cambiado'); pintarSon();
  });

  // El boton circular de doble corchea abre el selector de archivo nativo (oculto).
  const bt = document.getElementById('rec-bitacora');
  const arch = document.getElementById('rec-archivo');
  if (bt && arch && !arch.__mimoEnlazado) {
    arch.__mimoEnlazado = true;
    bt.onclick = () => arch.click();
    arch.onchange = () => {
      if (arch.files && arch.files[0]){
        const f = arch.files[0];
        E.tiempo.recTimbre = URL.createObjectURL(f);
        guardar('Timbre propio guardado');
        const nom = document.getElementById('rec-archivo-nom');
        if (nom) nom.textContent = f.name;
      }
    };
  }
  pintarSon();
  pintarNotificacion();
}

/* Pinta el estado del aviso del sistema en el panel de Tiempo. NO pide permiso aqui: solo informa
   (pedirlo sin un clic del usuario lo bloquean los navegadores). El permiso lo pide el boton. */
function pintarNotificacion(){
  const est = document.getElementById('aj-notif-estado');
  const btn = document.getElementById('aj-notif-pedir');
  if (!est || !btn) return;
  const soporta = ('Notification' in window);
  const permiso = soporta ? window.Notification.permission : 'no';
  const clave = !soporta ? 'ajustes.notif.nosoporte'
    : permiso === 'granted' ? 'ajustes.notif.concedido'
    : permiso === 'denied' ? 'ajustes.notif.denegado'
    : 'ajustes.notif.explica';
  est.setAttribute('data-i18n', clave);
  if (typeof window.t === 'function') est.textContent = window.t(clave);
  btn.hidden = !soporta || permiso === 'granted' || permiso === 'denied';
  btn.onclick = () => {
    try {
      const r = window.Notification.requestPermission(pintarNotificacion);
      if (r && r.then) r.then(pintarNotificacion);
    } catch (e) { /* peticion antigua con callback: ya se paso pintarNotificacion */ }
  };
}

function revisarRecordatorios(){
  const recs = recordatorios();
  if (!recs.length) return;
  const ahora = new Date();
  const hhmm = String(ahora.getHours()).padStart(2,'0') + ':' + String(ahora.getMinutes()).padStart(2,'0');
  // los recordatorios 'una' comparan su fecha con la de HOY; los 'prog' con el dia de la semana.
  const hoyISO = recHoyISO();
  const diaSemana = ahora.getDay(); // 0=Domingo .. 6=Sabado
  const aSonar = [];
  const aBorrar = [];
  recs.forEach(r => {
    let toca = false;
    if (r.tipo === 'una'){
      if (r.fecha === hoyISO && (r.horas || []).includes(hhmm)) toca = true;
    } else {
      if ((r.dias || []).includes(diaSemana) && (r.horas || []).includes(hhmm)) toca = true;
    }
    if (toca){
      // evitar sonar dos veces el mismo minuto para el mismo recordatorio
      if (r._sono === hoyISO + hhmm) return;
      r._sono = hoyISO + hhmm;
      aSonar.push(r);
      if (r.tipo === 'una') aBorrar.push(r.id);
    }
  });
  aSonar.forEach(r => sonarRecordatorio(r));
  if (aBorrar.length){
    const ids = aBorrar;
    E.tiempo.recordatorios = recordatorios().filter(r => !ids.includes(r.id));
    guardar('Recordatorio cumplido');
    pintarRecordatorios();
  }
}

function sonarRecordatorio(r){
  mostrarAviso('Recordatorio: ' + r.texto);
  if (E.ajustes && E.ajustes.sonido === false) return;
  const fuente = r.sonido || E.tiempo.recSonido || 'propia';
  try {
    if (fuente === 'sistema'){
      // beep por Web Audio: no depende de ningun archivo
      const ctx = (window.__recCtx = window.__recCtx || (window.AudioContext && new AudioContext()));
      if (ctx){
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; g.gain.value = 0.4;
        o.start(); o.stop(ctx.currentTime + 0.6);
      }
    } else if (fuente === 'archivo' && E.tiempo.recTimbre){
      const a = document.getElementById('audio-rec-subida') || (() => {
        const el = document.createElement('audio'); el.id = 'audio-rec-subida';
        document.body.appendChild(el); return el;
      })();
      a.src = E.tiempo.recTimbre; a.currentTime = 0;
      const p = a.play(); if (p && p.catch) p.catch(() => {});
    } else {
      // propia: reuse alarmaTiempo (mismo <audio> alarma.mp3), pero sin pisar su mensaje fijo
      let a = document.getElementById('audio-alarma');
      if (!a){
        a = document.createElement('audio'); a.id = 'audio-alarma';
        a.src = 'sonido/alarma.mp3'; a.preload = 'auto'; document.body.appendChild(a);
      }
      a.currentTime = 0;
      const p = a.play(); if (p && p.catch) p.catch(() => {});
    }
  } catch(e){ /* si no puede sonar, queda el aviso en pantalla */ }
}
