/* ------------------------------------------------------- leer una malla desde un PDF
   Un PDF no dice "aqui hay una tabla": dice "hay un texto de tal ancho en tal posicion". Por
   eso lo que decide todo son las COORDENADAS, no el orden en que sale el texto. En estas
   mallas el orden enganya de verdad: en una de las reales los semestres salian
   "3 4 5 6 7 8 9 10 11 1 2" mientras en la pagina estan del 1 al 11. Leyendo por orden se
   arma una malla falsa, corrida de semestre, y NADA avisa.

   Este lector propone. No pretende acertar siempre: cuando no esta seguro lo dice, y el alumno
   corrige el resto en el editor de ramos. Esa es la idea: la maquina hace el trabajo pesado y
   la persona da el visto bueno.

   Toda la lectura esta escrita aqui, en la aplicacion. No depende de ningun programa de
   afuera ni de tener internet: el alumno abre el archivo, elige su PDF y listo.
*/

// Las medidas salen de medir mallas reales, no de suponerlas.
const PDF_HUECO_CORTE = 12.0;   // a partir de aqui, dos textos son de columnas distintas
const PDF_HUECO_UNIR = 1.0;     // dentro de una palabra el hueco es 0.0; entre palabras, 1.4
const PDF_TOL_LINEA = 3.0;      // dos textos a menos de esto van en la misma linea
const PDF_HUECO_RAMO = 10.0;    // a partir de aqui, en una columna, empieza otro ramo

// Texto de relleno de las hojas: avisos legales, datos de la facultad, el codigo QR.
const PDF_RELLENO = new RegExp(
  'malla\\s*sujeta|plan\\s+de\\s+estudio\\s+podr|requisito\\s+de\\s+titulaci|resoluci[oó]n\\s*n|' +
  'accede\\s+a|para\\s+m[aá]s\\s+informaci|escanea|c[oó]digo\\s+qr|facultad\\s+de|' +
  'modelo\\s+curricular|www\\.|informaci[oó]n\\s+actualizada|podr[aá]n?\\s+ser\\s+modificad|' +
  'cr[eé]ditos\\s+totales|total\\s+cr[eé]ditos|semestre\\s+\\d+\\s*$', 'i');

const PDF_ROMANOS = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8,
                      ix: 9, x: 10, xi: 11, xii: 12 };

// Un codigo de ramo: dos a seis letras, dos a cuatro digitos, y a veces una letra al final.
const PDF_CODIGO = /^[A-Z]{2,5}\d{3,4}[A-Z]?$/;

function pdfEsRelleno(texto){
  const t = String(texto || '').trim();
  if (t.length < 5) return true;
  if (PDF_RELLENO.test(t)) return true;
  if (/^\d?\s*(er|do|to|mo|vo|no)\s*a[nñ]o$/i.test(t)) return true;
  if (/^semestre\s*\d+$/i.test(t)) return true;
  return false;
}

/* Saca de cada hoja las palabras con su posicion. Se cuenta la altura de la hoja porque el PDF
   mide desde abajo y nosotros pensamos desde arriba: sin dar vuelta el eje, los semestres
   salen al reves. */
/* Trae pdf.js solo cuando de verdad se va a leer un PDF.

   Antes pdf.js venia dentro del index.html: 700 KB que se descargaba todo el mundo al abrir el
   panel, aunque no fuera a importar nunca nada. Ahora vive en vendor/ y se engancha aqui, la
   primera vez. A partir de ahi queda cargado y las siguientes importaciones son instantaneas.

   El motor (vendor/pdf-motor.js) va aparte de la API (vendor/pdf.min.js) porque el motor se
   puede entregar comprimido y descomprimirlo en memoria: son 1,09 MB que viajan como 388 KB. */
function pdfEngancharScript(url){
  return new Promise(function (listo, falla) {
    const s = document.createElement('script');
    s.src = url;
    s.onload = function () { listo(); };
    s.onerror = function () {
      falla(new Error('No pude cargar ' + url + '. Si copiaste el panel a mano, ' +
                      'acuérdate de llevarte también la carpeta vendor/.'));
    };
    document.head.appendChild(s);
  });
}

