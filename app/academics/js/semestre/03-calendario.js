/* ---------------------------------------------------------- calendario mes/año
   El calendario comercial (tipo Google/Apple) que libera a mimo de depender de un semestre.
   Dos vistas navegables — MES (una grilla de un mes) y AÑO (los 12 meses) — mas la tabla semanal
   academica clasica (vista SEMESTRE). Los eventos salen de todosEventos(), que ya incluye los
   personales (E.personal) y los del semestre activo, por lo que el calendario funciona igual con
   o sin semestre.

   Estado de navegacion (en la global, para sobrevivir a los repintados):
     calVista  : 'mes' | 'anio' | 'sem'
     calAnio   : año visible (mes y año)
     calMes    : mes visible (0..11), solo en vista mes
*/
const MESES_LARGOS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto',
                      'Septiembre','Octubre','Noviembre','Diciembre'];
let calVista = 'mes';
let calAnio = new Date().getFullYear();
let calMes = new Date().getMonth();

function pintarControlesCalendario(){
  document.querySelectorAll('#cl-vista-mes,#cl-vista-anio,#cl-vista-sem').forEach(b =>
    b.classList.toggle('on', b.id === 'cl-vista-' + calVista));
  document.getElementById('cl-periodo').textContent =
    calVista === 'anio' ? String(calAnio) : MESES_LARGOS[calMes] + ' ' + calAnio;
  // La etiqueta del boton de viaje absoluto se adapta al periodo de la vista activa.
  const hoy = document.getElementById('cl-hoy');
  if (hoy) hoy.textContent = calVista === 'anio' ? 'Este año' : calVista === 'sem' ? 'Esta semana' : 'Este mes';
  document.getElementById('cl-mes').style.display = (calVista === 'mes') ? '' : 'none';
  document.getElementById('cl-anio').style.display = (calVista === 'anio') ? '' : 'none';
  document.getElementById('cl-semestre').style.display = (calVista === 'sem') ? '' : 'none';
}

function eventosDelDia(fecha){
  // Aplica los MISMOS filtros que la tabla semanal (por ramo y por tipo), para que el calendario
  // comercial respete lo que el usuario eligio en la barra lateral.
  return todosEventos().filter(e => e.fecha === fecha)
    .filter(e => (e.ramo ? ramosFiltro.has(e.ramo) : true) && tiposFiltro.has(e.tipo));
}

/* Un chip de evento para la grilla del mes, reutilizando el aspecto de la tabla semanal. */
function chipDia(ev){
  const s = est();
  const c = ev.ramo ? colorDe(ev.ramo) : '#94a3b8';
  // El texto se RECORTA a dos lineas (ver .chip .txt en general.css). Como el recorte esconde el
  // resto, el titulo completo se deja en el atributo `title`: al apuntar con el raton se lee
  // entero, y el dato no se pierde. Se escapa dos veces porque va dentro de un atributo.
  const completo = esc(String(ev.texto || '')) + (ev.hora ? ' · ' + esc(ev.hora) : '');
  return '<div class="chip' + (s.hechas[ev.id] ? ' hecha' : '') + '" data-id="' + ev.id + '"' +
    ' title="' + completo + '"' +
    ' style="background:' + tinte(c, .88) + ';border-left:3px solid ' + c + '">' +
    (s.prioridades[ev.id] ? '<span class="pri pri-' + s.prioridades[ev.id] + '">' +
      (s.prioridades[ev.id] === 'alta' ? 'A' : s.prioridades[ev.id] === 'media' ? 'M' : 'B') + '</span>' : '') +
    '<span class="txt">' + esc(ev.texto) + '</span>' +
    (ev.hora ? '<span class="tipo">' + esc(ev.hora) + '</span>' : '') + '</div>';
}

/* Marca (opcional) del semestre sobre un dia del calendario: devuelve la clase de la semana
   (clases/receso/examen) y su etiqueta ("S7", "Receso", "Examen 1"), o null si ese dia no cae
   en ninguna semana del semestre activo. */
function marcaSemestreDe(fecha){
  const sem = semActivo();
  const semanas = sem.semanas || [];
  const w = semanas.find(x => fecha >= x.lunes && fecha <= x.domingo);
  if (!w) return null;
  return {tipo: (w.tipo || 'clases'), etiqueta: w.etiqueta || ''};
}

