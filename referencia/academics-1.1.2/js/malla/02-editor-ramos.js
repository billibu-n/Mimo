/* ------------------------------------------------------------- editor de ramos
   Es la pieza que permite armar la malla desde cero: sin esto, la version limpia tendria el
   catalogo vacio y no habria de donde sacar ramos. Con esto, el usuario crea cada ramo con
   su codigo, creditos, nivel y prerrequisitos, y puede corregir cualquiera si se equivoca.
   La ficha ampliada (2026-09-21) reparte los campos en tres bloques: Institucion, Identidad
   y Percepcion. Los prerrequisitos se eligen con un buscador agil, no con un select multiple. */
function modalRamo(cod){
  const c = cod ? CAT()[cod] : null;
  const reqs = ((c && c.requisitos) || []).concat([].concat(...((c && c.requisitos_o) || [])));
  const enUso = cod ? ramosBase().some(r => r.codigo === cod) : false;

  document.getElementById('modal-caja').className = 'modal-caja m-campo';
  document.getElementById('modal-caja').innerHTML =
    '<h2>' + (cod ? 'Editar el ramo ' + esc(cod) : 'Nuevo ramo') + '</h2>' +
    '<button class="cerrar" id="cerrar">Cerrar</button>' +

    // ---------------- INSTITUCION ----------------
    '<h4 class="bloque-tit">Institución</h4>' +
    '<div class="campo"><span>Universidad</span><input id="r-univ" class="entrada" value="' +
      esc((c && c.universidad) || '') + '" placeholder="opcional, ej. Universidad de Chile" autocomplete="off"></div>' +
    '<div class="campo"><span>Carrera</span><input id="r-carrera" class="entrada" value="' +
      esc((c && c.carrera) || '') + '" placeholder="opcional, ej. Ingeniería Civil" autocomplete="off"></div>' +

    // ---------------- IDENTIDAD ----------------
    '<h4 class="bloque-tit">Identidad</h4>' +
    '<div class="campo"><span>Código</span><input id="r-cod" class="entrada" value="' + esc(cod || '') + '"' +
      (cod ? ' readonly' : '') + ' placeholder="MA1001" autocomplete="off"></div>' +
    '<div class="campo"><span>Nombre real</span><input id="r-nombre" class="entrada" value="' +
      esc((c && c.nombre) || '') + '" placeholder="Cálculo Diferencial e Integral" autocomplete="off"></div>' +
    '<div class="campo"><span>Tramo</span>' +
      '<select id="r-tramo">' +
        '<option value="semestre"' + ((c && c.tramo) === 'semestre' ? ' selected' : '') + '>Semestre</option>' +
        '<option value="trimestre"' + ((c && c.tramo) === 'trimestre' ? ' selected' : '') + '>Trimestre</option>' +
        '<option value="nivel"' + ((c && c.tramo) === 'nivel' ? ' selected' : '') + '>Nivel</option>' +
      '</select></div>' +
    '<div class="campo"><span id="r-tramo-lbl">Nivel (número)</span>' +
      '<input id="r-nivel" class="entrada" type="number" min="1" max="20" step="1" value="' + ((c && c.nivel) || 1) + '"></div>' +
    '<div class="campo"><span>Sección (Plan común, Licenciatura...)</span>' +
      '<select id="r-seccion">' + opcionesSeccion(c ? seccionDe(cod) : null) + '</select></div>' +
    '<div class="campo"><span>Créditos (según la institución)</span>' +
      '<input id="r-cred" class="entrada" type="number" min="0" max="40" step="1" value="' +
      ((c && c.creditos) || 0) + '"></div>' +
    '<div class="campo"><span>Espacio (cuánto dura)</span>' +
      '<div class="fila" style="gap:8px;flex-wrap:nowrap">' +
        '<select id="r-espacio-tipo">' +
          '<option value="">— no fijado —</option>' +
          '<option value="semestre"' + (espacioActual(c).tipo === 'semestre' ? ' selected' : '') + '>semestre(s)</option>' +
          '<option value="trimestre"' + (espacioActual(c).tipo === 'trimestre' ? ' selected' : '') + '>trimestre(s)</option>' +
          '<option value="semanas"' + (espacioActual(c).tipo === 'semanas' ? ' selected' : '') + '>semanas</option>' +
        '</select>' +
        '<input id="r-espacio-cant" class="entrada" type="number" min="1" max="52" step="1" placeholder="cantidad" style="width:90px" value="' +
        (espacioActual(c).cantidad || '') + '">' +
      '</div>' +
      '<div class="pista">Un semestre, dos semestres, un trimestre o un plazo fijo en semanas (hay ramos que duran semanas).</div></div>' +
    '<div class="campo"><span>Prerrequisitos</span><div id="r-req"></div>' +
      '<div class="pista">Escribe para buscar en la malla y haz clic para elegir. Un ramo con requisitos se necesita antes de poder inscribir este.</div></div>' +
    '<div class="campo"><span>Ramos equivalentes</span><div id="r-equi"></div>' +
      '<div class="pista">Otros ramos que valen lo mismo (de tu malla o externos). Se prioriza la misma carrera.</div></div>' +

    // ---------------- PERCEPCION ----------------
    '<h4 class="bloque-tit">Percepción</h4>' +
    '<div class="campo"><span>Demanda de tiempo</span>' + escalaDemanda('r-tiempo', c && c.demanda_tiempo) + '</div>' +
    '<div class="campo"><span>Demanda académica</span>' + escalaDemanda('r-academica', c && c.demanda_academica) + '</div>' +
    '<div class="campo"><span>Prioridad (ramos que abre)</span>' +
      '<span class="mono" style="font-size:.85rem">' + ramosQueAbre(cod) + ' ramo(s) hasta el final</span>' +
      '<div class="pista">Se calcula solo: cuántos ramos de la carrera dependen de este. No se edita.</div></div>' +
    '<div class="campo"><span>Tasa de aprobación (%)</span>' +
      '<input id="r-aprob" class="entrada" type="number" min="0" max="100" step="1" placeholder="opcional" value="' +
      ((c && c.aprobacion !== null && c.aprobacion !== undefined) ? c.aprobacion : '') + '"></div>' +
    '<div class="campo"><span>Descripción</span>' +
      '<textarea id="r-desc" rows="2" placeholder="opcional: de qué trata el ramo" style="width:100%">' +
      esc((c && c.descripcion) || '') + '</textarea></div>' +

    '<div id="r-error" class="ayuda" style="color:var(--bad)"></div>' +
    '<div class="fila" style="justify-content:flex-end;gap:8px;margin-top:12px">' +
      (enUso ? '<button class="btn peligro" id="r-quitar">Quitar del semestre</button>' : '') +
      (cod && CAT()[cod] && E.catalogo && E.catalogo[cod]
        ? '<button class="btn peligro" id="r-borrar">Borrar el ramo</button>' : '') +
      '<button class="btn" id="r-cancelar">Cancelar</button>' +
      '<button class="btn acento" id="r-guardar">Guardar</button>' +
    '</div>';

  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;
  document.getElementById('r-cancelar').onclick = cerrarEditor;
  const err = m => { document.getElementById('r-error').textContent = m; };

  // El tramo cambia la etiqueta del numero.
  const tramoSel = document.getElementById('r-tramo');
  const tramoLbl = document.getElementById('r-tramo-lbl');
  const tramoEtiqueta = () => ({semestre:'Semestre (número)', trimestre:'Trimestre (número)', nivel:'Nivel (número)'})[tramoSel.value] || 'Nivel (número)';
  tramoSel.onchange = () => { tramoLbl.textContent = tramoEtiqueta(); };
  tramoLbl.textContent = tramoEtiqueta();

  montarSelectorRamos('r-req', reqs, cod);
  montarSelectorEquivalentes('r-equi', (c && c.equivalentes) || [], cod, (c && c.equivalente));

  // Escala de percepcion (demanda de tiempo y academica): un clic marca el punto, mueve la clase
  // .on y deja el valor en data-val para que escalaDemandaElegida lo lea al guardar. Antes no se
  // enlazaban, asi que la seleccion no reaccionaba y se guardaba null.
  document.querySelectorAll('#modal-caja .escala .escala-punto').forEach(b => {
    b.onclick = () => {
      const escala = b.parentElement;
      const n = Number(b.dataset.n);
      escala.dataset.val = n;
      escala.querySelectorAll('.escala-punto').forEach(p => p.classList.toggle('on', p === b));
      const txt = escala.querySelector('.escala-txt');
      if (txt) txt.textContent = DEMANDA_NOMBRES[n - 1];
    };
  });

  document.getElementById('r-guardar').onclick = async () => {
    const nuevo = !cod;
    const clave = (cod || document.getElementById('r-cod').value || '').trim().toUpperCase();
    const nombre = document.getElementById('r-nombre').value.trim();
    const nivel = Math.max(1, parseInt(document.getElementById('r-nivel').value, 10) || 1);
    const cred = Math.max(0, parseInt(document.getElementById('r-cred').value, 10) || 0);
    if (!clave) return err('Falta el código del ramo.');
    if (!nombre) return err('Falta el nombre del ramo.');
    if (nuevo && CAT()[clave]) return err('Ya existe un ramo con el código ' + clave + '.');
    const elegidos = selectorRamosElegidos('r-req').filter(x => x !== clave);

    const datos = {
      nombre: nombre, creditos: cred, nivel: nivel,
      requisitos: elegidos, requisitos_o: [],
      tramo: tramoSel.value,
      universidad: document.getElementById('r-univ').value.trim() || null,
      carrera: document.getElementById('r-carrera').value.trim() || null
    };

    // espacio: solo si eligio tipo y cantidad. 2 semestres = anual (dibujo). Sin espacio fijado,
    // el ramo deja de ser anual (se limpia el dato viejo).
    const espTipo = document.getElementById('r-espacio-tipo').value;
    const espCant = parseInt(document.getElementById('r-espacio-cant').value, 10);
    if (espTipo && espCant) datos.espacio = {tipo: espTipo, cantidad: espCant};
    else datos.espacio = null;
    datos.anual = (espTipo === 'semestre' && espCant >= 2);

    // equivalentes: la lista nueva, y de regalo se conserva 'equivalente' si hay uno unico
    const equis = selectorEquivalentesElegidos('r-equi');
    if (equis.length) datos.equivalentes = equis;

    const secVal = document.getElementById('r-seccion').value;
    if (secVal !== '' && secVal !== null) datos.seccion = Number(secVal);

    datos.demanda_tiempo = escalaDemandaElegida('r-tiempo');
    datos.demanda_academica = escalaDemandaElegida('r-academica');

    const aprob = document.getElementById('r-aprob').value.trim();
    if (aprob !== '') datos.aprobacion = Math.max(0, Math.min(100, parseInt(aprob, 10) || 0));
    const desc = document.getElementById('r-desc').value.trim();
    if (desc) datos.descripcion = desc;

    ramoEnCatalogo(clave, datos);
    guardar('Ramo ' + clave + (nuevo ? ' creado' : ' actualizado'));
    cerrarEditor(); resetFiltros(); arranque();
  };
  const bB = document.getElementById('r-borrar');
  if (bB) bB.onclick = async () => {
    if (!await confirmar('Se borrara ' + cod + ' de tu malla.\n\nLos ramos que lo tenian de '
        + 'prerrequisito se quedan sin el.',
        { titulo: 'Borrar ramo', aceptar: 'Borrar', peligro: true })) return;
    borrarRamo(cod);
    guardar('Ramo ' + cod + ' borrado'); cerrarEditor(); resetFiltros(); arranque();
  };
  const bQ = document.getElementById('r-quitar');
  if (bQ) bQ.onclick = () => { quitarRamo(cod); cerrarEditor(); };
}

