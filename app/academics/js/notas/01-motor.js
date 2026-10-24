/* ---------------------------------------------------------------- motor de notas */
function catsDe(cod){
  const s = est();
  if (!s.cats[cod]) s.cats[cod] = copia((cursoDe(cod) || {}).categorias || []);
  return s.cats[cod];
}
function compsDe(cod){
  const s = est();
  if (!s.comps[cod]) s.comps[cod] = copia((cursoDe(cod) || {}).componentes || []);
  return s.comps[cod];
}
function examenDe(cod){
  const s = est(), c = cursoDe(cod);
  if (!c) return {activo:false, peso:0.4, reemplaza:null};   // sin ramo no hay examen que mostrar
  if (!s.examen[cod]) s.examen[cod] = copia(c.examen || {activo:false, peso:0.4, reemplaza:null});
  return s.examen[cod];
}
// La nota minima para aprobar. Por defecto 4.0 (la escala 1-7 de las universidades chilenas),
// pero cada ramo puede tener la suya (algunos exigen 5.0 en un ramo, o se aprueban con 3.95 si la
// decima se redondea). Se guarda en metas_ramo[codigo].nota_min; si no esta, 4.0.
function notaMinimaDe(cod){
  const m = ((est().metas_ramo || {})[cod] || {}).nota_min;
  return (m === null || m === undefined || m === '') ? 4.0 : Number(m);
}
function eximDe(cod){
  const s = est(), c = cursoDe(cod);
  if (!c) return {activa:false, modo:'todas', condiciones:[]};
  if (!s.exim[cod]) s.exim[cod] = copia(c.eximicion || {activa:false, modo:'todas', condiciones:[]});
  return s.exim[cod];
}
// Las notas van de 1,0 a 7,0. Cuando alguien escribe "22" quiso decir 2,2 y cuando escribe "112",
// 1,1: el dedo se come la coma. Se corre la coma a la izquierda mientras siga fuera de rango y se
// redondea a un decimal. Entre 7 y 10 no hay forma de adivinar, asi que se topa en 7,0.
function normalizarNota(v){
  if (v === '' || v === null || v === undefined) return null;
  let n = Number(String(v).replace(',', '.'));
  if (!isFinite(n)) return null;
  while (n >= 10) n = n / 10;
  if (n > 7) n = 7;
  if (n < 1) n = 1;
  return Math.round(n * 10) / 10;
}
function valorComp(cod, i, ex){
  const exa = examenDe(cod);
  if (exa.reemplaza === i && ex !== null && ex !== undefined) return Number(ex);
  const n = compsDe(cod)[i].nota;
  return (n === null || n === undefined || n === '') ? null : Number(n);
}
function promedioCategoria(cod, cat, ex){
  const comps = compsDe(cod).map((c, i) => ({c: c, i: i}))
    .filter(x => (x.c.categoria || 'General') === cat.nombre);
  let sp = 0, sn = 0;
  comps.forEach(x => {
    const v = valorComp(cod, x.i, ex);
    if (v === null) return;
    sp += (x.c.peso || 1); sn += (x.c.peso || 1) * v;
  });
  return sp ? sn / sp : null;
}
function presentacion(cod, ex){
  let sp = 0, sn = 0;
  catsDe(cod).forEach(c => {
    const p = promedioCategoria(cod, c, ex);
    if (p === null) return;
    sp += Number(c.peso) || 0; sn += (Number(c.peso) || 0) * p;
  });
  // La "nota de asistencia" se retiro con el apartado de asistencia de Ramos (2026-09-30): la
  // presentacion vuelve a ser solo la de las categorias. Cuando asistencia sea una seccion propia,
  // si aporta nota, volvera a entrar AQUI.
  return sp ? sn / sp : null;
}
function cumplenCondicion(cod, c, ex){
  let v = null;
  if (c.tipo === 'presentacion') v = presentacion(cod, ex);
  else if (c.tipo === 'categoria') {
    const cat = catsDe(cod).find(x => x.nombre === c.ref);
    v = cat ? promedioCategoria(cod, cat, ex) : null;
  } else if (c.tipo === 'componente') {
    const i = compsDe(cod).findIndex(x => x.nombre === c.ref);
    v = i >= 0 ? valorComp(cod, i, ex) : null;
  }
  if (v === null) return {ok:false, actual:null};
  const x = Number(c.valor);
  const ok = c.op === '>=' ? v >= x : c.op === '<=' ? v <= x : c.op === '>' ? v > x : v < x;
  // 'valor' es el umbral que puso el usuario; 'actual' es lo que el ramo lleva hoy
  return {ok: ok, actual: v};
}
function estadoEximicion(cod, ex){
  const x = eximDe(cod);
  const conds = x.condiciones || [];
  const detalle = conds.map(c => Object.assign({}, c, cumplenCondicion(cod, c, ex)));
  const vacias = detalle.filter(d => d.actual === null);
  let cumple = false;
  if (x.activa && detalle.length) {
    cumple = x.modo === 'alguna' ? detalle.some(d => d.ok) : detalle.every(d => d.ok);
  }
  // El efecto 'exim' de la asistencia se retiro con su apartado (2026-09-30). Volvera aqui si la
  // seccion propia de asistencia lo pide.
  return {activa:x.activa, modo:x.modo || 'todas', detalle:detalle, cumple:cumple, sinDatos:vacias.length > 0};
}
function notaFinal(cod, ex){
  const P = presentacion(cod, ex);
  if (P === null) return null;
  if (estadoEximicion(cod, ex).cumple) return P;
  const exa = examenDe(cod);
  if (!exa.activo) return P;
  if (ex === null || ex === undefined) return null;
  return (1 - Number(exa.peso)) * P + Number(exa.peso) * Number(ex);
}
function estadoDe(cod, ex){
  const P = presentacion(cod, ex);
  if (P === null) return {texto:'faltan datos', clase:'n'};
  if (estadoEximicion(cod, ex).cumple) return {texto:'eximido', clase:'ok'};
  const exa = examenDe(cod);
  if (exa.activo && (ex === null || ex === undefined)) return {texto:'a examen', clase:'warn'};
  const nf = notaFinal(cod, ex);
  return dec1(aCent(nf)) >= notaMinimaDe(cod) ? {texto:'aprobado', clase:'ok'} : {texto:'reprobado', clase:'bad'};
}
function examenPara(cod, objetivo){
  const f0 = notaFinal(cod, 0), f1 = notaFinal(cod, 1);
  if (f0 === null || f1 === null) return null;
  const p = f1 - f0;
  if (Math.abs(p) < 1e-9) return null;
  return (objetivo - f0) / p;
}

