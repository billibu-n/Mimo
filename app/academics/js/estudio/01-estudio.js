/* ---------------------------------------------------------------- estudio */
function renderBarras(){
  const sem = semActivo(), s = est();
  const semanas = sem.semanas;
  const meta = Number(s.metas.semanal) || 0;                  // la base
  const totales = semanas.map(w => horasAsignadas(w.lunes));
  const metas = semanas.map(w => metaDe(w.lunes));            // la de cada semana, que puede ser otra
  const hayPropias = semanas.some(w => tieneMetaPropia(w.lunes));
  const tope = Math.max(meta, Math.max.apply(null, metas.concat(totales).concat([0]))) * 1.12 || 10;
  document.getElementById('es-grafico-leyenda').innerHTML =
    ramosBase().map(r => {
      const h = semanas.reduce((a, w) => a + (Number(minutosDe(w.lunes)[r.codigo]) || 0), 0) / 60;
      return '<span class="lg"><i style="background:' + colorDe(r.codigo) + '"></i>' + esc(r.alias) +
             ' <b style="color:var(--muted2)">' + fmtHM(h * 60) + '</b></span>';
    }).join('') +
    '<span class="lg"><i style="background:#fff;border-top:2px dashed #86efac"></i>meta base ' +
      fmtHM(meta * 60) + '</span>' +
    (hayPropias ? '<span class="lg"><i style="background:#fff;border-top:2px solid var(--ac)"></i>' +
      'meta propia de esa semana</span>' : '');
  const alto = 100;
  const hayAlgo = Math.max.apply(null, totales.concat([0])) > 0;
  if (!hayAlgo) {
    document.getElementById('es-grafico').innerHTML = '<div class="grafico-vacio">' +
      'Todavía no hay horas repartidas entre los ramos, así que no hay nada que dibujar. ' +
      'Lo registrado (' + fmtHM(sinRepartir() * 60) + ') está sin repartir: asígnalo en la tabla de ' +
      'aquí abajo y cada ramo aparece con su color.</div>';
    return;
  }
  document.getElementById('es-grafico').innerHTML = '<div class="grafico-in">' + semanas.map(w => {
    const m = minutosDe(w.lunes), totalH = horasAsignadas(w.lunes);
    const seg = ramosBase().map(r => {
      const v = Number(m[r.codigo]) || 0;
      if (!v) return '';
      return '<div class="seg" style="height:' + (v/60/tope*alto) + '%;background:' + colorDe(r.codigo) +
        '" title="' + esc(r.alias) + ': ' + fmtHM(v) + '"></div>';
    }).join('');
    // Se compara contra la meta de ESA semana, no contra la base: una semana con meta propia es la
    // que manda para decidir si se paso.
    const metaW = metaDe(w.lunes);
    const marcaPropia = tieneMetaPropia(w.lunes)
      ? '<div class="ln-propia" style="bottom:' + (metaW / tope * 100) + '%" title="meta de esta ' +
        'semana: ' + fmtHM(metaW * 60) + '"></div>'
      : '';
    return '<div class="semana-col' + (totalH > metaW ? ' excedida' : '') + '" title="' + esc(w.etiqueta) + ' · ' +
      fmtHM(totalH * 60) + ' de ' + fmtHM(metaW * 60) + '"><span class="tot">' +
      (totalH ? fmtHM(totalH * 60) : '') + '</span>' +
      '<div class="pila" style="height:' + Math.min(alto, totalH/tope*alto) + '%">' + seg + '</div>' +
      marcaPropia +
      '<span class="etq">' + esc(w.etiqueta) + '</span></div>';
  }).join('') +
    '<div class="ln" style="bottom:' + (meta/tope*100) + '%"><span>meta base</span></div></div>';
}
/* La meta de una semana concreta.
 *
 * No todas las semanas son iguales: una con dos pruebas no se parece a la primera de clases. La
 * meta base (`metas.semanal`) sigue siendo el valor de siempre, pero una semana puede llevar la
 * suya, y esa manda: se pone en la columna Meta de la tabla, aqui mismo, sin ir a Ajustes.
 * Vacia quiere decir "usar la base", que es lo que quiere casi todo el mundo casi siempre.
 */
