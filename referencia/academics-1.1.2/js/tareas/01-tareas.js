/* ---------------------------------------------------------------- tareas
   La pestaña "Tareas" (propuesta v3 aprobada 2026-09-21): un tablero que JUNTA en un
   solo lugar todo lo que ya guardan Calendario y Evaluaciones —eventos del semestre y
   "nuevas" (las tareas sueltas)— y lo muestra en tres columnas (Hoy / Esta semana /
   Hechas) con un anillo de progreso y filtros. NO crea datos nuevos: lee y escribe
   los mismos est().hechas / prioridades / eventos que ya existen. "Personal" es un
   evento SIN ramo (el "— Sin ramo —" del editor), no un tipo aparte.
*/

let tareaFiltro = 'todas';   // todas | pendientes | hoy | ramos | personal

function renderTareas(){
  const s = est(), h = hoy(), lunes = semanaDe(h);
  const lista = todosEventos();

  // ---- filtro ----
  const filtro = e => {
    if (tareaFiltro === 'pendientes') return !s.hechas[e.id];
    if (tareaFiltro === 'hoy') return e.fecha === h;
    if (tareaFiltro === 'ramos') return !!e.ramo;
    if (tareaFiltro === 'personal') return !e.ramo;
    return true;
  };
  const visibles = lista.filter(filtro);

  // ---- conteos para KPIs y anillo ----
  const lunes6 = sumaDias(lunes, 6);
  const hechasSemana = lista.filter(e => s.hechas[e.id] && e.fecha >= lunes && e.fecha <= lunes6);
  const pendientesSemana = lista.filter(e => !s.hechas[e.id] && e.fecha >= lunes && e.fecha <= lunes6);
  const hoyLista = lista.filter(e => e.fecha === h && !s.hechas[e.id]);
  const personales = lista.filter(e => !e.ramo && !s.hechas[e.id]);
  const conRamo = lista.filter(e => !!e.ramo && !s.hechas[e.id]);

  pintarFiltrosTareas();
  pintarKpisTareas(hoyLista.length, personales.length, conRamo.length);
  pintarAnilloTareas(hechasSemana.length, pendientesSemana.length);

  // ---- tres columnas ----
  const colHoy = visibles.filter(e => e.fecha === h && !s.hechas[e.id]).sort(ordenTarea);
  const colSemana = visibles.filter(e => e.fecha > h && e.fecha <= lunes6 && !s.hechas[e.id]).sort(ordenTarea);
  const colHechas = visibles.filter(e => s.hechas[e.id] && e.fecha >= lunes && e.fecha <= lunes6).sort(ordenTarea);

  document.getElementById('ta-col-hoy').innerHTML = colHoy.map(tarjetaTarea).join('') || vacio('Nada para hoy.');
  document.getElementById('ta-col-semana').innerHTML = colSemana.map(tarjetaTarea).join('') || vacio('Nada pendiente esta semana.');
  document.getElementById('ta-col-hechas').innerHTML = colHechas.map(tarjetaTarea).join('') || vacio('Todavía no marcas nada como hecho esta semana.');
  document.querySelectorAll('#p-tareas .check').forEach(el => el.onclick = () => marcar(el.dataset.id));
  document.querySelectorAll('#p-tareas .tarea[data-id]').forEach(el => el.onclick = ev => {
    if (ev.target.closest('.check')) return;
    abrirEditor(el.dataset.id);
  });
  const bNueva = document.getElementById('ta-nueva');
  if (bNueva) bNueva.onclick = () => nuevaTarea();
  // Los filtros ya filtraban las columnas, pero nadie los pulsaba: el chip cambia
  // tareaFiltro y vuelve a pintar. Sin esto el filtro quedaba muerto (siempre 'todas').
  document.querySelectorAll('#p-tareas .chip[data-filtro]').forEach(ch => ch.onclick = () => {
    tareaFiltro = ch.dataset.filtro;
    renderTareas();
  });

  enlazarDragTareas();
}

