/* ---------------------------------------------------- ajustes avanzados
   Todo lo de esta parte es aspecto: no cambia ni un dato. Los colores de estado se derivan del color
   fuerte que elige el usuario: el fondo suave, el borde y el texto se calculan mezclando. Asi con un
   solo selector por estado queda coherente en los dos temas. */
/* Los atajos de fabrica: viajar entre las siete secciones, en el orden de la barra. Van aparte
   para poder volver a ellos ("Restablecer los de fabrica") sin repetir la lista. */
const AV_ATAJOS_FABRICA = {calendario:'ctrl+1', estudio:'ctrl+2', malla:'ctrl+3', notas:'ctrl+4',
                           tiempo:'ctrl+5', tareas:'ctrl+6', ajustes:'ctrl+7'};
const AV_FABRICA = {
  tema:'clasico', tModo:'claro', relleno:'suave', densidad:'normal', grosor:'normal', esquinas:'redondeadas',
  candado:true, creditos:true, barra:'manual', fuente:1,
  atajosOn:true, atajos:Object.assign({}, AV_ATAJOS_FABRICA),
  // tema: el ULTIMO tema elegido (el que se ve si tModo no es 'sistema').
  // tModo: 'claro' / 'oscuro' / 'sistema'. En 'sistema' manda el sistema: claro u oscuro.
  // temaClaro / temaOscuro: que tema usar en cada caso. Solo se usan en 'sistema'.
  temaClaro:'clasico', temaOscuro:'negro',
  colores:{aprobado:'#16a34a', curso:'#eab308', disponible:'#2563eb', bloqueado:'#94a3b8'}
};
/* El tema EFECTIVO: el que toca pintar ahora mismo. En modo claro/oscuro es el tema elegido; en
   'sistema' es el claro o el oscuro segun lo que diga el sistema en este momento. */
function temaEfectivo(){
  const a = avVista();
  if (a.tModo === 'claro' || a.tModo === 'oscuro') return a.tema;
  // modo 'sistema' (o desconocido): sigue al sistema.
  const oscuroSis = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return oscuroSis ? (a.temaOscuro || TEMA_OSCURO_POR_DEFECTO) : (a.temaClaro || TEMA_CLARO_POR_DEFECTO);
}
/* Los temas que existen, en el orden en que salen en Ajustes.

   PARA AGREGAR UN TEMA HACEN FALTA CINCO COSAS, no dos. Tres de ellas no dan error: el tema
   entra en la lista, se deja elegir, y se ve mal. Medido al agregar 'pinky' (2026-09-27):
     1. un archivo css/tema-<nombre>.css con la paleta completa (copiar uno y cambiar colores);
     2. una linea aqui abajo, en TEMAS;
     3. una linea en FONDO_TEMA (mas abajo). Sin ella, fondoTema() cae a blanco y los colores
        de estado se mezclan contra el fondo equivocado;
     4. la lista de temas CLAROS, escrita A MANO DOS VECES: en aplicarAvanzado() y en
        renderAvanzado() (buscar 'const oscuro ='). Un tema CLARO que falte ahi se trata como
        OSCURO, y sus textos de estado salen claros sobre fondo claro, SIN error en consola;
     5. el <link a css/tema-<nombre>.css> en index.html y plantilla.html, y los botones
        <button class="tema" data-val="<nombre>"> en index.html y html/ajustes.html.
   La clase del <body> SI se recorre desde esta lista: eso ya no se puede olvidar. */

/* La NATURALEZA de cada tema (claro u oscuro) es un DATO, no una deduccion. Antes estaba escrita a
   mano DOS VECES (en aplicarAvanzado y en renderAvanzado) y un tema claro que faltara ahi se trataba
   como oscuro, con sus textos ilegibles y SIN error. Ahora vive aqui, una sola vez. */
const TEMAS = [['clasico', 'Clásico', 'claro'], ['negro', 'Negro', 'oscuro'],
               ['medianoche', 'Medianoche', 'oscuro'], ['deepsea', 'DeepSea', 'oscuro'],
               ['bosque', 'Bosque', 'claro'], ['sepia', 'Sepia', 'claro'],
               ['vino', 'Vino', 'oscuro'], ['pinky', 'Pinky', 'claro'],
               ['alto-contraste', 'Alto contraste', 'oscuro']];