async function pdfCargarLector(){
  if (typeof pdfjsLib === 'undefined') await pdfEngancharScript('vendor/pdf.min.js');
  if (typeof pdfPrepararMotor === 'undefined') await pdfEngancharScript('vendor/pdf-motor.js');
  await pdfPrepararMotor();
}

async function pdfPalabras(datos){
  await pdfCargarLector();
  const documento = await pdfjsLib.getDocument({data: datos}).promise;
  const palabras = [];
  for (let n = 1; n <= documento.numPages; n++){
    const pagina = await documento.getPage(n);
    const alto = pagina.view[3];
    const contenido = await pagina.getTextContent();
    for (const it of contenido.items){
      const texto = it.str || '';
      if (!texto.trim()) continue;
      const t = it.transform;
      const x = t[4], ancho = it.width || 0, y = alto - t[5];
      const tam = Math.abs(t[3]) || (it.height || 10);

      // pdf.js NO entrega palabras: entrega trozos, y un trozo puede ser "I Semestre" entero.
      // Buscando una palabra que diga exactamente "semestre" no se encuentra jamas, y la familia
      // de columnas entera queda en cero ramos. Por eso cada trozo se parte en palabras, y a
      // cada una se le calcula su x repartiendo el ancho del trozo segun los caracteres que
      // ocupa. La primera palabra del trozo queda con su x exacta, que es la que ancla la
      // columna; las de adentro quedan aproximadas, y eso alcanza para separar columnas.
      const partes = texto.split(/\s+/).filter(Boolean);
      let desde = 0;
      for (const palabra of partes){
        const i = texto.indexOf(palabra, desde);
        const j = i + palabra.length;
        desde = j;
        palabras.push({
          p: n, t: palabra, y: y, tam: tam,
          x0: x + ancho * (i / texto.length),
          x1: x + ancho * (j / texto.length),
          ancla: x,
        });
      }
    }
  }
  return palabras;
}

/* Agrupa palabras en lineas. Se agrupa por hoja y por alto: dos textos a distinta altura son
   de lineas distintas aunque esten cerca en horizontal. */
function pdfLineas(palabras, tolerancia){
  const tol = tolerancia === undefined ? PDF_TOL_LINEA : tolerancia;
  const orden = palabras.slice().sort((a, b) => (a.p - b.p) || (a.y - b.y) || (a.x0 - b.x0));
  const lineas = [];
  let actual = null;
  for (const w of orden){
    if (actual && actual.p === w.p && Math.abs(actual.y - w.y) <= tol){
      actual.ws.push(w);
      actual.y = actual.ws.reduce((s, x) => s + x.y, 0) / actual.ws.length;
    } else {
      actual = {p: w.p, y: w.y, ws: [w]};
      lineas.push(actual);
    }
  }
  lineas.forEach(l => l.ws.sort((a, b) => a.x0 - b.x0));
  return lineas;
}

/* Une los textos de una linea. Entre trozos de la MISMA palabra el hueco es 0 y entre palabras
   distintas es 1.4, medido sobre mallas reales. El umbral va en 1.0, justo en medio: mas alto
   pega las palabras ("paraIngenieria") y mas bajo mete espacios dentro de ellas ("C a lculo"). */
function pdfTextoDe(linea){
  let salida = '', anterior = null;
  for (const w of linea.ws){
    if (anterior !== null && w.x0 - anterior >= PDF_HUECO_UNIR) salida += ' ';
    salida += w.t;
    anterior = w.x1;
  }
  return salida.replace(/\s+/g, ' ').trim();
}

/* Numero de semestre del encabezado. Se mira a los dos lados de la palabra porque las mallas
   usan las dos formas: "SEMESTRE 1" y "I Semestre". Mirando solo hacia adelante, media
   biblioteca de mallas da cero ramos. */
