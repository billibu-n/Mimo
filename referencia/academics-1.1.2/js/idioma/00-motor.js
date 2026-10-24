/* ============================================================================
   MOTOR DE IDIOMAS (i18n) — opcion A, pero con el FORMATO de i18next
   ============================================================================
   Que es: el motor que traduce los textos de la interfaz. Las claves y los diccionarios
   se escriben como los de i18next (`nav.apariencia` -> 'Apariencia'), para que el dia que
   haga falta mas potencia (plurales, arabe) se cambie SOLO el motor y los diccionarios no
   se toquen. Ver `_trabajo/fase3/DISENO-IDIOMAS.md`.

   Como se usa:
     - En el HTML:  <h2 data-i18n="ajustes.apariencia"></h2>
                    <div data-i18n-html="ajustes.tituloApp"></div>   (cuando hay etiquetas)
                    <button data-i18n-att="title:boton.cerrar;aria-label:boton.cerrar">
     - En el JS:    t('ajustes.apariencia')  y  fechaCorta(d)  /  nombreMes(d)

   Reglas del motor:
     1. Un diccionario por idioma: `window.IDIOMA_<codigo> = { 'clave': 'texto', ... }`.
     2. Si una clave NO esta en el idioma activo, CAE AL IDIOMA BASE (espanol). Nunca en blanco.
     3. Lo que falta se ANOTA (window.mimoIdioma.faltantes()) pero no rompe nada: asi se traduce
        POR PARTES.
     4. Fechas, horas y numeros NO se traducen a mano: los da el navegador (Intl), que ya sabe
        de todos los idiomas. Es lo que evita listas de meses escritas en cada idioma.
   ============================================================================ */

const IDIOMA_BASE = 'es';
const CLAVE_IDIOMA = 'mimo-idioma';
let _idiomaActivo = IDIOMA_BASE;
const _diccionarios = {};   // codigo -> { clave: texto }
const _faltantes = {};      // clave -> veces que se pidio y no estaba
let _idiomaListo = false;

/* ---- registro de diccionarios (lo llaman idioma/<codigo>.js) ---- */
function registrarIdioma(codigo, tabla) {
  _diccionarios[codigo] = tabla || {};
  if (!_idiomaListo && codigo === IDIOMA_BASE) _idiomaActivo = IDIOMA_BASE;
}

function idiomaActual() { return _idiomaActivo; }
function idiomasDisponibles() { return Object.keys(_diccionarios); }

/* Que idioma abrir: el que el usuario eligio; si no hay ninguno, el ESPANOL (base).
   A PROPOSITO no se detecta el idioma del navegador: cambiaria la aplicacion a ingles a quien
   tenga el navegador en ingles, que no es lo que pidio. El usuario elige desde el panel. */
function idiomaDeArranque() {
  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE_IDIOMA); } catch (e) {}
  if (guardado && _diccionarios[guardado]) return guardado;
  return IDIOMA_BASE;
}

/* La entrada cruda: primero el idioma activo; si no esta, el base. */
function _entrada(clave) {
  const activo = _diccionarios[_idiomaActivo] || {};
  if (activo[clave] !== undefined) return activo[clave];
  const base = _diccionarios[IDIOMA_BASE] || {};
  return base[clave];
}

/* t(clave, valores): el texto ya traducido. `valores` rellena los huecos {nombre}. */
function t(clave, valores) {
  let v = _entrada(clave);
  if (v === undefined) {
    _faltantes[clave] = (_faltantes[clave] || 0) + 1;
    return clave;
  }
  if (v && typeof v === 'object') v = (v.text !== undefined) ? v.text : '';
  if (valores) for (const k in valores) v = v.split('{' + k + '}').join(valores[k]);
  return v;
}

/* Igual que t(), pero para textos CON etiquetas. La entrada es {parts:[...]}: cada parte es un
   texto; si es un array [etiqueta, texto], se envuelve. Asi el traductor puede reordenar. */
function _marcado(clave) {
  const v = _entrada(clave);
  if (v === undefined) { _faltantes[clave] = (_faltantes[clave] || 0) + 1; return clave; }
  if (typeof v === 'string') return v;
  if (v && v.parts) {
    return v.parts.map(function (p) {
      return Array.isArray(p) ? ('<' + p[0] + '>' + p[1] + '</' + p[0] + '>') : p;
    }).join('');
  }
  return (v && v.text !== undefined) ? v.text : clave;
}