const NOMBRES_TEMA = TEMAS.map(t => t[0]);
const NATURALEZA_TEMA = {}; TEMAS.forEach(t => NATURALEZA_TEMA[t[0]] = t[2]);
function esClaro(nombre){ return NATURALEZA_TEMA[nombre] === 'claro'; }
const TEMAS_CLAROS = TEMAS.filter(t => t[2] === 'claro').map(t => t[0]);
const TEMAS_OSCUROS = TEMAS.filter(t => t[2] === 'oscuro').map(t => t[0]);
// El tema CLARO y el OSCURO con los que trabaja el modo "segun el sistema". Se recuerdan por
// separado para que al volver a "segun el sistema" no se pierda cual elige en cada caso.
const TEMA_CLARO_POR_DEFECTO = 'clasico';
const TEMA_OSCURO_POR_DEFECTO = 'negro';

// El fondo de cada tema. El resto de los colores se calculan mezclando contra este.
const FONDO_TEMA = {clasico:'#ffffff', negro:'#1e1e1e', medianoche:'#131314',
                    deepsea:'#071a2b', bosque:'#eef4ee', sepia:'#f4ecd8',
                    vino:'#150a0c', pinky:'#ffffff', 'alto-contraste':'#000000'};
function fondoTema(nombre){ return FONDO_TEMA[nombre] || '#ffffff'; }
const AV_DENSIDAD = {
  compacta:{pad:'4px 7px',  fuente:'.72rem', mgap:'26px', cgap:'6px'},
  normal:  {pad:'7px 9px',  fuente:'.78rem', mgap:'40px', cgap:'8px'},
  amplia:  {pad:'10px 12px', fuente:'.86rem', mgap:'54px', cgap:'11px'}
};
const AV_GROSOR = {fina:1, normal:1.6, gruesa:2.6};
const AV_ESTADOS = [['aprobado','--malla-aprobado','Aprobado'], ['curso','--malla-curso','En curso'],
                    ['disponible','--malla-disponible','Disponible'], ['bloqueado','--malla-bloqueado','Bloqueado']];
function av(){
  if (!E.ajustes.av) E.ajustes.av = {};
  const a = E.ajustes.av;
  for (const k in AV_FABRICA) if (a[k] === undefined) a[k] = AV_FABRICA[k];
  // Quien haya guardado el tema con el nombre viejo conserva su eleccion.
  if (a.tema === 'gemini') a.tema = 'medianoche';
  a.colores = Object.assign({}, AV_FABRICA.colores, a.colores || {});
  // Los atajos tambien se rellenan: una configuracion vieja no trae la lista, y una seccion nueva
  // (si algun dia se anade) recibe su tecla de fabrica sin dejar huecos.
  a.atajos = Object.assign({}, AV_ATAJOS_FABRICA, a.atajos || {});
  return a;
}
/* Los ajustes que se ven en pantalla: el borrador si hay uno abierto, y si no lo guardado. */
function avVista(){ return avBorrador || av(); }
function abrirBorrador(){
  if (!avBorrador) avBorrador = JSON.parse(JSON.stringify(av()));
  if (!coloresBorrador) coloresBorrador = JSON.parse(JSON.stringify(est().colores || {}));
}
const AV_ETIQUETAS = {tema:'Tema', tModo:'Modo de color', temaClaro:'Tema claro', temaOscuro:'Tema oscuro',
                      relleno:'Relleno de los estados', densidad:'Densidad',
                      grosor:'Grosor de las líneas', esquinas:'Esquinas',
                      candado:'Candado en la malla', creditos:'Créditos en la malla',
                      // barra/barraPos/barraEstilo faltaban aqui. AV_ETIQUETAS es la lista que
                      // cambiosDeAjustes() recorre para decidir si hay algo sin guardar; al no
                      // estar, pintarBarraAjustes() veia "0 cambios", anulaba el borrador y
                      // descartaba en silencio lo elegido en Navegacion (quedaba "en blanco").
                      barra:'Modo de la barra', barraPos:'Posición de la barra',
                      barraEstilo:'Estilo de la barra', fuente:'Tamaño de la fuente'};
function valorLegible(k, v){ return typeof v === 'boolean' ? (v ? 'sí' : 'no') : String(v); }
/* Que cambio y en que, para el resumen de la barra. Sin esto, "hay cambios" es un numero que no dice
   nada y el usuario tiene que acordarse de lo que toco. */