/* Escala de 1 a 5 para las demandas de percepcion. Devuelve los botones (o rayitas) y deja el
   valor elegido marcado. Se usa para demanda de tiempo y demanda academica. */
const DEMANDA_NOMBRES = ['muy baja','baja','media','alta','muy alta'];
/* Espacio actual de un ramo para el editor: lee {tipo,cantidad}, y si no hay campo 'espacio'
   pero el ramo venia marcado 'anual' (import viejo), lo traduce a 2 semestres. */
function espacioActual(c){
  if (c && c.espacio && c.espacio.tipo) return {tipo: c.espacio.tipo, cantidad: c.espacio.cantidad || 1};
  if (c && c.anual) return {tipo: 'semestre', cantidad: 2};
  return {tipo: '', cantidad: null};
}
function escalaDemanda(id, actual){
  return '<div class="escala" data-escala="' + id + '" data-val="' + (actual || 0) + '">' +
    [1,2,3,4,5].map(n =>
      '<button type="button" class="escala-punto' + (actual === n ? ' on' : '') + '" data-n="' + n + '" title="' + DEMANDA_NOMBRES[n-1] + '"></button>'
    ).join('') +
    '<span class="escala-txt">' + (actual ? DEMANDA_NOMBRES[actual-1] : 'sin dato') + '</span></div>';
}
function escalaDemandaElegida(id){
  const el = document.querySelector('#modal-caja [data-escala="' + id + '"]');
  const v = el ? Number(el.dataset.val) || 0 : 0;
  return v || null;
}