function pdfNumeroDe(ws, i){
  const pegado = /^SEMESTRE\s*(\d{1,2})$/i.exec(ws[i].t);
  if (pegado) return parseInt(pegado[1], 10);
  // Se miran los DOS lados y gana el que este mas cerca en horizontal. Mirando solo hacia
  // adelante, en "I Semestre" se toma el "II" de la columna siguiente y todos los semestres
  // salen corridos uno: la malla queda entera mal, y sin ningun aviso.
  let mejor = null, distancia = Infinity;
  for (const j of [i + 1, i - 1]){
    if (j < 0 || j >= ws.length) continue;
    const t = ws[j].t.trim().replace(/\.$/, '').toLowerCase();
    let n = null;
    if (/^\d+$/.test(t) && +t >= 1 && +t <= 12) n = +t;
    else if (PDF_ROMANOS[t]) n = PDF_ROMANOS[t];
    if (n === null) continue;
    const d = Math.abs(ws[j].x0 - ws[i].x0);
    if (d < distancia){ distancia = d; mejor = n; }
  }
  return mejor;
}

/* Busca la fila de encabezado con los semestres y devuelve en que x esta cada uno.

   El numero se busca primero al lado de la palabra y, si no esta, DEBAJO de ella. No es un
   capricho: hay mallas que escriben la celda del encabezado en dos renglones, con "Semestre"
   arriba y el numero abajo. Mirando solo la misma linea, esas mallas quedan enteras en cero. */
function pdfColumnas(lineas){
  const ordenadas = lineas.slice().sort((a, b) => a.y - b.y);
  for (let k = 0; k < ordenadas.length; k++){
    const linea = ordenadas[k], ws = linea.ws, pares = [];
    // Cuantas veces dice "semestre" cada trozo original. Si un trozo trae varios encabezados,
    // su x de inicio no sirve como ancla de ninguno de ellos.
    const porTrozo = {};
    for (const w of ws){
      if (/^semestre/i.test(w.t.trim())) porTrozo[w.ancla] = (porTrozo[w.ancla] || 0) + 1;
    }
    for (let i = 0; i < ws.length; i++){
      if (!/^semestre/i.test(ws[i].t.trim())) continue;
      const suelto = /^semestre\s*(\d{1,2})$/i.exec(ws[i].t.trim());
      let n = suelto ? parseInt(suelto[1], 10) : pdfNumeroDe(ws, i);
      if (n === null) n = pdfNumeroDebajo(ordenadas, k, ws[i].x0);
      // El ancla es el borde izquierdo real del trozo, que trae "I Semestre" junto: la x de la
      // palabra "Semestre" por si sola queda corrida a la derecha y ensancha la columna.
      const x = (porTrozo[ws[i].ancla] === 1) ? ws[i].ancla : ws[i].x0;
      if (n !== null) pares.push([n, x]);
    }
    if (pares.length >= 3){
      pares.sort((a, b) => a[1] - b[1]);
      const vistos = {};
      const limpios = pares.filter(p => (vistos[p[0]] ? false : (vistos[p[0]] = true)));
      return {pares: limpios, y: linea.y};
    }
  }
  return null;
}

/* El numero que esta justo debajo de una palabra, alineado con ella en horizontal. */
function pdfNumeroDebajo(ordenadas, k, x){
  const base = ordenadas[k];
  for (let j = k + 1; j < ordenadas.length; j++){
    const salto = ordenadas[j].y - base.y;
    if (salto > 16) break;
    if (salto < 2) continue;
    for (const w of ordenadas[j].ws){
      if (Math.abs((w.ancla !== undefined ? w.ancla : w.x0) - x) > 12) continue;
      const t = w.t.trim().replace(/\.$/, '').toLowerCase();
      if (/^\d{1,2}$/.test(t) && +t >= 1 && +t <= 12) return +t;
      if (PDF_ROMANOS[t]) return PDF_ROMANOS[t];
    }
  }
  return null;
}

/* Parte una linea en los grupos separados por un hueco grande.

   Aqui hay dos trampas que se contradicen, y las dos hay que resolver:
     * Una misma linea puede llevar ramos de varias columnas ("Calculo I | Algebra I | Fisica I").
       Si se junta todo, sale un ramo inventado que mezcla tres.
     * Pero un nombre puede ser MAS ANCHO que su columna y desbordar a la vecina. Repartiendo
       palabra por palabra segun el ancho de la columna, el ramo se corta en pedazos sin nombre.
   Lo que resuelve las dos: cortar por HUECOS grandes, no por el ancho de la columna. */
function pdfTrozosDe(linea){
  const grupos = [];
  let actual = [], anterior = null;
  for (const w of linea.ws){
    if (anterior !== null && w.x0 - anterior >= PDF_HUECO_CORTE){ grupos.push(actual); actual = []; }
    actual.push(w);
    anterior = w.x1;
  }
  if (actual.length) grupos.push(actual);
  return grupos;
}