function cambiosDeAjustes(){
  const guardado = av(), trabajo = avBorrador || guardado, filas = [];
  Object.keys(AV_ETIQUETAS).forEach(k => {
    if (guardado[k] !== trabajo[k]) {
      filas.push(AV_ETIQUETAS[k] + ': ' + valorLegible(k, guardado[k]) + ' -> ' + valorLegible(k, trabajo[k]));
    }
  });
  (AV_ESTADOS || []).forEach(x => {
    if (guardado.colores[x[0]] !== trabajo.colores[x[0]]) {
      filas.push(x[2] + ': ' + guardado.colores[x[0]] + ' -> ' + trabajo.colores[x[0]]);
    }
  });
  if (coloresBorrador) {
    // Se compara contra el color que el ramo tiene de verdad (el guardado, y si no lo trae de
    // fabrica). Comparar contra el guardado a secas contaba como cambio elegir el color que ya era.
    const guardados = est().colores || {};
    const n = Object.keys(coloresBorrador).filter(k => {
      const r = ramosH().find(x => x.codigo === k) || cursoDe(k) || {};
      const antes = guardados[k] || r.color;
      return coloresBorrador[k] !== antes;
    }).length;
    if (n) filas.push(n + (n === 1 ? ' color de ramo cambiado' : ' colores de ramos cambiados'));
  }
  return filas;
}
function tirarBorrador(){
  avBorrador = null; coloresBorrador = null;
  aplicarAvanzado(); renderTodo();
}
function guardarBorrador(){
  if (avBorrador) E.ajustes.av = JSON.parse(JSON.stringify(avBorrador));
  if (coloresBorrador) est().colores = JSON.parse(JSON.stringify(coloresBorrador));
  avBorrador = null; coloresBorrador = null;
  guardar('Ajustes guardados'); aplicarAvanzado(); renderTodo();
}
/* Barra fija al final de la pestaña: mientras haya cambios sin guardar, dice cuales y ofrece
   aceptarlos o descartarlos. Sin cambios, desaparece. */
