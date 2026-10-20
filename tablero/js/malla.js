/* ============================================================================
   malla.js — Mimo Nuevo · bloque MALLA (T004) · EL MOTOR Y SU VISTA

   QUE ES. El bloque que dibuja la malla del semestre: una columna por nivel, cada
   ramo con su estado (aprobado / en curso / disponible / bloqueado), el editor del
   ramo, la importacion y exportacion (JSON, CSV/TSV y pegado desde una foto) y el
   simulador de "que pasa si tomo este ramo". No hay otra fuente de verdad que el
   catalogo del sustrato (`MimoComun.CAT()`) y `E.malla`.

   POR QUE DOS PIEZAS. Se copia el molde de `js/tiempo.js`: un MOTOR sin DOM, con
   funciones puras que se pueden probar desde la consola o desde el instrumento, y
   una VISTA que solo pinta y delega. El motor no nombra el DOM ni una vez; la vista
   toma `D = window.document` una sola vez, igual que `tiempo.js`.

   DE DONDE SALE. Portado de `prototipo/bloques/malla/motor.js`, `importar.js`,
   `exportar.js` y `ui.js` (documentados en `PARIDAD.md` §T004), con los cambios
   dichos aqui:
     - el prototipo tenia su propia copia del estado (`E` con leer/escribir); aqui
       se lee y se escribe por la PUERTA UNICA del sustrato: `MimoComun.leer()` y
       `MimoComun.guardar()`, namespace `malla`, clave `mimo.datos.v1`;
     - `almacen.js` normaliza campo a campo y descarta lo que no conoce: `malla` se
       declaro alli como campo de primer nivel, asi que sobrevive a un F5 sin espejos;
     - el prototipo importaba SOLO el respaldo formato 2. El encargo pide ademas
       CSV/TSV y pegado desde foto, y exportar CSV: eso es nuevo aqui y se prueba
       con la ida y vuelta (importar lo exportado devuelve el mismo semestre);
     - el dibujo del prototipo (vista-mapa.js, 853 lineas de SVG) NO se porta: la
       reticula se pinta con rejilla CSS y las flechas son una capa SVG pequena
       (HUECO declarado en evidencia-malla.txt: sin carriles, sin curvas a medida).

   API DEL MOTOR (`window.MimoMallaMotor`)
     getCurso(cod)            la entrada del catalogo, o null
     getEstadoCurso(cod)      'aprobado'|'curso'|'disponible'|'bloqueado'
     getRamosActivos()        los de "en curso" (copia plana)
     getCursosDeSemestre(n)   codigos de la columna n
     getSemestres()           [{n, titulo, cursos}] (columnas ya ordenadas)
     getAprobados()           {codigo: true}
     requisitosFaltantes(cod) lista de requisitos que faltan
     desbloquea(cod)          inverso de requisitos
     cadena(cod, direccion)   'antes' | 'despues', sin repetir
     esAnual(cod)             true si ocupa dos semestres
     semestresQueOcupa(cod)   1, o los del anual
     creditosAprobados()      suma de creditos aprobados
     estados()                {codigo: estado} de todo el catalogo
     simularCon(aprobados)    los estados con otro juego de aprobados, sin guardar
     importarMalla(texto, formato)  'json'|'csv'|'tsv'|'auto' -> {ok, resumen}
     exportarMalla(formato)   'json' (defecto) | 'csv' | 'tsv' -> texto
   Mas las escrituras que la vista necesita: aprobar, quitarRamo, guardarCurso,
   borrarCurso, moverNivel, reordenarNivel, tituloNivel, ponerNota.

   LA CLAVE DEL BLOQUE ES `bloque.malla.nombre`, que SI existe en `js/i18n.js`, pero
   la descripcion y los rotulos de dentro NO: ese fichero es de T003 y este bloque no
   lo edita. Por eso los rotulos viven en `TEXTOS` (es/en) aqui abajo, se repintan al
   cambiar de idioma y no llevan `data-i18n` (asi el diagnostico de T003 sigue a cero).
   ============================================================================ */