function renderMes(){
  const cont = document.getElementById('cl-mes');
  const hoyISO = hoy();
  const primero = new Date(calAnio, calMes, 1);
  // La grilla arranca el lunes de la semana del dia 1
  const diaInicio = primero.getDay();          // 0=domingo
  const offset = (diaInicio + 6) % 7;          // dias desde el lunes hasta el dia 1
  const desde = new Date(calAnio, calMes, 1 - offset);
  const diasEnMes = new Date(calAnio, calMes + 1, 0).getDate();

  let celdas = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
    const iso = aISO(d);
    const fuera = d.getMonth() !== calMes;
    const esHoy = iso === hoyISO;
    const marca = marcaSemestreDe(iso);
    const evs = eventosDelDia(iso);
    let clase = 'cal-dia' + (fuera ? ' fuera' : '') + (esHoy ? ' hoy' : '');
    if (marca) clase += ' sem-' + marca.tipo;
    let etiq = '';
    if (marca && (marca.tipo === 'receso' || marca.tipo === 'examen')) {
      etiq = '<span class="cal-marca cal-marca-' + marca.tipo + '">' + esc(marca.etiqueta) + '</span>';
    } else if (marca) {
      etiq = '<span class="cal-marca">S' + esc(marca.etiqueta.replace(/^S/, '')) + '</span>';
    }
    celdas += '<div class="' + clase + '">' +
      '<span class="cal-num">' + d.getDate() + '</span>' + etiq +
      '<div class="cal-evs">' + evs.map(chipDia).join('') + '</div></div>';
  }

  const cab = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => '<div class="cal-cab">' + d + '</div>').join('');
  cont.innerHTML = '<div class="cal-grid">' + cab + celdas + '</div>';
  enlazarChipsCalendario(cont);
}

function renderAnio(){
  const cont = document.getElementById('cl-anio');
  let html = '';
  for (let m = 0; m < 12; m++) {
    const primero = new Date(calAnio, m, 1);
    const diasEnMes = new Date(calAnio, m + 1, 0).getDate();
    const offset = (primero.getDay() + 6) % 7;
    const nombre = MESES_LARGOS[m];
    html += '<div class="cal-mes">' +
      '<div class="cal-mes-tit">' + nombre + '</div>' +
      '<div class="cal-mes-grid">' +
      ['Lu','Ma','Mi','Ju','Vi','Sá','Do'].map(d => '<span class="cal-mes-cab">' + d + '</span>').join('');
    for (let i = 0; i < offset; i++) html += '<span class="cal-mes-cel vacia"></span>';
    for (let d = 1; d <= diasEnMes; d++) {
      const iso = aISO(new Date(calAnio, m, d));
      const evs = eventosDelDia(iso);
      const marca = marcaSemestreDe(iso);
      let clase = 'cal-mes-cel num' + (evs.length ? ' con' : '') + (marca ? ' sem-' + marca.tipo : '');
      html += '<span class="' + clase + '">' + d + (evs.length ? '<i class="dot"></i>' : '') + '</span>';
    }
    html += '</div></div>';
  }
  cont.innerHTML = html;
}

function renderCalendario(){
  pintarControlesCalendario();
  if (calVista === 'mes') renderMes();
  else if (calVista === 'anio') renderAnio();
  else renderSemestre();
}

/* Refresca SOLO la vista de mes/año (sin tocar la tabla semanal ni sus KPIs). Lo llama
   renderSemestre() al final, para que al cambiar un evento el calendario comercial tambien se
   actualice, sin riesgo de recursión. */
function actualizarCalendario(){
  if (calVista === 'mes') { renderMes(); }
  else if (calVista === 'anio') { renderAnio(); }
}

/* Une los chips de la grilla del mes con el mismo click que abren el editor de evento. */
function enlazarChipsCalendario(raiz){
  (raiz || document).querySelectorAll('.chip[data-id]').forEach(el => {
    el.onclick = () => abrirEditor(el.dataset.id);
  });
}

/* Engancha los controles de navegacion del calendario. Se llama una vez al arrancar.
   - ‹ › : viaje RELATIVO (un paso respecto de donde estas): mes <- / -> mes, año <- / ->.
   - Hoy : viaje ABSOLUTO, va SIEMPRE al periodo que contiene HOY, cualquiera sea la vista:
           en Mes -> el mes actual; en Año -> el año actual; en Semestre -> la semana actual. */
function enlazarCalendario(){
  const $ = id => document.getElementById(id);
  $('cl-vista-mes').onclick = () => { calVista = 'mes'; renderCalendario(); };
  $('cl-vista-anio').onclick = () => { calVista = 'anio'; renderCalendario(); };
  $('cl-vista-sem').onclick = () => { calVista = 'sem'; renderCalendario(); };
  $('cl-ant').onclick = () => {
    if (calVista === 'anio') calAnio--;
    else { calMes--; if (calMes < 0) { calMes = 11; calAnio--; } }
    renderCalendario();
  };
  $('cl-sig').onclick = () => {
    if (calVista === 'anio') calAnio++;
    else { calMes++; if (calMes > 11) { calMes = 0; calAnio++; } }
    renderCalendario();
  };
  $('cl-hoy').onclick = () => {
    const h = new Date(); calAnio = h.getFullYear(); calMes = h.getMonth();
    if (calVista === 'sem') {
      // viaje absoluto a la semana actual de la tabla: se posiciona sobre su fila
      pintarControlesCalendario();
      renderSemestre();
      const actual = document.querySelector('#cl-cuerpo tr.actual');
      if (actual) actual.scrollIntoView({block:'center', behavior:'smooth'});
      return;
    }
    renderCalendario();
  };
}