/* Selector agil de prerrequisitos: un buscador que filtra la malla + chips removibles de lo
   elegido. No depende de un <select multiple> torpe. La lista elegida vive en un input oculto
   con los codigos separados por coma; las funciones elegidos/leer la leen y escriben. */
function montarSelectorRamos(cajaId, iniciales, codExcluido){
  const caja = document.getElementById(cajaId);
  if (!caja) return;
  const todos = Object.keys(CAT()).filter(x => x !== codExcluido)
    .map(x => ({cod:x, nombre:CAT()[x].nombre, nivel:CAT()[x].semestre_num}))
    .sort((a,b) => a.nivel - b.nivel || a.cod.localeCompare(b.cod));
  let elegidos = iniciales.slice();
  const pintar = () => {
    const chips = elegidos.map(x =>
      '<span class="chip-req" data-cod="' + esc(x) + '">' + esc(x) +
        '<button type="button" class="ch-req-quita" data-cod="' + esc(x) + '" title="Quitar">×</button></span>'
    ).join('');
    const filter = (document.getElementById(cajaId + '-busca') || {}).value || '';
    const f = filter.trim().toUpperCase();
    const lista = todos.filter(t => !elegidos.includes(t.cod) &&
      (!f || t.cod.includes(f) || (t.nombre || '').toUpperCase().includes(f)))
      .slice(0, 30);
    const items = lista.map(t =>
      '<button type="button" class="req-opcion" data-cod="' + esc(t.cod) + '">' +
        '<span class="mono">' + esc(t.cod) + '</span>' +
        '<span class="nm2">' + esc(t.nombre) + '</span>' +
        '<span class="sm">' + (t.nivel !== 99 ? 'nivel ' + t.nivel : 'electivo') + '</span></button>'
    ).join('');
    caja.innerHTML =
      '<div class="fila" style="gap:6px;flex-wrap:wrap">' + (chips || '<span class="vacio">ninguno</span>') + '</div>' +
      '<input type="text" class="entrada" id="' + cajaId + '-busca" placeholder="Buscar por código o nombre..." style="width:100%;margin-top:6px">' +
      '<div class="req-lista">' + (items || (f ? '<span class="vacio">sin resultados</span>' : '')) + '</div>';
    caja.querySelectorAll('.ch-req-quita').forEach(b => b.onclick = () => {
      elegidos = elegidos.filter(x => x !== b.dataset.cod); pintar();
    });
    caja.querySelectorAll('.req-opcion').forEach(b => b.onclick = () => {
      if (!elegidos.includes(b.dataset.cod)) elegidos.push(b.dataset.cod); pintar();
    });
    const busca = document.getElementById(cajaId + '-busca');
    if (busca) busca.oninput = pintar;
  };
  pintar();
}
function selectorRamosElegidos(cajaId){
  const caja = document.getElementById(cajaId);
  if (!caja) return [];
  return [].slice.call(caja.querySelectorAll('.chip-req')).map(c => c.dataset.cod);
}