function metasPropias(){ return est().metas_semana || {}; }
function metaDe(lunes){
  const propia = Number(metasPropias()[lunes]);
  if (propia > 0) return propia;
  return metaBaseEfectiva();
}
function tieneMetaPropia(lunes){ return Number(metasPropias()[lunes]) > 0; }

function renderKpisEstudio(){
  const sem = semActivo(), s = est();
  const totales = sem.semanas.map(w => horasSemana(w.lunes));
  // Se compara cada semana contra SU meta: la suya si la tiene, y si no la base. Antes se
  // comparaban todas contra la misma cifra, y una semana con meta propia contaba mal.
  const sobreMeta = sem.semanas.filter(w => horasSemana(w.lunes) > metaDe(w.lunes)).length;
  const conPropia = sem.semanas.filter(w => tieneMetaPropia(w.lunes)).length;
  const conRegistro = totales.filter(t => t > 0);
  document.getElementById('es-kpis').innerHTML =
    kpi(fmtHM(totalHoras() * 60) || '0h', 'estudiadas en el semestre') +
    kpi((conRegistro.length ? fmtHM(conRegistro.reduce((a,b) => a+b, 0) / conRegistro.length * 60) : '0h'),
        'promedio en las ' + conRegistro.length + ' semanas con registro') +
    kpi(sobreMeta, 'semanas sobre su meta' +
        (conPropia ? ' (' + conPropia + ' con meta propia)' : '')) +
    kpi(fmtHM(objetivoSemanal() * 60), 'objetivo semanal (suma de los ramos)') +
    kpi(fmtHM(sinRepartir() * 60) || '0h', 'sin repartir, de lo registrado en el Excel');
}
// Avisa si a un ramo le estás dedicando poco tiempo (menos de la mitad de su meta semanal) y te deja
// decidir: "es válido, déjalo así" (lo descarta por esta semana) o "le dedicaré tiempo" (te pide horas).
function renderDedicacion(){
  const cont = document.getElementById('es-dedicacion');
  if (!cont) return;
  const s = est();
  const lu = semanaDe(hoy());
  const avisos = [];
  ramosBase().forEach(r => {
    const meta = (s.metas_ramo[r.codigo] || {}).horas || 0;
    if (!meta) return;
    if (s.descartes[r.codigo] === lu) return;
    const llevo = Number(minutosDe(lu)[r.codigo]) || 0;
    if (llevo >= meta * 60 * 0.5) return;
    avisos.push({cod: r.codigo, alias: r.alias || r.codigo, llevo: llevo, meta: meta * 60});
  });
  if (!avisos.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = '<div class="tarjeta aviso-dedicacion">' +
    '<h3>Te queda poco tiempo en…</h3>' +
    '<p class="ayuda">Estos ramos llevan menos de la mitad de su meta de esta semana. Decide si está ' +
    'bien así o si le dedicas tiempo ahora.</p>' +
    avisos.map(a => '<div class="aviso-fila" data-cod="' + a.cod + '">' +
      '<span class="lg"><i style="background:' + colorDe(a.cod) + '"></i><b>' + esc(a.alias) + '</b></span>' +
      '<span class="sm">llevas ' + fmtHM(a.llevo) + ' · meta ' + fmtHM(a.meta) + '</span>' +
      '<span class="aviso-acciones">' +
        '<button class="btn chico" data-descartar="' + a.cod + '">Es válido, déjalo así</button>' +
        '<button class="btn chico primario" data-anadir="' + a.cod + '">Le dedicaré tiempo</button>' +
      '</span></div>').join('') + '</div>';
  cont.querySelectorAll('[data-descartar]').forEach(b => b.onclick = () => {
    est().descartes[b.dataset.descartar] = lu; guardar(); renderDedicacion();
  });
  cont.querySelectorAll('[data-anadir]').forEach(b => b.onclick = () => {
    const fila = cont.querySelector('.aviso-fila[data-cod="' + b.dataset.anadir + '"]');
    if (!fila) return;
    const acc = fila.querySelector('.aviso-acciones');
    acc.innerHTML = '<input type="text" placeholder="2h 30m" style="width:96px">' +
      '<button class="btn chico primario" data-guardar="' + b.dataset.anadir + '">Guardar</button>' +
      '<button class="btn chico" data-cancelar="' + b.dataset.anadir + '">Cancelar</button>';
    const inp = acc.querySelector('input');
    inp.focus();
    acc.querySelector('[data-guardar]').onclick = () => {
      est().minutos[lu] = est().minutos[lu] || {};
      // SUMA a lo que ya llevaba ese ramo. Este boton dice "le dedicare tiempo": lo que se
      // escribe aqui es tiempo que se anade a lo de antes, no el total de la semana.
      est().minutos[lu][b.dataset.anadir] = minutosDeCasilla(lu, b.dataset.anadir) + parseHM(inp.value);
      guardar(); renderEstudio();
    };
    acc.querySelector('[data-cancelar]').onclick = () => renderDedicacion();
  });
}
// Sumar tiempo a lo que ya hay.
//
// El caso es corriente: un dia estudiaste una hora de un ramo y lo registraste; dias despues
// estudias media hora mas del mismo ramo, en la misma semana. Antes habia que leer lo que ya
// estaba escrito y sumarlo de cabeza, y si no lo hacias te borrabas la hora sin enterarte.
// Ahora se escribe "+30m" y se suma.
function esSuma(texto){
  return /^\s*\+/.test(String(texto || ''));
}
// Los minutos de un "+30m": parseHM ya ignora el signo, asi que sirve tal cual.
function minutosEscritos(texto){
  return parseHM(String(texto || '').replace(/^\s*\+/, ''));
}
function minutosDeCasilla(lunes, codigo){
  return Number(((est().minutos[lunes] || {})[codigo])) || 0;
}
function pintarTotalesDeLaFila(lunes){
  const cel = document.querySelector('#es-tabla td[data-tot="' + lunes + '"]');
  if (cel) cel.textContent = fmtHM(horasSemana(lunes) * 60);
  const co = document.querySelector('#es-tabla td[data-otros="' + lunes + '"] .h-otros');
  if (co) co.textContent = fmtHM(minutosDe(lunes).OTROS);
}
// Lo que de verdad se guarda: con "+" suma, sin "+" reemplaza (para poder corregir a mano).
function valorFinal(texto, actual){
  return esSuma(texto) ? actual + minutosEscritos(texto) : parseHM(texto);
}
function confirmarCasilla(inp){
  const lu = inp.dataset.lunes, ramo = inp.dataset.ramo;
  const valor = valorFinal(inp.value, minutosDeCasilla(lu, ramo));
  est().minutos[lu] = est().minutos[lu] || {};
  est().minutos[lu][ramo] = valor;
  inp.value = fmtHM(valor);          // queda escrito el total, no el "+30m"
  pintarTotalesDeLaFila(lu);
  guardar();
  renderKpisEstudio();
  renderBarras();
  renderPuntos();
  renderSemestre();
}
/* Sumar tiempo rapido, con el boton derecho sobre una casilla.
 *
 * La idea: estas estudiando, te acuerdas de que hoy le metiste media hora mas a un ramo, y
 * quieres anotarlo sin pensar. Un clic derecho sobre la casilla y "30m" hace la suma.
 *
 * Los tramos son los que se repiten de verdad; para lo demas esta "Otra cantidad", que entiende
 * lo mismo que las casillas ("25m", "1h 30m", "0:45").
 */
const SUMAS_RAPIDAS = [15, 30, 45, 60, 120];

function sumarTiempo(lunes, ramo, minutos){
  if (!(minutos > 0)) return;
  const s = est();
  s.minutos[lunes] = s.minutos[lunes] || {};
  s.minutos[lunes][ramo] = (Number(s.minutos[lunes][ramo]) || 0) + minutos;
  guardar();
  renderEstudio();          // la tabla y los graficos, con el total nuevo en la casilla
  mostrarAviso('Sumados ' + fmtHM(minutos) + ' a ' + aliasDe(ramo));
}

function cerrarMenuSuma(){
  const m = document.getElementById('menu-suma');
  if (m) m.remove();
  document.removeEventListener('mousedown', cerrarMenuSumaFuera, true);
  document.removeEventListener('keydown', cerrarMenuSumaEsc, true);
}
function cerrarMenuSumaFuera(ev){
  const m = document.getElementById('menu-suma');
  if (m && !m.contains(ev.target)) cerrarMenuSuma();
}
function cerrarMenuSumaEsc(ev){ if (ev.key === 'Escape') cerrarMenuSuma(); }

function abrirMenuSuma(ev, inp){
  cerrarMenuSuma();
  const lu = inp.dataset.lunes, ramo = inp.dataset.ramo;
  const actual = Number(((est().minutos[lu] || {})[ramo])) || 0;

  const m = document.createElement('div');
  m.id = 'menu-suma';
  m.className = 'menu-suma';
  m.innerHTML = '<div class="ms-titulo">' + esc(aliasDe(ramo)) + ' lleva ' +
      (fmtHM(actual) || '0h') + '</div>' +
    SUMAS_RAPIDAS.map(x => '<button class="ms-op" data-suma="' + x + '">+ ' + fmtHM(x) + '</button>').join('') +
    '<button class="ms-op" data-suma="otra">Otra cantidad…</button>';
  document.body.appendChild(m);

  // junto al cursor, pero sin salirse de la ventana
  const r = m.getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(ev.clientX, window.innerWidth - r.width - 8)) + 'px';
  m.style.top = Math.max(8, Math.min(ev.clientY, window.innerHeight - r.height - 8)) + 'px';

  m.querySelectorAll('[data-suma]').forEach(b => b.onclick = async () => {
    const v = b.dataset.suma;
    cerrarMenuSuma();
    if (v === 'otra') {
      // Ventana propia en vez de prompt(): en el escritorio no se muestra.
      const txt = await pedir('Cuanto tiempo quieres sumar a ' + aliasDe(ramo) + '?',
        { titulo: 'Sumar tiempo', aceptar: 'Sumar', valor: '30m', marcador: 'por ejemplo: 25m, 1h 30m' });
      if (txt === null) return;
      const min = parseHM(txt);
      if (min > 0) sumarTiempo(lu, ramo, min);
      else mostrarAviso('No entendí esa cantidad: prueba con 25m o 1h 30m');
      return;
    }
    sumarTiempo(lu, ramo, Number(v));
  });

  // se engancha despues de este clic, para que el propio clic derecho no lo cierre
  setTimeout(() => {
    document.addEventListener('mousedown', cerrarMenuSumaFuera, true);
    document.addEventListener('keydown', cerrarMenuSumaEsc, true);
  }, 0);
}

