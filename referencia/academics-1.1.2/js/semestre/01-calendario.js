/* ---------------------------------------------------------------- semestre */
const ramosFiltro = new Set();
const tiposFiltro = new Set();
let vista = 'todo';
let selNotas = null;
let examenSim = {};

function resetFiltros(){
  ramosFiltro.clear();
  ramosBase().forEach(r => ramosFiltro.add(r.codigo));
  tiposFiltro.clear();
  Object.keys(tiposDe()).forEach(t => tiposFiltro.add(t));
}
function ordenTarea(a, b){
  const rank = {alta:0, media:1, baja:2};
  const pa = rank[est().prioridades[a.id]] === undefined ? 3 : rank[est().prioridades[a.id]];
  const pb = rank[est().prioridades[b.id]] === undefined ? 3 : rank[est().prioridades[b.id]];
  if (pa !== pb) return pa - pb;
  return (est().hechas[a.id] ? 1 : 0) - (est().hechas[b.id] ? 1 : 0);
}
function chipHTML(ev){
  const s = est();
  const c = ev.ramo ? colorDe(ev.ramo) : '#94a3b8';
  const pr = s.prioridades[ev.id];
  const hecha = s.hechas[ev.id];
  const badge = pr ? '<span class="pri pri-' + pr + '">' + (pr === 'alta' ? 'A' : pr === 'media' ? 'M' : 'B') + '</span>' : '';
  // Si el evento tiene ramo y nota, la nota se ve en la tarjeta del calendario, no solo dentro.
  const nota = (s.notas_evento || {})[ev.id];
  const marcaNota = (nota === null || nota === undefined) ? ''
    : '<span class="nota-chip" title="Nota de este evento">' + ver1(nota) + '</span>';
  const cuando = (ev.hora ? ' · ' + ev.hora : '') + (ev.duracion ? ' (' + ev.duracion + 'h)' : '');
  return '<div class="chip' + (hecha ? ' hecha' : '') + '" data-id="' + ev.id + '" title="' + esc(ev.texto) + '"' +
    ' style="background:' + tinte(c,.88) + ';border-left:3px solid ' + c + '">' +
    badge + (hecha ? '<span class="marca-ok">✓</span>' : '') + '<span class="txt">' + esc(ev.texto) + '</span>' +
    marcaNota + '<span class="tipo">' + esc(tiposDe()[ev.tipo] || ev.tipo) + cuando + '</span></div>';
}
// La barrita de la semana: el ANCHO dice cuanto estudiaste respecto de tu semana mas cargada, y los
// tramos son el reparto por ramo. El gris es lo que todavia no asignaste a ningun ramo.
function miniBarra(lunes){
  const m = minutosDe(lunes);
  const otros = Number(m.OTROS) || 0;
  let tot = otros;
  ramosBase().forEach(r => tot += Number(m[r.codigo]) || 0);
  if (!tot) return '';
  const tope = Math.max(1, totalSemanaMax());
  const seg = ramosBase().map(r => {
    const v = Number(m[r.codigo]) || 0;
    if (!v) return '';
    return '<i style="width:' + (v / tot * 100) + '%;background:' + colorDe(r.codigo) + '"></i>';
  }).join('') +
    (otros ? '<i style="width:' + (otros / tot * 100) + '%;background:' + OTROS.color + '"></i>' : '');
  return '<div class="barra" style="width:' + Math.max(8, tot / tope * 100).toFixed(1) + '%">' + seg + '</div>';
}
function renderSemestre(){
  const h = hoy(), s = est(), sem = semActivo();
  const cuerpo = document.getElementById('cl-cuerpo');
  const porFecha = {};
  todosEventos().forEach(e => { (porFecha[e.fecha] = porFecha[e.fecha] || []).push(e); });
  const ocultarHechas = true;   // dentro de cada celda solo se ocultan en la vista "por hacer"
  let html = '', prox = null, pendientes = 0, altas = 0;
  sem.semanas.forEach(w => {
    const dias = [];
    for (let k = 0; k < 7; k++) dias.push(sumaDias(w.lunes, k));
    const esActual = dias.includes(h);
    const esPasada = dias[6] < h;
    const porDia = dias.map(f => (porFecha[f] || [])
      .filter(e => (e.ramo ? ramosFiltro.has(e.ramo) : true) && tiposFiltro.has(e.tipo))
      .filter(e => vista !== 'pend' || !s.hechas[e.id] || E.ajustes.verHechasPorHacer)
      .sort(ordenTarea));
    const nPend = porDia.reduce((a, l) => a + l.filter(e => !s.hechas[e.id]).length, 0);
    if (!prox) {
      const c = [].concat.apply([], porDia).filter(e => e.fecha >= h && e.tipo === 'control')
        .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      if (c) prox = c;
    }
    porDia.forEach(l => l.forEach(e => {
      if (e.fecha >= h && !s.hechas[e.id]) { pendientes++; if (s.prioridades[e.id] === 'alta') altas++; }
    }));
    let mostrar = true;
    if (vista === 'prox') mostrar = !esPasada;
    if (vista === 'pend') mostrar = nPend > 0;
    const tds = porDia.map(l => '<td>' + l.map(chipHTML).join('') + '</td>').join('');
    const hSem = horasSemana(w.lunes);
    html += '<tr class="' + (esActual ? 'actual ' : '') + (esPasada ? 'pasada ' : '') + (mostrar ? '' : 'oculta') + '">' +
      '<td class="bl"><b>' + esc(w.etiqueta) + '</b><span class="sm">' + rangoSemana(w.lunes) + '</span></td>' +
      tds + '<td class="est"><b>' + (fmtHM(hSem * 60) || '0h') + '</b><span class="sm">' +
      (hSem >= s.metas.semanal ? 'meta cumplida' : 'bajo la meta') +
      '</span>' + miniBarra(w.lunes) + '</td></tr>';
  });
  cuerpo.innerHTML = html;
  cuerpo.querySelectorAll('.chip').forEach(el => el.onclick = () => abrirEditor(el.dataset.id));

  const lunes = semanaDe(h), hAct = horasSemana(lunes);
  const meta = objetivoSemanal() || s.metas.semanal;
  document.getElementById('cl-estado').innerHTML =
    kpi(fmtHM(hAct * 60) || '0h', 'esta semana · objetivo ' + fmtHM(meta * 60)) +
    kpi(prox ? aFecha(prox.fecha).getDate() + ' ' + MESES[aFecha(prox.fecha).getMonth()] + ' · ' + prox.texto.slice(0,18) : '—',
        prox ? 'próximo control' : 'sin controles pendientes') +
    kpi(pendientes + (altas ? ' (' + altas + ')' : ''), 'tareas por hacer' + (altas ? ' · ' + altas + ' de prioridad alta' : '')) +
    kpi(fmtHM(totalHoras() * 60) || '0h', 'estudio registrado en el semestre');
  // El calendario comercial (mes/año) se refresca con los mismos eventos; la tabla semanal ya se
  // pinto aqui arriba. El guard evita la recursion con renderCalendario() cuando la vista es 'sem'.
  try { actualizarCalendario(); } catch (e) { /* sin calendario montado aun: solo la tabla */ }
}
function kpi(v, t){ return '<div class="kpi"><b>' + v + '</b><span>' + t + '</span></div>'; }