function pintarBarraAjustes(){
  const z = document.getElementById('aj-bar');
  if (!z) return;
  const filas = cambiosDeAjustes();
  if (!filas.length) { avBorrador = null; coloresBorrador = null; z.className = 'aj-bar'; z.innerHTML = ''; return; }
  z.className = 'aj-bar on';
  z.innerHTML = '<div class="aj-caja"><div class="aj-tit"><b>' + filas.length +
    (filas.length === 1 ? ' cambio sin guardar' : ' cambios sin guardar') + '</b>' +
    '<span class="sm">Nada de esto se ha escrito todavía. Acepta para dejarlo, o descarta para ' +
    'volver como estaba.</span></div><ul>' + filas.map(f => '<li>' + esc(f) + '</li>').join('') + '</ul>' +
    '<div class="fila" style="gap:8px"><button class="btn" id="aj-tirar">Descartar</button>' +
    '<button class="btn primario" id="aj-guardar">Aceptar y guardar</button></div></div>';
  document.getElementById('aj-tirar').onclick = tirarBorrador;
  document.getElementById('aj-guardar').onclick = guardarBorrador;
}
function aRGB(h){
  const s = String(h).replace('#','');
  const x = s.length === 3 ? s.split('').map(y => y + y).join('') : s;
  return [parseInt(x.slice(0,2),16) || 0, parseInt(x.slice(2,4),16) || 0, parseInt(x.slice(4,6),16) || 0];
}
function aHex(r,g,b){
  return '#' + [r,g,b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2,'0')).join('');
}
// mezcla dos colores: t=0 deja a, t=1 deja b
function aMezcla(c1, c2, s){
  const a = aRGB(c1), b = aRGB(c2);
  return aHex(a[0]+(b[0]-a[0])*s, a[1]+(b[1]-a[1])*s, a[2]+(b[2]-a[2])*s);
}
function aLuminancia(h){
  const c = aRGB(h).map(v => { const x = v/255; return x <= .03928 ? x/12.92 : Math.pow((x+.055)/1.055, 2.4); });
  return .2126*c[0] + .7152*c[1] + .0722*c[2];
}
// contraste de la WCAG: 4.5 es legible, 3 es el minimo para texto grande
function aContraste(c1, c2){
  const l1 = aLuminancia(c1), l2 = aLuminancia(c2);
  return (Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05);
}
function aplicarAvanzado(){
  const a = avVista(), efecto = temaEfectivo(), d = AV_DENSIDAD[a.densidad] || AV_DENSIDAD.normal;
  const oscuro = !esClaro(efecto);   // la naturaleza sale de TEMAS, no de una lista copiada aqui
  const base = fondoTema(efecto);
  const suave = (c, t) => aMezcla(c, base, t);
  const vars = ['--nodo-pad:' + d.pad, '--nodo-fuente:' + d.fuente, '--malla-gap:' + d.mgap,
                '--col-gap:' + d.cgap, '--linea:' + (AV_GROSOR[a.grosor] || 1.6),
                '--radio:' + (a.esquinas === 'rectas' ? '2px' : '9px')];
  AV_ESTADOS.forEach(x => {
    const c = a.colores[x[0]], v = x[1];
    vars.push(v + ':' + c);
    vars.push(v + '-bg:' + suave(c, oscuro ? .80 : .86));                     // fondo suave
    vars.push(v + '-bd:' + suave(c, oscuro ? .38 : .45));                     // borde
    // En tema oscuro el texto se aclara hacia el blanco. Mezclarlo contra el fondo oscuro (como se
    // hacia antes) daba texto del mismo tono que el recuadro: contraste 1,1 sobre 4,5 recomendado.
    vars.push(v + '-fg:' + (oscuro ? aMezcla(c, '#ffffff', .58) : aMezcla(c, '#000000', .5)));  // texto
    // Texto sobre relleno solido. Antes se decidia con 'luminancia > 0.5', y ese umbral
    // deja fuera al amarillo: #eab308 da 0.498, por un pelo, y le tocaba texto BLANCO.
    // El resultado eran 1.92 de contraste en 'en curso' y 2.56 en 'bloqueado', o sea
    // ilegible, y solo en el modo de relleno solido. Ahora se elige el blanco solo si de
    // verdad se lee (3.0 es el piso de la WCAG para texto grande); si no, va oscuro.
    vars.push(v + '-sol:' + (aContraste(c, '#ffffff') >= 3.0 ? '#ffffff' : '#101828'));
  });
  NOMBRES_TEMA.forEach(n => document.body.classList.toggle('tema-' + n, efecto === n));
  document.body.classList.toggle('relleno-solido', a.relleno === 'solido');
  // Tamano de la fuente: es GLOBAL y escala la app ENTERA, no solo la letra. Se usa el zoom de la
  // raiz porque el CSS tiene muchas medidas en px (1108) y pocas atadas a la letra (202): subir solo
  // la letra dejaria los huecos sin crecer y se veria descuadrado. El zoom escala letra + huecos +
  // bloques + la propia ventana (vh sigue bien) y WebKit/Safari lo soporta desde 3.1, asi que vale
  // igual en el navegador y en la app de escritorio. Medido: el panel pasa de 560 a 728 px.
  var zoom = Number(a.fuente) || 1;
  document.documentElement.style.zoom = (zoom === 1 ? '' : String(zoom));
  // El MISMO factor se publica como variable, para que el CSS pueda corregir las medidas atadas a
  // la pantalla. El `zoom` agranda TAMBIEN `100vh`, y el armazon mide eso: sin esta correccion el
  // armazon pasaba a medir mas que la ventana y la parte de abajo (el bloque de Semestre) se salia
  // y quedaba cortada. Ver el comentario de .marco.g1 en general.css.
  document.documentElement.style.setProperty('--zoom', String(zoom));
  // El modo de la barra lateral lo aplica el motor de la barra (comun/08-barra.js),
  // que vive en window.mimoBarra. Se le pasa el valor elegido en Ajustes.
  if (window.mimoBarra) {
    window.mimoBarra.ponerModo(a.barra || 'manual');
    if (window.mimoBarra.ponerPos) window.mimoBarra.ponerPos(a.barraPos || 'izquierda');
    if (window.mimoBarra.ponerEstilo) window.mimoBarra.ponerEstilo(a.barraEstilo || 'clasica');
  }
  // La hoja #av-vars se escribe en dos ambitos, y cada uno por una razon:
  //   - :root lleva TODAS las variables. Es lo que pinta a los temas que no definen colores de
  //     estado (negro, medianoche, deepsea) y el unico ambito que ve el tema clasico.
  //   - body.tema-<X> lleva SOLO los colores de estado, y SOLO si el usuario cambio alguno. Si no
  //     lo toco, manda el tema: bosque, sepia, vino y alto contraste traen a proposito su propia
  //     paleta de estados, y pisarla seria cambiarle el diseno a quien no pidio nada.
  // El fallo que esto arregla: esos mismos cuatro temas definen los estados en su body.tema-*, que
  // tiene MAS especificidad que :root. Escribirlos en :root hacia que se perdiera el color elegido
  // EN SILENCIO. Con el mismo selector del tema y la hoja despues en el documento, gana el usuario.
  const FORMA = ['--nodo-pad', '--nodo-fuente', '--malla-gap', '--col-gap', '--linea', '--radio'];
  const deColor = vars.filter(v => !FORMA.some(f => v.indexOf(f + ':') === 0));
  const colorTocado = AV_ESTADOS.some(x => (a.colores || {})[x[0]] !== AV_FABRICA.colores[x[0]]);
  const hoja = document.getElementById('av-vars');
  if (hoja) {
    hoja.textContent = ':root{' + vars.join(';') + '}' +
      (colorTocado ? 'body.tema-' + efecto + '{' + deColor.join(';') + '}' : '');
  }
}
/* "Segun el sistema": si cambia el sistema (de claro a oscuro o al reves), la app tiene que
   repintarse sola. matchMedia es la via: no hay otra forma de enterarse sin sondear. */
