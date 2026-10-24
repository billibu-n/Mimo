/* ------------------------------------------------------------- catalogo efectivo
   El catalogo con el que trabaja toda la aplicacion es el que trae el archivo MAS los ramos
   que el usuario haya creado. Asi un ramo propio se comporta igual que uno venido de una malla
   oficial, y la version limpia puede arrancar sin ninguno. */
let _catMemo = null;
function invalidarCatalogo(){
  _catMemo = null;
  // Los estados de la malla (aprobado / en curso / disponible / bloqueado) se calculan SOBRE el
  // catalogo, asi que si el catalogo cambia lo calculado antes ya no vale. Sin esto, un ramo recien
  // importado se dibujaba pero se quedaba sin estado hasta que otra cosa forzara un repintado: ni
  // disponible ni bloqueado, sin color y sin poder marcarlo. Se limpian aqui y no en cada sitio que
  // toca el catalogo, para que no vuelva a pasar cuando se agregue el proximo.
  memoEstados = null;
}
function CAT(){
  if (!_catMemo) _catMemo = Object.assign({}, D.catalogo, E.catalogo || {});
  return _catMemo;
}
/* Las columnas de la malla.
   Si el archivo trae columnas propias (el ejemplo, sacadas del plan oficial) se respetan tal cual,
   PERO ademas hay que colocar los ramos que no vengan listados en ninguna. Si no, un ramo creado a
   mano o traido en una importacion posterior no se dibuja NUNCA, aunque este en el catalogo: se
   guarda, se cuenta en los indicadores, y no hay donde verlo. Es un fallo caro de encontrar, porque
   el ramo "existe" y nada avisa de que no se esta dibujando. */
function NIVELES(){
  const c = CAT();
  // Columna de cada ramo = su 'nivel' actual. Asi, mover un ramo de nivel (cambiarlo en el
  // editor o en "Reordenar niveles") lo reubica solo, porque deja de coincidir con el nivel de
  // su columna vieja y pasa a la que si coincide.
  const nivelDe = k => (c[k].nivel > 0 && c[k].nivel < 99) ? Number(c[k].nivel) : 99;

  if (!D.niveles.length) {
    const por = {};
    Object.keys(c).forEach(k => { if (c[k].en_malla === false) return;
      (por[nivelDe(k)] = por[nivelDe(k)] || []).push(k); });
    return Object.keys(por).map(Number).sort((a, b) => a - b)
      .map(n => ({nivel:n, titulo:(n === 99 ? 'Electivos' : 'Nivel ' + n), ramos:por[n].sort()}));
  }

  // Con columnas del archivo: se respeta su orden y su titulo, pero los ramos se vuelven a
  // repartir por su nivel actual (no por la lista fija), para que "mover de nivel" funcione.
  // Los que no caen en ninguna columna existente (importados con nivel nuevo) crean la suya.
  const titulos = {}, orden = [];
  D.niveles.forEach(n => { titulos[Number(n.nivel)] = n.titulo; orden.push(Number(n.nivel)); });
  Object.keys(c).forEach(k => { if (c[k].en_malla === false) return;
    const nv = nivelDe(k); if (orden.indexOf(nv) < 0) orden.push(nv); });

  if (E.ordenNiveles && E.ordenNiveles.length) {
    // el usuario reordeno: su orden manda, y se agregan los niveles que falten al final
    const visto = E.ordenNiveles.slice();
    orden.forEach(n => { if (visto.indexOf(n) < 0) visto.push(n); });
    orden.splice(0, orden.length, ...visto);
  }

  // electivos (99) siempre al final
  const sin99 = orden.filter(n => n !== 99);
  if (orden.indexOf(99) >= 0) sin99.push(99);

  const por = {};
  Object.keys(c).forEach(k => { if (c[k].en_malla === false) return;
    (por[nivelDe(k)] = por[nivelDe(k)] || []).push(k); });

  return sin99.map(n => ({
    nivel: n,
    titulo: titulos[n] || (n === 99 ? 'Electivos' : 'Nivel ' + n),
    ramos: (por[n] || []).sort()
  }));
}


/* ---------------- secciones de la malla (Plan comun / Licenciatura / Especialidad...)

   Una seccion agrupa un rango de NIVELES de la carrera. El modelo de datos es por RAMO: cada
   ramo lleva 'seccion' (el indice en E.secciones), y el usuario lo asigna por rango de niveles
   (marca "del semestre I al IV = Plan comun") o ramo a ramo en su editor. La sigla (PC, LI, ES)
   la pone el usuario, y el color tambien. */
function SECC(){ return E.secciones || []; }

