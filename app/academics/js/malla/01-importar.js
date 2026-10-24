/* --------------------------------------------------------------- leer una malla
   Formatos aceptados (los tres mas faciles de generar desde cualquier plan de estudios):

     CSV o TSV, con cabecera:
        codigo,nombre,creditos,nivel,requisitos,tipo
        MA1001,Calculo Diferencial,8,1,,obligatorio
        MA2001,Calculo Integral,9,2,MA1001,obligatorio

     Los requisitos de varios ramos van separados por punto y coma o por barra:
        MA3001,Amarre,10,3,MA1001;MA2001,obligatorio

     JSON:
        {"ramos":[{"codigo":"MA1001","nombre":"...","creditos":8,"nivel":1,
                   "requisitos":[],"tipo":"obligatorio"}]}

   Se aceptan los titulos en espanol o en ingles, con o sin tildes, y las columnas en cualquier
   orden: se busca por nombre de columna, no por posicion. Sin cabecera, se supone ese orden.
*/
function partirLinea(linea, sep){
  const out = []; let campo = '', comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { out.push(campo); campo = ''; }
    else campo += c;
  }
  out.push(campo);
  return out.map(x => x.trim());
}
function sinTildes(t){
  return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
const CAMPOS = {
  codigo: ['codigo', 'code', 'sigla', 'clave', 'ramo', 'asignatura'],
  nombre: ['nombre', 'name', 'asignatura', 'titulo', 'ramo'],
  creditos: ['creditos', 'credits', 'cred', 'sct', 'sctla'],
  nivel: ['nivel', 'semestre', 'level', 'term', 'periodo', 'ano'],
  requisitos: ['requisitos', 'prerrequisitos', 'requisito', 'prerequisitos', 'prereq', 'reqs', 'req'],
  tipo: ['tipo', 'type', 'caracter', 'categoria'],
  anual: ['anual', 'annual', 'duracion', 'duracion_semestres', 'semestres que dura'],
  aprobacion: ['aprobacion', 'aprob', 'tasa_aprobacion', 'tasa de aprobacion', 'porcentaje'],
  dificultad: ['dificultad', 'dificulty', 'nivel de dificultad', 'dific'],
  prioridad: ['prioridad', 'prioridad', 'priority', 'prior'],
  descripcion: ['descripcion', 'descrip', 'description', 'resumen', 'comentario'],
  equivalente: ['equivalente', 'equivalente', 'equival', 'homologado', 'analogo']
};
function adivinarCampo(titulo){
  const t = sinTildes(titulo);
  return Object.keys(CAMPOS).find(k => CAMPOS[k].indexOf(t) >= 0) || null;
}
/* Lo que se copia a mano desde una FOTO de la malla.

   Quien tiene su malla como imagen no puede dar un archivo con columnas: copia lineas sueltas
   del tipo "EI1090 English Proficiency Test I", y muchas veces los titulos de semestre entre
   medio ("Semestre 3"). Hasta ahora eso se rechazaba de plano, y es justo el camino que la
   propia aplicacion le ofrece cuando le muestra la foto: le pide al alumno que pegue, y despues
   no le acepta el pegado. Se descubrio probando con la malla real de Ingenieria Civil de Minas.

   Devuelve {filas, semestres} o null. Devuelve null --en vez de armar una malla con cualquier
   cosa-- cuando el texto no tiene pinta de lista de ramos. */
const PEGADO_CON_NOMBRE = /^([A-Za-z]{2,6})\s*[- ]?\s*(\d{3,4})\s*([A-Za-z]?)\s+(\S.*)$/;
const PEGADO_SOLO_CODIGO = /^([A-Za-z]{2,6})\s*[- ]?\s*(\d{3,4})\s*([A-Za-z]?)$/;
const PEGADO_SEMESTRE = /^(?:semestre|nivel|ano)\s*(\d{1,2})\b|^(\d{1,2})\s*(?:er|do|to|mo|vo|no|[º°])?\s*(?:semestre|nivel|ano)\b/i;

function leerPegadoSimple(lineas){
  const utiles = lineas.filter(l => l.trim());
  if (!utiles.length) return null;
  // Si la primera linea trae separadores de tabla, esto no es un pegado: que lo lea el otro.
  if (/[,;\t|]/.test(utiles[0])) return null;

  const filas = [];
  let nivel = 1, semestres = 0;
  for (const cruda of utiles){
    const linea = cruda.trim();
    const sinT = sinTildes(linea);
    const ms = sinT.match(PEGADO_SEMESTRE);
    if (ms){
      const n = parseInt(ms[1] || ms[2], 10);
      if (n >= 1 && n <= 20){ nivel = n; semestres++; }
      continue;
    }
    const m = linea.match(PEGADO_CON_NOMBRE) || linea.match(PEGADO_SOLO_CODIGO);
    if (!m) continue;
    filas.push({codigo: (m[1] + m[2] + (m[3] || '')).toUpperCase(),
                nombre: (m[4] || '').trim(), creditos: 0, nivel: nivel,
                requisitos: [], tipo: 'obligatorio', anual: false});
  }
  if (filas.length < 2) return null;
  // La mayoria de las lineas tiene que ser un ramo o un titulo de semestre. Si no, es otra cosa.
  if (filas.length + semestres < utiles.length * 0.6) return null;
  return {filas: filas, semestres: semestres};
}

// Devuelve {ramos:[...], aviso:'...'} o lanza un error con un mensaje que el usuario entienda.
function leerMalla(texto, nombreArchivo){
  const bruto = String(texto || '').replace(/^\uFEFF/, '').trim();
  if (!bruto) throw new Error('El archivo está vacío.');
  const esJson = /^[\[{]/.test(bruto) || /\.json$/i.test(nombreArchivo || '');
  let filas;
  // Si el texto pegado no traia los semestres, hay que decirlo: si no, el alumno ve 55 ramos
  // apilados en la primera columna y no sabe por que.
  let pegadoSinSemestres = false;

  if (esJson) {
    let j;
    try { j = JSON.parse(bruto); } catch (e) { throw new Error('El JSON está mal escrito: ' + e.message); }
    const lista = Array.isArray(j) ? j : (j.ramos || j.cursos || j.asignaturas || j.malla);
    if (!Array.isArray(lista)) {
      throw new Error('El JSON no trae una lista de ramos (se esperaba "ramos": [...]).');
    }
    const seccionesDePaquete = (!Array.isArray(j) && Array.isArray(j.secciones)) ? j.secciones : null;
    filas = lista.map(r => {
      // Si el JSON trae 'requisitos' como texto ("MA1001;FI2004|IQ2212"), se parsea con la
      // notacion canonical. Si lo trae como lista (la forma vieja) se respeta tal cual.
      const reqCrudo = r.requisitos || r.prerequisitos || r.reqs;
      const estaReqTexto = typeof reqCrudo === 'string';
      const reqParsed = estaReqTexto ? requisitosDesdeTexto(reqCrudo) : null;
      return {
        codigo: r.codigo || r.code || r.sigla || '',
        nombre: r.nombre || r.name || '',
        creditos: r.creditos === undefined ? r.credits : r.creditos,
        nivel: r.nivel === undefined ? r.semestre : r.nivel,
        requisitos: reqParsed ? reqParsed.requisitos : (reqCrudo || []),
        requisitos_o: reqParsed ? reqParsed.requisitos_o : (r.requisitos_o || []),
        tipo: r.tipo || 'obligatorio',
        anual: r.anual === undefined ? r.annual : r.anual,
        seccion: (r.seccion !== undefined && r.seccion !== null) ? Number(r.seccion) : null,
        aprobacion: r.aprobacion,
        dificultad: r.dificultad,
        equivalente: r.equivalente,
        prioridad: r.prioridad,
        descripcion: r.descripcion
      };
    });
    // El paquete exportado trae 'secciones' (nombre/sigla/color/niveles). Se guardan para
    // cargarMalla, que las repone en E.secciones cuando vienen.
    if (seccionesDePaquete !== null) filas.__secciones = seccionesDePaquete;
  } else {
    const lineas = bruto.replace(/\r/g, '').split('\n').filter(l => l.trim());
    if (!lineas.length) throw new Error('El archivo no tiene ninguna línea con datos.');

    // Texto pegado de una foto: lineas sueltas, sin columnas. Se prueba antes de rendirse.
    const pegado = leerPegadoSimple(lineas);
    if (pegado) {
      filas = pegado.filas;
      pegadoSinSemestres = pegado.semestres === 0;
    } else {
    // el separador que mas aparece en la primera linea manda
    const cands = [',', ';', '\t', '|'];
    const sep = cands.map(c => [c, lineas[0].split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const cabecera = partirLinea(lineas[0], sep);
    const mapa = {};
    let tieneCabecera = false;
    cabecera.forEach((t, i) => {
      const c = adivinarCampo(t);
      if (c) { mapa[c] = i; tieneCabecera = true; }
    });
    // sin cabecera se supone el orden clasico: codigo, nombre, creditos, nivel, requisitos, tipo
    // Sin cabecera se supone el orden clasico, pero solo si la linea tiene pinta de malla:
    // con menos de tres columnas casi seguro que el archivo es otra cosa.
    if (!tieneCabecera) {
      if (cabecera.length < 3) {
        throw new Error('No reconocí las columnas. Ponle cabecera al archivo: ' +
          'codigo, nombre, creditos, nivel, requisitos, tipo');
      }
      mapa.codigo = 0; mapa.nombre = 1; mapa.creditos = 2; mapa.nivel = 3;
      mapa.requisitos = 4; mapa.tipo = 5;
    }
    if (mapa.codigo === undefined) {
      throw new Error('No encontré la columna del código. Ponle cabecera al archivo: ' +
        'codigo, nombre, creditos, nivel, requisitos, tipo');
    }
    const cuerpo = tieneCabecera ? lineas.slice(1) : lineas;
    filas = cuerpo.map(l => {
      const c = partirLinea(l, sep);
      // La columna requisitos usa la notacion canonical: ';' separa requisitos (Y), '|' separa
      // alternativas (O), "MA1001;FI2004|IQ2212" = MA1001 y (FI2004 o IQ2212).
      const reqTexto = mapa.requisitos === undefined ? '' : (c[mapa.requisitos] || '');
      const reqParsed = requisitosDesdeTexto(reqTexto);
      return {
        codigo: (c[mapa.codigo] || '').toUpperCase(),
        nombre: mapa.nombre === undefined ? '' : (c[mapa.nombre] || ''),
        creditos: mapa.creditos === undefined ? 0 : c[mapa.creditos],
        nivel: mapa.nivel === undefined ? 1 : c[mapa.nivel],
        requisitos: reqParsed.requisitos,
        requisitos_o: reqParsed.requisitos_o,
        tipo: mapa.tipo === undefined ? 'obligatorio' : (c[mapa.tipo] || 'obligatorio'),
        anual: mapa.anual === undefined ? false : (c[mapa.anual] || ''),
        aprobacion: mapa.aprobacion === undefined ? undefined : c[mapa.aprobacion],
        dificultad: mapa.dificultad === undefined ? undefined : c[mapa.dificultad],
        prioridad: mapa.prioridad === undefined ? undefined : c[mapa.prioridad],
        descripcion: mapa.descripcion === undefined ? undefined : c[mapa.descripcion],
        equivalente: mapa.equivalente === undefined ? undefined : c[mapa.equivalente]
      };
    });
    }
  }

  // limpieza y revision: nada entra a la malla sin codigo y sin nombre
  const seccionesImportadas = filas.__secciones || null;
  const buenos = [], problemas = [], vistos = {};
  filas.forEach((f, i) => {
    f.codigo = String(f.codigo || '').trim().toUpperCase();
    f.nombre = String(f.nombre || '').trim();
    f.creditos = Math.max(0, parseInt(f.creditos, 10) || 0);
    // Un ramo SIN nivel (campo vacio) se queda SIN nivel: es un electivo o suelto, y le
    // corresponde ir a la columna de electivos, NO al semestre I. Antes
    // 'Math.max(1, parseInt(f.nivel) || 1)' lo arrojaba al nivel 1 y amontonaba en la
    // primera columna ramos que no van ahi.
    const pn = parseInt(f.nivel, 10);
    f.nivel = Number.isFinite(pn) ? Math.max(1, pn) : '';
    if (!f.codigo) { problemas.push('línea ' + (i + 1) + ': sin código'); return; }
    if (vistos[f.codigo]) { problemas.push('línea ' + (i + 1) + ': ' + f.codigo + ' repetido'); return; }
    vistos[f.codigo] = true;
      if (!f.nombre) f.nombre = f.codigo;
      // La columna "anual" se acepta escrita de cualquiera de las formas razonables.
      f.anual = f.anual === true || /^(si|s|true|1|2|x|anual|yes)$/i.test(String(f.anual || '').trim());
      buenos.push(f);
  });
  if (!buenos.length) throw new Error('No pude leer ni un ramo. Revisa que el archivo tenga las ' +
    'columnas codigo y nombre.');
  if (pegadoSinSemestres)
    problemas.push('el texto no traía los semestres: todos los ramos quedaron en el primero, ' +
                   'repártelos en el editor de la malla');
  // los requisitos que apuntan a ramos que no vienen en el archivo se avisan, no se borran
  const tiene = {};
  buenos.forEach(f => { tiene[f.codigo] = true; });
  const huerfanos = [];
  buenos.forEach(f => f.requisitos.forEach(r => {
    if (!tiene[r] && !CAT()[r] && huerfanos.indexOf(r) < 0) huerfanos.push(r);
  }));
  return {ramos: buenos, problemas: problemas, huerfanos: huerfanos, secciones: seccionesImportadas};
}
// Mete los ramos leidos en el catalogo del usuario, respetando lo que ya existia.
function cargarMalla(leido){
  const puestos = {nuevos: 0, actualizados: 0};
  // Si el paquete traia secciones, se reponen ANTES de meter los ramos: el campo 'seccion' de cada
  // ramo apunta por indice a E.secciones, asi que tienen que entrar juntas y en el mismo orden.
  if (Array.isArray(leido.secciones) && leido.secciones.length) {
    E.secciones = leido.secciones.map(s => ({
      nombre: s.nombre || '', sigla: (s.sigla || '').slice(0, 3), color: s.color || '#2563eb', niveles: s.niveles || []
    }));
  }
  leido.ramos.forEach(f => {
    const ya = !!CAT()[f.codigo];
      // Los campos nuevos (requisitos_o, aprobacion, dificultad, prioridad, descripcion) se
      // pasan tal cual se leyeron. Lo que venga vacio entra como null y el modelo lo acepta.
      const datos = {nombre: f.nombre, creditos: f.creditos, nivel: f.nivel,
                     requisitos: f.requisitos || [], requisitos_o: f.requisitos_o || [],
                     tipo: f.tipo, anual: !!f.anual};
      if (f.aprobacion !== undefined && f.aprobacion !== null && f.aprobacion !== '')
        datos.aprobacion = f.aprobacion;
      if (f.dificultad) datos.dificultad = f.dificultad;
      if (f.prioridad) datos.prioridad = f.prioridad;
      if (f.descripcion) datos.descripcion = f.descripcion;
      if (f.seccion !== undefined && f.seccion !== null) datos.seccion = Number(f.seccion);
      ramoEnCatalogo(f.codigo, datos);
    if (ya) puestos.actualizados++; else puestos.nuevos++;
  });
  // Se recuerda que codigos trajo esta importacion para poder deshacerla de una vez. Corrigiendo
  // la lista a mano, una malla mal leida deja cientos de ramos y borrarlos uno por uno no lo hace
  // nadie.
  E.importado = {codigos: leido.ramos.map(f => f.codigo), cuando: hoy()};
  guardar('Malla cargada: ' + puestos.nuevos + ' ramos nuevos');
  return puestos;
}
/* Saca del catalogo y de los semestres todo lo que trajo la ultima importacion. */
async function deshacerImportacion(){
  const imp = E.importado;
  if (!imp || !imp.codigos.length) { mostrarAviso('No hay ninguna importación que deshacer'); return; }
  // Ventana propia: en la aplicacion de escritorio los dialogos del navegador no se muestran.
  if (!await confirmar('Se sacaran los ' + imp.codigos.length + ' ramos que trajo la importacion del '
      + imp.cuando + '.\n\nSi ya corregiste alguno a mano, tambien se va.',
      { titulo: 'Deshacer la importacion', aceptar: 'Sacar los ramos', peligro: true })) return;
  const n = imp.codigos.length;
  imp.codigos.forEach(cod => { borrarRamo(cod); quitarRamo(cod); });
  E.importado = null;
  guardar('Importación deshecha: ' + n + ' ramos fuera');
  resetFiltros();
  arranque();
}
/* El boton solo aparece si de verdad hay algo que deshacer. */
function renderDeshacer(){
  const z = document.getElementById('malla-deshacer');
  if (!z) return;
  const imp = E.importado;
  z.innerHTML = (imp && imp.codigos.length)
    ? '<div class="sub">La última importación trajo <b>' + imp.codigos.length + ' ramos</b>, el ' +
      imp.cuando + '. Si la malla quedó mal leída, sácalos todos de una vez y vuelve a intentarlo ' +
      'con otro archivo.</div>' +
      '<button class="btn peligro" id="malla-deshacer-btn">Sacar los ' + imp.codigos.length +
      ' ramos importados</button>'
    : '';
  const b = document.getElementById('malla-deshacer-btn');
  if (b) b.onclick = deshacerImportacion;
}
function modalImportarMalla(){
  const caja = document.getElementById('modal-caja');
  caja.classList.add('imp-caja');
  // Por dentro es un .aj-panel, como en el boceto: asi hereda la cara de Ajustes (.aj-cab/.aj-x/
  // .aj-pie) sin inventar clases. Las clases de la casa (.eti/.archivo/.nombre) las pinta el CSS
  // acotadas al imp-caja.
  caja.innerHTML =
    '<div class="aj-panel" role="dialog" aria-modal="true" aria-labelledby="imp-titulo">' +
    '<div class="aj-cab">' +
      '<span class="t-ic"><svg class="ic"><use href="#ARQ-08"></use></svg></span>' +
      '<div><h2 id="imp-titulo" data-i18n="malla.importar.titulo">Importar</h2>' +
        '<div class="sub" data-i18n="malla.importar.sub">JSON, CSV, TSV o PDF</div></div>' +
    '</div>' +
    '<button class="aj-x" type="button" data-i18n-att="aria-label:boton.cerrar">&times;</button>' +
    '<div class="g-cuerpo">' +
      '<label class="eti" data-i18n="malla.importar.campo">Archivo</label>' +
      '<div class="archivo">' +
        '<button class="btn" id="imp-elegir" type="button">' +
          '<svg class="ic"><use href="#ARQ-15"></use></svg>' +
          '<span data-i18n="malla.importar.elegir">Elegir archivo</span></button>' +
        '<span class="nombre" id="malla-archivo-nombre" data-i18n="malla.importar.ninguno">Ningún archivo elegido</span>' +
        '<input type="file" id="malla-archivo" accept=".json,.pdf,.csv,.tsv,.txt,image/*">' +
      '</div>' +
      '<p class="ayuda" data-i18n="malla.importar.ayuda">Un PDF de tu malla, o un archivo JSON, CSV o TSV.</p>' +
    '</div>' +
    '<div id="malla-foto"></div>' +
    '<div id="malla-pegado" class="pegado" style="display:none">' +
      '<span data-i18n="malla.importar.pegar">Copia aquí los ramos que veas, una línea por ramo</span>' +
      '<textarea id="malla-texto" rows="8"></textarea></div>' +
    '<div id="malla-aviso"></div>' +
    '<div class="aj-pie">' +
      '<button class="btn suave" id="malla-cancelar" data-i18n="boton.cancelar">Cancelar</button>' +
      '<button class="btn acento" id="malla-cargar" disabled data-i18n="boton.importar">Importar</button>' +
    '</div>' +
    '</div>';
  document.getElementById('modal').classList.add('on');
  aplicarIdioma(caja);
  // El boton de la casa abre el input de archivo, que va oculto: el boton nativo del navegador
  // no se puede pintar ni traducir. Mismo patron que el Respaldo de Ajustes.
  document.getElementById('imp-elegir').onclick = () => document.getElementById('malla-archivo').click();
  caja.querySelector('.aj-x').onclick = cerrarEditor;
  document.getElementById('malla-cancelar').onclick = cerrarEditor;
  const aviso = document.getElementById('malla-aviso');
  const boton = document.getElementById('malla-cargar');
  const casilla = document.getElementById('malla-archivo');
  let leido = null;

  // El resumen de lo que se leyo. Lo comparten los tres caminos (PDF, archivo de texto y lo
  // que el alumno pega a mano), en vez de tener tres copias del mismo texto.
  function mostrarLoLeido(){
    if (!leido) return;
    const niveles = {};
    leido.ramos.forEach(r => { niveles[r.nivel] = true; });
    const conReq = leido.ramos.filter(r => r.requisitos && r.requisitos.length).length;
    const sinNombre = leido.ramos.filter(r => !r.nombre).length;
    let html = '<p class="ayuda" style="color:var(--pill-ok-fg)">' +
      (leido.aviso ? esc(leido.aviso) + ' ' : '<b>Leí bien el archivo.</b> ') +
      leido.ramos.length + ' ramos en ' + Object.keys(niveles).length + ' niveles, de los cuales ' +
      conReq + ' traen prerrequisitos.</p>';
    (leido.avisos || []).forEach(a => {
      html += '<p class="ayuda" style="color:var(--warn)">' + esc(a) + '</p>';
    });
    if (sinNombre) html += '<p class="ayuda" style="color:var(--warn)">' + sinNombre +
      ' ramo(s) quedaron sin nombre. Se cargan igual y les pones el nombre en el editor: ' +
      'trabajar con el codigo es suficiente hasta entonces.</p>';
    if (leido.problemas && leido.problemas.length) html += '<p class="ayuda" style="color:var(--warn)">' +
      'Salté ' + leido.problemas.length + ' linea(s): ' + esc(leido.problemas.slice(0, 5).join(' · ')) + '</p>';
    if (leido.huerfanos && leido.huerfanos.length) html += '<p class="ayuda" style="color:var(--warn)">' +
      'Hay ' + leido.huerfanos.length + ' prerrequisito(s) que no vienen en el archivo (' +
      esc(leido.huerfanos.slice(0, 6).join(', ')) + '). Se guardan igual, pero hasta que no ' +
      'exista ese ramo no van a bloquear nada.</p>';
    aviso.innerHTML = html;
    boton.disabled = false;
  }

  casilla.onchange = async ev => {
    const f = ev.target.files && ev.target.files[0];
    const etiqueta = document.getElementById('malla-archivo-nombre');
    if (etiqueta) { etiqueta.textContent = f ? f.name : t('malla.importar.ninguno'); etiqueta.classList.toggle('on', !!f); }
    if (!f) return;
    leido = null; boton.disabled = true;
    aviso.innerHTML = '<p class="ayuda">Leyendo ' + esc(f.name) + '...</p>';
    const esPDF = /\.pdf$/i.test(f.name) || f.type === 'application/pdf';
    const esImagen = /^image\//.test(f.type) || /\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f.name);

    if (esPDF){
      try {
        leido = await leerMallaDePDF(new Uint8Array(await f.arrayBuffer()), f.name);
      } catch (e) {
        leido = null; boton.disabled = true;
        aviso.innerHTML = '<p class="ayuda" style="color:var(--bad)">' + esc(e.message) + '</p>';
        return;
      }
      mostrarLoLeido();
      return;
    }

    if (esImagen){
      // De una foto no se puede sacar el texto sin equivocarse. En vez de inventar, se muestra
      // al lado y el alumno copia lo que ve. El cuadro de abajo pasa por el mismo lector.
      const url = URL.createObjectURL(f);
      document.getElementById('malla-foto').innerHTML = '<img src="' + url +
        '" style="max-width:100%;border:1px solid var(--malla-ficha-bd);border-radius:8px;margin:10px 0">';
      document.getElementById('malla-pegado').style.display = '';
      aviso.innerHTML = '<p class="ayuda" style="color:var(--warn)">Es una foto, asi que no hay texto ' +
        'que leer. Te la dejo a la vista: copia los ramos en el cuadro y los ordeno yo.</p>';
      return;
    }

    document.getElementById('malla-foto').innerHTML = '';
    document.getElementById('malla-pegado').style.display = 'none';
    const lector = new FileReader();
    lector.onload = () => {
      try {
        leido = leerMalla(lector.result, f.name);
      } catch (e) {
        leido = null; boton.disabled = true;
        aviso.innerHTML = '<p class="ayuda" style="color:var(--bad)">' + esc(e.message) + '</p>';
        return;
      }
      mostrarLoLeido();
    };
    lector.readAsText(f, 'UTF-8');
  };

  // Lo que el alumno copia a mano desde la foto.
  document.getElementById('malla-texto').oninput = ev => {
    const t = ev.target.value.trim();
    if (!t){ leido = null; boton.disabled = true; return; }
    try {
      leido = leerMalla(t, 'copiado.txt');
      mostrarLoLeido();
    } catch (e) {
      leido = null; boton.disabled = true;
      aviso.innerHTML = '<p class="ayuda" style="color:var(--bad)">' + esc(e.message) + '</p>';
    }
  };

  boton.onclick = () => {
    if (!leido) return;
    const p = cargarMalla(leido);
    cerrarEditor(); resetFiltros(); arranque();
    mostrarAviso(p.nuevos + ' ramos nuevos, ' + p.actualizados + ' actualizados');
  };
}
/* ------------------------------------------------------------- exportar a CSV
   El CSV es el formato canonico del proyecto: cualquier malla (PDF, JSON, foto pegada) termina
   como filas de este CSV, y desde el sale la malla. Exportar cierra el ciclo: lo que el alumno
   corrigio a mano en la app vuelve a un CSV que puede guardar, versionar o compartir. */
const CSV_COLUMNAS = ['codigo', 'nombre', 'creditos', 'nivel', 'tipo', 'requisitos',
                      'anual', 'aprobacion', 'dificultad', 'prioridad', 'descripcion',
                      'equivalente'];
function requisitosATexto(reqs, reqsO){
  const partes = [];
  (reqs || []).forEach(r => partes.push(r));
  (reqsO || []).forEach(g => partes.push((g || []).join('|')));
  return partes.join(';');
}
function csvEsc(campo){
  let s = String(campo === null || campo === undefined ? '' : campo);
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function ramosACSV(orden){
  const lineas = [CSV_COLUMNAS.join(',')];
  const cat = CAT();
  (orden || Object.keys(cat).sort()).forEach(cod => {
    const c = cat[cod] || {};
    lineas.push([
      cod,
      c.nombre || cod,
      c.creditos === null || c.creditos === undefined ? '' : c.creditos,
      c.semestre_num === null || c.semestre_num === undefined ? (c.nivel || '') : c.semestre_num,
      c.tipo || 'obligatorio',
      requisitosATexto(c.requisitos, c.requisitos_o),
      c.anual ? '1' : '',
      c.aprobacion === null || c.aprobacion === undefined ? '' : c.aprobacion,
      c.dificultad || '',
      c.prioridad || '',
      c.descripcion || '',
      c.equivalente || ''
    ].map(csvEsc).join(','));
  });
  return lineas.join('\n');
}
function exportarCSV(){
  const cat = CAT();
  if (!Object.keys(cat).length) { mostrarAviso('No hay ramos que exportar: la malla está vacía.'); return; }
  // El orden de exportacion es el de la malla (niveles), no alfabetico, para que el CSV se lea
  // como la malla dibujada. Los ramos sin columna (electivos sueltos) van al final.
  const orden = [];
  NIVELES().forEach(n => n.ramos.forEach(c => { if (orden.indexOf(c) < 0) orden.push(c); }));
  Object.keys(cat).forEach(c => { if (orden.indexOf(c) < 0) orden.push(c); });
  const csv = ramosACSV(orden);
  const blob = new Blob([csv], {type: 'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'malla.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  mostrarAviso('Malla exportada a CSV: ' + orden.length + ' ramos');
}