function pdfCredito(texto){
  // Las dos formas existen en las mallas reales: "6 SCT" y "SCT 6". Mirando solo una, la mitad
  // de las mallas se queda sin creditos.
  const m = /(\d{1,3})\s*(?:SCT|cr[eé]ditos)|(?:SCT|cr[eé]ditos)\s*:?\s*(\d{1,3})/i.exec(texto);
  if (!m) return null;
  return parseInt(m[1] !== undefined ? m[1] : m[2], 10);
}

function pdfRamo(nombre, nivel, creditos, codigo){
  return {codigo: codigo || '', nombre: nombre || '', creditos: creditos === undefined ? null : creditos,
          nivel: String(nivel), requisitos: [], tipo: ''};
}


/* Familia de columnas: los ramos cuelgan bajo el encabezado de su semestre. */
function pdfPorColumnas(palabras, encabezado){
  const xs = encabezado.pares.map(p => p[1]);
  const cortes = [xs[0] - 16];
  for (let i = 0; i < xs.length - 1; i++) cortes.push((xs[i] + xs[i + 1]) / 2);
  cortes.push(xs[xs.length - 1] + 100);

  const columnaDe = x => {
    for (let i = 0; i < cortes.length - 1; i++) if (x >= cortes[i] && x < cortes[i + 1]) return encabezado.pares[i][0];
    return null;
  };

  const porColumna = {};
  for (const linea of pdfLineas(palabras)){
    if (linea.y <= encabezado.y + 4) continue;
    for (const g of pdfTrozosDe(linea)){
      const c = columnaDe(g[0].x0);
      if (c === null) continue;
      (porColumna[c] = porColumna[c] || []).push({y: linea.y, ws: g});
    }
  }

  const ramos = [], avisos = [];
  for (const nivel of Object.keys(porColumna).map(Number).sort((a, b) => a - b)){
    const bloques = [];
    for (const linea of porColumna[nivel].sort((a, b) => a.y - b.y)){
      const ultimo = bloques[bloques.length - 1];
      if (ultimo && linea.y - ultimo.yFin <= PDF_HUECO_RAMO){
        ultimo.lineas.push(linea); ultimo.yFin = linea.y;
      } else bloques.push({lineas: [linea], yFin: linea.y});
    }
    for (const b of bloques){
      let texto = b.lineas.map(pdfTextoDe).join(' ').replace(/\s+/g, ' ').replace(/^[ .-]+|[ .-]+$/g, '');
      if (pdfEsRelleno(texto)) continue;
      const cr = pdfCredito(texto);
      if (cr !== null){
        const donde = texto.search(/(\d{1,3})\s*(?:SCT|cr[eé]ditos)|(?:SCT|cr[eé]ditos)\s*:?\s*\d{1,3}/i);
        if (donde > 0) texto = texto.slice(0, donde).replace(/^[ .-]+|[ .-]+$/g, '');
        else texto = texto.replace(/(\d{1,3})\s*(?:SCT|cr[eé]ditos)|(?:SCT|cr[eé]ditos)\s*:?\s*\d{1,3}/gi, '').replace(/^[ .-]+|[ .-]+$/g, '');
      }
      if (pdfEsRelleno(texto)) continue;
      ramos.push(pdfRamo(texto, nivel, cr, ''));
    }
  }
  return {ramos: ramos, avisos: avisos};
}