/* La seccion a la que pertenece un ramo: su campo 'seccion' si apunta a una seccion que existe. */
function seccionDe(cod){
  const c = CAT()[cod];
  if (!c || c.seccion === undefined || c.seccion === null || c.seccion === '') return null;
  const i = Number(c.seccion);
  const secs = SECC();
  return (i >= 0 && i < secs.length) ? i : null;
}

/* Asigna una seccion (por indice) a todos los ramos de los niveles pedidos (o la quita si es -1).
   Devuelve cuantos ramos quedaron marcados. */
function asignarSeccionPorNiveles(idxSeccion, desde, hasta){
  const niveles = [];
  for (let n = desde; n <= hasta; n++) niveles.push(n);
  const cat = CAT();
  let cuantos = 0;
  Object.keys(cat).forEach(cod => {
    const c = cat[cod];
    const nv = (c.nivel > 0 && c.nivel < 99) ? Number(c.nivel) : 99;
    if (niveles.indexOf(nv) < 0) return;
    c.seccion = idxSeccion;
    cuantos++;
  });
  if (idxSeccion >= 0 && SECC()[idxSeccion]) SECC()[idxSeccion].niveles = niveles;
  guardar('Sección asignada a ' + cuantos + ' ramos');
  return cuantos;
}

// 'desbloquea' es el inverso de 'requisitos'. Se recalcula entero cada vez que cambia el grafo,
// para que no queden flechas colgando cuando alguien corrige un prerrequisito mal puesto.
function recalcularDesbloquea(){
  const c = CAT();
  Object.keys(c).forEach(k => { c[k].desbloquea = []; });
  Object.keys(c).forEach(k => {
    (c[k].requisitos || []).forEach(req => { if (c[req]) c[req].desbloquea.push(k); });
  });
  invalidarCatalogo();
}
/* Cuantos ramos dependen de este, transitivamente, hasta el final de la carrera. Es la
   ramificacion hacia delante: recorre el grafo de 'desbloquea' (lo que este ramo abre) sin
   repetir nodos. Se usa para la "prioridad" de percepcion: un ramo que abre muchos es mas
   critico. Solo cuenta los que estan EN la malla (en_malla !== false). */
