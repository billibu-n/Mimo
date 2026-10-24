/* ---------------------------------------------------------------- notas */
function renderLista(){
  const s = est();
  const ramos = ramosBase();
  if (!selNotas || !cursoDe(selNotas)) {
    // por defecto se abre el ramo con eximicion configurada: es el caso mas completo
    const conExim = ramos.find(r => (est().exim[r.codigo] || r.eximicion || {}).activa);
    const primero = conExim || ramos[0];
    selNotas = primero ? primero.codigo : null;    // sin ramos no hay nada que abrir
  }
  document.getElementById('ev-lista').innerHTML = ramos.map(r => {
    const ex = examenSim[r.codigo] !== undefined ? examenSim[r.codigo] : null;
    const nf = notaFinal(r.codigo, ex);
    const obj = (s.metas_ramo[r.codigo] || {}).nota;
    const cls = (nf !== null && obj) ? (dec1(aCent(nf)) >= obj ? ' style="color:var(--ok)"' : ' style="color:var(--bad)"') : '';
    const et = s.estado[r.codigo] === 'aprobado' ? ' · aprobado' : '';
    return '<div class="item' + (r.codigo === selNotas ? ' on' : '') + '" data-r="' + r.codigo + '">' +
      '<i class="pt" style="background:' + colorDe(r.codigo) + '"></i>' +
      '<span class="nm"><b>' + esc(r.alias) + '</b><span>' + r.codigo + et +
      (obj ? ' · apuntas a ' + ver1(obj) : '') + '</span></span>' +
      '<span class="nf"' + cls + '>' + (nf === null ? '—' : ver1(nf)) + '</span></div>';
  }).join('');
  document.querySelectorAll('#ev-lista .item').forEach(el =>
    el.onclick = () => { selNotas = el.dataset.r; renderLista(); renderDetalle(); });
}
function htmlExim(cod, ex){
  const x = estadoEximicion(cod, ex);
  if (!x.activa) return '<span>La eximición está desactivada para este ramo.</span>';
  if (!x.detalle.length) return '<span>No hay condiciones puestas: con ninguna, el ramo no se exime.</span>';
  const filas = x.detalle.map((d, i) => {
    const ref = d.tipo === 'presentacion' ? 'la nota de presentación' : d.ref;
    const cab = (i + 1) + '. ' + esc(ref) + ' ' + d.op + ' ' + ver1(d.valor);
    if (d.actual === null) return '<div>' + cab + ' — <b style="color:var(--muted)">todavía sin nota</b></div>';
    if (d.ok) return '<div>' + cab + ' — <b style="color:var(--ok)">cumplida</b>, va en ' + ver1(d.actual) + '</div>';
    const falta = d.op.charAt(0) === '>' ? Number(d.valor) - Number(d.actual) : Number(d.actual) - Number(d.valor);
    return '<div>' + cab + ' — <b style="color:var(--warn)">te faltan ' + ver2(falta) + '</b>, va en ' +
      ver1(d.actual) + '</div>';
  }).join('');
  const texto = x.detalle.some(d => d.actual === null)
    ? '<b>Faltan notas para saber si te eximes.</b>'
    : (x.cumple ? '<b>Con estas notas, ya te eximes.</b>' : '<b>Con estas notas, todavía no te eximes.</b>');
  return texto + filas;
}
function actualizarResumen(cod){
  const ex = examenSim[cod] !== undefined ? examenSim[cod] : null;
  const obj = (est().metas_ramo[cod] || {}).nota || 5.0;
  const P = presentacion(cod, ex), nf = notaFinal(cod, ex), e = estadoDe(cod, ex);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('res-p', P === null ? '—' : ver1(P));
  set('res-nf', nf === null ? '—' : ver1(nf));
  set('res-nf2', nf === null ? '—' : ver1(nf));
  set('res-ex', ex === null ? 'sin nota' : ver1(ex));
  set('res-nec4', ver2(examenPara(cod, notaMinimaDe(cod))));
  set('res-nec-obj', ver2(examenPara(cod, obj)));
  const pe = document.getElementById('res-estado');
  if (pe) { pe.textContent = e.texto; pe.className = 'pill ' + e.clase; }
  const pex = document.getElementById('res-exim');
  if (pex) {
    pex.className = 'exim' + (estadoEximicion(cod, ex).cumple ? '' : ' no');
    pex.innerHTML = htmlExim(cod, ex);
  }
  renderLista();
}
function renderDetalle(){
  const cod = selNotas, r = cursoDe(cod), s = est();
  if (!r) {   // sin ramos no hay nada que detallar: se explica en vez de reventar
    document.getElementById('ev-detalle').innerHTML =
      '<p class="ayuda" style="padding:20px">Aquí aparecen las notas del ramo que elijas a la ' +
      'izquierda. Todavía no tienes ninguno: créalos en la pestaña <b>Malla</b>.</p>';
    return;
  }
  const exa = examenDe(cod), exim = eximDe(cod);
  const ex = examenSim[cod] !== undefined ? examenSim[cod] : null;
  const P = presentacion(cod, ex), nf = notaFinal(cod, ex), estd = estadoDe(cod, ex);
  const estx = estadoEximicion(cod, ex);
  const obj = (s.metas_ramo[cod] || {}).nota || 5.0;
  const cats = catsDe(cod), comps = compsDe(cod);
  // Pesar distinto cada componente es raro (casi siempre pesan igual). La columna aparece solo si
  // alguien la pide con el recuadro, para no llenar la tabla de numeros que casi nadie toca.
  const verPesos = !!E.ajustes.pesosComponente;

  const filasCat = cats.map((c, i) => {
    const p = promedioCategoria(cod, c, ex);
    const col = colorCategoria(c, i);
    return '<tr><td><span class="punto-cat" style="background:' + col + '"></span>' +
      '<input type="text" data-cat-nombre="' + i + '" value="' + esc(c.nombre) + '"></td>' +
      '<td class="num"><input type="color" data-cat-color="' + i + '" value="' + col +
      '" title="Tinte de la categoría"></td>' +
      '<td class="num"><input type="number" min="0" max="100" step="5" data-cat-peso="' + i +
      '" value="' + (Number(c.peso) * 100).toFixed(0) + '"></td>' +
      '<td class="num">' + (p === null ? '—' : ver1(p)) + '</td>' +
      '<td class="num"><button class="quitar" data-cat-quitar="' + i + '">×</button></td></tr>';
  }).join('') || '<tr><td colspan="5" class="vacio">Sin categorías: agrega una para poder pesar los componentes.</td></tr>';
  const sumaPesos = cats.reduce((a, c) => a + (Number(c.peso) || 0), 0);
  const barra = cats.map((c, i) => '<i style="width:' + (sumaPesos ? (Number(c.peso) || 0) / sumaPesos * 100 : 0) +
    '%;background:' + colorCategoria(c, i) + '"></i>').join('');

  const filasComp = comps.map((c, i) => {
    const reemplaza = exa.reemplaza === i;
    const v = valorComp(cod, i, ex);
    const opciones = cats.map(x => '<option' + (x.nombre === c.categoria ? ' selected' : '') + '>' + esc(x.nombre) + '</option>').join('');
    return '<tr><td><input type="text" data-comp-nombre="' + i + '" value="' + esc(c.nombre) + '"></td>' +
      '<td><select data-comp-cat="' + i + '">' + opciones + '</select></td>' +
      (verPesos ? '<td class="num"><input type="number" min="0.1" step="0.5" data-comp-peso="' + i +
        '" value="' + (c.peso || 1) + '"></td>' : '') +
      '<td class="num">' + (reemplaza
        ? '<span class="mono" style="color:var(--q)">' + (ex === null ? 'lo pone el examen' : ver1(v)) + '</span>'
        : '<input type="number" min="1" max="7" step="0.1" data-comp-nota="' + i + '" value="' +
          (c.nota === null || c.nota === undefined ? '' : c.nota) + '">') + '</td>' +
      '<td class="num"><input type="date" data-comp-fecha="' + i + '" value="' + (c.fecha || '') + '"></td>' +
      '<td>' + (reemplaza ? '<span class="reemplazo">el examen ocupa este lugar</span>' : '') + '</td>' +
      '<td class="num"><button class="quitar" data-comp-quitar="' + i + '">×</button></td></tr>';
  }).join('') || '<tr><td colspan="' + (verPesos ? 7 : 6) + '" class="vacio">Sin componentes todavía.</td></tr>';

  const filasCond = (exim.condiciones || []).map((c, i) => {
    const e = estx.detalle[i] || {};
    const ref = c.tipo === 'categoria'
      ? '<select data-cond-ref="' + i + '">' + cats.map(x => '<option' + (x.nombre === c.ref ? ' selected' : '') + '>' +
          esc(x.nombre) + '</option>').join('') + '</select>'
      : c.tipo === 'componente'
        ? '<select data-cond-ref="' + i + '">' + comps.map(x => '<option' + (x.nombre === c.ref ? ' selected' : '') + '>' +
            esc(x.nombre) + '</option>').join('') + '</select>'
        : '<span class="vacio">' + (e.valor === null ? 'sin datos' : 'va en ' + ver1(e.valor)) + '</span>';
    return '<div class="cond">' +
      '<select data-cond-tipo="' + i + '">' +
        '<option value="presentacion"' + (c.tipo === 'presentacion' ? ' selected' : '') + '>Nota de presentación</option>' +
        '<option value="categoria"' + (c.tipo === 'categoria' ? ' selected' : '') + '>Promedio de la categoría</option>' +
        '<option value="componente"' + (c.tipo === 'componente' ? ' selected' : '') + '>Nota de un componente</option>' +
      '</select>' + ref +
      '<select data-cond-op="' + i + '">' +
        ['>=','>','<=','<'].map(o => '<option' + (c.op === o ? ' selected' : '') + '>' + o + '</option>').join('') +
      '</select>' +
      '<input type="number" min="1" max="7" step="0.1" data-cond-valor="' + i + '" value="' + c.valor + '">' +
      '<button class="quitar" data-cond-quitar="' + i + '">×</button></div>';
  }).join('') || '<div class="vacio">Sin condiciones: mientras no haya ninguna, el ramo no se exime.</div>';

  document.getElementById('ev-detalle').innerHTML = `
    <div class="tarjeta">
      <h2><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${colorDe(cod)}"></i>
        ${esc(r.alias)} <span class="mono" style="font-weight:400;color:var(--muted)">${r.codigo}</span>
        <span class="pill ${estd.clase}" id="res-estado">${estd.texto}</span></h2>
      <div class="sub">${esc(r.nombre)} · ${r.creditos || '?'} créditos · apuntas a ${ver1(obj)}</div>
      <div class="grueso">
        <div class="caja"><b id="res-p">${P === null ? '—' : ver1(P)}</b><span>Nota de presentación (sin examen)</span></div>
        <div class="caja"><b id="res-nf">${nf === null ? '—' : ver1(nf)}</b><span>Nota final</span></div>
      </div>

      <div class="bloque">
        <details class="barra-extraible" open>
          <summary><span class="izq">Nota mínima para aprobar</span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <div class="campo"><span>Nota de corte de este ramo</span>
              <input type="number" id="nota-min" min="1" max="7" step="0.1" value="${ver1(notaMinimaDe(cod))}"></div>
            <p class="ayuda">Con la final sobre esta nota, el ramo queda aprobado. En casi todas las
              carreras es 4.0; cámbiala aquí y el semáforo y el simulador la usan.</p>
          </div>
        </details>
      </div>

      <div class="bloque">
        <details class="barra-extraible">
          <summary><span class="izq">Categorías <span class="cuenta">peso sobre la presentación</span></span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <table class="cat">
              <thead><tr><th>Categoría</th><th class="num">Tinte</th><th class="num">Peso %</th><th class="num">Promedio</th><th></th></tr></thead>
              <tbody>${filasCat}</tbody>
            </table>
            <div class="barra-peso">${barra}</div>
            <div class="fila" style="margin-top:8px"><button class="btn" id="cat-nueva">+ Categoría</button>
              <span class="ayuda" style="margin:0"><b>El peso es cuánto aporta cada categoría a tu nota de
              presentación.</b> Si tienes 60% de controles y 40% de tareas, un 6.0 en controles pesa más
              que un 6.0 en tareas. Da igual si suman menos o más de 100%: se reparten solos. El examen
              no entra aquí, se suma aparte.</span></div>
          </div>
        </details>
      </div>

      <div class="bloque">
        <details class="barra-extraible">
          <summary><span class="izq">Componentes y notas <span class="cuenta">cada control, entrega, ejercicio</span></span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <div class="alta">
              <select id="comp-cant-cat">${cats.map(x => '<option>' + esc(x.nombre) + '</option>').join('')}</select>
              <input type="number" id="comp-cant" min="1" max="50" value="7" title="Cuántos">
              <button class="btn" id="comp-varios">+ Agregar</button>
              <button class="btn" id="comp-nuevo">+ Uno suelto</button>
            </div>
            <label class="chico"><input type="checkbox" id="comp-ver-pesos"${verPesos ? ' checked' : ''}>
              usar un peso distinto por componente</label>
            <table class="cat">
              <thead><tr><th>Componente</th><th>Categoría</th>${verPesos ? '<th class="num">Peso</th>' : ''}<th class="num">Nota</th><th class="num">Fecha</th><th></th><th></th></tr></thead>
              <tbody>${filasComp}</tbody>
            </table>
            <p class="ayuda">Elige la categoría y cuántos, y se crean numerados de una vez: 7 en Ejercicios dan
              Ejercicio 1 a Ejercicio 7. La columna de peso aparece solo si la pides aquí arriba.</p>
          </div>
        </details>
      </div>

      <div class="bloque">
        <details class="barra-extraible">
          <summary><span class="izq">Eximición <span class="cuenta">cuándo te saltas el examen</span></span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <div class="campo"><span>El ramo se puede eximir</span>
              <input type="checkbox" id="exim-activa" ${exim.activa ? 'checked' : ''} style="justify-self:end"></div>
            <div class="campo"><span>Deben cumplirse</span>
              <select id="exim-modo">
                <option value="todas"${(exim.modo || 'todas') === 'todas' ? ' selected' : ''}>Todas las condiciones</option>
                <option value="alguna"${exim.modo === 'alguna' ? ' selected' : ''}>Al menos una condición</option>
              </select></div>
            ${filasCond}
            <div class="fila" style="margin-top:8px"><button class="btn" id="cond-nueva">+ Condición</button></div>
            <div class="exim${estx.cumple ? '' : ' no'}" id="res-exim" style="margin-top:10px">${htmlExim(cod, ex)}</div>
          </div>
        </details>
      </div>

      <div class="bloque">
        <details class="barra-extraible">
          <summary><span class="izq">Examen</span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <div class="campo"><span>Este ramo tiene examen</span>
              <input type="checkbox" id="exa-activo" ${exa.activo ? 'checked' : ''} style="justify-self:end"></div>
            <div class="campo"><span>Cuánto vale en la nota final si no te eximes (%)</span>
              <input type="number" id="exa-peso" min="0" max="100" step="5" value="${(Number(exa.peso)*100).toFixed(0)}"></div>
            <div class="campo"><span>Ocupa el lugar de un componente</span>
              <select id="exa-reemplaza"><option value="">— No, el examen va aparte —</option>
                ${comps.map((c, i) => '<option value="' + i + '"' + (exa.reemplaza === i ? ' selected' : '') + '>' +
                  esc(c.nombre) + '</option>').join('')}</select></div>
            <p class="ayuda">El examen solo se considera si <b>no</b> cumples la eximición. Si ocupa el lugar de un
               componente, la nota de presentación también se mueve con él.</p>
          </div>
        </details>
      </div>

      <div class="bloque">
        <details class="barra-extraible">
          <summary><span class="izq">Color del ramo</span><span class="flecha">&#9654;</span></summary>
          <div class="cuerpo">
            <div class="campo"><span>Color con el que se marca este ramo</span>
              <input type="color" id="ramo-color" value="${colorDe(cod)}"></div>
            <p class="ayuda">El color individual del ramo, tal como aparece al tomarlo (en Evaluaciones,
              Calendario y Malla). Cada ramo puede tener el suyo.</p>
          </div>
        </details>
      </div>
    </div>
    <div class="sim">
      <details class="barra-extraible">
        <summary><span class="izq">Simulador <span class="cuenta">mueve la nota del examen</span></span><span class="flecha">&#9654;</span></summary>
        <div class="cuerpo">
          <input type="range" min="100" max="700" step="5" id="slider" value="${ex === null ? 400 : Math.round(ex*100)}">
          <div class="fila" style="justify-content:space-between;font-size:.8rem;color:var(--q)">
            <span>1.0</span><span>examen simulado: <b id="res-ex">${ex === null ? 'sin nota' : ver1(ex)}</b></span><span>7.0</span>
          </div>
          <div class="res">
            <span>Con esa nota, la final queda en</span><b id="res-nf2">${nf === null ? '—' : ver1(nf)}</b>
            <span>Para aprobar (${ver1(notaMinimaDe(cod))}) necesitas</span><b id="res-nec4">${ver2(examenPara(cod, notaMinimaDe(cod)))}</b>
            <span>Para tu meta (${ver1(obj)}) necesitas</span><b id="res-nec-obj">${ver2(examenPara(cod, obj))}</b>
          </div>
        </div>
      </details>
    </div>`;
  enlazarDetalle(cod, r);
}
function enlazarDetalle(cod, r){
  const s = est();
  const on = (sel, ev, fn) => document.querySelectorAll(sel).forEach(el => el[ev] = () => { fn(el); guardar(); renderTodo(); });
  on('[data-cat-nombre]','onchange', el => { catsDe(cod)[+el.dataset.catNombre].nombre = el.value; });
  on('[data-cat-peso]','onchange', el => { catsDe(cod)[+el.dataset.catPeso].peso = (Number(el.value) || 0) / 100; });
  on('[data-cat-quitar]','onclick', el => { catsDe(cod).splice(+el.dataset.catQuitar, 1); });
  on('[data-comp-nombre]','onchange', el => { compsDe(cod)[+el.dataset.compNombre].nombre = el.value; });
  on('[data-comp-cat]','onchange', el => { compsDe(cod)[+el.dataset.compCat].categoria = el.value; });
  on('[data-comp-peso]','onchange', el => { compsDe(cod)[+el.dataset.compPeso].peso = Number(el.value) || 1; });
  on('[data-comp-nota]','onchange', el => {
    compsDe(cod)[+el.dataset.compNota].nota = normalizarNota(el.value);
  });
  // La fecha de un componente puede reflejarse como evento en el calendario. Se pregunta ANTES de
  // crear/vincular: el usuario decide si quiere el evento o no. Si ya habia un evento con el mismo
  // nombre, se sincroniza (le cambia la fecha); si no, se crea uno nuevo.
  on('[data-comp-fecha]','onchange', async el => {
    const c = compsDe(cod)[+el.dataset.compFecha];
    const fecha = el.value;                       // '' si se borro, 'AAAA-MM-DD' si se puso
    c.fecha = fecha || null;
    const ev = eventoDelComponente(c.nombre);
    if (fecha) {                                  // se PUSO una fecha
      if (ev && ev.origen === 'notas') {          // ya vinculado a una nota: solo se mueve
        ev.fecha = fecha; ev.dia = diaDeFecha(fecha); ev.ramo = cod;
      } else if (ev) {                            // hay evento del mismo nombre, pero NO de notas
        // no se toca un evento ajeno: se avisa y se deja la fecha solo en Notas
        mostrarAviso('Ya hay "' + c.nombre + '" en el calendario (no viene de Notas); no lo cambié.');
      } else {                                    // no hay evento: se propone crearlo
        // Ventana propia en vez de confirm(): en el escritorio los dialogos del navegador
        // no se muestran, y el evento se creaba (o no) sin que el usuario viera nada.
        if (await confirmar('Se creara el evento "' + c.nombre + '" en el calendario con la fecha '
            + fecha + '.', { titulo: 'Crear el evento', aceptar: 'Crear' })) {
          crearEventoDesdeComponente(c, cod, fecha);
          mostrarAviso('Evento creado en el calendario.');
        }
      }
    } else {                                      // se BORRO la fecha
      if (ev && ev.origen === 'notas') {          // estaba vinculado: se borra el evento con la fecha
        est().nuevas = est().nuevas.filter(x => String(x.id) !== String(ev.id));
        mostrarAviso('Se quitó "' + c.nombre + '" del calendario.');
      }
      // si el evento no era de notas, se queda: solo se le quita la fecha al componente
    }
    guardar(); renderTodo();
  });
  on('[data-comp-quitar]','onclick', el => {
    const i = +el.dataset.compQuitar;
    const c = compsDe(cod)[i];
    // si este componente habia creado su evento por fecha, ese evento se va con el
    const ev = c ? eventoDelComponente(c.nombre) : null;
    if (ev && ev.origen === 'notas') {
      est().nuevas = est().nuevas.filter(x => String(x.id) !== String(ev.id));
    }
    compsDe(cod).splice(i, 1);
    const exa = examenDe(cod);
    if (exa.reemplaza === i) exa.reemplaza = null;
    else if (exa.reemplaza !== null && exa.reemplaza > i) exa.reemplaza--;
  });
  on('[data-cat-color]','onchange', el => { catsDe(cod)[+el.dataset.catColor].color = el.value; });
  on('[data-cond-tipo]','onchange', el => { eximDe(cod).condiciones[+el.dataset.condTipo].tipo = el.value; });
  on('[data-cond-ref]','onchange', el => { eximDe(cod).condiciones[+el.dataset.condRef].ref = el.value; });
  on('[data-cond-op]','onchange', el => { eximDe(cod).condiciones[+el.dataset.condOp].op = el.value; });
  on('[data-cond-valor]','onchange', el => {
    eximDe(cod).condiciones[+el.dataset.condValor].valor = normalizarNota(el.value) || 4;
  });
  on('[data-cond-quitar]','onclick', el => { eximDe(cod).condiciones.splice(+el.dataset.condQuitar, 1); });
  // ASISTENCIA: el apartado se retiro de esta seccion (2026-09-30) y sera una seccion propia;
  // por eso ya no hay manejadores de #asis-minimo / #asis-parcial / #hora-agregar.
  const ramoColor = document.getElementById('ramo-color');
  if (ramoColor) ramoColor.onchange = () => {
    est().colores = est().colores || {};
    est().colores[cod] = ramoColor.value;
    guardar(); renderTodo();
  };
  // El horario semanal (bloques L-D, arrastrables y estirables) tambien se retiro con la
  // asistencia: vivia colgado del mismo bloque de la ficha del ramo.
  const nm = document.getElementById('nota-min');
  if (nm) nm.onchange = () => {
    const v = normalizarNota(nm.value);
    est().metas_ramo[cod] = est().metas_ramo[cod] || {};
    est().metas_ramo[cod].nota_min = (v === null ? 4.0 : v);
    guardar(); renderTodo();
  };

  document.getElementById('cat-nueva').onclick = () => {
    const i = catsDe(cod).length;
    catsDe(cod).push({nombre:'Categoría ' + (i + 1), peso:0, color:PALETA_CATS[i % PALETA_CATS.length]});
    guardar(); renderTodo();
  };
  // Crear siete ejercicios de una vez en vez de siete veces "+ Uno suelto". La numeracion sigue
  // desde el ultimo que ya exista con ese nombre, para no repetir "Ejercicio 1" dos veces.
  document.getElementById('comp-varios').onclick = () => {
    const cat = document.getElementById('comp-cant-cat').value;
    const n = Math.max(1, Math.min(50, Number(document.getElementById('comp-cant').value) || 1));
    const base = singularDe(cat);   // "Controles"->"Control", "Exámenes"->"Examen" (engine de idioma)
    for (let k = 0; k < n; k++) {
      const ya = compsDe(cod).filter(x => x.nombre.indexOf(base + ' ') === 0).length;
      compsDe(cod).push({nombre:base + ' ' + (ya + 1), categoria:cat, peso:1, nota:null});
    }
    guardar(); renderTodo();
  };
  document.getElementById('comp-ver-pesos').onchange = (ev) => {
    E.ajustes.pesosComponente = ev.target.checked; guardar(); renderTodo();
  };
  document.getElementById('comp-nuevo').onclick = () => {
    const cat = catsDe(cod)[0] ? catsDe(cod)[0].nombre : 'General';
    compsDe(cod).push({nombre:'Componente ' + (compsDe(cod).length + 1), categoria:cat, peso:1, nota:null});
    guardar(); renderTodo();
  };
  document.getElementById('cond-nueva').onclick = () => {
    const x = eximDe(cod);
    x.condiciones = x.condiciones || [];
    x.condiciones.push({tipo:'presentacion', ref:null, op:'>=', valor:5.0});
    x.activa = true;
    guardar(); renderTodo();
  };
  document.getElementById('exim-activa').onchange = ev => { eximDe(cod).activa = ev.target.checked; guardar(); renderTodo(); };
  document.getElementById('exim-modo').onchange = ev => { eximDe(cod).modo = ev.target.value; guardar(); renderTodo(); };
  document.getElementById('exa-activo').onchange = ev => { examenDe(cod).activo = ev.target.checked; guardar(); renderTodo(); };
  document.getElementById('exa-peso').oninput = ev => { examenDe(cod).peso = (Number(ev.target.value) || 0) / 100; guardar(); renderTodo(); };
  document.getElementById('exa-reemplaza').onchange = ev => {
    examenDe(cod).reemplaza = ev.target.value === '' ? null : Number(ev.target.value);
    guardar(); renderTodo();
  };
  const sl = document.getElementById('slider');
  sl.oninput = ev => { examenSim[cod] = Number(ev.target.value) / 100; actualizarResumen(cod); };
  sl.onchange = () => { guardar(); renderTodo(); };
  document.querySelectorAll('[data-estado-ramo]').forEach(el => el.onchange = () => {
    est().estado[cod] = el.value; guardar(); renderTodo();
  });
}
function renderTodo(sinAjustes){
  // Al repintar, las barras extraibles (barra-extraible) se reconstruyen y nacen plegadas. Para que
  // un cambio dentro de una barra (ej. marcar la eximicion o el examen) NO cierre el panel que se
  // esta editando, se recuerda cuales estaban abiertas por el resumen del <summary> y se reabren al
  // final. Es el arreglo del bug "se cierra el panel al tocar algo" (2026-09-21).
  const abiertas = [].slice.call(document.querySelectorAll('.barra-extraible.abierta'))
    .map(b => (b.querySelector(':scope > summary') || {}).textContent || '')
    .map(t => t.replace(/\s+/g, ' ').trim());
  memoEstados = null;                       // cualquier cambio puede mover el estado de la malla
  // los filtros del calendario salen de los ramos del semestre: si se agrega o se quita uno, la lista
  // del costado tiene que seguirlo, o quedaria desfasada de la malla
  pintarFiltros();
  renderLista(); renderDetalle(); renderSemestre(); renderEstudio(); renderMalla();
  estilizarSelects(document);
  if (!sinAjustes) renderAjustes();
  // reabre las que estaban abiertas, buscandolas por su titulo (los summaries no llevan id estable)
  document.querySelectorAll('.barra-extraible').forEach(b => {
    const t = ((b.querySelector(':scope > summary') || {}).textContent || '').replace(/\s+/g, ' ').trim();
    if (t && abiertas.indexOf(t) !== -1 && !b.classList.contains('abierta')) b.classList.add('abierta');
  });
}