/* Familia de grilla: filas de CODIGO + creditos, con el nombre encima de cada codigo. */
function pdfPorCodigos(palabras){
  // Las lineas se calculan UNA vez. Calculandolas dentro del bucle de cada codigo, el trabajo
  // se multiplica por el numero de codigos y la lectura se vuelve lenta sin motivo.
  const lineasTodas = pdfLineas(palabras);
  // Una fila de la grilla es la que trae AL MENOS un codigo, y cada fila es un semestre. Antes
  // se exigian tres codigos por fila, y con eso las filas de uno o dos ramos desaparecian.
  const filas = lineasTodas.filter(l => l.ws.some(w => PDF_CODIGO.test(w.t)));
  if (filas.length < 4) return {ramos: [], avisos: []};
  const ramos = [], avisos = [];
  let nivel = 0;
  for (const fila of filas.sort((a, b) => (a.p - b.p) || (a.y - b.y))){
    nivel++;
    for (let i = 0; i < fila.ws.length; i++){
      const w = fila.ws[i];
      if (!PDF_CODIGO.test(w.t)) continue;
      const cr = i + 1 < fila.ws.length && /^\d{1,3}$/.test(fila.ws[i + 1].t)
        ? parseInt(fila.ws[i + 1].t, 10) : null;
      const x0 = w.x0, x1 = w.x1 + 34;
      // El nombre va ENCIMA del codigo, en su misma franja horizontal. Se recorre de la linea
      // mas cercana hacia arriba: recorriendo desde el principio de la hoja, la primera linea
      // esta arriba de todo y corta la busqueda en el acto.
      const candidatas = [];
      const deArribaAbajo = lineasTodas.slice().sort((a, b) => b.y - a.y);
      for (const l of deArribaAbajo){
        if (l.p !== fila.p) continue;
        if (l.y >= fila.y - 1) continue;
        if (l.y < fila.y - 44) break;
        const trozos = l.ws.filter(x => x.x0 >= x0 && x.x0 <= x1);
        if (trozos.length) candidatas.push({y: l.y, ws: trozos});
      }
      candidatas.sort((a, b) => a.y - b.y);
      let nombre = candidatas.map(pdfTextoDe).join(' ').replace(/\s+/g, ' ').trim();
      // Si lo que quedo arriba es otra fila de codigos, no era un nombre: sin este filtro, la
      // fila de arriba entera se pega como nombre del ramo.
      if (PDF_CODIGO.test(nombre.replace(/ /g, '')) && !/^[^\d]*$/.test(nombre)) nombre = '';
      ramos.push(pdfRamo(pdfEsRelleno(nombre) ? '' : nombre, nivel, cr, w.t.toUpperCase()));
    }
  }
  if (ramos.length && !ramos.some(r => r.nombre))
    avisos.push('esta malla trae los codigos y los creditos, pero los nombres no se pudieron ' +
                'emparejar: van aparte de los codigos. Ponlos a mano en el editor.');
  return {ramos: ramos, avisos: avisos};
}

function pdfQuitarRepetidos(ramos, avisos){
  // Los ramos SIN codigo no se tocan. Antes se descartaban, y eso borraba de una sola vez toda
  // la familia de columnas, que es la que no trae codigos: la malla salia vacia sin ningun aviso.
  const porCodigo = {};
  const salida = [];
  let repetidos = 0;
  for (const r of ramos){
    if (!r.codigo){ salida.push(r); continue; }
    const previo = porCodigo[r.codigo];
    if (!previo){ porCodigo[r.codigo] = r; salida.push(r); continue; }
    repetidos++;
    if (!previo.nombre && r.nombre) previo.nombre = r.nombre;
    if (previo.creditos === null && r.creditos !== null) previo.creditos = r.creditos;
  }
  if (repetidos) avisos.push(repetidos + ' ramos venian repetidos (el archivo tiene varias ' +
    'hojas) y se dejo una sola vez cada uno');
  return salida;
}

/* Un codigo estable a partir del nombre, para las mallas que no traen codigos.

   Varias carreras de la Chile nombran los ramos y no les ponen codigo: arquitectura, artes
   visuales, composicion musical, teoria del arte. El lector devolvia esos ramos con el codigo
   vacio, y ahi estaba el problema: al cargarlos todos caian en el MISMO codigo vacio y se pisaban
   entre si, de modo que una malla de 48 ramos entraba como uno solo. Se noto al importar de
   verdad las mallas reales, no en las de ejemplo, que todas traen codigo.

   El codigo se saca de las iniciales del nombre, que es lo unico que se puede sacar de un nombre,
   y se evita repetir. Queda como una propuesta mas, para que el alumno la corrija: es la misma
   regla que sigue el resto del lector. */