/* ---------------------------------------------------------------- sincronizacion notas -> calendario
   Un componente (en Notas) puede llevar fecha. Esa fecha puede reflejarse como un EVENTO en el
   calendario, unidos por el NOMBRE: componente.nombre === evento.texto. Es una sola via: del
   calendario NO se empuja nada hacia Notas, porque ahi viven tambien cosas personales que no
   corresponden (feriados, citas) y no siempre aplican.

   El "vinculo" es el propio nombre compartido. No hay id comun: con el mismo criterio ya existente
   de "Pasar al promedio" (que busca por c.nombre === ev.texto), un componente y un evento con el
   mismo nombre son el mismo objeto visto desde dos lados.
*/
// El evento del calendario que corresponde a un componente por nombre, o null.
function eventoDelComponente(nombre){
  if (!nombre) return null;
  return todosEventos().find(e => e.texto === nombre) || null;
}
// Crea un evento nuevo en el calendario, ligado a un componente (cod es el codigo del ramo).
function crearEventoDesdeComponente(c, cod, fecha){
  const id = 'n' + Date.now() + Math.floor(Math.random() * 1000);
  const tipo = tipoPorCategoria(c.categoria);
  est().nuevas = est().nuevas || [];
  est().nuevas.push({
    id:id, semana:'—', dia:diaDeFecha(fecha), fecha:fecha, texto:c.nombre,
    detalle:'', ramo:cod, color_excel:null, tipo:tipo, origen:'notas'
  });
  return id;
}
// El dia de la semana de una fecha (Lunes..Domingo) para el evento.
function diaDeFecha(fecha){
  const d = aFecha(fecha);
  return DIAS[(d.getDay() + 6) % 7];   // getDay: domingo=0; aqui lunes=0
}
// Que tipo de evento le toca a una categoria (por su singular). Si no lo conocemos, 'tarea'.
// Acepta el nombre en singular o plural, con o sin tildes: el engine de idioma normaliza y da el
// singular ("controles"->"control", "exámenes"->"examen", "EXAMENES"->"examen").
function tipoPorCategoria(cat){
  const singular = singularDe(cat).toLowerCase();
  const m = {control:'control', entrega:'entrega', ejercicio:'ejercicio', examen:'control',
             certamen:'control', tarea:'tarea', laboratorio:'terreno', terreno:'terreno',
             prueba:'control', test:'control', quiz:'control', lectura:'tarea', informe:'entrega'};
  return m[singular] || 'tarea';
}

/* ---------------------------------------------------------- calendario -> notas (inversa)
   La via que faltaba: cuando en el calendario das fecha a un evento CON ramo, esa fecha se refleja
   en la evaluacion del mismo nombre (componente), igual que Notas ya reflejaba hacia el calendario.
   El vinculo sigue siendo el NOMBRE compartido (componente.nombre === evento.texto); no se tocan
   eventos ajenos (sin ramo, o sin un componente del mismo nombre). */
function componenteDelEvento(ev){
  if (!ev || !ev.ramo || !ev.texto) return null;
  const c = compsDe(ev.ramo).find(x => x.nombre === ev.texto);
  return c || null;
}
function sincronizarEventoAComponente(ev){
  const c = componenteDelEvento(ev);
  if (!c) return;
  c.fecha = ev.fecha || null;
}