if (window.matchMedia) {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      if (avVista().tModo === 'sistema') { aplicarAvanzado(); renderTodo(); }
    });
  } catch (e) { /* navegadores viejos: sin addEventListener en matchMedia, no pasa nada grave */ }
}
function avSeg(clave, opciones){
  const a = avVista();
  return '<div class="seg" data-av="' + clave + '">' + opciones.map(o =>
    '<button data-val="' + o[0] + '"' + (a[clave] === o[0] ? ' class="on"' : '') + '>' + o[1] +
    '</button>').join('') + '</div>';
}
/* Un nodo de la maqueta: la MISMA receta de color que usa la malla de verdad (fondo, borde y
   texto derivados del color del estado), con la forma y el tamano que piden los ajustes. */
function avMaqNodo(estado, a, efecto, oscuro){
  const T = (k) => (typeof window.t === 'function' ? window.t(k) : k);
  const c = a.colores[estado];
  const fondo = a.relleno === 'solido' ? c : aMezcla(c, fondoTema(efecto), .86);
  const borde = a.relleno === 'solido' ? c : aMezcla(c, fondoTema(efecto), .45);
  const texto = a.relleno === 'solido'
    ? (aLuminancia(c) > .5 ? '#101828' : '#ffffff')
    : (oscuro ? aMezcla(c, '#ffffff', .58) : aMezcla(c, '#000000', .5));
  const d = AV_DENSIDAD[a.densidad] || AV_DENSIDAD.normal;
  const radio = a.esquinas === 'rectas' ? '3px' : 'var(--r-md)';
  return '<div class="av-maq-nodo" style="background:' + fondo + ';border-color:' + borde +
    ';color:' + texto + ';border-width:' + (AV_GROSOR[a.grosor] || 1.6) + 'px;border-radius:' + radio +
    ';padding:' + d.pad + ';font-size:' + d.fuente + '">' +
    '<span class="av-maq-nombre">' + T('malla.est.' + estado) + '</span>' +
    '<span class="av-maq-ratio">' + aContraste(fondo, texto).toFixed(1) + ':1</span></div>';
}
/* La maqueta de la ventana de Malla. Va en #av-maqueta, FUERA de #avanzado: ocupa el ancho
   completo y queda debajo de las filas de controles (boceto B aprobado). Se repinta sola cada vez
   que cambia un ajuste, porque la llama renderAvanzado(), que es el punto por el que pasan todos. */