function ramosQueAbre(cod){
  const c = CAT();
  const visto = new Set([cod]);
  const pila = (c[cod] && c[cod].desbloquea) ? c[cod].desbloquea.slice() : [];
  while (pila.length) {
    const k = pila.pop();
    if (visto.has(k)) continue;
    const r = c[k];
    if (!r || r.en_malla === false) continue;
    visto.add(k);
    if (r.desbloquea) r.desbloquea.forEach(x => { if (!visto.has(x)) pila.push(x); });
  }
  return visto.size - 1;   // no se cuenta a si mismo
}
// Convierte la expresion canonical de prerrequisitos ("MA1001;FI2004|IQ2212") en las dos listas
// que usa el resto de la aplicacion: 'requisitos' (todos, Y) y 'requisitos_o' (grupos donde basta
// uno, O). Un grupo con una sola alternativa es un requisito simple. Los grupos de varios ramos
// (y los "basta uno") no se inventan: si el texto no trae ';' ni '|', es un requisito simple.
function requisitosDesdeTexto(txt){
  txt = String(txt || '').trim();
  if (!txt) return {requisitos: [], requisitos_o: []};
  const requisitos = [], requisitos_o = [];
  txt.split(';').forEach(grupo => {
    const alts = grupo.split('|').map(x => x.trim().toUpperCase()).filter(Boolean);
    if (!alts.length) return;
    if (alts.length === 1) requisitos.push(alts[0]);
    else requisitos_o.push(alts);
  });
  return {requisitos: requisitos, requisitos_o: requisitos_o};
}
// Un ramo creado por el usuario entra al catalogo con la misma forma que los traidos de
// fabrica, para que nada mas en el codigo tenga que distinguirlos. OJO: no puede llamarse
// ramoNuevo(), que es el nombre que ya usa la aplicacion para armar el ramo dentro del semestre.
// Los campos opcionales (aprobacion, dificultad, prioridad, descripcion, anual) viven aqui como
// nulos/ausentes si la fuente no los trae, y no rompen la version limpia: nada de la aplicacion
// exige que existan.
function ramoEnCatalogo(cod, datos){
  // Un ramo SIN nivel (electivo, o suelto) NO es nivel 1: va a la columna de electivos (nivel 99,
  // que la malla dibuja aparte, a la derecha). Antes 'Number(datos.nivel) || 1' lo arrojaba al
  // semestre I y se amontonaban ramos que no corresponden ahi. El 99 es el marcador de
  // 'sin nivel / electivos' que ya usa el dibujo (col-extras).
  // Si quien llama no trae 'nivel' (p. ej. solo marca anual: true), NO se toca el nivel que el
  // ramo ya tenia: forzar 99 lo sacaba de su columna y lo dibujaba como electivo compacto.
  const traeNivel = datos.nivel !== undefined && datos.nivel !== null && datos.nivel !== '';
  const prev = E.catalogo && E.catalogo[cod];
  const raw = Number(datos.nivel);
  const n = traeNivel ? ((raw > 0 && raw < 99) ? raw : 99)
                      : (prev && prev.nivel !== undefined && prev.nivel !== null
                         ? Number(prev.nivel) : 99);
  E.catalogo = E.catalogo || {};
  E.catalogo[cod] = Object.assign({
    nombre:cod, creditos:0, aprobacion:null, requisitos:[], desbloquea:[],
    en_malla:true, tipo:'obligatorio', requisitos_o:[],
    dificultad:null, prioridad:null, descripcion:null, equivalente:null,
    // ficha ampliada (2026-09-21): institucion, tramo y espacio, y la percepcion.
    universidad:null, carrera:null,
    tramo:'semestre',                       // 'semestre' | 'trimestre' | 'nivel'
    espacio:null,                           // {tipo:'semestre'|'trimestre'|'semanas', cantidad:N} o null
    equivalentes:[],                        // lista de {cod, origen:'misma'|'externa'} (amplia al viejo equivalente)
    demanda_tiempo:null,                    // 1..5 (muy baja .. muy alta)
    demanda_academica:null                  // 1..5 analogo
  }, E.catalogo[cod] || {}, datos, {nivel:n, semestre_num:n, semestre:String(n)});
  invalidarCatalogo();
  recalcularDesbloquea();
  return E.catalogo[cod];
}
function borrarRamo(cod){
  if (E.catalogo) delete E.catalogo[cod];
  Object.keys(CAT()).forEach(k => {
    const c = CAT()[k];
    c.requisitos = (c.requisitos || []).filter(x => x !== cod);
    c.requisitos_o = (c.requisitos_o || []).filter(x => x !== cod);
  });
  invalidarCatalogo();
  recalcularDesbloquea();
}
// La lista de ramos de un semestre puede cambiar: se quitan los que el usuario saco y se
// agregan los que sumo despues. Venga de donde venga el semestre, el mecanismo es el mismo.
function ramosDeSem(sem){
  const fuera = E.fuera[sem.id] || [];
  const vistos = {};
  return sem.ramos.filter(r => fuera.indexOf(r.codigo) < 0).concat(E.agregados[sem.id] || [])
    .filter(r => { if (vistos[r.codigo]) return false; vistos[r.codigo] = true; return true; });
}
function ramosBase(){ return ramosDeSem(semActivo()); }
function ramosH(){ return ramosBase().concat([OTROS]); }
function cursoDe(cod){ return ramosBase().find(r => r.codigo === cod); }
function enSemestre(cod){ return ramosBase().some(r => r.codigo === cod); }
const PALETA = ['#2563EB','#16A34A','#B45309','#7C3AED','#0E7490','#DC2626','#0D9488','#9333EA','#EA580C'];
function aliasCorto(nombre){
  return String(nombre).replace(/^Introducci[oó]n a(l)? /i, '').split(' ').slice(0, 2).join(' ');
}
function colorLibre(){
  const usados = ramosBase().map(r => colorDe(r.codigo));
  return PALETA.find(c => usados.indexOf(c) < 0) || PALETA[ramosBase().length % PALETA.length];
}
// Las cuatro categorias de fabrica. Nacen con cada ramo para que solo haya que ponerles notas; la
// que no se use no ensucia el promedio, porque una categoria sin notas se salta sola.
const CATS_FABRICA = [['Ejercicios','#2563eb'], ['Tareas','#16a34a'],
                      ['Laboratorios','#b45309'], ['Controles','#7c3aed']];