function renderEstudio(){
  const sem = semActivo(), s = est();
  const semanas = sem.semanas;
  const h = hoy();
  renderKpisEstudio();
  renderBarras();
  renderPuntos();
  renderDedicacion();
  // La meta base se edita en esta misma pestana (se mudo desde Ajustes, que es para lo secundario).
  // No se pisa el valor mientras se esta escribiendo en ella.
  const casillaMeta = document.getElementById('es-meta');
  if (casillaMeta && document.activeElement !== casillaMeta) casillaMeta.value = s.metas.semanal;
  const chkMax = document.getElementById('es-meta-max');
  if (chkMax) {
    chkMax.checked = !!(E.usarMetaMaxima);
    chkMax.parentElement.parentElement.querySelector('.pista').textContent = E.usarMetaMaxima
      ? 'Tu récord actual es ' + fmtHM(totalSemanaMax()) + '. Meta base ahora: ' + fmtHM(metaBaseEfectiva() * 60) + '.'
      : 'En vez de fijar un número, la meta pasa a ser la semana en la que más estudiaste hasta ahora. Si un día superas ese récord, la meta sube sola.';
    const info = document.getElementById('es-meta-max-info');
    if (info) info.textContent = E.usarMetaMaxima
      ? 'Activado: tu meta es tu máximo histórico (' + fmtHM(totalSemanaMax()) + '), y se actualiza solo.'
      : '';
  }
  // El nombre del ramo se resume segun lo elegido en Ajustes, y el completo va en el tooltip: un
  // nombre largo no puede quedarse cortado a media palabra sin forma de saber cual es.
  const cab = '<thead><tr><th>Semana</th>' +
    ramosH().map(r => {
      const horas = (s.metas_ramo[r.codigo] || {}).horas;
      return '<th title="' + esc(r.alias) + '">' +
        '<span class="abrev">' + esc(resumirTitulo(r.alias)) + '</span>' +
        '<span class="meta-ramo">' + (horas !== undefined ? fmtHM(horas * 60) : '') + '</span></th>';
    }).join('') +
    '<th title="Meta de esta semana. Si la dejas en blanco se usa la meta base.">Meta</th>' +
    '<th>Total</th></tr></thead>';
  const filas = semanas.map(w => {
    const m = minutosDe(w.lunes);
    const act = (h >= w.lunes && h <= sumaDias(w.lunes, 6));
    const celdas = ramosH().map(r => r.codigo === OTROS.codigo
      ? '<td class="celda-otros" data-otros="' + w.lunes + '">' +
        '<span class="h-otros">' + fmtHM(m.OTROS) + '</span>' +
        '<input class="nota-otros" data-otros-texto="' + w.lunes + '" placeholder="nota libre" value="' +
        esc((s.notas_otros || {})[w.lunes] || '') + '" title="Para escribir qué piensas hacer con ese tiempo. No suma horas."></td>'
      : '<td><input type="text" data-lunes="' + w.lunes + '" data-ramo="' + r.codigo +
        '" value="' + fmtHM(m[r.codigo]) + '" placeholder="0h" inputmode="decimal"></td>').join('');
    // La meta de la semana: vacia quiere decir "la base". Cuando lleva la suya, se marca para que
    // se vea de un golpe que esa semana es distinta y no un descuido.
    const propia = tieneMetaPropia(w.lunes);
    const celdaMeta = '<td class="celda-meta"><input type="text" class="meta-casilla' +
      (propia ? ' propia' : '') + '" data-meta="' + w.lunes + '" value="' +
      (propia ? fmtHM(metasPropias()[w.lunes] * 60) : '') + '" placeholder="' +
      fmtHM(metaDe(w.lunes) * 60) + '" title="' + (propia
        ? 'Meta propia de esta semana. Borrala para volver a la meta base.'
        : 'Vacio: esta semana usa la meta base (' + fmtHM(metaDe(w.lunes) * 60) +
          '). Escribe otra para cambiarla solo aqui.') + '"></td>';
    return '<tr' + (act ? ' class="hoy"' : '') + '><td><b>' + esc(w.etiqueta) + '</b> <span class="sm">' +
      rangoSemana(w.lunes) + '</span></td>' + celdas + celdaMeta +
      '<td class="tot" data-tot="' + w.lunes + '">' + fmtHM(horasSemana(w.lunes) * 60) + '</td></tr>';
  }).join('');
  document.getElementById('es-tabla').innerHTML = cab + '<tbody>' + filas + '</tbody>';
  document.querySelectorAll('#es-tabla input').forEach(inp => {
    inp.oninput = () => {
      const lu = inp.dataset.lunes;
      // Con "+" delante, el tiempo se SUMA a lo que ya habia en esa casilla: es para cuando
      // estudias un rato mas otro dia de la misma semana y no quieres ponerte a calcular el
      // total de cabeza. Mientras se escribe NO se guarda --cada tecla sumaria otra vez--, solo
      // se muestra como quedaria el total; se confirma con Enter o al salir de la casilla.
      if (esSuma(inp.value)) {
        const cel = document.querySelector('#es-tabla td[data-tot="' + lu + '"]');
        if (cel) cel.textContent = fmtHM(horasSemana(lu) * 60 + minutosEscritos(inp.value));
        return;
      }
      est().minutos[lu] = est().minutos[lu] || {};
      est().minutos[lu][inp.dataset.ramo] = parseHM(inp.value);
      pintarTotalesDeLaFila(lu);
      guardar();
      // se repintan solo las piezas que dependen del dato; la tabla NO, para no perder el foco
      renderKpisEstudio();
      renderBarras();
      renderPuntos();
      renderSemestre();
    };
    inp.onblur = () => confirmarCasilla(inp);
    // El boton derecho abre el menu para sumar. Se le quita a la casilla el menu del navegador,
    // que aqui no sirve de nada.
    inp.oncontextmenu = ev => { ev.preventDefault(); abrirMenuSuma(ev, inp); };
    // Enter confirma. Se llama a confirmar DIRECTAMENTE en vez de confiar en que soltar el foco
    // lo haga: si el navegador no dispara el blur, el "+30m" se quedaba escrito en la casilla sin
    // sumarse, y el usuario veia que no pasaba nada. Volver a confirmar es inofensivo: sin "+",
    // escribe el mismo valor otra vez.
    inp.onkeydown = ev => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      confirmarCasilla(inp);
      inp.blur();
    };
  });
  // La columna Meta: escribir una meta propia para esa semana, o dejarla vacia para volver a la
  // base. Enter confirma, como en las casillas de tiempo.
  document.querySelectorAll('#es-tabla input[data-meta]').forEach(inp => {
    const aplicar = () => {
      const lu = inp.dataset.meta, txt = inp.value.trim();
      const s2 = est();
      s2.metas_semana = s2.metas_semana || {};
      const min = txt ? parseHM(txt) : 0;
      if (min > 0) s2.metas_semana[lu] = min / 60;
      else delete s2.metas_semana[lu];
      guardar();
      renderEstudio();
    };
    inp.onblur = aplicar;
    inp.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); aplicar(); } };
  });

  // El texto de "Sin asignar" es una nota para uno mismo: se guarda, pero no entra en ningun
  // calculo de horas. Por eso no se repinta nada al escribirlo.
  document.querySelectorAll('[data-otros-texto]').forEach(el => el.onchange = () => {
    est().notas_otros = est().notas_otros || {};
    est().notas_otros[el.dataset.otrosTexto] = el.value;
    guardar();
  });
}
function renderPuntos(){
  const sem = semActivo(), s = est();
  const cont = document.getElementById('es-puntos');
  const ancho = Math.max(700, cont.clientWidth || 900);
  const alto = 250, izq = 42, der = 14, arriba = 16, abajo = 30;
  const semanas = sem.semanas;
  const horas = semanas.map(w => horasSemana(w.lunes));
  const objetivo = objetivoSemanal();
  const tope = Math.max(objetivo, Math.max.apply(null, horas.concat([0]))) * 1.15 || 10;
  const x = i => izq + (semanas.length === 1 ? 0 : i * (ancho - izq - der) / (semanas.length - 1));
  const y = v => arriba + (1 - v / tope) * (alto - arriba - abajo);
  const marcas = [0, 0.25, 0.5, 0.75, 1].map(f => {
    const v = tope * f;
    return '<line x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + y(v) + '" y2="' + y(v) +
      '" stroke="var(--line)" stroke-width="1"></line>' +
      '<text x="' + (izq - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end" font-size="9" fill="var(--muted)">' +
      v.toFixed(0) + '</text>';
  }).join('');
  const linea = horas.map((v, i) => (i ? 'L' : 'M') + x(i) + ' ' + y(v)).join(' ');
  const actual = '<path d="' + linea + '" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round"></path>' +
    semanas.map((w, i) => {
      const act = (w.lunes <= hoy() && sumaDias(w.lunes, 6) >= hoy());
      return '<circle cx="' + x(i) + '" cy="' + y(horas[i]) + '" r="' + (act ? 5 : 3.5) + '" fill="' +
        (act ? 'var(--ac)' : 'var(--sup)') + '" stroke="var(--fg)" stroke-width="2"><title>' + esc(w.etiqueta) + ': ' +
        fmtHM(horas[i] * 60) + '</title></circle>';
    }).join('');
  const etiquetas = semanas.map((w, i) =>
    (i % 2 === 0 || semanas.length <= 12)
      ? '<text x="' + x(i) + '" y="' + (alto - 10) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' +
        esc(w.etiqueta) + '</text>'
      : '').join('');
  cont.innerHTML = '<div class="puntos"><svg viewBox="0 0 ' + ancho + ' ' + alto + '" width="100%" height="' + alto + '">' +
    marcas +
    '<line x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + y(objetivo) + '" y2="' + y(objetivo) +
      '" stroke="var(--ok)" stroke-width="2"></line>' +
    '<text x="' + (ancho - der) + '" y="' + (y(objetivo) - 6) + '" text-anchor="end" font-size="10" fill="var(--ok)">' +
      'objetivo ' + fmtHM(objetivo * 60) + '</text>' +
    actual + etiquetas + '</svg></div>';
  document.getElementById('es-puntos-leyenda').innerHTML =
    '<span class="lg"><i style="background:var(--fg)"></i>horas realizadas</span>' +
    '<span class="lg"><i style="background:var(--ok)"></i>objetivo semanal ' + fmtHM(objetivo * 60) + '</span>' +
    '<span class="lg" style="color:var(--muted)">El punto resaltado es la semana en curso.</span>';
}