function pintarMaquetaMalla(){
  const z = document.getElementById('av-maqueta');
  if (!z) return;
  const T = (k) => (typeof window.t === 'function' ? window.t(k) : k);
  const a = avVista(), efecto = temaEfectivo(), oscuro = !esClaro(efecto);
  z.innerHTML = '<div class="av-maq-cab"><b>' + T('malla.maq') + '</b><span>' + T('malla.maq.d') + '</span></div>' +
    '<div class="av-maq-rej">' + AV_ESTADOS.map(x => avMaqNodo(x[0], a, efecto, oscuro)).join('') + '</div>';
}
function renderAvanzado(){
  const a = avVista(), efecto = temaEfectivo();
  const oscuro = !esClaro(efecto);            // la misma fuente unica que aplicarAvanzado
  // Los textos salen por el motor de idioma (window.t): este bloque se pinta en JS, no lleva
  // data-i18n. renderAvanzado se vuelve a llamar al cambiar de idioma.
  const T = (k) => (typeof window.t === 'function' ? window.t(k) : k);
  document.getElementById('avanzado').innerHTML =
    '<div class="av-fila"><span class="eti">' + T('malla.rel') + '</span>' +
      avSeg('relleno', [['suave', T('malla.suave')], ['solido', T('malla.solido')]]) + '</div>' +
    '<div class="av-fila"><span class="eti">' + T('malla.tam') + '</span>' +
      avSeg('densidad', [['compacta', T('malla.compacta')], ['normal', T('malla.normal')], ['amplia', T('malla.amplia')]]) + '</div>' +
    '<div class="av-fila"><span class="eti">' + T('malla.esq') + '</span>' +
      avSeg('esquinas', [['redondeadas', T('malla.redondas')], ['rectas', T('malla.rectas')]]) + '</div>' +
    '<div class="av-fila"><span class="eti">' + T('malla.col') + '</span>' +
      '<span style="display:flex;gap:12px;flex-wrap:wrap">' +
      AV_ESTADOS.map(x => '<span class="av-color"><input type="color" data-avcolor="' + x[0] +
        '" value="' + a.colores[x[0]] + '" title="' + T('malla.est.' + x[0]) + '"><span>' + T('malla.est.' + x[0]) + '</span></span>').join('') +
      '</span><button class="mini" id="av-fabrica">' + T('malla.fab') + '</button></div>' +
    '<div class="av-fila"><span class="eti">' + T('malla.gro') + '</span>' +
      avSeg('grosor', [['fina', T('malla.fina')], ['normal', T('malla.normal')], ['gruesa', T('malla.gruesa')]]) + '</div>' +
    '<div class="av-fila"><span class="eti">' + T('malla.ext') + '</span>' +
      '<label class="av-check"><input type="checkbox" id="av-candado"' + (a.candado ? ' checked' : '') + '> ' + T('malla.ico') + '</label>' +
      '<label class="av-check"><input type="checkbox" id="av-creditos"' + (a.creditos ? ' checked' : '') + '> ' + T('malla.cre') + '</label></div>';
  pintarMaquetaMalla();
  document.getElementById('av-fabrica').onclick = () => {
    abrirBorrador();
    avBorrador = JSON.parse(JSON.stringify(AV_FABRICA));
    aplicarAvanzado(); renderTodo(true); renderAvanzado(); pintarBarraAjustes();
  };
  // convertirPistas() sigue haciendo falta: convierte los .pista de OTRAS ventanas en su boton.
  convertirPistas();
}
/* Nada de esto guarda: todo va al borrador y la barra de abajo es la que decide. */
document.getElementById('avanzado').addEventListener('click', ev => {
  const b = ev.target.closest('.seg button');
  if (!b) return;
  abrirBorrador();
  avBorrador[b.parentNode.dataset.av] = b.dataset.val;
  aplicarAvanzado(); renderTodo(true); renderAvanzado(); pintarBarraAjustes();
});
document.getElementById('avanzado').addEventListener('input', ev => {
  const c = ev.target.closest('[data-avcolor]');
  if (!c) return;                       // mientras se arrastra el selector, solo se repinta la malla
  abrirBorrador();
  avBorrador.colores[c.dataset.avcolor] = c.value;
  aplicarAvanzado(); renderMalla(); renderAvanzado(); pintarBarraAjustes();
});
document.getElementById('avanzado').addEventListener('change', ev => {
  const c = ev.target.closest('[data-avcolor]');
  if (c) { renderAvanzado(); pintarBarraAjustes(); return; }
  if (ev.target.id === 'av-candado' || ev.target.id === 'av-creditos') {
    abrirBorrador();
    avBorrador[ev.target.id === 'av-candado' ? 'candado' : 'creditos'] = ev.target.checked;
    aplicarAvanzado(); renderMalla(); renderAvanzado(); pintarBarraAjustes();
  }
});