function pintarFiltrosTareas(){
  const s = est(), lista = todosEventos();
  const n = {
    todas: lista.length,
    pendientes: lista.filter(e => !s.hechas[e.id]).length,
    hoy: lista.filter(e => e.fecha === hoy()).length,
    ramos: lista.filter(e => !!e.ramo).length,
    personal: lista.filter(e => !e.ramo).length
  };
  document.querySelectorAll('#p-tareas .chip').forEach(ch => ch.classList.toggle('on', ch.dataset.filtro === tareaFiltro));
  const set = (k, id) => { const el = document.getElementById(id); if (el && el.querySelector('.n')) el.querySelector('.n').textContent = n[k]; };
  set('todas', 'ta-ch-todas'); set('pendientes', 'ta-ch-pendientes'); set('hoy', 'ta-ch-hoy');
  set('ramos', 'ta-ch-ramos'); set('personal', 'ta-ch-personal');
}

function pintarKpisTareas(hoy, personal, ramos){
  const s = est(), lista = todosEventos();
  const pend = lista.filter(e => !s.hechas[e.id]).length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ta-kpi-pend', pend); set('ta-kpi-hoy', hoy); set('ta-kpi-personal', personal); set('ta-kpi-ramo', ramos);
}

// anillo que compara hecho vs pendiente de la semana; el % pendiente sale del dato, no esta pintado
function pintarAnilloTareas(hechas, pendientes){
  const total = hechas + pendientes;
  const pct = total ? Math.round(pendientes / total * 100) : 0;
  const C = 2 * Math.PI * 50;
  const hechoLen = total ? (hechas / total) * C : 0;
  const pendLen = total ? (pendientes / total) * C : 0;
  const svg = document.getElementById('ta-anillo');
  if (!svg) return;
  svg.innerHTML =
    '<circle cx="60" cy="60" r="50" fill="none" stroke="var(--pista)" stroke-width="14"></circle>' +
    '<circle cx="60" cy="60" r="50" fill="none" stroke="var(--ok)" stroke-width="14" stroke-linecap="round" ' +
      'stroke-dasharray="' + hechoLen.toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 60 60)"></circle>' +
    '<circle cx="60" cy="60" r="50" fill="none" stroke="var(--fg)" stroke-width="14" stroke-linecap="round" ' +
      'stroke-dasharray="' + pendLen.toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="-' + hechoLen.toFixed(1) + '" transform="rotate(-90 60 60)"></circle>' +
    '<text x="60" y="57" text-anchor="middle" font-size="24" font-weight="700" fill="var(--fg)">' + pct + '%</text>' +
    '<text x="60" y="74" text-anchor="middle" font-size="10" fill="var(--muted)">pendientes</text>';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('ta-ley-hechas', hechas); set('ta-ley-pend', pendientes); set('ta-ley-total', total);
}

function tarjetaTarea(e){
  const s = est();
  const pr = s.prioridades[e.id];
  const priCls = pr === 'alta' ? 'pri-alta' : pr === 'media' ? 'pri-media' : pr === 'baja' ? 'pri-baja' : '';
  const ramo = e.ramo ? cursoDe(e.ramo) : null;
  // vinculo visible con las otras secciones: una tarea puede venir de una evaluacion
  // (Notas, origen:'notas'), de un ramo (Calendario/Estudio) o ser personal.
  const origen = e.origen === 'notas' ? ' <span class="origen-chip">ramo</span>'
    : e.origen === 'calendario' ? ' <span class="origen-chip">calendario</span>' : '';
  const ramoHtml = ramo
    ? '<div class="fila"><span class="ramo"><i style="background:' + colorDe(e.ramo) + '"></i>' +
      esc(ramo.codigo + ' · ' + (ramo.alias || ramo.nombre)) + '</span>' + origen + '</div>'
    : '<div class="fila"><span class="personal-chip">✳ personal</span>' + origen + '</div>';
  const horaHtml = e.hora
    ? '<span class="hora">🕓 ' + esc(e.hora) + (e.duracion ? ' <span class="reloj">· ' + fmtHM(e.duracion * 60) + '</span>' : '') + '</span>'
    : '';
  const fechaHtml = s.hechas[e.id]
    ? '<span class="fecha">hecha el ' + esc(etiquetaDia(e.fecha)) + '</span>'
    : (e.fecha < hoy() ? '<span class="fecha vencida">vencía el ' + esc(etiquetaDia(e.fecha)) + '</span>'
      : '<span class="fecha">' + (e.fecha === hoy() ? 'hoy' : esc(etiquetaDia(e.fecha))) + '</span>');
  return '<div class="tarea ' + priCls + (s.hechas[e.id] ? ' hecha' : '') + '" data-id="' + e.id + '" draggable="true">' +
    '<span class="check" data-id="' + e.id + '"></span>' +
    '<div class="cuerpo"><div class="titulo">' + esc(e.texto) + '</div>' +
    '<div class="meta">' + ramoHtml +
    '<div class="fila">' + horaHtml + fechaHtml + '</div></div></div></div>';
}