/* Equivalentes: igual que los prerrequisitos (chips + buscador), pero cada equivalente lleva un
   origen (misma malla / externo). Se prioriza la misma carrera. */
function montarSelectorEquivalentes(cajaId, iniciales, codExcluido, equivalenteViejo){
  const caja = document.getElementById(cajaId);
  if (!caja) return;
  // el viejo campo 'equivalente' (una sola clave) entra como equivalente 'misma' si no esta ya
  let elegidos = iniciales.slice();
  if (equivalenteViejo && !elegidos.some(e => (e.cod || e) === equivalenteViejo) && equivalenteViejo !== codExcluido) {
    elegidos.push({cod: equivalenteViejo, origen: 'misma'});
  }
  const todos = Object.keys(CAT()).filter(x => x !== codExcluido)
    .map(x => ({cod:x, nombre:CAT()[x].nombre})).sort((a,b) => a.cod.localeCompare(b.cod));
  const pintar = () => {
    const chips = elegidos.map(e => {
      const cod = e.cod || e;
      return '<span class="chip-req"' + (e.origen === 'externa' ? ' data-ext="1"' : '') + ' data-cod="' + esc(cod) + '">' +
        esc(cod) + (e.origen === 'externa' ? ' · externo' : '') +
        '<button type="button" class="ch-req-quita" data-cod="' + esc(cod) + '" title="Quitar">×</button></span>';
    }).join('');
    const f = ((document.getElementById(cajaId + '-busca') || {}).value || '').trim().toUpperCase();
    const lista = todos.filter(t => !elegidos.some(e => (e.cod || e) === t.cod) &&
      (!f || t.cod.includes(f) || (t.nombre || '').toUpperCase().includes(f))).slice(0, 30);
    const items = lista.map(t =>
      '<button type="button" class="req-opcion" data-cod="' + esc(t.cod) + '">' +
        '<span class="mono">' + esc(t.cod) + '</span><span class="nm2">' + esc(t.nombre) + '</span></button>'
    ).join('');
    caja.innerHTML =
      '<div class="fila" style="gap:6px;flex-wrap:wrap">' + (chips || '<span class="vacio">ninguno</span>') + '</div>' +
      '<input type="text" class="entrada" id="' + cajaId + '-busca" placeholder="Buscar por código (también puedes escribir uno externo)..." style="width:100%;margin-top:6px">' +
      '<div class="req-lista">' + items + '</div>';
    caja.querySelectorAll('.ch-req-quita').forEach(b => b.onclick = () => {
      elegidos = elegidos.filter(e => (e.cod || e) !== b.dataset.cod); pintar();
    });
    caja.querySelectorAll('.req-opcion').forEach(b => b.onclick = () => {
      if (!elegidos.some(e => (e.cod || e) === b.dataset.cod)) elegidos.push({cod: b.dataset.cod, origen: 'misma'});
      pintar();
    });
    const busca = document.getElementById(cajaId + '-busca');
    if (busca) busca.onkeydown = ev => {
      // Enter con texto que no coincide con ningun ramo = equivalente externo
      if (ev.key === 'Enter') {
        const val = busca.value.trim().toUpperCase();
        if (val && !todos.some(t => t.cod === val) && !elegidos.some(e => (e.cod || e) === val)) {
          elegidos.push({cod: val, origen: 'externa'});
          busca.value = ''; pintar();
          ev.preventDefault();
        }
      }
    };
  };
  pintar();
}
function selectorEquivalentesElegidos(cajaId){
  const caja = document.getElementById(cajaId);
  if (!caja) return [];
  return [].slice.call(caja.querySelectorAll('.chip-req')).map(c => ({
    cod: c.dataset.cod, origen: c.dataset.ext ? 'externa' : 'misma'
  }));
}

