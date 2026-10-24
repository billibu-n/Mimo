/* ---------------------------------------------------------------- malla */
/* Estados posibles de un ramo en la malla:
   aprobado   -> ya lo pasaste (marcado en algún semestre o a mano)
   curso      -> está en el semestre activo
   disponible -> no lo has tomado y ya tienes todos sus prerrequisitos
   bloqueado  -> le falta algún prerrequisito                                  */
let mallaSel = null, mallaRapido = false, mallaBusca = '', mallaBuscaTexto = '',
    memoEstados = null;

function aprobadosSet(){
  const set = {};
  Object.keys(E.aprobados || {}).forEach(c => { if (E.aprobados[c]) set[c] = true; });
  semestres().forEach(sm => {
    const e = (E.sem[sm.id] || {}).estado || {};
    Object.keys(e).forEach(c => { if (e[c] === 'aprobado') set[c] = true; });
  });
  return set;
}
// El motor de estados, parametrizado: recibe un juego de aprobados (objeto codigo->true) y devuelve
// el estado de cada ramo. La version real usa los aprobados de verdad; el simulador le pasa los
// reales MAS los que el usuario marca como "aprobado en simulacion", sin tocar el estado guardado.
function calcularCon(aprob){
  const enCurso = {};
  ramosBase().forEach(r => { enCurso[r.codigo] = true; });
  const memo = {};
  function est(cod, visto){
    if (memo[cod]) return memo[cod];
    visto = visto || {};
    if (visto[cod]) return 'bloqueado';          // por si el grafo trajera un ciclo
    visto[cod] = true;
    let v;
    if (aprob[cod]) v = 'aprobado';
    else if (enCurso[cod]) v = 'curso';
    else {
      const reqs = (CAT()[cod] || {}).requisitos || [];
      // Ademas de "todos estos" hay grupos donde basta uno (MI3230 pide FI2004 o IQ2212). Sin
      // mirarlos, esos ramos quedaban marcados como disponibles aunque faltara el prerrequisito.
      const uno = (CAT()[cod] || {}).requisitos_o || [];
      v = (reqs.every(r => est(r, visto) === 'aprobado') &&
           uno.every(g => g.some(r => est(r, visto) === 'aprobado')))
        ? 'disponible' : 'bloqueado';
    }
    memo[cod] = v;
    return v;
  }
  Object.keys(CAT()).forEach(c => est(c));
  return memo;
}
function calcularEstados(){ return calcularCon(aprobadosSet()); }
function estados(){ return memoEstados || (memoEstados = calcularEstados()); }
function aplanar(grupos){ return [].concat.apply([], grupos || []); }
function requisitosFaltantes(cod){
  const e = estados();
  const c = CAT()[cod] || {};
  const faltan = (c.requisitos || []).filter(r => e[r] !== 'aprobado');
  // De cada grupo "basta uno" se avisa como texto: si no hay ninguno aprobado, falta el grupo entero.
  (c.requisitos_o || []).forEach(g => {
    if (!g.some(r => e[r] === 'aprobado')) faltan.push(g.join(' o '));
  });
  return faltan;
}
function cadena(cod, direccion, visto){
  visto = visto || {};
  if (visto[cod]) return [];
  visto[cod] = true;
  const c = CAT()[cod] || {};
  const base = direccion === 'antes' ? (c.requisitos || []).concat(aplanar(c.requisitos_o))
                                     : (c.desbloquea || []);
  let out = [];
  base.forEach(x => { out = out.concat([x], cadena(x, direccion, visto)); });
  return out;
}
function herederoDe(cod){
  if (!mallaSel) return true;
  if (cod === mallaSel) return true;
  return cadena(mallaSel, 'antes').indexOf(cod) >= 0 || cadena(mallaSel, 'despues').indexOf(cod) >= 0;
}
/* Un ramo anual se cursa en dos semestres seguidos: en Ingenieria son tipicos los talleres y
   varios ramos de especialidad. Se dibuja como un recuadro del ancho de dos columnas, y la
   columna de al lado le reserva el alto para que no le quede nada debajo (eso lo hace
   acomodarAnuales). */