function marcar(id){
  const s = est();
  if (s.hechas[id]) delete s.hechas[id]; else s.hechas[id] = true;
  guardar(s.hechas[id] ? 'Tarea marcada como hecha' : 'Tarea devuelta a pendientes');
  renderSemestre(); renderTareas();
}

function vacio(t){ return '<div class="vacio">' + esc(t) + '</div>'; }


/* ---- drag & drop entre columnas ------------------------------------------
   Arrastrar una tarjeta re-fecha o re-marca la tarea segun la columna de
   destino, usando el MISMO dato que el calendario (ev.fecha / est().hechas).
   "Hoy" -> fecha de hoy; "Esta semana" -> lunes de esta semana (si ya es pasado)
   o su propia fecha si cae dentro; "Hechas" -> hechas[id]=true. Sacarla de
   "Hechas" a una columna pendiente le quita la marca y le pone fecha de hoy. */
let taArrastrando = null;

function enlazarDragTareas(){
  const colocacion = { 'ta-col-hoy': 'hoy', 'ta-col-semana': 'semana', 'ta-col-hechas': 'hechas' };

  document.querySelectorAll('#p-tareas .tarea[data-id]').forEach(tar => {
    tar.addEventListener('dragstart', ev => {
      taArrastrando = tar.dataset.id;
      tar.classList.add('arrastrando');
      try { ev.dataTransfer.setData('text/plain', tar.dataset.id); } catch(e){}
      ev.dataTransfer.effectAllowed = 'move';
    });
    tar.addEventListener('dragend', () => {
      tar.classList.remove('arrastrando');
      taArrastrando = null;
      document.querySelectorAll('#p-tareas .ta-col').forEach(c => c.classList.remove('sobre'));
    });
  });

  // Las columnas contenedoras son .ta-col; el id del destino esta en el <div> interno.
  document.querySelectorAll('#p-tareas .ta-col').forEach(col => {
    const hueco = col.querySelector('[id^="ta-col-"]');
    const destino = hueco ? colocacion[hueco.id] : null;
    if (!destino) return;
    col.addEventListener('dragover', ev => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      col.classList.add('sobre');
    });
    col.addEventListener('dragleave', () => col.classList.remove('sobre'));
    col.addEventListener('drop', ev => {
      ev.preventDefault();
      col.classList.remove('sobre');
      const id = taArrastrando || (ev.dataTransfer && ev.dataTransfer.getData('text/plain'));
      if (!id) return;
      soltarTarea(id, destino);
    });
  });
}

function soltarTarea(id, destino){
  const ev = eventoPorId(id);
  if (!ev) return;
  const s = est();
  if (destino === 'hechas'){
    if (!s.hechas[id]) { s.hechas[id] = true; guardar('Tarea marcada como hecha'); }
  } else {
    if (s.hechas[id]) { delete s.hechas[id]; guardar('Tarea devuelta a pendientes'); }
    const h = hoy(), lunes = semanaDe(h), lunes6 = sumaDias(lunes, 6);
    if (destino === 'hoy'){
      if (ev.fecha !== h) { ev.fecha = h; guardar('Tarea movida a hoy'); }
    } else { // semana
      const yaCae = ev.fecha >= lunes && ev.fecha <= lunes6;
      if (!yaCae) { ev.fecha = (h < lunes ? lunes : h); guardar('Tarea movida a esta semana'); }
    }
  }
  renderSemestre(); renderTareas();
}