function categoriasDeFabrica(){
  return CATS_FABRICA.map(c => ({nombre:c[0], peso:1.0, color:c[1]}));
}
const PALETA_CATS = ['#2563eb','#16a34a','#b45309','#7c3aed','#0e7490','#be123c','#0f766e','#a16207'];
function colorCategoria(c, i){ return c.color || PALETA_CATS[i % PALETA_CATS.length]; }
function ramoNuevo(cod){
  const c = CAT()[cod];
  return {codigo:cod, alias:aliasCorto(c.nombre), nombre:c.nombre, creditos:c.creditos,
          color:colorLibre(), categorias:categoriasDeFabrica(), componentes:[],
          examen:{activo:true, peso:0.4, reemplaza:null},
          eximicion:{activa:false, modo:'todas', condiciones:[]}};
}
function agregarRamo(cod){
  const sem = semActivo();
  if (enSemestre(cod)) { mostrarAviso('Ese ramo ya está en ' + sem.nombre); return; }
  E.fuera[sem.id] = (E.fuera[sem.id] || []).filter(c => c !== cod);
  // Si el ramo ya venia en la lista del semestre, con sacarlo de "fuera" basta. Agregarlo ademas a
  // "agregados" lo dejaba dos veces: dos columnas en la tabla de minutos y las horas contadas doble.
  if (!(sem.ramos || []).some(r => r.codigo === cod)) {
    E.agregados[sem.id] = (E.agregados[sem.id] || []).filter(r => r.codigo !== cod).concat([ramoNuevo(cod)]);
  }
  const s = est();
  s.metas_ramo[cod] = s.metas_ramo[cod] || {horas:5.5, nota:5.0, nota_min:4.0};
  sem.semanas.forEach(w => {
    s.minutos[w.lunes] = s.minutos[w.lunes] || {};
    if (s.minutos[w.lunes][cod] === undefined) s.minutos[w.lunes][cod] = 0;
  });
  guardar(aliasCorto(CAT()[cod].nombre) + ' agregado a ' + sem.nombre);
  resetFiltros(); renderTodo();
}
function quitarRamo(cod){
  const sem = semActivo();
  if (!enSemestre(cod)) return;
  E.agregados[sem.id] = (E.agregados[sem.id] || []).filter(r => r.codigo !== cod);
  E.fuera[sem.id] = (E.fuera[sem.id] || []).concat([cod]).filter((c, i, a) => a.indexOf(c) === i);
  guardar(aliasCorto((CAT()[cod] || {}).nombre || cod) + ' quitado de ' + sem.nombre);
  resetFiltros(); renderTodo();
}
function minutosIniciales(sem){
  const m = {};
  sem.semanas.forEach(s => {
    const o = {};
    sem.ramos.concat([OTROS]).forEach(r => { o[r.codigo] = 0; });
    const reg = (sem.semanas_estudio || []).find(x => x.lunes === s.lunes);
    o.OTROS = reg ? Math.round((reg.horas_semana || 0) * 60) : 0;
    m[s.lunes] = o;
  });
  return m;
}
function estadoSemestre(sem){
  const e = {colores:{}, fichas:{}, hechas:{}, prioridades:{}, nuevas:[],
             metas:{semanal:27.5}, metas_semana:{}, metas_ramo:{}, estado:{}, descartes:{},
             cats:{}, comps:{}, examen:{}, exim:{}, sesiones:[],
             minutos: minutosIniciales(sem)};
  sem.ramos.forEach(r => { e.metas_ramo[r.codigo] = {horas:5.5, nota:5.0, nota_min:4.0}; });
  return e;
}
function estadoInicial(){
  // Sin semestres (version limpia) 'activo' queda en null: la aplicacion tiene que poder
  // arrancar sin nada y esperar a que el usuario cree el primero.
  const e = {v:3, activo:D.semestres.length ? D.semestres[0].id : null,
             ajustes:{verHechasPorHacer:false, titulos:{modo:'envuelto', largo:12}}, extras:[],
             sem:{}, agregados:{}, fuera:{}, aprobados:{}, secciones:[],
             // Eventos PERSONALES del calendario (sin semestre): el estado "personal" es un
             // estadoSemestre(SEM_VACIO) persistente, distinto de los semestres academicos. Asi,
             // sin haber creado ningun semestre, los eventos, prioridades, hechas y notas viven
             // en E.personal y no se pierden (est() solia devolver un objeto temporal descartable).
             personal: estadoSemestre(SEM_VACIO),
             // (asistencia: RETIRADA del esquema 2026-09-30; sera una seccion propia)
             tiempo:{modo:'cronometro',
                             crono:{acumulado:0, corriendo:false, inicio:null},
                             temp:{objetivoSeg:1500, restante:0, corriendo:false, inicio:null},
                             ramo:null, semana:null, dia:null,
                             pomodoro:{fase:'trabajo', restante:null, corriendo:false, inicio:null,
                                       trabajos:0, racha:0, hoy:null,
                                       config:{trabajo:25, corto:5, largo:15, cada:4}},
                             recordatorios:[],        // {id,tipo:'una'|'prog',fecha,horas:[],dias:[],texto,sonido}
                             recSonido:'propia'}};
  D.semestres.forEach(s => { e.sem[s.id] = estadoSemestre(s); });
  return e;
}
function cargar(){
  const base = estadoInicial();
  try {
    const g = localStorage.getItem(CLAVE);
    if (!g) return base;
    const s = JSON.parse(g);
    const e = Object.assign(base, s);
    e.ajustes = Object.assign(base.ajustes, s.ajustes || {});
    e.tiempo = Object.assign(base.tiempo, s.tiempo || {});
    e.extras = s.extras || [];
    e.agregados = s.agregados || {};
    e.fuera = s.fuera || {};
    e.aprobados = s.aprobados || {};
    e.secciones = s.secciones || [];
    e.personal = s.personal || estadoSemestre(SEM_VACIO);
    // (asistencia: RETIRADA del esquema 2026-09-30; un respaldo viejo puede traerla y se ignora)
    // OJO: aqui NO se puede llamar a semestres(): esa funcion lee la global E, que en este
    // momento se esta construyendo en 'let E = cargar()' y todavia no existe.
    D.semestres.concat(e.extras || []).forEach(sem => {
      if (!e.sem[sem.id]) e.sem[sem.id] = estadoSemestre(sem);
      e.sem[sem.id].metas = Object.assign({semanal:27.5}, e.sem[sem.id].metas || {});
      e.sem[sem.id].descartes = e.sem[sem.id].descartes || {};
      // Las metas propias de cada semana. Se asegura al cargar para que los datos guardados antes
      // de que esto existiera sigan abriendo sin problemas.
      e.sem[sem.id].metas_semana = e.sem[sem.id].metas_semana || {};
      delete e.sem[sem.id].metas.techo;   // el techo se elimino: se descarta lo guardado
    });
    if (!e.sem[e.activo] && D.semestres.length) e.activo = D.semestres[0].id;
    migrarTiempo(e);
    return e;
  } catch (err) { return base; }
}
// Cronometro y temporizador pasaron de compartir un estado (acumulado/corriendo/inicio/objetivo)
// a tener dos estados propios (crono y temp). Si se abre un respaldo guardado antes, se mueve lo
// viejo a su lugar para que nada se pierda ni se mezcle.
function migrarTiempo(e){
  const t = e.tiempo || {};
  e.tiempo = t;
  t.crono = t.crono || {acumulado:0, corriendo:false, inicio:null};
  t.temp = t.temp || {objetivoSeg:1500, restante:0, corriendo:false, inicio:null};
  // La duracion del temporizador paso de minutos (`objetivo`) a segundos (`objetivoSeg`), para no
  // perder los segundos que se escriben en el reloj. Un estado viejo trae minutos: se convierten.
  if (t.temp.objetivoSeg == null) t.temp.objetivoSeg = (Number(t.temp.objetivo) || 25) * 60;
  delete t.temp.objetivo;
  // El estado viejo vivia en la raiz de t. Si todavia esta, se rescata al cronometro y se limpia.
  if (t.acumulado !== undefined || t.corriendo !== undefined){
    t.crono.acumulado = Number(t.acumulado) || 0;
    t.crono.corriendo = !!t.corriendo;
    t.crono.inicio = t.inicio || null;
    t.temp.objetivoSeg = (Number(t.objetivo) || 25) * 60;
    delete t.acumulado; delete t.corriendo; delete t.inicio; delete t.objetivo;
  }
}
// Estado del almacenamiento del navegador. Si `fallo` no es null, la ultima escritura en
// localStorage NO se pudo hacer (cuota llena, modo privado, almacenamiento bloqueado) y los
// cambios viven SOLO en memoria: hay que decirlo, no fingir que se guardo.
const ALMACEN = {fallo: null};
function guardar(aviso){
  E.guardadoEn = Date.now();          // marca para decidir quién tiene lo más nuevo al conectar
  try { localStorage.setItem(CLAVE, JSON.stringify(E)); ALMACEN.fallo = null; }
  catch (err) { ALMACEN.fallo = (err && err.name) || 'Error'; }
  if (SERVIDOR.activo) {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardarEnServidor, 500);   // se agrupan las escrituras seguidas
  }
  if (aviso) mostrarAviso(aviso);
  // Si el usuario eligio una carpeta de respaldo, se deja ahi una copia. El typeof es porque este
  // modulo se carga despues de 03-catalogo.js: en los guardados mas tempranos aun no existe.
  if (typeof respaldoAuto === 'function') respaldoAuto();
  pintarGuardado();
}