function pdfCodigosDeRelleno(ramos){
  const usados = {};
  ramos.forEach(r => { if (r.codigo) usados[r.codigo] = true; });
  const sinTildes = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const vacias = ['para', 'del', 'los', 'las', 'con', 'una', 'ingenieria', 'taller', 'introduccion'];
  ramos.forEach(r => {
    if (r.codigo) return;
    const significativas = (sinTildes(r.nombre).match(/[A-Za-z]+/g) || [])
      .filter(p => p.length > 3 && vacias.indexOf(p.toLowerCase()) < 0);
    const base = significativas.slice(0, 4).map(p => p.slice(0, 2)).join('').toUpperCase().slice(0, 6)
                 || 'RAMO';
    let cod = base, n = 1;
    while (usados[cod]) { n++; cod = base + n; }
    usados[cod] = true;
    r.codigo = cod;
  });
  return ramos;
}
/* De las palabras a los ramos. Esta es la parte que decide la malla, y esta separada de la
   lectura del PDF a proposito: asi se puede probar sola, con palabras conocidas, sin navegador
   y sin pdf.js de por medio. */
function pdfRamosDePalabras(palabras){
  const lineas = pdfLineas(palabras);
  const porHoja = {};
  lineas.forEach(l => { (porHoja[l.p] = porHoja[l.p] || []).push(l); });

  let avisos = [];
  let ramos = [];
  let hojasLeidas = 0;

  for (const hoja of Object.keys(porHoja).map(Number).sort((a, b) => a - b)){
    const deLaHoja = palabras.filter(w => w.p === hoja);
    const lineasHoja = porHoja[hoja];

    // Cuantos codigos de ramo hay en la hoja: eso dice a que familia pertenece, y hay que
    // decidirlo ANTES de repartir por columnas. Una grilla tambien trae encabezados de
    // semestre, asi que empezando por columnas se le aplica el metodo equivocado y salen
    // cientos de ramos que no existen.
    const cuantosCodigos = deLaHoja.filter(w => PDF_CODIGO.test(w.t)).length;

    // La grilla manda si hay codigos de ramo, y solo se cae a columnas si la grilla no saco
    // nada. Elegir por "la que de mas ramos con nombre" parece mas listo y es peor: una malla de
    // grilla tambien trae encabezados de semestre, asi que la familia de columnas le saca
    // cientos de ramos inventados y gana por numero. La grilla, en cambio, casi no se equivoca.
    let salida = null;
    if (cuantosCodigos >= 8){
      const r = pdfPorCodigos(deLaHoja);
      if (r.ramos.length) salida = r;
    }
    if (!salida){
      const enc = pdfColumnas(lineasHoja);
      if (enc){
        const r = pdfPorColumnas(deLaHoja, enc);
        if (r.ramos.length) salida = r;
      }
    }
    if (salida){ ramos = ramos.concat(salida.ramos); avisos = avisos.concat(salida.avisos); hojasLeidas++; }
  }

  return {ramos: pdfCodigosDeRelleno(pdfQuitarRepetidos(ramos, avisos)),
          avisos: avisos, hojasLeidas: hojasLeidas};
}

async function leerMallaDePDF(datos, nombreArchivo){
  if (!datos || !datos.byteLength) throw new Error('El archivo está vacío.');
  let palabras;
  try {
    palabras = await pdfPalabras(datos);
  } catch (e) {
    throw new Error('No pude abrir el PDF (' + (e && e.message ? e.message : 'archivo dañado') +
                    '). Si es una foto o un escaneo, no tiene texto que leer: prueba con la ' +
                    'opción de foto.');
  }
  if (!palabras.length)
    throw new Error('Este PDF no tiene texto: parece una foto o un escaneo. Usa la opción de foto.');

  const r = pdfRamosDePalabras(palabras);
  if (!r.ramos.length)
    throw new Error('No reconocí una malla en este PDF. Puede ser un formato que todavía no ' +
                    'sé leer: prueba con la opción de foto o carga los ramos a mano.');
  return {ramos: r.ramos, problemas: [], huerfanos: [],
          aviso: 'Leí el PDF y propongo ' + r.ramos.length + ' ramos en ' + r.hojasLeidas +
                 ' hoja(s). Revísalos y corrige lo que falte: es más rápido corregir que ' +
                 'escribir todo.',
          avisos: r.avisos,
          sinCreditos: r.ramos.filter(x => x.creditos === null).length,
          sinNombre: r.ramos.filter(x => !x.nombre).length};
}