/* Las opciones del campo "Sección" del editor: "Sin sección" + las que existen (sigla · nombre). */
function opcionesSeccion(actual){
  const secs = SECC();
  let out = '<option value="">— Sin sección —</option>';
  secs.forEach((s, i) => {
    out += '<option value="' + i + '"' + (actual === i ? ' selected' : '') + '>' +
      esc((s.sigla ? s.sigla + ' · ' : '') + s.nombre) + '</option>';
  });
  return out;
}

function modalNuevoSemestre(){
  memoEstados = null;
  const e = calcularEstados();
  const rango = {disponible:0, curso:1, bloqueado:2, aprobado:3};
  const orden = Object.keys(CAT()).sort((a, b) => {
    const ra = rango[e[a]] - rango[e[b]];
    if (ra) return ra;
    return (CAT()[a].semestre_num || 99) - (CAT()[b].semestre_num || 99) || a.localeCompare(b);
  });
  const lista = orden.filter(cod => CAT()[cod].tipo !== 'cupo').map(cod => {
    const c = CAT()[cod], ec = e[cod];
    const ya = ec === 'aprobado', cursando = ec === 'curso';
    const faltan = requisitosFaltantes(cod);
    const nota = ya ? 'ya aprobado' : cursando ? 'lo estás cursando' : faltan.length
      ? 'le falta' + (faltan.length > 1 ? 'n' : '') + ' ' + faltan.join(', ') : 'ya puedes tomarlo';
    return '<label class="opcion" data-estado="' + ec + '">' +
      '<input type="checkbox" data-ramo="' + cod + '"' + (ya || cursando ? ' disabled' : '') + '>' +
      '<span class="mono">' + cod + '</span><span class="nm2">' + esc(c.nombre) + '</span>' +
      '<span class="sm">' + (c.semestre ? 'Semestre ' + c.semestre : 'electivo') + ' · ' +
      (c.creditos === null ? 'créditos sin dato' : c.creditos + ' cr') + ' · ' + esc(nota) + '</span></label>';
  }).join('');
  document.getElementById('modal-caja').innerHTML = `
    <button class="cerrar" id="cerrar">Cerrar</button>
    <h2>Semestre nuevo</h2>
    <div class="sub">Se genera el calendario de semanas y eliges los ramos. Después puedes cambiarlo todo.</div>
    <div class="campo"><span>Nombre</span><input type="text" id="ns-nombre" value="Semestre nuevo"></div>
    <div class="campo"><span>Primer lunes de clases</span><input type="date" id="ns-inicio" value="${hoy()}"></div>
    <div class="campo"><span>Semanas de clases</span><input type="number" id="ns-clases" min="1" max="25" value="15"></div>
    <div class="campo"><span>Recesos tras las semanas (separados por coma)</span>
      <input type="text" id="ns-recesos" value="6, 11"></div>
    <div class="campo"><span>Semanas de examen, al final</span><input type="number" id="ns-examen" min="0" max="8" value="3"></div>
    <h4 style="margin:18px 0 6px;font-size:.86rem;text-transform:uppercase;color:var(--muted2)">Ramos del semestre</h4>
    <input type="text" id="ns-buscar" placeholder="Buscar por código o nombre" style="width:100%;padding:6px 9px;
           border:1px solid var(--line);border-radius:8px;font:inherit;margin-bottom:8px">
    <div class="fila" style="gap:8px;margin-bottom:8px;flex-wrap:wrap">
      <button class="mini" id="ns-sugeridos">Marcar los que ya puedes tomar</button>
      <button class="mini" id="ns-disponibles">Ver solo los disponibles</button>
      <button class="mini" id="ns-limpiar">Desmarcar todo</button>
    </div>
    <div class="lista-ramos" id="ns-lista">${lista}</div>
    <div class="fila" style="margin-top:14px;gap:8px">
      <button class="btn primario" id="ns-crear">Crear semestre</button>
    </div>`;
  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;
  document.getElementById('ns-sugeridos').onclick = () => {
    document.querySelectorAll('#ns-lista .opcion').forEach(op => {
      const i = op.querySelector('input');
      if (i.disabled) return;
      if (op.dataset.estado === 'disponible') i.checked = true;
    });
  };
  document.getElementById('ns-disponibles').onclick = ev2 => {
    // el primer clic filtra; el segundo vuelve a mostrar todo
    const solo = ev2.target.dataset.solo !== '1';
    ev2.target.dataset.solo = solo ? '1' : '0';
    ev2.target.textContent = solo ? 'Ver todos' : 'Ver solo los disponibles';
    document.querySelectorAll('#ns-lista .opcion').forEach(op => {
      op.style.display = (!solo || op.dataset.estado === 'disponible') ? '' : 'none';
    });
  };
  document.getElementById('ns-limpiar').onclick = () => {
    document.querySelectorAll('#ns-lista input').forEach(i => { if (!i.disabled) i.checked = false; });
  };
  document.getElementById('ns-buscar').oninput = ev => {
    const q = sinTildes(ev.target.value);
    document.querySelectorAll('#ns-lista .opcion').forEach(el => {
      el.style.display = sinTildes(el.textContent).includes(q) ? '' : 'none';
    });
  };
  document.getElementById('ns-crear').onclick = async () => {
    const nombre = document.getElementById('ns-nombre').value.trim() || 'Semestre nuevo';
    const inicio = document.getElementById('ns-inicio').value;
    const nClases = Math.max(1, Number(document.getElementById('ns-clases').value) || 15);
    const recesos = (document.getElementById('ns-recesos').value || '').split(',')
      .map(x => parseInt(x.trim(), 10)).filter(x => x > 0);
    const nExamen = Math.max(0, Number(document.getElementById('ns-examen').value) || 0);
    // OJO: [].concat(nodeList) mete la lista entera como un solo elemento; hay que recorrerla.
    const marcados = document.querySelectorAll('#ns-lista input:checked');
    const codigos = Array.prototype.map.call(marcados, i => i.dataset.ramo);
    if (!inicio) { await avisar('Falta el primer lunes de clases.',
        { titulo: 'No se puede guardar' }); return; }
    // En la version limpia el catalogo puede estar vacio: ahi no hay nada que elegir y el
    // semestre se crea igual, para ir agregando los ramos despues desde la Malla.
    if (!codigos.length && Object.keys(CAT()).length) { await avisar('Elige al menos un ramo.',
        { titulo: 'Falta un dato' }); return; }
    const id = 's' + Date.now();
    const sem = {id:id, nombre:nombre, inicio:inicio, semanas:[], ramos:[], eventos:[], semanas_estudio:[]};
    let cursor = inicio;
    for (let i = 1; i <= nClases; i++) {
      const w = {etiqueta:'S' + i, lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'clases'};
      sem.semanas.push(w); cursor = sumaDias(cursor, 7);
      if (recesos.indexOf(i) >= 0) {
        sem.semanas.push({etiqueta:'Receso', lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'receso'});
        cursor = sumaDias(cursor, 7);
      }
    }
    for (let i = 1; i <= nExamen; i++) {
      sem.semanas.push({etiqueta:'Examen ' + i, lunes:cursor, domingo:sumaDias(cursor, 6), tipo:'examen'});
      cursor = sumaDias(cursor, 7);
    }
    const usados = {};
    codigos.forEach(cod => {
      const c = CAT()[cod];
      let alias = c.nombre.split(' ').slice(0, 2).join(' ');
      if (usados[alias]) alias += ' ' + cod.slice(-2);
      usados[alias] = true;
      sem.ramos.push({
        codigo:cod, alias:alias, nombre:c.nombre, creditos:c.creditos,
        color:['#2563EB','#16A34A','#B45309','#7C3AED','#0E7490','#DC2626'][sem.ramos.length % 6],
        categorias:[{nombre:'Controles', peso:1.0}],
        componentes:[],
        examen:{activo:true, peso:0.4, reemplaza:null},
        eximicion:{activa:false, modo:'todas', condiciones:[]}
      });
    });
    E.extras = (E.extras || []).concat([sem]);
    E.sem[id] = estadoSemestre(sem);
    E.activo = id;
    guardar('Semestre "' + nombre + '" creado');
    cerrarEditor(); resetFiltros(); arranque();
  };
}
function renderSemActivo(){
  const sel = document.getElementById('sem-activo');
  sel.innerHTML = semestres().map(s => '<option value="' + s.id + '"' + (s.id === E.activo ? ' selected' : '') + '>' +
    esc(s.nombre) + '</option>').join('');
  sel.onchange = () => cambiarSemestre(sel.value);
}


