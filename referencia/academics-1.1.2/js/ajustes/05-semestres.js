/* ---------------------------------------------------------------- semestres */
function cambiarSemestre(id){
  E.activo = id;
  examenSim = {};
  memoEstados = null;
  mallaSel = null;
  guardar();
  resetFiltros();
  arranque();
}

function semestreActual(){
  return semestres().find(x => x.id === E.activo) || null;
}
/* Devuelve true si el semestre es editable por el usuario (los creados por él viven en E.extras;
   los del paquete del ejemplo, D.semestres, son fijos y no se tocan). */
function semEsEditable(id){
  return (E.extras || []).some(x => x.id === id);
}

/* Edita el semestre activo: abre un modal PRECARGADO solo para el nombre (el caso del tipeo) y
   las fechas/calendario. Al guardar se regeneran las semanas PERO se conservan los ramos (con sus
   horas y notas, que viven en E.sem[id] y no se tocan) y los eventos. Importante para no romper
   los datos del usuario. */
function modalEditarSemestre(){
  const sem = semestreActual();
  if (!sem) { mostrarAviso('No hay ningún semestre activo que editar.'); return; }
  if (!semEsEditable(sem.id)) {
    mostrarAviso('Este semestre es parte de la malla de ejemplo y no se puede editar.');
    return;
  }
  const nClases = (sem.semanas || []).filter(w => w.tipo === 'clases').length;
  const recesos = [];
  (sem.semanas || []).forEach((w, i) => {
    // los recesos van tras la semana de clases numero (i/2) aprox; se reconstruye como texto
    if (w.tipo === 'receso') recesos.push(String(Math.max(1, Math.floor(i / 2))));
  });
  const nExamen = (sem.semanas || []).filter(w => w.tipo === 'examen').length;

  document.getElementById('modal-caja').innerHTML =
    '<button class="cerrar" id="cerrar">Cerrar</button>' +
    '<h2>Editar semestre</h2>' +
    '<div class="sub">Cambiar el nombre o el calendario no borra tus ramos, horas ni notas.</div>' +
    '<div class="campo"><span>Nombre</span><input type="text" id="es-nombre" value="' + esc(sem.nombre) + '"></div>' +
    '<div class="campo"><span>Primer lunes de clases</span><input type="date" id="es-inicio" value="' + (sem.inicio || hoy()) + '"></div>' +
    '<div class="campo"><span>Semanas de clases</span><input type="number" id="es-clases" min="1" max="25" value="' + (nClases || 15) + '"></div>' +
    '<div class="campo"><span>Recesos tras las semanas (separados por coma)</span>' +
      '<input type="text" id="es-recesos" value="' + recesos.join(', ') + '"></div>' +
    '<div class="campo"><span>Semanas de examen, al final</span><input type="number" id="es-examen" min="0" max="8" value="' + (nExamen || 0) + '"></div>' +
    '<div class="fila" style="margin-top:14px;gap:8px">' +
      '<button class="btn primario" id="es-guardar">Guardar cambios</button>' +
      '<button class="btn" id="es-cancelar">Cancelar</button>' +
    '</div>';

  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;
  document.getElementById('es-cancelar').onclick = cerrarEditor;

  document.getElementById('es-guardar').onclick = async () => {
    const nombre = document.getElementById('es-nombre').value.trim() || sem.nombre;
    const inicio = document.getElementById('es-inicio').value;
    const nCl = Math.max(1, Number(document.getElementById('es-clases').value) || 15);
    const recesosN = (document.getElementById('es-recesos').value || '').split(',')
      .map(x => parseInt(x.trim(), 10)).filter(x => x > 0);
    const nEx = Math.max(0, Number(document.getElementById('es-examen').value) || 0);
    if (!inicio) { await avisar('Falta el primer lunes de clases.',
        { titulo: 'No se puede guardar' }); return; }

    // se regenera el calendario de semanas, conservando ramos y eventos
    const semanas = [];
    let cursor = inicio;
    for (let i = 1; i <= nCl; i++) {
      semanas.push({etiqueta:'S' + i, lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'clases'});
      cursor = sumaDias(cursor, 7);
      if (recesosN.indexOf(i) >= 0) {
        semanas.push({etiqueta:'Receso', lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'receso'});
        cursor = sumaDias(cursor, 7);
      }
    }
    for (let i = 1; i <= nEx; i++) {
      semanas.push({etiqueta:'Examen ' + i, lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'examen'});
      cursor = sumaDias(cursor, 7);
    }

    const i = E.extras.findIndex(x => x.id === sem.id);
    if (i >= 0) {
      E.extras[i] = Object.assign({}, E.extras[i], {nombre: nombre, inicio: inicio, semanas: semanas});
    }
    guardar('Semestre renombrado');
    cerrarEditor(); resetFiltros(); arranque();
  };
}

async function borrarSemestre(){
  const sem = semestreActual();
  if (!sem) { mostrarAviso('No hay ningún semestre activo que borrar.'); return; }
  if (!semEsEditable(sem.id)) {
    mostrarAviso('Este semestre es parte de la malla de ejemplo y no se puede borrar.');
    return;
  }
  if (!await confirmar('Se borrara el semestre "' + sem.nombre + '".\n\nSe pierde su calendario, '
      + 'pero el resto de tus datos (malla, ramos del catalogo, ajustes) quedan intactos.\n\n'
      + 'Esta accion no se puede deshacer.',
      { titulo: 'Borrar semestre', aceptar: 'Borrar', peligro: true })) return;
  const activoEra = (E.activo === sem.id);
  E.extras = (E.extras || []).filter(x => x.id !== sem.id);
  delete E.sem[sem.id];
  if (activoEra) {
    const restantes = semestres();
    E.activo = restantes.length ? restantes[0].id : null;
  }
  guardar('Semestre "' + sem.nombre + '" borrado');
  resetFiltros(); arranque();
}