function esAnual(cod){ return !!(CAT()[cod] || {}).anual; }
/* Texto legible del espacio/duracion de un ramo, para mostrarlo en la ficha. */
function txtEspacio(esp){
  if (!esp || !esp.tipo) return '';
  const n = esp.cantidad || 1;
  if (esp.tipo === 'semanas') return n + ' semana' + (n === 1 ? '' : 's');
  if (esp.tipo === 'trimestre') return n + ' trimestre' + (n === 1 ? '' : 's');
  return n + ' semestre' + (n === 1 ? '' : 's');
}
function semestresQueOcupa(cod){
  if (!esAnual(cod)) return 1;
  const n = parseInt((CAT()[cod] || {}).semestres, 10);
  return n > 1 ? n : 2;
}
function nodoHTML(cod, compacto){
  const c = CAT()[cod] || {nombre:cod, creditos:null};
  const e = estados()[cod] || 'bloqueado';
  const clases = ['nodo', e];
  if (c.tipo === 'cupo') clases.push('cupo');
  if (compacto === false && esAnual(cod)) clases.push('anual');
  if (cod === mallaSel) clases.push('sel');
  if (mallaSel && !herederoDe(cod)) clases.push('apagado');
  if (mallaBusca && sinTildes(cod + ' ' + c.nombre).indexOf(mallaBusca) < 0) clases.push('oculto');
  const a = avVista();
  const candado = !a.candado ? ''
    : e === 'bloqueado' ? '<span class="candado" title="le falta algún prerrequisito">&#128274;</span>'
    : e === 'curso' ? '<span class="candado" title="lo estás cursando">&#9998;</span>'
    : e === 'aprobado' ? '<span class="candado" title="aprobado">&#10003;</span>' : '';
  // Este es el vínculo entre la malla y el resto: agregar aquí es agregar al semestre en curso, y ese
  // semestre es el que alimenta el calendario, las horas, las notas y los indicadores. Una sola fuente.
  const sem = semActivo();
  const enSem = enSemestre(cod);
  const boton = compacto ? '' : (enSem
    ? '<button class="mas quitar" data-menos="' + cod + '" data-globo="Quitar de ' + esc(sem.nombre) + '">&#8722;</button>'
    : (e === 'aprobado' ? ''
      : '<button class="mas" data-mas="' + cod + '" data-globo="Agregar a ' + esc(sem.nombre) + ' (en curso)">+</button>'));
  const cred = !a.creditos || c.creditos === null ? '' : c.creditos + ' cr';
  const credTag = cred ? '<em>' + cred + '</em>' : '';
  if (compacto) {
    // en la columna de fuera de la malla, 27 tarjetas de alto completo estiraban toda la malla a
    // 2159 px. En una linea cada una: el nombre completo queda en el globo y en la ficha de al lado.
    return '<div class="' + clases.join(' ') + ' compacto" data-cod="' + cod +
      '" title="' + esc(c.nombre) + '">' +
      '<b>' + cod + '</b>' + credTag + '</div>';
  }
  // La marca va pegada al codigo y no en una esquina: la derecha de arriba la ocupa el candado
  // y la de abajo el boton de agregar, asi que ahi se pisarian.
  const marca = clases.indexOf('anual') >= 0 ? '<span class="anual-tag">anual</span>' : '';
  return '<div class="' + clases.join(' ') + '" data-cod="' + cod + '">' + candado +
    '<b>' + cod + marca + '</b><span class="nm">' + esc(c.nombre) + '</span>' + credTag + boton + '</div>';
}
function renderMalla(){
  renderDeshacer();
  // La configuracion de la malla (secciones) vive en esta misma pestana. Los colores de los
  // ramos salieron de aca (2026-09-21): renderColoresMalla() se conserva, a la espera de su
  // nuevo lugar.
  renderSecciones();
  const e = estados();
  if (!Object.keys(CAT()).length) {
    // La version limpia recien empezada no tiene nada que dibujar: se explica como empezar en
    // vez de dejar la pantalla en blanco, que parece que la aplicacion estuviera rota.
    document.getElementById('malla-kpis').innerHTML = '';
    document.getElementById('malla-leyenda').innerHTML = '';
    document.getElementById('malla').innerHTML =
      '<div class="tarjeta" style="max-width:580px;margin:24px auto;text-align:center">' +
      '<h2 style="border:0;justify-content:center">Tu malla está vacía</h2>' +
      '<p class="ayuda">Un ramo es una asignatura: su código, su nombre, sus créditos y de qué ' +
      'otros ramos depende. Al crearlos, la malla se va armando sola por niveles y las flechas de ' +
      'prerrequisito aparecen solas.</p>' +
      '<button class="btn acento" id="malla-vacia-nuevo">+ Crear mi primer ramo</button>' +
      '<button class="btn acento" id="malla-vacia-importar">+ Traer una malla desde un archivo</button></div>';
    document.getElementById('malla-detalle').innerHTML = '';
    document.getElementById('malla-vacia-nuevo').onclick = () => modalRamo(null);
    document.getElementById('malla-vacia-importar').onclick = () => modalImportarMalla();
    return;
  }
  const casillaBusca = document.getElementById('malla-buscar');
  if (document.activeElement !== casillaBusca) casillaBusca.value = mallaBuscaTexto;
  document.getElementById('malla-rapido').checked = mallaRapido;

  // Solo cuentan los ramos que de verdad estan dibujados en una columna. El catalogo traia uno
  // (MI6930, "Trabajo de Memoria de Titulo", 30 creditos, sin prerrequisitos y sin lugar en el
  // plan) que sumaba al total y bajaba el porcentaje de la carrera sin aparecer nunca en la
  // malla. El porcentaje tiene que hablar de lo que el estudiante ve.
  const dibujados = {};
  NIVELES().forEach(n => n.ramos.forEach(c => { dibujados[c] = true; }));
  const obligatorios = Object.keys(CAT()).filter(c => CAT()[c].en_malla && dibujados[c]);
  const reales = obligatorios.filter(c => CAT()[c].tipo !== 'cupo');
  const suma = c => obligatorios.filter(x => e[x] === c).reduce((a, x) => a + (CAT()[x].creditos || 0), 0);
  const total = obligatorios.reduce((a, x) => a + (CAT()[x].creditos || 0), 0);
  const aprobadosN = reales.filter(x => e[x] === 'aprobado').length;
  const listos = reales.filter(x => e[x] === 'disponible');
  document.getElementById('malla-kpis').innerHTML =
    kpi(suma('aprobado') + ' / ' + total, 'créditos aprobados de los obligatorios') +
    kpi(Math.round(suma('aprobado') / total * 100) + '%', 'de la carrera, sobre ' + reales.length + ' ramos y ' +
       obligatorios.filter(x => CAT()[x].tipo === 'cupo').length + ' cupos del plan') +
    kpi(aprobadosN + ' ramos', 'aprobados · ' + reales.filter(x => e[x] === 'curso').length + ' en curso') +
    kpi(listos.length, 'ramos que ya puedes tomar');

  document.getElementById('malla-leyenda').innerHTML =
    [['aprobado','aprobado'], ['curso','en curso'], ['disponible','disponible (ya puedes tomarlo)'],
     ['bloqueado','bloqueado por prerrequisito'], ['cupo','cupo del plan (electivos, formación integral)']]
      .map(x => '<span><i class="' + x[0] + '"></i>' + x[1] + '</span>').join('') +
    (mallaSel
      ? '<span style="color:var(--muted)">Ves solo las líneas de este ramo: en <b>naranjo</b> lo que él ' +
        'desbloquea y en <b>azul</b> lo que necesita. Para volver al flujo completo, quita la selección.</span>'
      : '<span style="color:var(--muted)">Estas son todas las líneas de prerrequisito. Elige un ramo para ' +
        'quedarte solo con las suyas.</span>');

  // Arma las columnas. Si hay secciones definidas, se agrupan por seccion: cada seccion es un
  // bloque con su titulo (sigla + nombre) CENTRADO sobre sus columnas, un fondo suave y una
  // linea vertical que la separa de la siguiente. Los niveles sin seccion van en un bloque aparte.
  const nivelesTodos = NIVELES();
  const secs = SECC();
  // seccion de cada nivel (la del primer ramo que tenga una); -1 = sin seccion
  const secDeNivel = n => {
    for (const cod of n.ramos) { const s = seccionDe(cod); if (s !== null) return s; }
    return -1;
  };
  let bloques;
  if (secs.length) {
    bloques = [];
    let actual = null;
    nivelesTodos.forEach(n => {
      const sIdx = secDeNivel(n);
      if (actual && actual.idx === sIdx) { actual.niveles.push(n); return; }
      actual = {idx: sIdx, niveles: [n]};
      bloques.push(actual);
    });
  } else {
    bloques = [{idx: -1, niveles: nivelesTodos}];
  }

  document.getElementById('malla').innerHTML = '<svg id="malla-svg"></svg>' + bloques.map(b => {
    const s = (b.idx >= 0) ? secs[b.idx] : null;
    const titulo = s
      ? '<div class="sec-titulo"' + (s.color ? ' style="border-color:' + esc(s.color) + '"' : '') + '>' +
          (s.sigla ? '<span class="sigla">' + esc(s.sigla) + '</span>' : '') + esc(s.nombre) + '</div>'
      : '';
    return '<div class="seccion-bloque"' + (s && s.color ? ' style="--sec-color:' + esc(s.color) + '"' : '') + '>' +
      titulo +
      '<div class="columnas">' + b.niveles.map(n => {
        const ramos = n.ramos.filter(c => CAT()[c]);
        const cred = ramos.reduce((a, c) => a + (CAT()[c].creditos || 0), 0);
        const apretado = n.nivel === 99;
        return '<div class="malla-col' + (apretado ? ' col-extras' : '') + '" data-nivel="' + n.nivel + '">' +
          '<div class="col-tit">' + esc(n.titulo) + ' <span class="col-cred">' + cred + ' cr</span></div>' +
          ramos.map(x => nodoHTML(x, apretado)).join('') + '</div>';
      }).join('') + '</div></div>';
  }).join('');
  document.querySelectorAll('#malla .nodo').forEach(n => n.onclick = () => {
    const cod = n.dataset.cod;
    if (mallaRapido) { alternarAprobado(cod); return; }
    mallaSel = (mallaSel === cod) ? null : cod;
    renderMalla(); renderMallaDetalle();
  });
  document.querySelectorAll('#malla .mas').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (b.dataset.mas) agregarRamo(b.dataset.mas); else quitarRamo(b.dataset.menos);
  });
  // Primero se acomodan los anuales (mueven tarjetas de sitio) y RECIEN despues se trazan las
  // lineas: al reves, las lineas quedarian calculadas con las posiciones viejas.
  acomodarAnuales();
  dibujarLineas();
  renderMallaDetalle();
}
/* Un ramo anual ocupa su columna y la siguiente, pero las columnas son independientes y la de al
   lado no sabe que le estan tapando media columna. Aqui se le empujan hacia abajo las tarjetas
   que caen dentro de la franja del recuadro anual.
   Se hace midiendo de verdad, no a ojo: el alto del recuadro depende de como quiebre el texto. */
