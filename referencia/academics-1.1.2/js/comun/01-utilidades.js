/* ---------------------------------------------------------------- utilidades */
function sumaDias(iso, n){
  const d = aFecha(iso);
  d.setDate(d.getDate() + n);
  return aISO(d);
}
function aFecha(iso){ return new Date(iso + 'T12:00:00'); }
function dos(n){ return String(n).padStart(2, '0'); }
// Fecha de HOY en hora LOCAL (YYYY-MM-DD). Antes usaba toISOString(), que es UTC: en Chile eso
// descuadraba la fecha y una sesion de "ayer" aparecia como de hoy (o al reves) segun la hora.
function aISO(d){ return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
function hoy(){ return aISO(new Date()); }
function rangoSemana(lunes){
  const l = aFecha(lunes), d = aFecha(sumaDias(lunes, 6));
  const a = dos(l.getDate()), b = dos(d.getDate());
  if (l.getMonth() === d.getMonth()) return a + '–' + b + ' ' + MESES[l.getMonth()];
  return a + ' ' + MESES[l.getMonth()] + ' – ' + b + ' ' + MESES[d.getMonth()];
}
function copia(x){ return JSON.parse(JSON.stringify(x)); }
/* ------------------------------------------------------------------ engine de idioma (tarea 2)
   Inflector de numero (singular/plural) en espanol, pequeno, con aprendizaje y tolerante.

   Que resuelve: dado un nombre (una categoria, un tipo de evento), devolver su singular y su
   plural SIEMPRE, ignorando mayusculas, tildes y espacios de mas. "Controles", "controles" y
   " CONTROLES " dan los tres singular "control" y plural "controles"; "exámenes", "examenes" y
   "EXAMENES" dan singular "examen".

   Aprendizaje: si llega una palabra que NO esta en el vocabulario, se infiere de su terminacion
   si es singular o plural, se genera el par que falta, y queda REGISTRADA en la tabla para la
   proxima. Asi el usuario puede crear su propia categoria ("Talleres") y el motor la aprende. */

function mayusInicial(s){ return s ? s[0].toUpperCase() + s.slice(1) : s; }

// Quita tildes y dieresis (diacriticos) y normaliza el texto para poder comparar sin importar
// como lo escribieron: "examenes", "exámenes", "EXAMENES" y " exámenes " caen todos en "examenes".
function quitarTildes(s){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function normalizar(texto){
  return quitarTildes((texto || '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

// Vocabulario base del dominio. Se escribe una vez en su forma real (con tildes), y al construir la
// tabla se normaliza cada entrada: la busqueda es SIEMPRE sin tildes y en minuscula. El valor es el
// singular canonico (sin tildes, minuscula) que sirve de raiz para generar el par singular/plural.
const VOCAB_CRUDO = {
  'control':'control', 'controles':'control', 'tarea':'tarea', 'tareas':'tarea',
  'ejercicio':'ejercicio', 'ejercicios':'ejercicio', 'laboratorio':'laboratorio',
  'laboratorios':'laboratorio', 'examen':'examen', 'exámenes':'examen',
  'certamen':'certamen', 'certámenes':'certamen', 'informe':'informe', 'informes':'informe',
  'lectura':'lectura', 'lecturas':'lectura', 'prueba':'prueba', 'pruebas':'prueba',
  'test':'test', 'tests':'test', 'quiz':'quiz', 'quizes':'quiz', 'quizzes':'quiz',
  'entrega':'entrega', 'entregas':'entrega', 'terreno':'terreno', 'terrenos':'terreno',
  'categoría':'categoría', 'ramo':'ramo', 'ramos':'ramo', 'componente':'componente',
  'componentes':'componente', 'hora':'hora', 'horas':'hora', 'nota':'nota', 'notas':'nota',
  'semana':'semana', 'semanas':'semana', 'día':'día', 'mes':'mes', 'meses':'mes', 'país':'país'
};

// Tabla construida una vez: clave normalizada -> singular canonico (normalizado).
let _TABLA = null;
function tabla(){
  if (_TABLA) return _TABLA;
  _TABLA = {};
  for (const k in VOCAB_CRUDO){
    const clave = normalizar(k);
    if (!_TABLA[clave]) _TABLA[clave] = normalizar(VOCAB_CRUDO[k]);
  }
  return _TABLA;
}

// Devuelve {singular, plural} para una palabra, ignorando mayusculas, tildes y espacios.
// Si no la conoce, la infiere y la aprende (la registra en la tabla). Nunca falla.
function formasDe(palabra){
  const p = (palabra || '').trim();
  if (!p) return {singular:'', plural:''};
  const w = normalizar(p);
  const t = tabla();
  const raiz = t[w];
  if (raiz !== undefined){
    const sing = raiz;
    const plur = pluralDeRaiz(sing);
    return {singular:decorar(sing, p), plural:decorar(plur, p)};
  }
  return inferirYRegistrar(w, p);
}

// El plural canonico de un singular conocido (busca en la tabla la clave plural de esa raiz).
function pluralDeRaiz(sing){
  for (const k in tabla()){
    if (tabla()[k] === sing && k !== sing) return k;
  }
  return pluralizarGenerico(sing);
}

// Repone la mayuscula inicial segun como se escribio la palabra de origen.
function decorar(texto, origen){
  const p = (origen || '').trim();
  const mayus = p.length && p[0] === p[0].toUpperCase();
  return mayus ? mayusInicial(texto) : texto;
}

// Regla general de pluralizacion (singular -> plural) en espanol, sobre texto ya normalizado.
function pluralizarGenerico(s){
  if (!s) return '';
  if (/[aeiou]$/.test(s)) return s + 's';              // casa -> casas
  if (/[bcdfghjklmnñpqrstvwxyz]$/.test(s)) return s + 'es';  // control -> controles
  if (/z$/.test(s)) return s.slice(0, -1) + 'ces';     // luz -> luces
  return s + 's';
}

// Infiere singular/plural de una palabra desconocida, la aprende y la devuelve.
function inferirYRegistrar(w, origen){
  let sing, plur;
  if (w.endsWith('es') && w.length > 3 && !/[aeiou]$/.test(w.slice(0, -2))){
    sing = w.slice(0, -2); plur = w;                    // talleres -> taller
  } else if (w.endsWith('s') && w.length > 1){
    sing = w.slice(0, -1); plur = w;                    // seminarios -> seminario
  } else {
    sing = w; plur = pluralizarGenerico(w);             // taller -> talleres
  }
  const t = tabla();
  t[w] = sing; t[sing] = sing; t[plur] = sing;          // aprender
  return {singular:decorar(sing, origen), plural:decorar(plur, origen)};
}

// atajos de conveniencia usados por el resto de la app
function singularDe(palabra){ return formasDe(palabra).singular; }
function pluralDe(palabra){ return formasDe(palabra).plural; }
/* Mezcla un color hacia el fondo del tema.
   Hacia el BLANCO no sirve: en tema oscuro deja el recuadro casi blanco y la letra clara encima
   se pierde. Se guarda el fondo en cache porque esto se llama una vez por evento dibujado. */
let _fondoTinte = null, _claveTinte = '';
function fondoDeTinte(){
  const clave = document.body.className;
  if (_fondoTinte && clave === _claveTinte) return _fondoTinte;
  const v = getComputedStyle(document.body).getPropertyValue('--sup').trim();
  _fondoTinte = /^#[0-9a-f]{6}$/i.test(v) ? v.slice(1) : 'ffffff';
  _claveTinte = clave;
  return _fondoTinte;
}
function tinte(hex, f){
  const h = String(hex).replace('#','');
  const b = fondoDeTinte();
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), bl = parseInt(h.slice(4,6),16);
  const br = parseInt(b.slice(0,2),16), bg = parseInt(b.slice(2,4),16), bb = parseInt(b.slice(4,6),16);
  const m = (v, base) => Math.round(v + (base - v) * f);
  return 'rgb(' + m(r,br) + ',' + m(g,bg) + ',' + m(bl,bb) + ')';
}
function hsl2hex(h, s, l){
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const v = n => Math.round(255 * f(n)).toString(16).padStart(2,'0');
  return '#' + v(0) + v(8) + v(4);
}
function hex2hsl(hex){
  const h = String(hex).replace('#','');
  const r = parseInt(h.slice(0,2),16)/255, g = parseInt(h.slice(2,4),16)/255, b = parseInt(h.slice(4,6),16)/255;
  const mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx - mn;
  let hh = 0;
  if (d) {
    if (mx === r) hh = 60 * (((g - b) / d) % 6);
    else if (mx === g) hh = 60 * ((b - r) / d + 2);
    else hh = 60 * ((r - g) / d + 4);
  }
  if (hh < 0) hh += 360;
  const l = (mx + mn) / 2;
  return {h: Math.round(hh), s: d ? Math.round(d / (1 - Math.abs(2*l - 1)) * 100) : 0, l: Math.round(l*100)};
}
// Buscar sin tildes: quien escribe "mecanica" o "calculo" tiene que encontrar "Mecánica".
function sinTildes(s){
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
/* Como se abrevian los titulos que no caben.
 *
 * En la tabla de horas, el nombre de un ramo tiene que entrar en una columna que ademas lleva su
 * casilla de tiempo. Los nombres largos se cortaban a media palabra y no habia forma de saber cual
 * era. Ahora se elige que hacer, y el nombre completo esta siempre en el tooltip al pasar el mouse.
 *
 *   envuelto  el nombre entero, repartido en varias lineas hacia abajo. Es lo de fabrica: se lee.
 *   puntos    una sola linea, recortada y con puntos suspensivos al final.
 *   iniciales solo las iniciales (MRM), para cuando se prefieren columnas estrechas y ya te sabes
 *             los ramos de memoria.
 */
const FORMATOS_TITULO = [
  ['envuelto',  'El nombre entero, hacia abajo', 'se lee completo'],
  ['puntos',    'Una línea, recortado con…',     'Mecánica…'],
  ['iniciales', 'Solo las iniciales',            'MRM'],
];

function formatoTitulo(){
  const a = (E.ajustes && E.ajustes.titulos) || {};
  return {modo: a.modo || 'envuelto', largo: Math.max(4, Number(a.largo) || 12)};
}
function resumirTitulo(texto){
  const t = String(texto === null || texto === undefined ? '' : texto).trim();
  if (!t) return '';
  const f = formatoTitulo();
  if (f.modo === 'puntos') return t.length > f.largo ? t.slice(0, f.largo).trim() + '…' : t;
  if (f.modo === 'iniciales') {
    const letras = t.split(/[\s\-]+/).filter(Boolean).map(x => x[0]).join('').toUpperCase();
    return letras.slice(0, 5) || t;
  }
  return t;
}
function esc(t){ return String(t === null || t === undefined ? '' : t)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* redondeo del usuario: un decimal, media hacia arriba, con enteros en centesimas */
function aCent(x){ return Math.round(Number(x) * 100); }
function dec1(c){ return Math.floor((c + 5) / 10) / 10; }
function ver1(x){ return (x === null || x === undefined) ? '—' : dec1(aCent(x)).toFixed(1); }
function ver2(x){ return (x === null || x === undefined) ? '—' : (aCent(x) / 100).toFixed(2); }