/* ---------------- reordenar la malla: mover ramos de nivel y reordenar columnas ----------------
   El usuario NO confia en el orden que vino del archivo: por eso aqui puede corregirlo el mismo.
   Dos cosas: (1) mover un ramo a otro nivel cambiando su 'nivel', y (2) reordenar las columnas
   moviendo los niveles completos. Ambas se guardan y la malla se redibuja al instante. */
function modalReordenarMalla(){
  const c = CAT();
  if (!Object.keys(c).length) { mostrarAviso('Aun no hay ramos que ordenar.'); return; }
  const e = estados();

  // ---- seccion 1: reordenar columnas (niveles) ----
  const columnas = NIVELES();
  const colHTML = columnas.map((n, i) => {
    const titulo = n.titulo || (n.nivel === 99 ? 'Electivos' : 'Nivel ' + n.nivel);
    return '<div class="fila-ord"><span class="mono">' + esc(titulo) + '</span>' +
      '<span class="sm">' + n.ramos.length + ' ramos</span>' +
      '<span class="ord-acciones">' +
        '<button class="btn chico" data-col-up="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="btn chico" data-col-down="' + i + '"' + (i === columnas.length - 1 ? ' disabled' : '') + '>↓</button>' +
      '</span></div>';
  }).join('');

  // ---- seccion 2: mover ramos de nivel ----
  const ramosOrd = Object.keys(c).filter(k => c[k].tipo !== 'cupo').sort();
  const ramosHTML = ramosOrd.map(k => {
    const nivel = (c[k].nivel > 0 && c[k].nivel < 99) ? c[k].nivel : 99;
    const estado = e[k] || 'bloqueado';
    return '<div class="fila-ord"><span class="mono">' + esc(k) + '</span>' +
      '<span class="nm2">' + esc(c[k].nombre) + '</span>' +
      '<span class="pill ' + (estado === 'aprobado' ? 'ok' : estado === 'curso' ? 'warn' : estado === 'disponible' ? 'n' : 'bad') + '">' +
        (nivel === 99 ? 'electivo' : 'Nivel ' + nivel) + '</span>' +
      '<span class="ord-acciones">' +
        '<button class="btn chico" data-r-up="' + k + '">↑</button>' +
        '<button class="btn chico" data-r-down="' + k + '">↓</button>' +
      '</span></div>';
  }).join('');

  document.getElementById('modal-caja').innerHTML = `
    <button class="cerrar" id="cerrar">Cerrar</button>
    <h2>Reordenar la malla</h2>
    <div class="sub">Mueve un ramo a otro nivel, o reordena las columnas enteras. Los cambios se guardan
      enseguida y la malla se dibuja de nuevo. Los electivos van aparte, a la derecha (nivel 99).</div>

    <h4 style="margin:16px 0 6px;font-size:.84rem;text-transform:uppercase;color:var(--muted2)">Reordenar columnas (niveles)</h4>
    <div class="lista-ord">${colHTML}</div>

    <h4 style="margin:18px 0 6px;font-size:.84rem;text-transform:uppercase;color:var(--muted2)">Mover ramos de nivel</h4>
    <div class="lista-ord" id="lista-ramos-ord">${ramosHTML}</div>

    <div class="fila" style="margin-top:14px;gap:8px;justify-content:flex-end">
      <button class="btn" id="ord-volver-auto">Volver al orden del archivo</button>
    </div>`;
  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;

  // --- reordenar columnas: mueve un nivel en E.ordenNiveles ---
  const moverColumna = (desde, a) => {
    const cols = NIVELES().map(n => Number(n.nivel));
    if (a < 0 || a >= cols.length) return;
    const actual = (E.ordenNiveles && E.ordenNiveles.length === cols.length) ? E.ordenNiveles.slice() : cols.slice();
    const tmp = actual[desde]; actual[desde] = actual[a]; actual[a] = tmp;
    E.ordenNiveles = actual;
    guardar('Columnas reordenadas'); cerrarEditor(); resetFiltros(); arranque();
  };
  document.querySelectorAll('[data-col-up]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.colUp); moverColumna(i, i - 1);
  });
  document.querySelectorAll('[data-col-down]').forEach(b => b.onclick = () => {
    const i = Number(b.dataset.colDown); moverColumna(i, i + 1);
  });

  // --- mover un ramo de nivel (cambia su 'nivel', que es lo que decide la columna) ---
  const moverRamo = (cod, delta) => {
    const nivelActual = (c[cod].nivel > 0 && c[cod].nivel < 99) ? Number(c[cod].nivel) : 99;
    let nuevo = nivelActual + delta;
    if (nuevo < 1) nuevo = 1;
    if (nuevo > 20) nuevo = 20;
    ramoEnCatalogo(cod, {nivel: nuevo, semestre_num: nuevo, semestre: nuevo === 99 ? null : String(nuevo)});
    guardar(cod + ' movido al nivel ' + nuevo);
    cerrarEditor(); resetFiltros(); arranque();
  };
  document.querySelectorAll('[data-r-up]').forEach(b => b.onclick = () => moverRamo(b.dataset.rUp, -1));
  document.querySelectorAll('[data-r-down]').forEach(b => b.onclick = () => moverRamo(b.dataset.rDown, 1));

  document.getElementById('ord-volver-auto').onclick = () => {
    delete E.ordenNiveles;
    guardar('Orden de malla restaurado'); cerrarEditor(); resetFiltros(); arranque();
  };
}