function acomodarAnuales(){
  const malla = document.getElementById('malla');
  if (!malla) return;
  const MARGEN = 6;
  const base = malla.getBoundingClientRect();
  const cols = [].slice.call(malla.querySelectorAll('.malla-col'));
  const idx = {};
  cols.forEach(col => { idx[Number(col.dataset.nivel)] = col; });
  cols.forEach(col => {
    const nivel = Number(col.dataset.nivel);
    const anuales = [].slice.call(col.querySelectorAll('.nodo.anual:not(.oculto)'));
    if (!anuales.length) return;
    const franjas = anuales.map(a => {
      const r = a.getBoundingClientRect();
      return {y0: r.top - base.top, y1: r.bottom - base.top};
    }).sort((a, b) => a.y0 - b.y0);
    // Se empuja a todas las columnas que el recuadro invade, no solo a la de al lado.
    anuales.forEach(a => {
      const cuantas = semestresQueOcupa(a.dataset.cod);
      for (let k = 1; k < cuantas; k++) {
        const vecina = idx[nivel + k];
        if (!vecina) continue;
        let yaBajado = 0;
        [].slice.call(vecina.querySelectorAll('.nodo')).forEach(n => {
          if (n.classList.contains('oculto')) return;
          const r = n.getBoundingClientRect();
          const arriba = r.top - base.top - yaBajado;   // donde quedaria sin el empuje
          let empuje = 0;
          franjas.forEach(f => {
            if (arriba < f.y1 + MARGEN && arriba + r.height > f.y0 - MARGEN) {
              empuje = Math.max(empuje, f.y1 + MARGEN - arriba);
            }
          });
          if (empuje > 0) { n.style.marginTop = empuje + 'px'; yaBajado += empuje; }
        });
      }
    });
  });
}
function dibujarLineas(){
  const malla = document.getElementById('malla');
  const svg = document.getElementById('malla-svg');
  if (!malla || !svg) return;
  const ancho = malla.scrollWidth, alto = malla.scrollHeight;
  svg.setAttribute('width', ancho); svg.setAttribute('height', alto);
  svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
  const base = malla.getBoundingClientRect();
    const pos = {}, nivelDe = {}, porNivel = {};
    const estorbos = {};               // lo que tapa una columna sin ser de esa columna
    const columnas = [];
  malla.querySelectorAll('.malla-col').forEach(col => {
    const nl = Number(col.dataset.nivel);
    const caja = col.getBoundingClientRect();
    const nodos = [];
    col.querySelectorAll('.nodo').forEach(n => {
      if (n.classList.contains('oculto')) return;
      const r = n.getBoundingClientRect();
      const p = {x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height};
      pos[n.dataset.cod] = p;
      nivelDe[n.dataset.cod] = nl;
      nodos.push(p);
      // Un recuadro anual invade la columna siguiente. Para el trazado tiene que contar como
      // estorbo ALLI tambien: si no, las lineas que saltan columnas le pasan por encima.
      const cuantas = semestresQueOcupa(n.dataset.cod);
      for (let k = 1; k < cuantas; k++) {
        (estorbos[nl + k] = estorbos[nl + k] || []).push(p);
      }
    });
    columnas.push({nivel: nl, x0: caja.left - base.left, nodos: nodos});
  });
  // el orden que manda es el de la pantalla, de izquierda a derecha
  columnas.sort((a, b) => a.x0 - b.x0);
  const idxDe = {};
  columnas.forEach((col, i) => {
    col.i = i; idxDe[col.nivel] = i;
    porNivel[col.nivel] = col.nodos.concat(estorbos[col.nivel] || []);
  });
  // El trazado va por los PASILLOS: el hueco vertical entre una columna y la siguiente, y las
  // franjas horizontales entre tarjeta y tarjeta. Asi ninguna linea pisa un texto.
  const tapa = (nl, y) => (porNivel[nl] || []).some(p => y > p.y - 3 && y < p.y + p.h + 3);
  const franjas = nl => {           // centros de las franjas libres de una columna
    const ps = (porNivel[nl] || []).slice().sort((a, b) => a.y - b.y);
    const out = []; let prev = 0;
    ps.forEach(p => {
      if (p.y - 3 > prev) out.push((prev + p.y - 3) / 2);
      prev = Math.max(prev, p.y + p.h + 3);
    });
    if (alto > prev) out.push((prev + alto) / 2);
    return out;
  };
  const aristas = [];
  Object.keys(CAT()).forEach(c => {
    const cc = CAT()[c] || {};
    // Los grupos "basta uno" tambien son flechas: sin ellos Termodinamica no se conectaba con
    // MI3230 ni MI3235, justamente lo que se veia mal en la malla.
    (cc.requisitos || []).concat(aplanar(cc.requisitos_o)).forEach(r => {
      if (pos[r] && pos[c]) aristas.push([r, c]);
    });
  });
  // Con un ramo elegido se dibujan SOLO sus lineas (lo que necesita y lo que desbloquea): treinta
  // trazos encima de todas las tarjetas no dejan ver nada. Al soltarlo vuelve el flujo completo.
  const visibles = mallaSel
    ? aristas.filter(a => a[0] === mallaSel || a[1] === mallaSel)
    : aristas;
  // orden estable: si no, los desvios cambian de sitio en cada repintado y las lineas bailan
  visibles.sort((a, b) => (nivelDe[a[0]] - nivelDe[b[0]]) || (pos[a[0]].y - pos[b[0]].y));
  const usados = {};
  // los desvios se reparten dentro del pasillo: con 40 px caben ocho posiciones sin pisarse
  const turno = k => { const v = usados[k] = (usados[k] || 0); return v; };
  svg.innerHTML = visibles.map(a => {
    const p1 = pos[a[0]], p2 = pos[a[1]];
    const nl1 = nivelDe[a[0]], nl2 = nivelDe[a[1]];
    const i1 = idxDe[nl1], i2 = idxDe[nl2];
    const x1 = p1.x + p1.w, y1 = p1.y + p1.h / 2, x2 = p2.x, y2 = p2.y + p2.h / 2;
    // Los colores salen del CSS, no de aqui: escritos a mano desaparecian en tema oscuro.
    const color = !mallaSel ? 'var(--malla-linea)'
      : (a[0] === mallaSel ? 'var(--malla-linea-des)' : 'var(--malla-linea-req)');
    const base = AV_GROSOR[av().grosor] || 1.6;
    const grosor = ((a[0] === mallaSel || a[1] === mallaSel) ? base * 1.7 : base).toFixed(1);
    let pts;
    if (i1 === i2) {
      // mismo semestre (p. ej. Inglés I -> II, o Práctica -> Proyectos): sale por la derecha de la columna
      const xOut = Math.max(p1.x + p1.w, p2.x + p2.w) + 10 + (turno('m' + nl1) % 4) * 6;
      pts = [[x1, y1], [xOut, y1], [xOut, y2], [p2.x + p2.w, y2]];
    } else if (i2 - i1 <= 1) {
      // columnas vecinas: una sola codo en el pasillo
      const xm = (x1 + x2) / 2 + (turno('a' + nl1) % 3 - 1) * 8;
      pts = [[x1, y1], [xm, y1], [xm, y2], [x2, y2]];
    } else {
      // salta columnas: se viaja por una franja horizontal libre de las columnas de en medio
      const desvio1 = x1 + 3 + (turno('i' + nl1) % 8) * 4;
      const desvio2 = x2 - 3 - (turno('j' + nl2) % 8) * 4;
      let cands = [];
      for (let k = i1 + 1; k < i2; k++) cands = cands.concat(franjas(columnas[k].nivel));
      if (!cands.length) cands = [(y1 + y2) / 2];
      const medio = (y1 + y2) / 2;
      const estorbo = v => {
        let c = 0;
        for (let k = i1 + 1; k < i2; k++) if (tapa(columnas[k].nivel, v)) c++;
        return c;
      };
      const yy = cands.slice().sort((m, n) =>
        (estorbo(m) - estorbo(n)) || (Math.abs(m - medio) - Math.abs(n - medio)))[0];
      pts = [[x1, y1], [desvio1, y1], [desvio1, yy], [desvio2, yy], [desvio2, y2], [x2, y2]];
    }
    const d = pts.map((p, i) => (i ? 'L' : 'M') + Math.round(p[0]) + ' ' + Math.round(p[1])).join(' ');
    // El color va en style y no en el atributo: los atributos de SVG NO entienden var(--x),
    // asi que stroke="var(--malla-linea)" no pintaria nada. En style si, y ademas el navegador
    // lo repinta solo al cambiar de tema, sin volver a dibujar la malla.
    return '<path d="' + d + '" fill="none" style="stroke:' + color + ';stroke-width:' + grosor +
      ';stroke-linejoin:round;opacity:.85"></path>';
  }).join('');
}
function chipCurso(cod){
  const c = CAT()[cod] || {nombre:cod, creditos:null};
  const e = estados()[cod] || 'bloqueado';
  // El nombre se recorta con puntos si es muy largo: la pastilla no se estira sin fin ni se
  // parte a media palabra. El nombre completo queda en el tooltip.
  const nombre = resumirTitulo(c.nombre);
  return '<span class="pt-chip ' + e + '" data-ir="' + cod + '" title="' + esc(cod + ' · ' + c.nombre) + '">' +
    esc(cod + ' · ' + nombre) + '</span>';
}
function renderMallaDetalle(){
  const cont = document.getElementById('malla-detalle');
  if (!mallaSel) {
    cont.innerHTML = '<div class="tarjeta"><p class="ayuda">Elige un ramo en la malla para ver qué ' +
      'necesita, qué desbloquea, y para agregarlo o quitarlo del semestre activo. Si tienes muchos ramos ' +
      'ya aprobados, enciende el modo rápido y márcalos con un clic.</p></div>';
    return;
  }
  const c = CAT()[mallaSel] || {nombre:mallaSel};
  const e = estados()[mallaSel];
  const faltan = requisitosFaltantes(mallaSel);
  const enSem = enSemestre(mallaSel);
  const aprob = e === 'aprobado';
  const sem = semActivo();
  cont.innerHTML = `
    <div class="tarjeta">
      <h2>${mallaSel} <span class="mono" style="font-weight:400;color:var(--muted)">${esc(c.nombre)}</span>
        <span class="pill ${aprob ? 'ok' : e === 'curso' ? 'warn' : e === 'disponible' ? 'n' : 'bad'}">${
          aprob ? 'aprobado' : e === 'curso' ? 'en curso' : e === 'disponible' ? 'puedes tomarlo' : 'bloqueado'}</span></h2>
      <div class="sub">${c.semestre ? 'Semestre ' + c.semestre + ' del plan' : 'Electivo (fuera del plan)'} ·
        ${c.creditos === null ? 'créditos sin dato' : c.creditos + ' créditos'}${
        c.aprobacion ? ' · ' + c.aprobacion + '% de aprobación' : ''}${
        c.dificultad ? ' · dificultad: ' + esc(c.dificultad) : ''}${
        c.prioridad ? ' · prioridad: ' + esc(c.prioridad) : ''}</div>

      ${(c.universidad || c.carrera) ? '<div class="bloque"><h4>Institución</h4><p class="ficha-texto">' +
        [c.universidad, c.carrera].filter(Boolean).join(' · ') + '</p></div>' : ''}
      ${c.espacio ? '<div class="bloque"><h4>Espacio</h4><p class="ficha-texto">' +
        esc(txtEspacio(c.espacio)) + '</p></div>' : ''}
      ${c.demanda_tiempo || c.demanda_academica ? '<div class="bloque"><h4>Percepción</h4><p class="ficha-texto">' +
        (c.demanda_tiempo ? 'demanda de tiempo: ' + DEMANDA_NOMBRES[c.demanda_tiempo - 1] + ' · ' : '') +
        (c.demanda_academica ? 'demanda académica: ' + DEMANDA_NOMBRES[c.demanda_academica - 1] : '') +
        '</p></div>' : ''}

      ${c.descripcion ? '<div class="bloque"><h4>Descripción</h4><p class="ficha-texto">' +
        esc(c.descripcion).replace(/\n/g, '<br>') + '</p></div>' : ''}
      ${(c.equivalentes && c.equivalentes.length) ? '<div class="bloque"><h4>Ramos equivalentes</h4><p class="ficha-texto">' +
        c.equivalentes.map(ev => esc(ev.cod) + (ev.origen === 'externa' ? ' (externo)' : '')).join(', ') + '</p></div>' : ''}
      ${c.equivalente ? '<div class="bloque"><h4>Ramo equivalente</h4><p class="ficha-texto">' +
        esc(c.equivalente) + (CAT()[c.equivalente] ? ' — ' + esc(CAT()[c.equivalente].nombre || '') : '') +
        '</p></div>' : ''}

      <div class="fila" style="gap:8px;margin:16px 0">
        <button class="btn" id="md-editar">Editar este ramo</button>
      </div>
      <div class="bloque"><h4>Antes necesitas</h4>
        ${((c.requisitos || []).length || (c.requisitos_o || []).length)
          ? ((c.requisitos || []).length
              ? '<div class="pt-chips">' + (c.requisitos || []).map(chipCurso).join('') + '</div>'
              : '') +
            (c.requisitos_o || []).map(g => '<div class="uno-de">basta <b>uno</b> de:' +
              g.map(chipCurso).join('<span class="o">o</span>') + '</div>').join('')
          : '<span class="vacio">Ninguno: es de entrada.</span>'}
        ${faltan.length ? '<p class="ayuda">Te falta' + (faltan.length > 1 ? 'n' : '') + ': <b>' +
          faltan.join(', ') + '</b>. Igual puedes agregarlo al semestre, pero no podrás inscribirlo sin ellos.</p>' : ''}
      </div>

      <div class="bloque"><h4>Este ramo desbloquea</h4>
        ${(c.desbloquea || []).length
          ? '<div class="pt-chips">' + (c.desbloquea || []).map(chipCurso).join('') + '</div>'
          : '<span class="vacio">No es prerrequisito de nada más.</span>'}
      </div>

      <div class="fila" style="gap:8px;flex-wrap:wrap">
        ${enSem
          ? '<button class="btn peligro" id="md-quitar">Quitar de ' + esc(sem.nombre) + '</button>'
          : '<button class="btn primario" id="md-agregar">Agregar a ' + esc(sem.nombre) + '</button>'}
        <button class="btn" id="md-aprobado">${aprob ? (enSem ? 'Devolverlo a en curso' : 'Volver a pendiente') : 'Marcar como aprobado'}</button>
        <button class="btn" id="md-cerrar">Quitar selección</button>
      </div>
    </div>`;
  const ag = document.getElementById('md-agregar');
  if (ag) ag.onclick = () => { agregarRamo(mallaSel); renderMalla(); };
  const qu = document.getElementById('md-quitar');
  if (qu) qu.onclick = () => { quitarRamo(mallaSel); renderMalla(); };
  document.getElementById('md-aprobado').onclick = () => { alternarAprobado(mallaSel); };
  document.getElementById('md-cerrar').onclick = () => { mallaSel = null; renderMalla(); };
  document.querySelectorAll('#malla-detalle [data-ir]').forEach(el => el.onclick = () => {
    mallaSel = el.dataset.ir; renderMalla(); renderMallaDetalle();
    const n = document.querySelector('#malla .nodo[data-cod="' + mallaSel + '"]');
    if (n) n.scrollIntoView({block:'nearest', inline:'center'});
  });
  const bEd = document.getElementById('md-editar');
  if (bEd) bEd.onclick = () => modalRamo(mallaSel);
}
function alternarAprobado(cod){
  memoEstados = null;
  const aprobado = estados()[cod] === 'aprobado';
  const donde = semestres().filter(sm => ramosDeSem(sm).some(r => r.codigo === cod));
  if (donde.length) {
    const objetivo = aprobado ? 'en_curso' : 'aprobado';
    donde.forEach(sm => {
      const st2 = E.sem[sm.id] || {};
      st2.estado = st2.estado || {};
      st2.estado[cod] = objetivo;
    });
    delete E.aprobados[cod];
    guardar(cod + (objetivo === 'aprobado' ? ' marcado como aprobado' : ' devuelto a en curso'));
  } else if (aprobado) {
    delete E.aprobados[cod];
    guardar(cod + ' vuelto a pendiente');
  } else {
    E.aprobados[cod] = true;
    guardar(cod + ' marcado como aprobado');
  }
  memoEstados = null;
  renderTodo();
}


