/* ------------------------------------------------------------- simulador de toma de ramos
   A partir de lo que ya has aprobado (lo real) puedes MARCAR ramos adicionales como "aprobado en
   simulacion", sin tocar tu estado, y ver que se te desbloquea. Sirve para planear: "si apruebo
   esto, cuantos ramos me quedan disponibles y cuales son". Nada de lo que marques aqui se guarda;
   es un borrador que muere al cerrar el modal. */
let simMarcados = {};   // ramos que el usuario marco como aprobado en la simulacion (solo en memoria)

function aprobadosSim(){
  const base = aprobadosSet();
  const out = {};
  Object.keys(base).forEach(c => { out[c] = true; });
  Object.keys(simMarcados).forEach(c => { if (simMarcados[c]) out[c] = true; });
  return out;
}

function requisitosFaltantesSim(cod, estadosSim){
  const c = CAT()[cod] || {};
  const faltan = (c.requisitos || []).filter(r => estadosSim[r] !== 'aprobado');
  (c.requisitos_o || []).forEach(g => {
    if (!g.some(r => estadosSim[r] === 'aprobado')) faltan.push(g.join(' o '));
  });
  return faltan;
}

function modalSimular(){
  simMarcados = {};
  // arranca con los aprobados y en curso ya marcados, para que el punto de partida sea la realidad
  const reales = aprobadosSet();
  Object.keys(reales).forEach(c => { simMarcados[c] = true; });
  const enCurso = {};
  ramosBase().forEach(r => { enCurso[r.codigo] = true; });

  const codigos = Object.keys(CAT()).filter(c => CAT()[c].tipo !== 'cupo')
    .sort((a, b) => ((CAT()[a].semestre_num || 99) - (CAT()[b].semestre_num || 99)) || a.localeCompare(b));

  document.getElementById('modal-caja').className = 'modal-caja m-campo';
  document.getElementById('modal-caja').innerHTML =
    '<h2>Simulador de toma de ramos</h2>' +
    '<button class="cerrar" id="cerrar">Cerrar</button>' +
    '<p class="ayuda">Marca ramos como <b>aprobados</b> (aunque no lo esten) y mira que se te ' +
      'desbloquea. Es solo una proyeccion: no cambia nada de tu malla real.</p>' +
    '<div class="fila" style="gap:8px;flex-wrap:wrap;margin:8px 0">' +
      '<button class="mini" id="sim-restaurar">Volver a lo real</button>' +
      '<button class="mini" id="sim-todos-bloqueados">Desmarcar los no aprobados</button>' +
    '</div>' +
    '<div class="lista-ramos" id="sim-lista">' + codigos.map(cod => {
      const c = CAT()[cod];
      const marcado = !!simMarcados[cod];
      const real = reales[cod] || enCurso[cod];
      return '<label class="opcion" data-cod="' + cod + '">' +
        '<input type="checkbox" data-sim="' + cod + '"' + (marcado ? ' checked' : '') + '>' +
        '<span class="mono">' + cod + '</span><span class="nm2">' + esc(c.nombre) + '</span>' +
        '<span class="sm">' + (real ? (reales[cod] ? 'ya aprobado' : 'en curso') : '') + '</span></label>';
    }).join('') + '</div>' +
    '<div id="sim-resultado" style="margin-top:14px"></div>' +
    '<div class="fila" style="justify-content:flex-end;gap:8px;margin-top:12px">' +
      '<button class="btn" id="sim-cerrar">Cerrar</button>' +
    '</div>';

  document.getElementById('modal').classList.add('on');
  document.getElementById('cerrar').onclick = cerrarEditor;
  document.getElementById('sim-cerrar').onclick = cerrarEditor;

  function pintarResultado(){
    const eSim = calcularCon(aprobadosSim());
    const eReal = calcularEstados();
    // que se desbloqueo: estaba bloqueado (o curso) en lo real y ahora queda disponible
    const nuevos = codigos.filter(cod => eReal[cod] !== 'disponible' && eSim[cod] === 'disponible');
    const disponibles = codigos.filter(cod => eSim[cod] === 'disponible').length;
    const bloqueados = codigos.filter(cod => eSim[cod] === 'bloqueado').length;
    const caja = document.getElementById('sim-resultado');
    let html = '<div class="bloque"><h4 style="margin:0 0 6px">Con esta seleccion</h4>' +
      '<span class="pill n">' + disponibles + ' disponibles</span> ' +
      '<span class="pill bad">' + bloqueados + ' bloqueados</span>' +
      '<p class="ayuda" style="margin:4px 0 0">Los "en curso" se cuentan aparte; al marcarlos como ' +
      'aprobados entran al juego.</p></div>';
    if (nuevos.length) {
      html += '<div class="bloque"><h4 style="margin:0 0 6px">Se te desbloquean (' + nuevos.length + ')</h4>' +
        nuevos.map(cod => '<div class="opcion" style="pointer-events:none">' +
          '<span class="mono">' + cod + '</span><span class="nm2">' + esc(CAT()[cod].nombre) + '</span>' +
          '<span class="sm" style="color:var(--ok)">ahora disponible</span></div>').join('') + '</div>';
    } else {
      html += '<p class="ayuda">Con lo marcado, ningun ramo nuevo se desbloquea respecto de tu ' +
        'estado real.</p>';
    }
    caja.innerHTML = html;
  }

  document.querySelectorAll('[data-sim]').forEach(cb => cb.onchange = () => {
    simMarcados[cb.dataset.sim] = cb.checked;
    pintarResultado();
  });
  document.getElementById('sim-restaurar').onclick = () => {
    simMarcados = {};
    Object.keys(reales).forEach(c => { simMarcados[c] = true; });
    document.querySelectorAll('[data-sim]').forEach(cb => {
      cb.checked = !!simMarcados[cb.dataset.sim];
    });
    pintarResultado();
  };
  document.getElementById('sim-todos-bloqueados').onclick = () => {
    Object.keys(simMarcados).forEach(c => { if (!reales[c]) delete simMarcados[c]; });
    document.querySelectorAll('[data-sim]').forEach(cb => {
      cb.checked = !!simMarcados[cb.dataset.sim];
    });
    pintarResultado();
  };

  pintarResultado();
}
