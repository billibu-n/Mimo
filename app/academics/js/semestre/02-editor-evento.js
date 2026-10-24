/* Vinculo OPCIONAL entre un evento y su ramo: si el evento tiene ramo, el usuario decide si su
   nota viaja al promedio del ramo. Antes esa conexion solo se podia crear con el boton "Pasar al
   promedio" del bloque de nota; aca se ve el estado y se puede activar o quitar al vuelo. */
function catAutoPorTipo(tipo){ return CAT_POR_TIPO[tipo] || 'General'; }
function vinculoRamoHtml(ev, id){
  if (!ev.ramo) return '';
  const comp = componenteDelEvento(ev);
  const cats = catsDe(ev.ramo);
  const cat = comp ? comp.categoria : catAutoPorTipo(ev.tipo);
  const opciones = (cats.some(c => c.nombre === cat) ? cats : cats.concat([{nombre: cat}])).map(c =>
    '<option' + (c.nombre === cat ? ' selected' : '') + '>' + esc(c.nombre) + '</option>').join('');
  return '<div class="campo m-vinculo"><span>Nota del ramo<small class="ayuda" style="display:block">suma al promedio</small></span>' +
    '<select id="m-vinc-cat">' + opciones + '</select></div>' +
    (comp
      ? '<div class="fila" style="gap:8px;align-items:center;margin:2px 0 8px"><span class="ayuda" style="flex:1">' +
        'Su nota suma al promedio de ' + esc(aliasDe(ev.ramo)) + ' (categoria ' + esc(cat) + ').</span>' +
        '<button class="btn chico" id="m-vinc-quitar">Quitar del ramo</button></div>'
      : '<div class="fila" style="gap:8px;align-items:center;margin:2px 0 8px"><span class="ayuda" style="flex:1">' +
        'Todavia no suma al promedio del ramo.</span>' +
        '<button class="btn chico" id="m-vinc-usar">Usar el ramo</button></div>');
}
/* ---------------------------------------------------------------- editor de tarea */
let editando = null;
function abrirEditor(id){
  editando = id;
  const ev = eventoPorId(id);
  if (!ev) return;
  const s = est(), pr = s.prioridades[id], f = s.fichas[id] || {};
  const esNueva = String(ev.id).startsWith('n');
  const notaEv = (est().notas_evento || {})[id];
  // Si el evento tiene ramo, la nota puede irse al promedio. La categoria se propone segun el tipo
  // de evento (un CONTROL cae en Controles, una TAREA en Tareas) y siempre se puede cambiar.
  const catsRamo = ev.ramo ? catsDe(ev.ramo) : [];
  let catSugerida = '';
  if (ev.ramo) {
    const prefiere = CAT_POR_TIPO[ev.tipo];
    catSugerida = (prefiere && catsRamo.some(c => c.nombre === prefiere)) ? prefiere
                : (catsRamo.length ? catsRamo[0].nombre : 'General');
    if (!catsRamo.some(c => c.nombre === catSugerida)) catsRamo.push({nombre:catSugerida, peso:1.0});
  }
  const opcionesCat = catsRamo.map(c => '<option' + (c.nombre === catSugerida ? ' selected' : '') + '>' +
    esc(c.nombre) + '</option>').join('');
  const bloqueNota = ev.ramo
    ? '<div class="campo"><span>Nota de este evento (1,0 a 7,0)</span>' +
      '<input type="number" id="m-nota" min="1" max="7" step="0.1" value="' +
      (notaEv === null || notaEv === undefined ? '' : notaEv) + '"></div>' +
      '<div class="fila" style="gap:6px;align-items:center"><select id="m-nota-cat">' + opcionesCat +
      '</select><button class="btn" id="m-nota-pasar">Pasar al promedio del ramo</button></div>' +
      '<p class="ayuda" id="m-nota-aviso">Se agrega como un componente con el nombre del evento. ' +
      'Si ya lo habias pasado, se actualiza en vez de repetirse.</p>'
    : '<p class="ayuda">Elige un ramo arriba y aqui aparece la nota, para pasarla al promedio.</p>';
  document.getElementById('modal-caja').innerHTML = `
    <button class="cerrar" id="cerrar">Cerrar</button>
    <div class="campo m-nombre-caja">
      <span>Nombre</span>
      <input type="text" id="m-nombre" value="${esc(ev.texto)}" placeholder="Ej: Control 1 de Álgebra">
    </div>
    ${vinculoRamoHtml(ev, id)}
    <div class="sub">${esc(ev.dia)} ${esc(ev.fecha)} · ${esc(tiposDe()[ev.tipo] || ev.tipo)}${
      ev.ramo ? ' · ' + esc((cursoDe(ev.ramo) || {}).alias || ev.ramo) : ''}</div>
    <details class="barra-extraible" open>
      <summary><span class="izq">Qué es <span class="cuenta">prioridad, fecha y ramo</span></span>
        <span class="flecha">&#9654;</span></summary>
      <div class="cuerpo">
        <div class="campo"><span>Hecha</span>
          <input type="checkbox" id="m-hecha" ${s.hechas[id] ? 'checked' : ''} style="justify-self:end"></div>
        <div class="campo" style="display:block">
          <span style="display:block;margin-bottom:5px">Prioridad</span>
          <div class="prioridades">
            <button data-p="alta" class="${pr === 'alta' ? 'on' : ''}">Alta</button>
            <button data-p="media" class="${pr === 'media' ? 'on' : ''}">Media</button>
            <button data-p="baja" class="${pr === 'baja' ? 'on' : ''}">Baja</button>
            <button data-p="" class="${!pr ? 'on' : ''}">Sin prioridad</button>
          </div>
        </div>
        <div class="campo"><span>Fecha</span><input type="date" id="m-fecha" value="${ev.fecha}"></div>
        <div class="campo"><span>Ramo</span>
          <select id="m-ramo"><option value="">— Sin ramo —</option>${
            ramosH().map(r => '<option value="' + r.codigo + '"' + (ev.ramo === r.codigo ? ' selected' : '') +
              '>' + esc(r.alias) + '</option>').join('')}</select></div>
      </div>
    </details>
    <details class="barra-extraible">
      <summary><span class="izq">Cuándo <span class="cuenta">hora, duración y tipo</span></span>
        <span class="flecha">&#9654;</span></summary>
      <div class="cuerpo">
        <div class="campo"><span>Hora de inicio</span><input type="time" id="m-hora" value="${ev.hora || ''}"></div>
        <div class="campo"><span>Duración (horas)</span>
          <input type="number" id="m-dur" min="0" max="24" step="0.25" value="${ev.duracion || ''}" placeholder="ej. 3 para un control, 1 para una actividad"></div>
        <div class="campo"><span>Tipo de evento</span>
          <select id="m-tipo">${
            Object.keys(tiposDe()).map(t => '<option value="' + t + '"' + (ev.tipo === t ? ' selected' : '') +
              '>' + esc(tiposDe()[t]) + '</option>').join('')}</select></div>
        <div class="fila" style="gap:6px;align-items:center;margin-top:6px">
          <input type="text" id="m-tipo-texto" placeholder="otro tipo, ej: Laboratorio" style="flex:1">
          <button class="btn chico" id="m-tipo-crear">+ Crear tipo</button></div>
      </div>
    </details>
    <details class="barra-extraible">
      <summary><span class="izq">Nota y temario <span class="cuenta">opcional</span></span>
        <span class="flecha">&#9654;</span></summary>
      <div class="cuerpo">
        ${bloqueNota}
        <div style="margin-top:12px"><span style="font-size:.85rem">Descripción</span>
          <textarea id="m-desc" placeholder="Qué hay que hacer, con qué material, cómo se entrega">${esc(f.descripcion || '')}</textarea></div>
        <div style="margin-top:12px"><span style="font-size:.85rem">Temario</span>
          <textarea id="m-tema" placeholder="Los temas que entran, uno por línea">${esc(f.temario || '')}</textarea></div>
      </div>
    </details>
    <div class="fila" style="margin-top:14px;gap:8px">
      ${esNueva ? '<button class="btn peligro" id="borrar">Eliminar</button>' : ''}
      <button class="btn primario" id="guardar-ficha">Guardar</button>
    </div>`;
  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;
  // El nombre es el dato que enlaza el calendario con Notas (componente.nombre === evento.texto).
  // Al cambiarlo, el evento sigue viviendo en `nuevas` (ahi esta su identidad: id, tipo, ramo) y,
  // si en su ramo ya existe un componente con el nuevo nombre, hereda su fecha en vez de duplicar.
  const inpNombre = document.getElementById('m-nombre');
  if (inpNombre) inpNombre.onchange = e2 => {
    const nuevo = e2.target.value.trim();
    if (!nuevo || nuevo === ev.texto) { e2.target.value = ev.texto; return; }
    const viejo = ev.texto;
    ev.texto = nuevo;
    if (ev.ramo) {
      const c = compsDe(ev.ramo).filter(x => x.nombre === viejo)[0];
      if (c) c.nombre = nuevo;
      else sincronizarEventoAComponente(ev);
    }
    guardar('Nombre cambiado'); renderSemestre(); pintarFiltros(); abrirEditor(id);
  };
  const bVincUsar = document.getElementById('m-vinc-usar');
  if (bVincUsar) bVincUsar.onclick = () => {
    if (!ev.texto) { const av = document.getElementById('m-vinc-cat'); if (av) av.focus(); return; }
    const cat = document.getElementById('m-vinc-cat').value;
    if (!catsDe(ev.ramo).some(c => c.nombre === cat)) {
      catsDe(ev.ramo).push({nombre: cat, peso: 1.0, color: colorLibre()});
    }
    compsDe(ev.ramo).push({nombre: ev.texto, categoria: cat, peso: 1, nota: null, fecha: ev.fecha || null});
    guardar('Vinculado al promedio de ' + aliasDe(ev.ramo)); renderTodo(); abrirEditor(id);
  };
  const bVincQuitar = document.getElementById('m-vinc-quitar');
  if (bVincQuitar) bVincQuitar.onclick = () => {
    const arr = compsDe(ev.ramo);
    const j = arr.findIndex(x => x.nombre === ev.texto);
    if (j >= 0) arr.splice(j, 1);
    guardar('Quitado del promedio de ' + aliasDe(ev.ramo)); renderTodo(); abrirEditor(id);
  };
  document.querySelectorAll('.prioridades button').forEach(b => b.onclick = () => {
    const p = b.dataset.p;
    if (p) s.prioridades[id] = p; else delete s.prioridades[id];
    guardar(); document.querySelectorAll('.prioridades button').forEach(x => x.classList.toggle('on', x === b));
    renderSemestre();
  });
  document.getElementById('m-hecha').onchange = e2 => {
    if (e2.target.checked) s.hechas[id] = true; else delete s.hechas[id];
    guardar(e2.target.checked ? 'Tarea marcada como hecha' : 'Tarea devuelta a pendientes');
    renderSemestre();
  };
  document.getElementById('m-fecha').onchange = e2 => {
    ev.fecha = e2.target.value; ev.dia = diaDeFecha(e2.target.value);
    sincronizarEventoAComponente(ev);   // calendario -> evaluaciones (mismo nombre + ramo)
    guardar(); renderSemestre();
  };
  document.getElementById('m-hora').onchange = e2 => {
    ev.hora = e2.target.value || null; guardar(); renderSemestre();
  };
  document.getElementById('m-dur').onchange = e2 => {
    const v = parseFloat(e2.target.value);
    ev.duracion = (v > 0) ? v : null; guardar(); renderSemestre();
  };
  // Cambiar ramo o tipo rehace el modal: el bloque de la nota depende de ambos.
  document.getElementById('m-ramo').onchange = e2 => {
    ev.ramo = e2.target.value || null;
    sincronizarEventoAComponente(ev);   // si el evento coincide con una evaluacion, se unen
    guardar(); renderSemestre(); abrirEditor(id);
  };
  document.getElementById('m-tipo').onchange = e2 => {
    ev.tipo = e2.target.value; guardar(); renderSemestre(); abrirEditor(id);
  };
  document.getElementById('m-tipo-crear').onclick = () => {
    const t = document.getElementById('m-tipo-texto').value.trim();
    if (!t) return;
    // El codigo interno se arma del nombre sin tildes ni espacios; si ya existe un tipo con ese
    // nombre, se reutiliza en vez de crear un gemelo.
    const limpio = t.toUpperCase();
    const existente = Object.keys(tiposDe()).filter(k => tiposDe()[k] === limpio)[0];
    const cod = existente || ('x' + t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '').slice(0, 16) + Object.keys(tiposDe()).length);
    if (!existente) { E.tipos = E.tipos || {}; E.tipos[cod] = limpio; }
    ev.tipo = cod;
    guardar('Tipo "' + limpio + '" listo'); renderSemestre(); resetFiltros(); pintarFiltros(); abrirEditor(id);
  };
  const inpNota = document.getElementById('m-nota');
  if (inpNota) inpNota.onchange = () => {
    const n = normalizarNota(inpNota.value);
    est().notas_evento = est().notas_evento || {};
    if (n === null) delete est().notas_evento[id]; else est().notas_evento[id] = n;
    guardar(); renderSemestre(); abrirEditor(id);
  };
  const bPasar = document.getElementById('m-nota-pasar');
  if (bPasar) bPasar.onclick = () => {
    const aviso = document.getElementById('m-nota-aviso');
    const cat = document.getElementById('m-nota-cat').value;
    const nota = (est().notas_evento || {})[id];
    if (nota === null || nota === undefined) {
      if (aviso) aviso.textContent = 'Primero escribe la nota de este evento, arriba.';
      return;
    }
    const cats = catsDe(ev.ramo);
    if (!cats.some(c => c.nombre === cat)) cats.push({nombre:cat, peso:1.0, color:colorLibre()});
    const cs = compsDe(ev.ramo);
    const ya = cs.filter(c => c.nombre === ev.texto)[0];
    if (ya) { ya.nota = nota; ya.categoria = cat; }
    else cs.push({nombre:ev.texto, categoria:cat, peso:1, nota:nota});
    guardar('Nota pasada al promedio de ' + aliasDe(ev.ramo));
    cerrarEditor(); renderTodo();
  };
  document.getElementById('guardar-ficha').onclick = () => {
    s.fichas[id] = {descripcion: document.getElementById('m-desc').value,
                    temario: document.getElementById('m-tema').value};
    guardar('Guardado'); cerrarEditor();
  };
  const b = document.getElementById('borrar');
  if (b) b.onclick = () => {
    est().nuevas = est().nuevas.filter(x => String(x.id) !== String(id));
    // renderSemestre() no repinta Tareas: la tarjeta se quedaba en pantalla hasta navegar.
    guardar('Tarea eliminada'); cerrarEditor(); renderSemestre(); renderTareas();
  };
}
function cerrarEditor(){
  // Un evento nuevo que se abre sin nombre y sin descripcion se descarta al cerrar: el evento ya no
  // nace con texto fijo, asi que sin esto quedaria una tarjeta vacia en el calendario y en Tareas.
  const idC = editando;
  if (idC && String(idC).startsWith('n')) {
    const evC = eventoPorId(idC);
    const fC = (est().fichas || {})[idC] || {};
    if (evC && !evC.texto && !fC.descripcion) {
      est().nuevas = (est().nuevas || []).filter(x => String(x.id) !== String(idC));
      guardar(); renderSemestre();
    }
  }
  document.getElementById('modal').classList.remove('on'); editando = null;
  const caja = document.getElementById('modal-caja'); if (caja) caja.className = 'modal-caja';
}
function nuevaTarea(){
  // Los eventos ahora pueden ser personales (sin semestre): est() cae en E.personal cuando no hay
  // semestre activo, asi que un evento nuevo se guarda igual y no se pierde.
  const id = 'n' + Date.now();
  est().nuevas = est().nuevas || [];
  est().nuevas.push({id:id, semana:'—', dia:diaDeFecha(hoy()), fecha:hoy(), texto:'',
                     detalle:'', ramo:null, color_excel:null, tipo:'tarea'});
  // El tipo 'tarea' tiene que quedar visible de inmediato: en la version limpia el catalogo de
  // tipos arranca vacio, y sin registrarlo el evento nuevo no se dibuja (ni en la tabla ni en el
  // calendario), como lo vigila prueba_filtro_tipo. Se asegura y se recargan los filtros.
  E.tipos = E.tipos || {};
  if (!E.tipos['tarea']) E.tipos['tarea'] = TIPOS['tarea'] || 'TAREA';
  resetFiltros(); pintarFiltros();
  guardar(); renderSemestre(); abrirEditor(id);
  const inp = document.getElementById('m-nombre');
  if (inp) { inp.focus(); inp.select(); }
}