/* Exporta la malla SIN nada personal del alumno: solo la estructura (ramos, nombres, creditos,
   niveles, prerrequisitos, anuales y equivalencias). Queda fuera el estado de cada ramo
   (aprobado/en curso), las notas, las horas, los alias y los colores: esos datos viven en el
   semestre y en las preferencias, no en la malla, y no viajan con ella. Sirve para compartir una
   malla corregida con un companero o respaldarla para partir de nuevo. */
const CAMPOS_MALLA = ['nombre','creditos','nivel','semestre','semestre_num','requisitos',
                      'requisitos_o','anual','tipo','en_malla','equivalente','seccion'];
function exportarMalla(){
  const cat = CAT();
  const codigos = Object.keys(cat);
  if (!codigos.length) { mostrarAviso('Aun no hay malla que exportar.'); return; }
  const malla = {};
  codigos.forEach(k => {
    const r = cat[k];
    const limpio = {};
    CAMPOS_MALLA.forEach(campo => { if (r[campo] !== undefined) limpio[campo] = r[campo]; });
    malla[k] = limpio;
  });
  const paquete = {
    carrera: (D.carrera || {}),
    catalogo: malla,
    niveles: NIVELES().map(n => ({nivel:n.nivel, titulo:n.titulo})),
    secciones: SECC().map(s => ({nombre:s.nombre, sigla:s.sigla, color:s.color, niveles:s.niveles || []})),
    // NIVELES() ya devuelve los ramos repartidos por su nivel actual, pero el catalogo ya los trae.
  };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 1)], {type:'application/json'}));
  a.download = 'malla.json';
  a.click();
  mostrarAviso('Malla exportada: ' + codigos.length + ' ramos, sin datos personales.');
}