/* Esta traducida esa clave en el idioma ACTIVO? (para el aviso de "en preparacion") */
function estaTraducida(clave) {
  const activo = _diccionarios[_idiomaActivo] || {};
  return activo[clave] !== undefined;
}
function faltantes() { return Object.keys(_faltantes); }

/* ---- fechas, horas y numeros: los sabe el navegador (Intl) ---- */
function formatearFecha(d, opciones) {
  try { return new Intl.DateTimeFormat(_idiomaActivo, opciones).format(d); }
  catch (e) { return ''; }
}
function formatearNumero(n, opciones) {
  try { return new Intl.NumberFormat(_idiomaActivo, opciones).format(n); }
  catch (e) { return String(n); }
}
function nombreMes(d, largo) { return formatearFecha(d, { month: largo ? 'long' : 'short' }); }
function nombreDia(d, largo) { return formatearFecha(d, { weekday: largo ? 'long' : 'short' }); }
/* "5 sept" o "5 de septiembre" segun el idioma lo escriba. */
function fechaCorta(d) { return formatearFecha(d, { day: 'numeric', month: 'short' }); }
function fechaMedia(d) { return formatearFecha(d, { day: 'numeric', month: 'long' }); }

/* ---- pintar los textos en el DOM ---- */
function aplicarIdioma(raiz) {
  raiz = raiz || document;
  raiz.querySelectorAll('[data-i18n]').forEach(function (el) {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  raiz.querySelectorAll('[data-i18n-html]').forEach(function (el) {
    el.innerHTML = _marcado(el.getAttribute('data-i18n-html'));
  });
  raiz.querySelectorAll('[data-i18n-att]').forEach(function (el) {
    el.getAttribute('data-i18n-att').split(';').forEach(function (par) {
      const p = par.split(':');
      if (p.length === 2 && p[0].trim()) el.setAttribute(p[0].trim(), t(p[1].trim()));
    });
  });
}

/* Cambiar de idioma: guarda, traduce lo que se le pase y avisa a quien dibuje texto. */
function cambiarIdioma(codigo) {
  if (!_diccionarios[codigo] || codigo === _idiomaActivo) return false;
  _idiomaActivo = codigo;
  try { localStorage.setItem(CLAVE_IDIOMA, codigo); } catch (e) {}
  document.documentElement.setAttribute('lang', codigo);
  aplicarIdioma(document);
  if (window.mimoIdiomaPanel) { try { window.mimoIdiomaPanel.pintar(); } catch (e) {} }
  if (typeof renderTodo === 'function') { try { renderTodo(true); } catch (e) {} }
  // Quien tenga textos que NO viven en el DOM fijo (enlaces calculados, listas) se apunta aqui.
  document.dispatchEvent(new CustomEvent('mimo:idioma', { detail: { codigo: codigo } }));
  return true;
}

/* Arranque del idioma. Se llama DESPUES de que los diccionarios esten registrados (no dentro
   de este fichero): aqui ya se puede elegir el idioma guardado y traducir el DOM. */
function inicializarIdioma() {
  _idiomaActivo = idiomaDeArranque();
  document.documentElement.setAttribute('lang', _idiomaActivo);
  _idiomaListo = true;
  _faltantes && Object.keys(_faltantes).forEach(function (k) { delete _faltantes[k]; });
  if (document.body) aplicarIdioma(document);
}

/* Lo que comparten la aplicacion y el panel de Idioma. */
window.mimoIdioma = {
  t: t, marcado: _marcado, actual: idiomaActual, cambiar: cambiarIdioma,
  disponibles: idiomasDisponibles, registrar: registrarIdioma, inicializar: inicializarIdioma,
  traducida: estaTraducida, faltantes: faltantes,
  formatearFecha: formatearFecha, formatearNumero: formatearNumero,
  fechaCorta: fechaCorta, fechaMedia: fechaMedia, nombreMes: nombreMes, nombreDia: nombreDia,
  aplicar: aplicarIdioma, base: IDIOMA_BASE
};