var MimoMallaMotor = (function () {
  'use strict';

  var Mimo = window.MimoComun;

  /* --------------------------------------------------------------- utilidades */
  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function codigo(v) { return String(v === undefined || v === null ? '' : v).replace(/^\s+|\s+$/g, '').toUpperCase(); }
  function texto(v) { return String(v === undefined || v === null ? '' : v).replace(/^\s+|\s+$/g, ''); }
  function numero(v, def) { var n = Number(v); return isFinite(n) ? n : def; }
  function esSi(v) {
    var s = texto(v).toLowerCase();
    return s === '1' || s === 'si' || s === 'sí' || s === 'true' || s === 'x' || s === 'v';
  }
  function clon(v) {
    if (v === undefined || v === null) { return v; }
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }
  function listaCodigos(v) {
    if (Array.isArray(v)) {
      var out = [];
      for (var i = 0; i < v.length; i++) { var c = codigo(v[i]); if (c) { out.push(c); } }
      return out;
    }
    if (typeof v === 'string') {
      var txt = v.replace(/\|/g, ';');
      return listaCodigos(txt.split(';'));
    }
    return [];
  }
  function listaGrupos(v) {
    if (!Array.isArray(v)) { return []; }
    var out = [];
    for (var i = 0; i < v.length; i++) {
      var g = listaCodigos(v[i]);
      if (g.length) { out.push(g); }
    }
    return out;
  }
  function ahora() {
    return (typeof Mimo.aISO === 'function') ? Mimo.aISO(new Date()) : new Date().toISOString();
  }

  /* El estado y el catalogo: las dos unicas fuentes. Nada de copias propias. */
  function estado() { return Mimo.estadoMalla(); }
  function catalogo() { return Mimo.CAT(); }

  /* Guarda por la puerta unica: `estadoMalla()` devuelve `E.malla` y `guardar()`
     persiste el estado entero. */
  function guardar(aviso) {
    Mimo.guardar(aviso);
  }

  /* ----------------------------------------------------------- estados -------
     Portado de malla/03-dibujo.js:22-48 sin cambios de criterio:
       aprobado > en curso > disponible si TODOS los requisitos estan aprobados y
       CADA grupo de requisitos_o tiene al menos uno aprobado > bloqueado.
     Se recorren tambien los codigos aprobados o en curso que no estan en el
     catalogo, para que getEstadoCurso() nunca devuelva undefined. */
  function calcularCon(aprob) {
    var cat = catalogo();
    var m = estado();
    var enCurso = {};
    m.ramos.forEach(function (r) { enCurso[codigo(r.codigo)] = true; });

    var memo = {};
    function est(cod, visto) {
      if (Object.prototype.hasOwnProperty.call(memo, cod)) { return memo[cod]; }
      visto = visto || {};
      if (visto[cod]) { return 'bloqueado'; }          // por si el grafo trajera un ciclo
      visto[cod] = true;
      var v;
      if (aprob[cod]) {
        v = 'aprobado';
      } else if (enCurso[cod]) {
        v = 'curso';
      } else {
        var c = cat[cod] || {};
        var reqs = c.requisitos || [];
        var uno = c.requisitos_o || [];
        var ok = true;
        for (var i = 0; i < reqs.length && ok; i++) {
          if (est(reqs[i], visto) !== 'aprobado') { ok = false; }
        }
        for (var j = 0; j < uno.length && ok; j++) {
          var grupo = uno[j] || [];
          var alguno = false;
          for (var k = 0; k < grupo.length; k++) {
            if (est(grupo[k], visto) === 'aprobado') { alguno = true; break; }
          }
          if (!alguno) { ok = false; }
        }
        v = ok ? 'disponible' : 'bloqueado';
      }
      memo[cod] = v;
      return v;
    }

    var todos = Object.keys(cat);
    Object.keys(aprob).forEach(function (c) { if (todos.indexOf(c) < 0) { todos.push(c); } });
    m.ramos.forEach(function (r) {
      var c = codigo(r.codigo);
      if (c && todos.indexOf(c) < 0) { todos.push(c); }
    });
    todos.forEach(function (c) { est(c); });

    var out = {};
    todos.forEach(function (c) { out[c] = memo[c]; });
    return out;
  }

  function aprobadosSet() {
    var m = estado(), out = {};
    Object.keys(m.aprobados).forEach(function (c) { if (m.aprobados[c]) { out[c] = true; } });
    return out;
  }

  function estados() { return calcularCon(aprobadosSet()); }

  /* --------------------------------------------------------- semestres ------
     Las columnas las decide `MimoComun.NIVELES()` (una sola implementacion: la del
     catalogo). Aqui solo se traducen a la forma del motor. */
  function getSemestres() {
    var manual = (estado().ajustes && estado().ajustes.orden) || {};
    return Mimo.NIVELES().map(function (col) {
      var cursos = col.ramos.slice();
      var orden = manual[String(col.nivel)];
      if (Array.isArray(orden)) {
        // El orden manual de la columna (los botones subir/bajar) manda, pero solo
        // para los ramos que siguen en ella: uno movido de nivel no deja fantasma.
        var out = [], puesto = {};
        orden.forEach(function (c) {
          if (cursos.indexOf(c) >= 0 && !puesto[c]) { puesto[c] = true; out.push(c); }
        });
        cursos.forEach(function (c) { if (!puesto[c]) { out.push(c); } });
        cursos = out;
      }
      return { n: col.nivel, titulo: col.titulo, cursos: cursos };
    });
  }

  function getCursosDeSemestre(n) {
    var num = Number(n);
    if (!isFinite(num)) { return []; }
    var out = [], visto = {};
    var cols = getSemestres();
    for (var i = 0; i < cols.length; i++) {
      if (cols[i].n !== num) { continue; }
      cols[i].cursos.forEach(function (c) {
        if (!visto[c]) { visto[c] = true; out.push(c); }
      });
    }
    var cat = catalogo();
    Object.keys(cat).forEach(function (cod) {
      if (cat[cod].en_malla === false) { return; }
      if (Number(cat[cod].semestre_num) === num && !visto[cod]) { visto[cod] = true; out.push(cod); }
    });
    return out;
  }

  /* --------------------------------------------------------------- API ------ */
  function getCurso(cod) { return catalogo()[codigo(cod)] || null; }
  function getEstadoCurso(cod) { return estados()[codigo(cod)] || 'bloqueado'; }

  function getRamosActivos() {
    return estado().ramos.map(function (r) {
      return {
        codigo: codigo(r.codigo),
        nombre: texto(r.nombre) || codigo(r.codigo),
        creditos: numero(r.creditos, 0),
        nivel: numero(r.nivel, 99)
      };
    });
  }

  function getAprobados() { return aprobadosSet(); }
  function getCatalogo() { return catalogo(); }
  function getAjustes() { return estado().ajustes; }

  function getNota(cod) {
    var n = estado().notas[codigo(cod)];
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  function requisitosFaltantes(cod) {
    var e = estados();
    var c = catalogo()[codigo(cod)] || {};
    var faltan = (c.requisitos || []).filter(function (r) { return e[r] !== 'aprobado'; });
    (c.requisitos_o || []).forEach(function (g) {
      var alguno = g.some(function (r) { return e[r] === 'aprobado'; });
      if (!alguno) { faltan.push(g.join(' o ')); }
    });
    return faltan;
  }

  function inverso() {
    var cat = catalogo(), inv = {};
    Object.keys(cat).forEach(function (cod) {
      var c = cat[cod];
      var fuentes = (c.requisitos || []).concat(listaGrupos(c.requisitos_o).reduce(function (a, g) { return a.concat(g); }, []));
      fuentes.forEach(function (r) {
        if (!r || r === cod) { return; }
        (inv[r] = inv[r] || []).push(cod);
      });
    });
    Object.keys(inv).forEach(function (k) { inv[k].sort(); });
    return inv;
  }

  function desbloquea(cod) { return (inverso()[codigo(cod)] || []).slice(); }

  /* Portado de malla/03-dibujo.js:62-72. Se conserva el primer orden de aparicion
     y se quita el codigo repetido: la vista pinta la linea y no debe listar dos
     veces el mismo ramo cuando dos caminos llegan a el. */
  function cadena(cod, direccion) {
    var cat = catalogo();
    var raiz = codigo(cod);
    var out = [], puestos = {};
    function andar(c, visto) {
      if (visto[c]) { return; }
      visto[c] = true;
      var cc = cat[c] || {};
      var base = (direccion === 'antes')
        ? (cc.requisitos || []).concat(listaGrupos(cc.requisitos_o).reduce(function (a, g) { return a.concat(g); }, []))
        : desbloquea(c);
      base.forEach(function (x) {
        if (!puestos[x] && x !== raiz) { puestos[x] = true; out.push(x); }
        andar(x, visto);
      });
    }
    andar(raiz, {});
    return out;
  }

  function herederoDe(cod, seleccion) {
    if (!seleccion) { return true; }
    if (cod === seleccion) { return true; }
    return cadena(seleccion, 'antes').indexOf(cod) >= 0 || cadena(seleccion, 'despues').indexOf(cod) >= 0;
  }

  function esAnual(cod) { return !!(catalogo()[codigo(cod)] || {}).anual; }

  function semestresQueOcupa(cod) {
    if (!esAnual(cod)) { return 1; }
    var n = parseInt((catalogo()[codigo(cod)] || {}).semestres, 10);
    return n > 1 ? n : 2;
  }

  function creditosAprobados() {
    var cat = catalogo(), e = estados(), total = 0;
    Object.keys(cat).forEach(function (cod) {
      if (cat[cod].en_malla === false) { return; }
      if (e[cod] !== 'aprobado') { return; }
      total += numero(cat[cod].creditos, 0);
    });
    return total;
  }

  function simularCon(aprobados) {
    var aprob = {};
    if (Array.isArray(aprobados)) {
      aprobados.forEach(function (c) { var k = codigo(c); if (k) { aprob[k] = true; } });
    } else if (esObjeto(aprobados)) {
      Object.keys(aprobados).forEach(function (c) { if (aprobados[c]) { aprob[codigo(c)] = true; } });
    }
    return calcularCon(aprob);
  }

  /* --------------------------------------------------------- escrituras ----- */
  function aprobar(cod, si) {
    cod = codigo(cod);
    if (!cod) { return false; }
    var m = estado();
    if (si === false) { delete m.aprobados[cod]; } else { m.aprobados[cod] = true; }
    guardar(si === false ? (cod + ' ya no está aprobado') : (cod + ' aprobado'));
    return true;
  }

  function ponerNota(cod, nota) {
    cod = codigo(cod);
    var m = estado();
    var n = Number(nota);
    if (!cod) { return false; }
    if (nota === null || nota === '' || !isFinite(n)) { delete m.notas[cod]; } else { m.notas[cod] = n; }
    guardar('');
    return true;
  }

  function quitarRamo(cod) {
    cod = codigo(cod);
    var m = estado();
    var antes = m.ramos.length;
    m.ramos = m.ramos.filter(function (r) { return codigo(r.codigo) !== cod; });
    if (m.ramos.length === antes) { return false; }
    guardar(cod + ' fuera de en curso');
    return true;
  }

  function borrarCurso(cod) {
    cod = codigo(cod);
    if (!getCurso(cod)) { return false; }
    Mimo.borrarRamo(cod);
    var m = estado();
    delete m.aprobados[cod];
    delete m.notas[cod];
    m.ramos = m.ramos.filter(function (r) { return codigo(r.codigo) !== cod; });
    guardar(cod + ' borrado del catálogo');
    return true;
  }

  /* Alta y edicion del ramo en UNA puerta. Devuelve {ok, codigo, nuevo} o
     {ok:false, error}. El texto de requisitos usa la notacion del sustrato:
     ';' separa requisitos (Y) y '|' alternativas (O). */
  function guardarCurso(datos) {
    datos = datos || {};
    var cod = codigo(datos.codigo);
    if (!cod) { return { ok: false, error: 'falta-codigo' }; }
    if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(cod)) { return { ok: false, error: 'codigo-invalido' }; }
    var nivel = Math.round(numero(datos.nivel, 1));
    if (!isFinite(nivel) || nivel <= 0) { nivel = 1; }
    if (nivel > 99) { nivel = 99; }
    var req = Mimo.requisitosDesdeTexto(texto(datos.requisitos));
    var yaEstaba = !!getCurso(cod);
    Mimo.ramoEnCatalogo(cod, {
      nombre: texto(datos.nombre) || cod,
      creditos: Math.max(0, numero(datos.creditos, 0)),
      nivel: nivel,
      requisitos: req.requisitos,
      requisitos_o: req.requisitos_o,
      anual: !!datos.anual,
      tipo: texto(datos.tipo) || 'obligatorio',
      secciones: listaCodigos(datos.secciones)
    });
    definirSecciones(listaCodigos(datos.secciones));
    guardar((yaEstaba ? 'Ramo actualizado: ' : 'Ramo agregado: ') + cod);
    return { ok: true, codigo: cod, nuevo: !yaEstaba };
  }

  /* Las secciones son datos de la carrera (sigla, nombre, color, niveles). El
     editor puede nombrar una sigla nueva; aqui se da de alta sin inventar color:
     el color lo pone quien lo sepa, y la reticula no lo usa para nada mas. */
  function definirSecciones(siglas) {
    var m = estado(), hay = {}, nuevas = false;
    m.secciones.forEach(function (s) { hay[codigo(s.sigla)] = true; });
    siglas.forEach(function (sig) {
      if (!hay[sig]) {
        m.secciones.push({ sigla: sig, nombre: sig, color: '', niveles: [] });
        hay[sig] = true;
        nuevas = true;
      }
    });
    return nuevas;
  }

  function moverNivel(cod, nivel) {
    cod = codigo(cod);
    if (!getCurso(cod)) { return null; }
    var n = Math.round(numero(nivel, 1));
    if (!isFinite(n) || n <= 0) { n = 1; }
    if (n > 99) { n = 99; }
    Mimo.ramoEnCatalogo(cod, { nivel: n });
    guardar(cod + ' a la columna ' + n);
    return n;
  }

  /* Mueve una columna una posicion y guarda el orden ENTERO en `E.malla.niveles`,
     que es lo que respeta NIVELES(). Los electivos no se mueven del final. */
  function reordenarNivel(nivel, direccion) {
    var n = Number(nivel);
    var cols = getSemestres();
    var orden = cols.map(function (c) { return c.n; });
    var i = orden.indexOf(n);
    if (i < 0) { return orden; }
    var j = (direccion === 'izq' || direccion === 'antes') ? i - 1 : i + 1;
    if (j < 0 || j >= orden.length) { return orden; }
    orden.splice(i, 1);
    orden.splice(j, 0, n);
    var i99 = orden.indexOf(99);
    if (i99 >= 0) { orden.splice(i99, 1); orden.push(99); }
    var titulos = {};
    cols.forEach(function (c) { titulos[c.n] = c.titulo; });
    estado().niveles = orden.map(function (k) {
      return { nivel: k, titulo: titulos[k] || (k === 99 ? 'Electivos' : 'Nivel ' + k), ramos: [] };
    });
    guardar('Columnas reordenadas');
    return orden;
  }

  function tituloNivel(nivel, titulo) {
    var n = Number(nivel);
    if (!isFinite(n) || n <= 0) { return false; }
    var m = estado();
    var cols = getSemestres();
    var titulos = {};
    cols.forEach(function (c) { titulos[c.n] = c.titulo; });
    titulos[n] = texto(titulo) || (n === 99 ? 'Electivos' : 'Nivel ' + n);
    var orden = cols.map(function (c) { return c.n; });
    m.niveles = orden.map(function (k) { return { nivel: k, titulo: titulos[k], ramos: [] }; });
    guardar('Columna renombrada');
    return true;
  }

  /* --------------------------------------------------- importar y exportar ---
     Una sola forma de leer: cada formato se convierte en una lista de FILAS con las
     mismas claves y de ahi sale todo. Asi el pegado, el CSV y el JSON no pueden
     divergir, que es el fallo clasico de tener tres lectores. */

  var ALIAS = {
    codigo: ['codigo', 'sigla', 'code', 'clave'],
    nombre: ['nombre', 'name', 'asignatura', 'ramo'],
    creditos: ['creditos', 'cr', 'creditos_sct', 'sct'],
    nivel: ['nivel', 'semestre', 'level', 'sem'],
    requisitos: ['requisitos', 'prerequisitos', 'reqs', 'requisito'],
    tipo: ['tipo', 'type'],
    anual: ['anual', 'annual'],
    aprobado: ['aprobado', 'approved', 'aprobada'],
    en_curso: ['en_curso', 'encurso', 'curso', 'activo'],
    secciones: ['secciones', 'seccion', 'section']
  };

  function sinTildes(s) {
    var t = String(s === undefined || s === null ? '' : s).toLowerCase();
    if (t.normalize) { t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    return t.replace(/^\s+|\s+$/g, '');
  }

  function partirTabla(txt, sep) {
    var filas = [], fila = [], campo = '', comillas = false, i = 0;
    txt = String(txt || '').replace(/\r\n?/g, '\n');
    while (i < txt.length) {
      var c = txt.charAt(i);
      if (comillas) {
        if (c === '"') {
          if (txt.charAt(i + 1) === '"') { campo += '"'; i += 2; continue; }
          comillas = false; i++; continue;
        }
        campo += c; i++; continue;
      }
      if (c === '"') { comillas = true; i++; continue; }
      if (c === sep) { fila.push(campo); campo = ''; i++; continue; }
      if (c === '\n') { fila.push(campo); filas.push(fila); fila = []; campo = ''; i++; continue; }
      campo += c; i++;
    }
    fila.push(campo);
    filas.push(fila);
    return filas.filter(function (f) {
      return f.some(function (x) { return String(x).replace(/^\s+|\s+$/g, '') !== ''; });
    });
  }

  function leerTabla(txt, sep) {
    var filas = partirTabla(txt, sep);
    if (!filas.length) { return []; }
    var cab = filas[0].map(sinTildes);
    var tieneCab = false;
    var i;
    for (i = 0; i < cab.length; i++) {
      if (cab[i] === 'codigo' || cab[i] === 'sigla' || cab[i] === 'code') { tieneCab = true; }
    }
    var mapa = null;
    if (tieneCab) {
      mapa = {};
      for (i = 0; i < cab.length; i++) { mapa[cab[i]] = i; }
      filas.shift();
    }
    var out = [];
    filas.forEach(function (f) {
      var obj = {}, claves = Object.keys(ALIAS);
      if (mapa) {
        claves.forEach(function (k) {
          var alias = ALIAS[k];
          for (var j = 0; j < alias.length; j++) {
            if (mapa[alias[j]] !== undefined) { obj[k] = f[mapa[alias[j]]]; break; }
          }
        });
      } else {
        obj = { codigo: f[0], nombre: f[1], creditos: f[2], nivel: f[3], requisitos: f[4], tipo: f[5], anual: f[6] };
      }
      out.push(obj);
    });
    return out;
  }

  /* PEGADO DESDE UNA FOTO. Portado de malla/01-importar.js:55-96: lineas sueltas
     "MA1001 Calculo I" y titulos "Semestre 3". Si el texto no tiene pinta de lista
     de ramos se devuelve null y quien llama avisa; no se arma una malla con basura. */
  var RE_CODIGO_NOMBRE = /^([A-Za-z]{2,6})\s*[- ]?\s*(\d{3,4})\s*([A-Za-z]?)\s+(\S.*)$/;
  var RE_SOLO_CODIGO = /^([A-Za-z]{2,6})\s*[- ]?\s*(\d{3,4})\s*([A-Za-z]?)$/;
  var RE_NIVEL = /^(?:semestre|nivel|ano)\s*(\d{1,2})\b|^(\d{1,2})\s*(?:er|do|to|mo|vo|no|[º°])?\s*(?:semestre|nivel|ano)\b/i;

  function leerPegado(txt) {
    var lineas = String(txt || '').split(/\n/);
    var utiles = lineas.filter(function (l) { return l.replace(/^\s+|\s+$/g, '') !== ''; });
    if (!utiles.length) { return null; }
    if (/[,;\t|]/.test(utiles[0])) { return null; }     // esto es una tabla: que lo lea el otro
    var filas = [], nivel = 1, titulos = 0;
    utiles.forEach(function (cruda) {
      var linea = cruda.replace(/^\s+|\s+$/g, '');
      var ms = sinTildes(linea).match(RE_NIVEL);
      if (ms) {
        var n = parseInt(ms[1] || ms[2], 10);
        if (n >= 1 && n <= 20) { nivel = n; titulos++; }
        return;
      }
      var m = linea.match(RE_CODIGO_NOMBRE) || linea.match(RE_SOLO_CODIGO);
      if (!m) { return; }
      filas.push({
        codigo: (m[1] + m[2] + (m[3] || '')).toUpperCase(),
        nombre: (m[4] || '').replace(/^\s+|\s+$/g, ''),
        creditos: 0, nivel: nivel, requisitos: [], tipo: 'obligatorio', anual: false
      });
    });
    if (filas.length < 2) { return null; }
    if (filas.length + titulos < utiles.length * 0.6) { return null; }
    return filas;
  }

  function busqueda(obj, claves) {
    for (var i = 0; i < claves.length; i++) {
      if (obj[claves[i]] !== undefined && obj[claves[i]] !== null && obj[claves[i]] !== '') { return obj[claves[i]]; }
    }
    return undefined;
  }

  /* Convierte una fila en la entrada del catalogo. Acepta requisitos como texto
     ('A;B|C') o como listas (la forma del respaldo viejo) y `requisitos_o` aparte. */
  function cursoDesdeFila(f) {
    var cod = codigo(busqueda(f, ALIAS.codigo));
    if (!cod) { return null; }
    var nivel = numero(busqueda(f, ALIAS.nivel), 99);
    if (!isFinite(nivel) || nivel <= 0) { nivel = 99; }
    if (nivel > 99) { nivel = 99; }
    var reqCrudo = busqueda(f, ALIAS.requisitos);
    var req;
    if (typeof reqCrudo === 'string') {
      req = Mimo.requisitosDesdeTexto(reqCrudo);
    } else {
      req = { requisitos: listaCodigos(reqCrudo), requisitos_o: listaGrupos(f.requisitos_o) };
    }
    var secs = busqueda(f, ALIAS.secciones);
    return {
      codigo: cod,
      datos: {
        nombre: texto(busqueda(f, ALIAS.nombre)) || cod,
        creditos: Math.max(0, numero(busqueda(f, ALIAS.creditos), 0)),
        nivel: nivel,
        semestre_num: nivel,
        tipo: texto(busqueda(f, ALIAS.tipo)) || 'obligatorio',
        anual: !!busqueda(f, ALIAS.anual) && busqueda(f, ALIAS.anual) !== '0',
        en_malla: f.en_malla === false ? false : true,
        requisitos: req.requisitos,
        requisitos_o: req.requisitos_o,
        secciones: typeof secs === 'string' ? listaCodigos(secs) : listaCodigos(secs)
      }
    };
  }

  function ramoDesdeFila(f, cat) {
    var cod = codigo(busqueda(f, ALIAS.codigo) || f.codigo);
    if (!cod) { return null; }
    var c = cat[cod] || {};
    var nivel = numero(busqueda(f, ALIAS.nivel), c.nivel);
    if (!isFinite(nivel) || nivel <= 0) { nivel = c.nivel || 99; }
    return {
      codigo: cod,
      nombre: texto(busqueda(f, ALIAS.nombre)) || texto(c.nombre) || cod,
      creditos: numero(busqueda(f, ALIAS.creditos), numero(c.creditos, 0)),
      nivel: nivel
    };
  }

  /* El respaldo formato 2 (el del prototipo) y el JSON simple de una lista. */
  function leerJson(txt) {
    var j;
    try { j = JSON.parse(txt); } catch (e) { return { error: 'json-mal-escrito' }; }
    if (Array.isArray(j)) { return { filas: j }; }
    if (!esObjeto(j)) { return { error: 'json-sin-ramos' }; }
    if (esObjeto(j.estado) || esObjeto(j.catalogo)) {
      var est = esObjeto(j.estado) ? j.estado : j;
      var cat = esObjeto(est.catalogo) ? est.catalogo : (esObjeto(j.catalogo) ? j.catalogo : {});
      var aprob = esObjeto(est.aprobados) ? est.aprobados : {};
      var ramos = [];
      if (Array.isArray(est.extras)) {
        for (var i = 0; i < est.extras.length && !ramos.length; i++) {
          if (esObjeto(est.extras[i]) && Array.isArray(est.extras[i].ramos)) { ramos = est.extras[i].ramos; }
        }
      }
      var notas = {};
      if (esObjeto(est.sem)) {
        Object.keys(est.sem).forEach(function (k) {
          var sem = est.sem[k];
          if (!esObjeto(sem) || !esObjeto(sem.metas_ramo)) { return; }
          Object.keys(sem.metas_ramo).forEach(function (cod) {
            var meta = sem.metas_ramo[cod];
            if (esObjeto(meta) && typeof meta.nota === 'number') { notas[codigo(cod)] = meta.nota; }
          });
        });
      }
      var filas = Object.keys(cat).map(function (k) {
        var entrada = clon(cat[k]) || {};
        entrada.codigo = k;
        return entrada;
      });
      return {
        filas: filas,
        aprobados: aprob,
        ramos: ramos,
        notas: notas,
        niveles: Array.isArray(j.niveles) ? j.niveles : [],
        secciones: Array.isArray(j.secciones) ? j.secciones : []
      };
    }
    var lista = j.ramos || j.cursos || j.asignaturas || j.malla;
    if (!Array.isArray(lista)) { return { error: 'json-sin-ramos' }; }
    return {
      filas: lista,
      niveles: Array.isArray(j.niveles) ? j.niveles : [],
      secciones: Array.isArray(j.secciones) ? j.secciones : []
    };
  }

  /* Pega la malla entera: es una FOTO, no una fusion. Se reemplaza el catalogo y el
     estado de malla, y se dice en el aviso (HUECO declarado: no hay importacion
     parcial; fusionar dos mallas es otra tarea). */
  function aplicar(datos) {
    var e = Mimo.leer();
    var catNuevo = {};
    var filas = datos.filas || [];
    filas.forEach(function (f) {
      var r = cursoDesdeFila(esObjeto(f) ? f : {});
      if (r) { catNuevo[r.codigo] = r.datos; }
    });
    if (!Object.keys(catNuevo).length) { return { ok: false, error: 'sin-ramos' }; }

    e.catalogo = catNuevo;
    Mimo.invalidarCatalogo();
    Mimo.recalcularDesbloquea();

    var m = estado();
    m.aprobados = {};
    if (esObjeto(datos.aprobados)) {
      Object.keys(datos.aprobados).forEach(function (k) {
        if (datos.aprobados[k]) { m.aprobados[codigo(k)] = true; }
      });
    }
    filas.forEach(function (f) {
      if (!esObjeto(f)) { return; }
      var cod = codigo(busqueda(f, ALIAS.codigo));
      if (cod && esSi(busqueda(f, ALIAS.aprobado))) { m.aprobados[cod] = true; }
    });

    m.ramos = [];
    var vistos = {};
    (datos.ramos && datos.ramos.length ? datos.ramos : filas.filter(function (f) {
      return esObjeto(f) && esSi(busqueda(f, ALIAS.en_curso));
    })).forEach(function (f) {
      var r = ramoDesdeFila(esObjeto(f) ? f : {}, catNuevo);
      if (r && !vistos[r.codigo]) { vistos[r.codigo] = true; m.ramos.push(r); }
    });

    m.notas = esObjeto(datos.notas) ? clon(datos.notas) : {};
    m.niveles = [];
    if (Array.isArray(datos.niveles)) {
      datos.niveles.forEach(function (n) {
        var num = Number(esObjeto(n) ? n.nivel : n);
        if (!isFinite(num) || num <= 0) { return; }
        m.niveles.push({ nivel: num, titulo: texto(esObjeto(n) ? n.titulo : '') || (num === 99 ? 'Electivos' : 'Nivel ' + num), ramos: [] });
      });
    }
    m.secciones = Array.isArray(datos.secciones) ? clon(datos.secciones) : [];
    m.importado = { codigos: Object.keys(catNuevo).sort(), cuando: ahora() };
    guardar('Malla importada: ' + Object.keys(catNuevo).length + ' ramos');
    return { ok: true, resumen: { cursos: Object.keys(catNuevo).length, aprobados: Object.keys(m.aprobados).length, activos: m.ramos.length } };
  }

  function importarMalla(txt, formato) {
    var bruto = String(txt === undefined || txt === null ? '' : txt).replace(/^\uFEFF/, '').replace(/^\s+|\s+$/g, '');
    if (!bruto) { return { ok: false, error: 'vacio' }; }
    var f = texto(formato).toLowerCase();
    if (!f || f === 'auto') {
      if (/^[\[{]/.test(bruto)) { f = 'json'; }
      else if (bruto.indexOf('\t') >= 0) { f = 'tsv'; }
      else if (bruto.indexOf(',') >= 0) { f = 'csv'; }
      else if (bruto.indexOf(';') >= 0) { f = 'csv'; }
      else { f = 'pegado'; }
    }
    var datos;
    if (f === 'json') {
      datos = leerJson(bruto);
      if (datos.error) { return { ok: false, error: datos.error }; }
    } else if (f === 'csv' || f === 'tsv') {
      var sep = f === 'tsv' ? '\t' : (bruto.split('\n')[0].indexOf(';') >= 0 && bruto.split('\n')[0].indexOf(',') < 0 ? ';' : ',');
      datos = { filas: leerTabla(bruto, sep) };
      if (!datos.filas.length) { return { ok: false, error: 'sin-ramos' }; }
    } else {
      var filas = leerPegado(bruto);
      if (!filas) { return { ok: false, error: 'pegado-no-reconocido' }; }
      datos = { filas: filas };
    }
    return aplicar(datos);
  }

  function reqTexto(c) {
    var partes = (c.requisitos || []).slice();
    (c.requisitos_o || []).forEach(function (g) { partes.push(g.join('|')); });
    return partes.join(';');
  }

  function celda(v, sep) {
    var s = String(v === undefined || v === null ? '' : v);
    if (s.indexOf('"') >= 0 || s.indexOf(sep) >= 0 || s.indexOf('\n') >= 0) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function enCursoSet() {
    var out = {};
    estado().ramos.forEach(function (r) { out[codigo(r.codigo)] = true; });
    return out;
  }

  function exportarTabla(sep) {
    var m = estado();
    var aprob = aprobadosSet(), curso = enCursoSet();
    var cab = ['codigo', 'nombre', 'creditos', 'nivel', 'requisitos', 'tipo', 'anual', 'aprobado', 'en_curso', 'secciones'];
    var filas = [cab.join(sep)];
    getSemestres().forEach(function (col) {
      col.cursos.forEach(function (cod) {
        var c = getCurso(cod) || {};
        var campos = [
          cod,
          c.nombre || cod,
          numero(c.creditos, 0),
          numero(c.nivel, 99),
          reqTexto(c),
          c.tipo || 'obligatorio',
          c.anual ? '1' : '0',
          aprob[cod] ? '1' : '',
          curso[cod] ? '1' : '',
          (c.secciones || []).join('|')
        ];
        filas.push(campos.map(function (x) { return celda(x, sep); }).join(sep));
      });
    });
    return filas.join('\n') + '\n';
  }

  function exportarMalla(formato) {
    var f = texto(formato).toLowerCase() || 'json';
    if (f === 'csv' || f === 'tsv') { return exportarTabla(f === 'tsv' ? '\t' : ','); }
    var e = Mimo.leer();
    var m = estado();
    var salida = {
      formato: 2,
      estado: {
        v: 3,
        catalogo: clon(e.catalogo),
        aprobados: clon(m.aprobados),
        importado: clon(m.importado),
        extras: [{ ramos: clon(m.ramos) }],
        ajustes: clon(m.ajustes)
      },
      niveles: clon(m.niveles),
      secciones: clon(m.secciones)
    };
    var clavesNotas = Object.keys(m.notas);
    if (clavesNotas.length) {
      salida.estado.activo = 'malla';
      salida.estado.sem = { malla: { metas_ramo: {} } };
      clavesNotas.forEach(function (k) {
        salida.estado.sem.malla.metas_ramo[k] = { nota: m.notas[k] };
      });
    }
    return JSON.stringify(salida, null, 2);
  }

  /* ------------------------------------------------------------- resumen ---- */
  function resumen() {
    var cols = getSemestres();
    var n = 0;
    cols.forEach(function (c) { n += c.cursos.length; });
    return {
      columnas: cols.length,
      ramos: n,
      enCurso: estado().ramos.length,
      aprobados: Object.keys(aprobadosSet()).length,
      creditos: creditosAprobados(),
      secciones: estado().secciones.length,
      importado: estado().importado
    };
  }

  return {
    // catalogo y estado
    getCurso: getCurso,
    getCatalogo: getCatalogo,
    getAjustes: getAjustes,
    getNota: getNota,
    getEstadoCurso: getEstadoCurso,
    getRamosActivos: getRamosActivos,
    getAprobados: getAprobados,
    getCursosDeSemestre: getCursosDeSemestre,
    getSemestres: getSemestres,

    // el grafo y los numeros
    estados: estados,
    requisitosFaltantes: requisitosFaltantes,
    desbloquea: desbloquea,
    cadena: cadena,
    herederoDe: herederoDe,
    esAnual: esAnual,
    semestresQueOcupa: semestresQueOcupa,
    creditosAprobados: creditosAprobados,
    simularCon: simularCon,

    // escrituras (la vista no toca el almacen directamente)
    aprobar: aprobar,
    ponerNota: ponerNota,
    quitarRamo: quitarRamo,
    borrarCurso: borrarCurso,
    guardarCurso: guardarCurso,
    moverNivel: moverNivel,
    reordenarNivel: reordenarNivel,
    tituloNivel: tituloNivel,

    // texto: ida y vuelta
    importarMalla: importarMalla,
    exportarMalla: exportarMalla,
    resumen: resumen
  };
})();

if (typeof window !== 'undefined') { window.MimoMallaMotor = MimoMallaMotor; }

/* ============================================================================
   LA VISTA. Toma el DOM una sola vez (`D`), como `js/tiempo.js`. No guarda nada:
   todo lo que escribe pasa por el motor. Pinta la reticula, el editor, el panel de
   datos (importar/exportar) y el simulador.
   ============================================================================ */
var MimoMallaUI = (function () {
  'use strict';

  var Mimo = window.MimoComun;
  var D = (typeof window !== 'undefined' && window.document) ? window.document : null;

  /* Los rotulos. No van en `js/i18n.js` porque ese fichero es de T003 y este bloque
     no lo edita (limite del encargo); viven aqui, en los dos idiomas, y se repintan
     al cambiar de idioma. HUECO declarado en evidencia-malla.txt. */
  var TEXTOS = {
    es: {
      'mapa': 'Malla del semestre',
      'sinRamos': 'El catálogo está vacío. Crea un ramo o importa tu malla.',
      'nuevo': 'Nuevo ramo',
      'datos': 'Importar y exportar',
      'simulador': 'Simulador',
      'estado.aprobado': 'aprobado',
      'estado.curso': 'en curso',
      'estado.disponible': 'disponible',
      'estado.bloqueado': 'bloqueado',
      'resumen': '{ramos} ramos · {curso} en curso · {aprobados} aprobados · {creditos} créditos',
      'simulando': 'simulación con {n} ramo(s); nada guardado',
      'mapa.region': 'Malla del semestre, columnas por nivel',
      'col.izq': 'Mover esta columna a la izquierda',
      'col.der': 'Mover esta columna a la derecha',
      'editar': 'Editar',
      'aprobar': 'Aprobar',
      'retirar': 'Quitar aprobación',
      'curso': 'En curso',
      'quitarCurso': 'Quitar de en curso',
      'subir': 'Subir en la columna',
      'bajar': 'Bajar en la columna',
      'anual': 'anual',
      'editor.nuevo': 'Ramo nuevo',
      'editor.editar': 'Editar {codigo}',
      'campo.codigo': 'Código',
      'campo.nombre': 'Nombre',
      'campo.creditos': 'Créditos',
      'campo.nivel': 'Nivel (99 = electivos)',
      'campo.requisitos': 'Requisitos',
      'campo.secciones': 'Secciones (siglas, separadas por coma)',
      'campo.anual': 'Ocupa dos semestres (anual)',
      'pista.requisitos': 'Separa con ; los requisitos y con | las alternativas: MA1001;FI2004|IQ2212',
      'guardar': 'Guardar',
      'cancelar': 'Cancelar',
      'borrar': 'Borrar ramo',
      'borrar.seguro': '¿Borrar {codigo} del catálogo?',
      'borrar.si': 'Sí, borrar',
      'error.falta-codigo': 'Falta el código.',
      'error.codigo-invalido': 'El código va de 2 a 12 caracteres: letras, números o guion.',
      'panel.datos': 'Importar y exportar',
      'panel.pista': 'Pega aquí el JSON exportado, un CSV/TSV con cabecera o las líneas copiadas de una foto. Importar reemplaza la malla entera.',
      'importar.pegado': 'Importar lo pegado',
      'importar.archivo': 'Archivo…',
      'exportar.csv': 'Exportar CSV',
      'exportar.json': 'Exportar malla.json',
      'cerrar': 'Cerrar',
      'panel.simulador': 'Simulador: ¿qué pasa si apruebo?',
      'panel.simPista': 'Marca ramos y mira qué se desbloquea. No se guarda nada.',
      'sim.desbloquea': 'Se desbloquean: {lista}',
      'sim.nada': 'No se desbloquea nada nuevo.',
      'import.ok': 'Malla importada: {cursos} ramos.',
      'import.error': 'No se pudo importar: {error}',
      'export.hecho': 'Exportado abajo: cópialo o guárdalo.',
      'nota': 'Nota {n}'
    },
    en: {
      'mapa': 'Semester grid',
      'sinRamos': 'The catalogue is empty. Create a course or import your grid.',
      'nuevo': 'New course',
      'datos': 'Import and export',
      'simulador': 'Simulator',
      'estado.aprobado': 'passed',
      'estado.curso': 'taking',
      'estado.disponible': 'available',
      'estado.bloqueado': 'locked',
      'resumen': '{ramos} courses · {curso} taking · {aprobados} passed · {creditos} credits',
      'simulando': 'simulating {n} course(s); nothing saved',
      'mapa.region': 'Semester grid, one column per level',
      'col.izq': 'Move this column left',
      'col.der': 'Move this column right',
      'editar': 'Edit',
      'aprobar': 'Mark passed',
      'retirar': 'Unmark passed',
      'curso': 'Taking',
      'quitarCurso': 'Remove from taking',
      'subir': 'Move up',
      'bajar': 'Move down',
      'anual': 'full year',
      'editor.nuevo': 'New course',
      'editor.editar': 'Edit {codigo}',
      'campo.codigo': 'Code',
      'campo.nombre': 'Name',
      'campo.creditos': 'Credits',
      'campo.nivel': 'Level (99 = electives)',
      'campo.requisitos': 'Prerequisites',
      'campo.secciones': 'Sections (codes, comma separated)',
      'campo.anual': 'Spans two semesters (full year)',
      'pista.requisitos': 'Separate requirements with ; and alternatives with |: MA1001;FI2004|IQ2212',
      'guardar': 'Save',
      'cancelar': 'Cancel',
      'borrar': 'Delete course',
      'borrar.seguro': 'Delete {codigo} from the catalogue?',
      'borrar.si': 'Yes, delete',
      'error.falta-codigo': 'The code is missing.',
      'error.codigo-invalido': 'The code is 2 to 12 characters: letters, digits or hyphen.',
      'panel.datos': 'Import and export',
      'panel.pista': 'Paste the exported JSON, a CSV/TSV with a header, or lines copied from a photo here. Importing replaces the whole grid.',
      'importar.pegado': 'Import pasted text',
      'importar.archivo': 'File…',
      'exportar.csv': 'Export CSV',
      'exportar.json': 'Export malla.json',
      'cerrar': 'Close',
      'panel.simulador': 'Simulator: what if I pass?',
      'panel.simPista': 'Tick courses and see what unlocks. Nothing is saved.',
      'sim.desbloquea': 'Unlocks: {lista}',
      'sim.nada': 'Nothing new unlocks.',
      'import.ok': 'Grid imported: {cursos} courses.',
      'import.error': 'Import failed: {error}',
      'export.hecho': 'Exported below: copy or save it.',
      'nota': 'Grade {n}'
    }
  };

  var _idioma = 'es';
  var _estado = { editor: null, nivel: 1, panel: '', confirmar: null, sim: {}, mensaje: '' };
  var _oyentes = null;
  var _raf = null;

  function idiomaActual() {
    try {
      if (window.MimoI18n && typeof window.MimoI18n.idiomaActual === 'function') {
        var i = window.MimoI18n.idiomaActual();
        if (i === 'es' || i === 'en') { return i; }
      }
    } catch (e) { /* sin i18n se queda en es */ }
    return 'es';
  }

  function t(clave, vars) {
    var tabla = TEXTOS[_idioma] || TEXTOS.es;
    var s = tabla[clave];
    if (s === undefined) { s = TEXTOS.es[clave]; }
    if (s === undefined) { return clave; }
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function motor() { return window.MimoMallaMotor; }

  function caja(nombre) { return D ? D.querySelector('[data-malla="' + nombre + '"]') : null; }

  function subirA(nodo, selector) {
    while (nodo && nodo !== D.body) {
      if (nodo.nodeType === 1) {
        if (nodo.matches && nodo.matches(selector)) { return nodo; }
      }
      nodo = nodo.parentNode;
    }
    return null;
  }

  /* ------------------------------------------------------------- pintar ----
     `pintar()` es el gancho que llama el armazon: pinta el hueco SOLO si esta
     virgen (el armazon acaba de rehacer la losa) y, si ya estaba pintado, solo
     refresca las cifras. Asi el armazon puede llamarlo en cada repintado y en
     cada resize sin borrar lo que el usuario este escribiendo en el editor.
     `repintar()` es la pintura entera, para cuando cambian los datos. */
  function pintar() {
    _idioma = idiomaActual();
    var mapa = caja('mapa');
    if (!mapa) { return; }
    if (mapa.getAttribute('data-pintado') === '1') { pintarResumen(); return; }
    repintar();
  }

  function repintar() {
    _idioma = idiomaActual();
    pintarBarra();
    pintarResumen();
    pintarMapa();
    pintarEditor();
    if (_estado.panel) { pintarPanel(); }
  }

  function boton(accion, clave, extra, datos) {
    return '<button class="btn btn--mini" type="button" data-malla-accion="' + accion + '"' +
      (datos || '') + '>' + esc(t(clave)) + '</button>';
  }

  function pintarBarra() {
    var barra = caja('barra');
    if (!barra) { return; }
    var html = '<button class="btn btn--primario" type="button" data-malla-accion="nuevo">' +
      esc(t('nuevo')) + '</button>' +
      boton('panel-datos', 'datos') +
      boton('panel-simulador', 'simulador');
    if (_estado.editor) {
      html += '<span class="malla__marca">' + esc(_estado.editor === 'nuevo' ? t('editor.nuevo') : _estado.editor) + '</span>';
    }
    barra.innerHTML = html;
  }

  function pintarResumen() {
    var p = caja('resumen');
    if (!p) { return; }
    var r = motor().resumen();
    var html = t('resumen', { ramos: r.ramos, curso: r.enCurso, aprobados: r.aprobados, creditos: r.creditos });
    if (r.importado && r.importado.cuando) {
      html += ' · ' + esc(r.importado.cuando);
    }
    var sim = Object.keys(_estado.sim).filter(function (k) { return _estado.sim[k]; });
    if (sim.length) { html += ' · ' + esc(t('simulando', { n: sim.length })); }
    if (_estado.mensaje) { html += ' · ' + esc(_estado.mensaje); }
    p.textContent = html;
  }

  function estadoDe(cod) { return motor().getEstadoCurso(cod); }

  function nodoRamo(cod, columna, fila, total, estados, simEstados) {
    var curso = motor().getCurso(cod) || {};
    var anual = motor().esAnual(cod);
    var est = estados[cod] || 'bloqueado';
    var aprobado = est === 'aprobado';
    var enCurso = est === 'curso';
    var div = D.createElement('div');
    div.className = 'ramo ramo--' + est + (anual ? ' ramo--anual' : '');
    div.setAttribute('data-malla', 'ramo');
    div.setAttribute('data-codigo', cod);
    div.setAttribute('data-estado', est);
    div.setAttribute('data-nivel', String(curso.nivel));
    div.setAttribute('data-anual', anual ? '1' : '0');
    if (simEstados && simEstados[cod] && simEstados[cod] !== est) {
      div.setAttribute('data-sim-estado', simEstados[cod]);
    }
    if (anual && columna + 1 < total) {
      div.style.gridColumn = (columna + 1) + ' / span 2';
    } else {
      div.style.gridColumn = String(columna + 1);
    }
    div.style.gridRow = String(fila + 2);

    var acc = '<button class="btn btn--mini" type="button" data-malla-accion="editar" data-codigo="' + esc(cod) + '">' + esc(t('editar')) + '</button>';
    acc += '<button class="btn btn--mini" type="button" data-malla-accion="aprobar" data-codigo="' + esc(cod) + '" aria-pressed="' + (aprobado ? 'true' : 'false') + '">' + esc(t(aprobado ? 'retirar' : 'aprobar')) + '</button>';
    acc += '<button class="btn btn--mini" type="button" data-malla-accion="curso" data-codigo="' + esc(cod) + '" aria-pressed="' + (enCurso ? 'true' : 'false') + '">' + esc(t(enCurso ? 'quitarCurso' : 'curso')) + '</button>';
    acc += '<button class="btn btn--mini" type="button" data-malla-accion="subir" data-codigo="' + esc(cod) + '" aria-label="' + esc(t('subir')) + '">↑</button>';
    acc += '<button class="btn btn--mini" type="button" data-malla-accion="bajar" data-codigo="' + esc(cod) + '" aria-label="' + esc(t('bajar')) + '">↓</button>';

    div.innerHTML =
      '<div class="ramo__cab">' +
        '<span class="ramo__cod">' + esc(cod) + '</span>' +
        '<span class="ramo__cred">' + esc(String(curso.creditos || 0)) + ' cr</span>' +
      '</div>' +
      '<span class="ramo__nom">' + esc(curso.nombre || cod) + '</span>' +
      '<span class="ramo__pie"><span class="ramo__estado">' + esc(t('estado.' + est)) + '</span>' +
        (anual ? '<span class="ramo__anual">' + esc(t('anual')) + '</span>' : '') +
      '</span>' +
      '<span class="ramo__acciones">' + acc + '</span>';
    return div;
  }

  function pintarMapa() {
    var mapa = caja('mapa');
    if (!mapa || !motor()) { return; }
    var cols = motor().getSemestres();
    mapa.innerHTML = '';
    mapa.setAttribute('data-pintado', '1');
    mapa.setAttribute('aria-label', t('mapa.region'));
    mapa.style.setProperty('--malla-cols', String(Math.max(1, cols.length)));
    if (!cols.length) {
      var vacio = D.createElement('p');
      vacio.className = 'malla__vacio';
      vacio.textContent = t('sinRamos');
      mapa.appendChild(vacio);
      return;
    }
    var estados = motor().estados();
    var simEstados = Object.keys(_estado.sim).length ? motor().simularCon(_estado.sim) : null;
    var total = cols.length;
    var ocupadas = [];
    var i, j, k;
    for (i = 0; i < total; i++) {
      ocupadas.push({});
      var cab = D.createElement('div');
      cab.className = 'malla__colcab';
      cab.setAttribute('data-columna', String(cols[i].n));
      cab.style.gridColumn = String(i + 1);
      cab.style.gridRow = '1';
      cab.innerHTML = '<span class="malla__coltit">' + esc(cols[i].titulo) + '</span>' +
        '<span class="malla__colacc">' +
          '<button class="btn btn--mini" type="button" data-malla-accion="col-izq" data-nivel="' + cols[i].n + '" aria-label="' + esc(t('col.izq')) + '">←</button>' +
          '<button class="btn btn--mini" type="button" data-malla-accion="col-der" data-nivel="' + cols[i].n + '" aria-label="' + esc(t('col.der')) + '">→</button>' +
        '</span>';
      mapa.appendChild(cab);
    }
    for (i = 0; i < total; i++) {
      for (j = 0; j < cols[i].cursos.length; j++) {
        var cod = cols[i].cursos[j];
        var anual = motor().esAnual(cod);
        k = 0;
        while (ocupadas[i][k] || (anual && i + 1 < total && ocupadas[i + 1][k])) { k++; }
        ocupadas[i][k] = true;
        if (anual && i + 1 < total) { ocupadas[i + 1][k] = true; }
        mapa.appendChild(nodoRamo(cod, i, k, total, estados, simEstados));
      }
    }
    var svg = D.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'malla__flechas');
    svg.setAttribute('aria-hidden', 'true');
    mapa.appendChild(svg);
    pedirFlechas();
  }

  /* ----------------------------------------------------------- flechas -----
     Una linea por requisito, del borde derecho del ramo que abre al borde izquierdo
     del que pide. Se miden las cajas ya pintadas. Las lineas se recalculan al
     redimensionar y al repintar; son decorativas (aria-hidden) y nunca reciben el
     puntero. */
  function pedirFlechas() {
    if (!D) { return; }
    var v = D.defaultView;
    if (!v || typeof v.requestAnimationFrame !== 'function') { dibujarFlechas(); return; }
    if (_raf) { v.cancelAnimationFrame(_raf); }
    _raf = v.requestAnimationFrame(function () { _raf = null; dibujarFlechas(); });
  }

  function dibujarFlechas() {
    var mapa = caja('mapa');
    if (!mapa || !motor()) { return; }
    var svg = mapa.querySelector('.malla__flechas');
    if (!svg) { return; }
    while (svg.firstChild) { svg.removeChild(svg.firstChild); }
    var ancho = Math.max(1, mapa.scrollWidth);
    var alto = Math.max(1, mapa.scrollHeight);
    svg.setAttribute('width', String(ancho));
    svg.setAttribute('height', String(alto));
    svg.setAttribute('viewBox', '0 0 ' + ancho + ' ' + alto);
    var cajaMapa = mapa.getBoundingClientRect();
    var x0 = cajaMapa.left - mapa.scrollLeft;
    var y0 = cajaMapa.top - mapa.scrollTop;
    function punto(nodo, lado) {
      var r = nodo.getBoundingClientRect();
      return {
        x: (lado === 'der' ? r.right : r.left) - x0,
        y: r.top - y0 + r.height / 2
      };
    }
    var nodos = mapa.querySelectorAll('[data-malla="ramo"]');
    for (var i = 0; i < nodos.length; i++) {
      var nodo = nodos[i];
      var cod = nodo.getAttribute('data-codigo');
      var c = motor().getCurso(cod) || {};
      var fuentes = (c.requisitos || []).slice();
      (c.requisitos_o || []).forEach(function (g) { g.forEach(function (x) { fuentes.push(x); }); });
      for (var j = 0; j < fuentes.length; j++) {
        var origen = mapa.querySelector('[data-malla="ramo"][data-codigo="' + fuentes[j] + '"]');
        if (!origen || origen === nodo) { continue; }
        trazar(svg, punto(origen, 'der'), punto(nodo, 'izq'));
      }
    }
  }

  function trazar(svg, a, b) {
    var ns = 'http://www.w3.org/2000/svg';
    if (Math.abs(b.x - a.x) < 2) { return; }
    var medio = (a.x + b.x) / 2;
    var linea = D.createElementNS(ns, 'path');
    linea.setAttribute('class', 'malla__flecha');
    linea.setAttribute('d', 'M' + a.x + ' ' + a.y + ' C' + medio + ' ' + a.y + ' ' + medio + ' ' + b.y + ' ' + b.x + ' ' + b.y);
    svg.appendChild(linea);
    var ang = Math.atan2(b.y - a.y, b.x - a.x);
    var largo = 7;
    var p1x = b.x - largo * Math.cos(ang - 0.45);
    var p1y = b.y - largo * Math.sin(ang - 0.45);
    var p2x = b.x - largo * Math.cos(ang + 0.45);
    var p2y = b.y - largo * Math.sin(ang + 0.45);
    var punta = D.createElementNS(ns, 'path');
    punta.setAttribute('class', 'malla__punta');
    punta.setAttribute('d', 'M' + b.x + ' ' + b.y + ' L' + p1x + ' ' + p1y + ' L' + p2x + ' ' + p2y + ' Z');
    svg.appendChild(punta);
  }

  /* ------------------------------------------------------------- editor ---- */
  function textoRequisitos(c) {
    var partes = (c.requisitos || []).slice();
    (c.requisitos_o || []).forEach(function (g) { partes.push(g.join('|')); });
    return partes.join(';');
  }

  function campo(clave, etiqueta, valor, tipo, extra) {
    return '<label class="malla__campo"><span class="malla__rot">' + esc(etiqueta) + '</span>' +
      '<input class="campo-reloj" type="' + tipo + '" data-malla-campo="' + clave + '" value="' + esc(valor) + '"' + (extra || '') + '></label>';
  }

  function pintarEditor() {
    var forma = caja('editor');
    if (!forma) { return; }
    if (!_estado.editor) {
      forma.hidden = true;
      forma.innerHTML = '';
      return;
    }
    var nuevo = _estado.editor === 'nuevo';
    var curso = nuevo ? null : motor().getCurso(_estado.editor);
    if (!nuevo && !curso) { _estado.editor = null; forma.hidden = true; forma.innerHTML = ''; return; }
    /* El codigo NO vive dentro de la entrada del catalogo (la clave es el codigo):
       en edicion se toma del estado del editor, no de `curso.codigo`. Sin esto el
       campo salia vacio, el formulario se enviaba sin codigo y no guardaba nada. */
    var v = curso || { nombre: '', creditos: '', nivel: _estado.nivel || 1, anual: false };
    var cod = nuevo ? '' : _estado.editor;
    var nivel = curso ? curso.nivel : (_estado.nivel || 1);
    var html = '<h3 class="malla__tit">' +
      esc(nuevo ? t('editor.nuevo') : t('editor.editar', { codigo: cod })) + '</h3>';
    html += '<div class="malla__rejilla">' +
      campo('codigo', t('campo.codigo'), cod, 'text', nuevo ? ' maxlength="12" autocomplete="off"' : ' readonly') +
      campo('nombre', t('campo.nombre'), v.nombre || '', 'text') +
      campo('creditos', t('campo.creditos'), v.creditos === undefined || v.creditos === null ? '' : v.creditos, 'number', ' min="0" step="1"') +
      campo('nivel', t('campo.nivel'), nivel, 'number', ' min="1" max="99" step="1"') +
      '</div>' +
      '<label class="malla__campo"><span class="malla__rot">' + esc(t('campo.requisitos')) + '</span>' +
        '<input class="campo-reloj" type="text" data-malla-campo="requisitos" value="' + esc(textoRequisitos(curso || {})) + '" autocomplete="off">' +
        '<span class="malla__pista">' + esc(t('pista.requisitos')) + '</span></label>' +
      '<label class="malla__campo"><span class="malla__rot">' + esc(t('campo.secciones')) + '</span>' +
        '<input class="campo-reloj" type="text" data-malla-campo="secciones" value="' + esc((v.secciones || []).join(', ')) + '" autocomplete="off"></label>' +
      '<label class="malla__campo malla__campo--ancho"><input type="checkbox" data-malla-campo="anual"' + (v.anual ? ' checked' : '') + '> ' +
        esc(t('campo.anual')) + '</label>';
    if (_estado.confirmar === _estado.editor) {
      html += '<p class="malla__error">' + esc(t('borrar.seguro', { codigo: cod })) + '</p>';
      html += '<div class="malla__acciones">' +
        '<button class="btn btn--mini" type="button" data-malla-accion="borrar-si" data-codigo="' + esc(cod) + '">' + esc(t('borrar.si')) + '</button>' +
        '<button class="btn btn--mini" type="button" data-malla-accion="borrar-no">' + esc(t('cancelar')) + '</button>' +
        '</div>';
    } else {
      html += '<div class="malla__acciones">' +
        '<button class="btn btn--primario" type="submit">' + esc(t('guardar')) + '</button>' +
        '<button class="btn btn--mini" type="button" data-malla-accion="cerrar-editor">' + esc(t('cancelar')) + '</button>' +
        (curso ? '<button class="btn btn--mini" type="button" data-malla-accion="borrar">' + esc(t('borrar')) + '</button>' : '') +
        '</div>';
    }
    forma.hidden = false;
    forma.innerHTML = html;
    var primero = forma.querySelector('[data-malla-campo="codigo"]');
    if (primero && nuevo) { primero.focus(); }
  }

  /* -------------------------------------------------------------- panel ---- */
  function pintarPanel() {
    var cajaPanel = caja('panel');
    if (!cajaPanel) { return; }
    if (!_estado.panel) {
      cajaPanel.hidden = true;
      cajaPanel.innerHTML = '';
      return;
    }
    cajaPanel.hidden = false;
    if (_estado.panel === 'simulador') { pintarSimulador(cajaPanel); return; }
    var html = '<h3 class="malla__tit">' + esc(t('panel.datos')) + '</h3>' +
      '<p class="malla__pista">' + esc(t('panel.pista')) + '</p>' +
      '<textarea class="campo-reloj malla__texto" data-malla-texto rows="6" spellcheck="false" aria-label="' + esc(t('panel.datos')) + '"></textarea>' +
      '<div class="malla__acciones">' +
        '<button class="btn btn--mini" type="button" data-malla-accion="importar-pegado">' + esc(t('importar.pegado')) + '</button>' +
        '<button class="btn btn--mini" type="button" data-malla-accion="elegir-archivo">' + esc(t('importar.archivo')) + '</button>' +
        '<button class="btn btn--mini" type="button" data-malla-accion="exportar-csv">' + esc(t('exportar.csv')) + '</button>' +
        '<button class="btn btn--primario" type="button" data-malla-accion="exportar-json">' + esc(t('exportar.json')) + '</button>' +
        '<button class="btn btn--mini" type="button" data-malla-accion="cerrar-panel">' + esc(t('cerrar')) + '</button>' +
      '</div>' +
      '<textarea class="campo-reloj malla__texto malla__salida" data-malla-salida rows="6" readonly spellcheck="false" aria-label="' + esc(t('exportar.json')) + '"></textarea>' +
      '<input type="file" data-malla-archivo accept=".json,.csv,.tsv,.txt,application/json,text/csv,text/plain" hidden>';
    cajaPanel.innerHTML = html;
  }

  function pintarSimulador(cajaPanel) {
    var cat = motor().getCatalogo();
    var base = motor().estados();
    var sim = motor().simularCon(_estado.sim);
    var desbloqueados = [];
    Object.keys(cat).forEach(function (cod) {
      if (cat[cod].en_malla === false) { return; }
      if (base[cod] === 'bloqueado' && sim[cod] === 'disponible') { desbloqueados.push(cod); }
    });
    var html = '<h3 class="malla__tit">' + esc(t('panel.simulador')) + '</h3>' +
      '<p class="malla__pista">' + esc(t('panel.simPista')) + '</p>' +
      '<div class="malla__lista-sim">';
    var codigos = Object.keys(cat).filter(function (cod) { return cat[cod].en_malla !== false; }).sort();
    for (var i = 0; i < codigos.length; i++) {
      var cod = codigos[i];
      var est = base[cod] || 'bloqueado';
      html += '<label class="malla__sim-fila"><input type="checkbox" data-malla-sim="' + esc(cod) + '"' +
        (_estado.sim[cod] ? ' checked' : '') + '><span class="malla__sim-cod">' + esc(cod) + '</span>' +
        '<span class="malla__sim-est">' + esc(t('estado.' + est)) + '</span></label>';
    }
    html += '</div>' +
      '<p class="malla__pista" data-malla-sim-resumen>' +
      esc(desbloqueados.length ? t('sim.desbloquea', { lista: desbloqueados.join(', ') }) : t('sim.nada')) +
      '</p>' +
      '<div class="malla__acciones"><button class="btn btn--mini" type="button" data-malla-accion="sim-limpiar">' + esc(t('cancelar')) + '</button>' +
      '<button class="btn btn--mini" type="button" data-malla-accion="cerrar-panel">' + esc(t('cerrar')) + '</button></div>';
    cajaPanel.innerHTML = html;
  }

  /* ------------------------------------------------------------ acciones ---- */
  function cerrarEditor() {
    _estado.editor = null;
    _estado.confirmar = null;
    pintarEditor();
    pintarBarra();
  }

  function abrirEditor(cod) {
    _estado.editor = cod || 'nuevo';
    _estado.confirmar = null;
    _estado.panel = '';
    pintarPanel();
    pintarEditor();
    pintarBarra();
  }

  function abrirPanel(cual) {
    _estado.panel = (_estado.panel === cual) ? '' : cual;
    _estado.editor = null;
    pintarEditor();
    pintarPanel();
    pintarBarra();
  }

  function mensaje(txt) { _estado.mensaje = txt; pintarResumen(); }

  function alClic(ev) {
    if (!D || !motor()) { return; }
    var nodo = subirA(ev.target, '[data-malla-accion]');
    if (!nodo) { return; }
    if (!subirA(nodo, '[data-malla="bloque"]')) { return; }
    var accion = nodo.getAttribute('data-malla-accion');
    var cod = nodo.getAttribute('data-codigo');
    var nivel = nodo.getAttribute('data-nivel');
    var i;
    switch (accion) {
      case 'nuevo':
        abrirEditor('nuevo');
        break;
      case 'editar':
        abrirEditor(cod);
        break;
      case 'cerrar-editor':
        cerrarEditor();
        break;
      case 'panel-datos':
        abrirPanel('datos');
        break;
      case 'panel-simulador':
        abrirPanel('simulador');
        break;
      case 'cerrar-panel':
        _estado.panel = '';
        pintarPanel();
        break;
      case 'aprobar':
        motor().aprobar(cod, motor().getEstadoCurso(cod) !== 'aprobado');
        pintarMapa();
        pintarResumen();
        break;
      case 'curso':
        // "En curso" y "aprobado" se excluyen en el dibujo: aprobar quita de en
        // curso; poner en curso no toca la aprobacion (si ya estaba aprobado, el
        // estado sigue siendo aprobado y el ramo se queda en su color).
        if (motor().getEstadoCurso(cod) === 'curso') {
          motor().quitarRamo(cod);
        } else {
          window.MimoComun.agregarRamo(cod);
        }
        repintar();
        break;
      case 'subir':
      case 'bajar':
        moverEnColumna(cod, accion === 'subir' ? -1 : 1);
        break;
      case 'col-izq':
        motor().reordenarNivel(nivel, 'izq');
        pintarMapa();
        break;
      case 'col-der':
        motor().reordenarNivel(nivel, 'der');
        pintarMapa();
        break;
      case 'borrar':
        _estado.confirmar = _estado.editor;
        pintarEditor();
        break;
      case 'borrar-no':
        _estado.confirmar = null;
        pintarEditor();
        break;
      case 'borrar-si':
        motor().borrarCurso(cod);
        cerrarEditor();
        repintar();
        break;
      case 'importar-pegado': {
        var campoTexto = D.querySelector('[data-malla-texto]');
        var txt = campoTexto ? campoTexto.value : '';
        var r = motor().importarMalla(txt, 'auto');
        if (r.ok) {
          _estado.panel = '';
          _estado.editor = null;
          repintar();
          mensaje(t('import.ok', { cursos: r.resumen.cursos }));
        } else {
          mensaje(t('import.error', { error: r.error }));
        }
        break;
      }
      case 'elegir-archivo': {
        var entrada = D.querySelector('[data-malla-archivo]');
        if (entrada) { entrada.click(); }
        break;
      }
      case 'exportar-csv':
      case 'exportar-json': {
        var salida = D.querySelector('[data-malla-salida]');
        var formato = accion === 'exportar-csv' ? 'csv' : 'json';
        if (salida) { salida.value = motor().exportarMalla(formato); }
        mensaje(t('export.hecho'));
        break;
      }
      case 'sim-limpiar':
        _estado.sim = {};
        pintarSimulador(caja('panel'));
        pintarMapa();
        pintarResumen();
        break;
      default:
        return;
    }
  }

  /* Subir/bajar dentro de la columna: se cambia el nivel de la lista guardada, no
     el nivel del ramo (que es su columna). Como la reticula ordena por codigo, el
     orden manual se guarda en `E.malla.ajustes.orden[nivel]` y `getSemestres()` lo
     aplica; si el ramo cambia de columna, su entrada vieja se ignora. */
  function moverEnColumna(cod, paso) {
    var m = motor().getCurso(cod);
    if (!m) { return; }
    var estadoMalla = Mimo.estadoMalla();
    estadoMalla.ajustes = estadoMalla.ajustes || {};
    var orden = estadoMalla.ajustes.orden || (estadoMalla.ajustes.orden = {});
    var clave = String(m.nivel);
    if (!Array.isArray(orden[clave])) {
      orden[clave] = (motor().getCursosDeSemestre(m.nivel) || []).slice();
    }
    var i = orden[clave].indexOf(cod);
    if (i < 0) { orden[clave].push(cod); i = orden[clave].length - 1; }
    var j = i + paso;
    if (j < 0 || j >= orden[clave].length) { return; }
    var tmp = orden[clave][i];
    orden[clave][i] = orden[clave][j];
    orden[clave][j] = tmp;
    Mimo.guardar('');
    pintarMapa();
  }

  function alEnviar(ev) {
    var forma = ev.target;
    if (!forma || !forma.getAttribute || forma.getAttribute('data-malla') !== 'editor') { return; }
    ev.preventDefault();
    var valor = function (k) {
      var c = forma.querySelector('[data-malla-campo="' + k + '"]');
      return c ? c.value : '';
    };
    var anual = forma.querySelector('[data-malla-campo="anual"]');
    var r = motor().guardarCurso({
      codigo: valor('codigo'),
      nombre: valor('nombre'),
      creditos: valor('creditos'),
      nivel: valor('nivel'),
      requisitos: valor('requisitos'),
      secciones: valor('secciones'),
      anual: !!(anual && anual.checked)
    });
    if (r.ok) {
      _estado.editor = null;
      _estado.confirmar = null;
      repintar();
    } else {
      var err = D.querySelector('[data-malla="editor"] .malla__error');
      if (!err) {
        err = D.createElement('p');
        err.className = 'malla__error';
        forma.appendChild(err);
      }
      err.textContent = t('error.' + r.error);
    }
  }

  function alCambiar(ev) {
    if (!D || !motor()) { return; }
    var nodo = ev.target;
    if (!nodo || !nodo.getAttribute) { return; }
    if (nodo.getAttribute('data-malla-sim')) {
      _estado.sim[nodo.getAttribute('data-malla-sim')] = !!nodo.checked;
      pintarSimulador(caja('panel'));
      pintarMapa();
      pintarResumen();
      return;
    }
    if (nodo.getAttribute('data-malla-archivo')) {
      var archivo = nodo.files && nodo.files[0];
      if (!archivo) { return; }
      var lector = new D.defaultView.FileReader();
      lector.onload = function () {
        var r = motor().importarMalla(String(lector.result || ''), 'auto');
        if (r.ok) { _estado.panel = ''; pintar(); mensaje(t('import.ok', { cursos: r.resumen.cursos })); }
        else { mensaje(t('import.error', { error: r.error })); }
      };
      lector.readAsText(archivo);
    }
  }

  /* ------------------------------------------------------------ arranque --- */
  function iniciar() {
    _idioma = idiomaActual();
    if (!D || _oyentes) { return { pintar: pintar, detener: detener }; }
    _oyentes = {
      clic: alClic,
      enviar: alEnviar,
      cambiar: alCambiar,
      redimensionar: pedirFlechas
    };
    D.addEventListener('click', _oyentes.clic);
    D.addEventListener('submit', _oyentes.enviar);
    D.addEventListener('change', _oyentes.cambiar);
    var v = D.defaultView;
    if (v) { v.addEventListener('resize', _oyentes.redimensionar); }
    repintar();
    return { pintar: pintar, detener: detener };
  }

  function detener() {
    if (!D || !_oyentes) { return; }
    D.removeEventListener('click', _oyentes.clic);
    D.removeEventListener('submit', _oyentes.enviar);
    D.removeEventListener('change', _oyentes.cambiar);
    var v = D.defaultView;
    if (v) { v.removeEventListener('resize', _oyentes.redimensionar); }
    _oyentes = null;
  }

  return { iniciar: iniciar, pintar: pintar, detener: detener };
})();

if (typeof window !== 'undefined') { window.MimoMallaUI = MimoMallaUI; }
