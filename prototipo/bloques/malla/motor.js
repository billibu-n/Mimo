/* =============================================================== Malla · motor
   Calculo puro del bloque Malla (Iteracion 3 de Mimo Nuevo).

   Portado de la app Academics (/tmp/mimo-explore), SOLO el calculo:
     - calcularCon / est                 -> estados(), simularCon()      [malla/03-dibujo.js:22-48]
     - aprobadosSet                      -> estados() (aprobados del almacen) [malla/03-dibujo.js:10-18]
     - requisitosFaltantes               -> requisitosFaltantes()        [malla/03-dibujo.js:52-61]
     - cadena                            -> cadena()                     [malla/03-dibujo.js:62-72]
     - herederoDe                        -> herederoDe() (con la seleccion por parametro) [malla/03-dibujo.js:73-77]
     - esAnual / semestresQueOcupa       -> esAnual(), semestresQueOcupa() [malla/03-dibujo.js:82-95]
     - aplanar                           -> aplanar() (interno)          [malla/03-dibujo.js:51]
     - CAT (catalogo efectivo)           -> getCatalogo()                [comun/03-catalogo.js:15-18]
     - NIVELES (reparto por nivel)       -> getSemestres()               [comun/03-catalogo.js:25-68]
     - ramoEnCatalogo (forma del ramo)   -> normalizarCurso()            [comun/03-catalogo.js:157-186]
     - cargar / guardar (una sola puerta)-> leer(), escribir()           [comun/03-catalogo.js:302-372]

   NO se porta: nodoHTML, renderMalla, PDF, editor de ramos, simulador de UI, CSV,
   descarga con Blob/URL, avisos y pintado. Este fichero no toca el DOM.

   Concesion de la spec (§3): el almacen se lee y se escribe SOLO por leer()/escribir().
   Si no hay localStorage (Node, modo privado) queda el respaldo en memoria.
   leer(), getCatalogo(), getAjustes() y getAprobados() devuelven los objetos vivos del
   almacen en memoria: NO se mutan desde fuera; para cambiar datos se usa escribir().
   La unica linea que nombra `window` es la de exportacion, al final.
   ============================================================================ */
var MimoMallaMotor = (function () {
  'use strict';

  var CLAVE = 'mimo.bloque.malla';
  var VERSION = 1;

  // --- estado en memoria (respaldo del almacen y cache de lo ya normalizado) ----
  var _datos = null;         // datos normalizados; null = todavia sin leer
  var _version = 0;          // sube con cada lectura/escritura: invalida memos
  var _memoEstados = null;
  var _memoEstadosVersion = -1;
  var _memoInverso = null;
  var _memoInversoVersion = -1;

  /* ------------------------------------------------------------ utilidades */
  function texto(v) {
    return (v === null || v === undefined) ? '' : String(v);
  }
  function codigo(v) {
    return texto(v).trim().toUpperCase();
  }
  function numero(v, porDefecto) {
    var n = Number(v);
    return isFinite(n) ? n : porDefecto;
  }
  function esObjeto(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }
  // Lista de codigos limpia: mayusculas, sin vacios, sin repetidos y en orden de entrada.
  function listaCodigos(v) {
    if (!Array.isArray(v)) return [];
    var out = [], visto = {};
    v.forEach(function (x) {
      var c = codigo(x);
      if (!c || visto[c]) return;
      visto[c] = true;
      out.push(c);
    });
    return out;
  }
  // Lista de grupos "basta uno" (requisitos_o): cada grupo es una lista de codigos.
  function listaGrupos(v) {
    if (!Array.isArray(v)) return [];
    var out = [];
    v.forEach(function (g) {
      var l = listaCodigos(g);
      if (l.length) out.push(l);
    });
    return out;
  }

  /* ------------------------------------------------------ normalizacion ---- */

  // Forma de un curso tal como la deja ramoEnCatalogo (comun/03-catalogo.js:157-186).
  function normalizarCurso(cod, crudo) {
    var c = esObjeto(crudo) ? crudo : {};
    // El nivel 99 es el marcador de "sin nivel / electivos" que usa el dibujo.
    var nivel = (c.nivel !== undefined && c.nivel !== null && c.nivel !== '') ? Number(c.nivel) : null;
    var semNum = (c.semestre_num !== undefined && c.semestre_num !== null && c.semestre_num !== '')
      ? Number(c.semestre_num) : null;
    if (nivel === null || !isFinite(nivel) || nivel <= 0) {
      nivel = (semNum !== null && isFinite(semNum) && semNum > 0) ? semNum : 99;
    }
    if (nivel > 99) nivel = 99;
    if (semNum === null || !isFinite(semNum) || semNum <= 0) semNum = nivel;
    return {
      nombre: texto(c.nombre) || cod,
      creditos: Math.max(0, numero(c.creditos, 0)),
      nivel: nivel,
      semestre_num: semNum,
      tipo: texto(c.tipo) || 'obligatorio',
      en_malla: c.en_malla === false ? false : true,
      anual: !!c.anual,
      requisitos: listaCodigos(c.requisitos),
      requisitos_o: listaGrupos(c.requisitos_o),
      desbloquea: listaCodigos(c.desbloquea),
      aprobacion: (c.aprobacion === undefined) ? null : c.aprobacion,
      dificultad: (c.dificultad === undefined) ? null : c.dificultad,
      prioridad: (c.prioridad === undefined) ? null : c.prioridad,
      descripcion: (c.descripcion === undefined) ? null : c.descripcion,
      equivalente: (c.equivalente === undefined) ? null : c.equivalente,
      // cuantos semestres ocupa un anual (ver semestresQueOcupa)
      semestres: (c.semestres === undefined) ? null : c.semestres
    };
  }

  function normalizarCatalogo(v) {
    var out = {};
    if (!esObjeto(v)) return out;
    Object.keys(v).forEach(function (k) {
      var cod = codigo(k);
      if (!cod || out[cod]) return;
      out[cod] = normalizarCurso(cod, v[k]);
    });
    return out;
  }

  function normalizarAprobados(v) {
    var out = {};
    if (Array.isArray(v)) {
      listaCodigos(v).forEach(function (c) { out[c] = true; });
      return out;
    }
    if (!esObjeto(v)) return out;
    Object.keys(v).forEach(function (k) {
      var c = codigo(k);
      if (c && v[k]) out[c] = true;
    });
    return out;
  }

  function normalizarImportado(v) {
    if (!esObjeto(v)) return null;
    var cods = listaCodigos(v.codigos);
    var cuando = texto(v.cuando) || null;
    if (!cods.length && !cuando) return null;
    return { codigos: cods, cuando: cuando };
  }

  function normalizarRamos(v, catalogo) {
    if (!Array.isArray(v)) return [];
    var out = [], visto = {};
    v.forEach(function (r) {
      var o = esObjeto(r) ? r : {};
      var cod = codigo(o.codigo || o.code || o.sigla);
      if (!cod || visto[cod]) return;
      visto[cod] = true;
      var cat = catalogo[cod] || {};
      var nivel = (o.nivel !== undefined && o.nivel !== null && o.nivel !== '')
        ? Number(o.nivel) : cat.nivel;
      if (!isFinite(nivel) || nivel <= 0) nivel = cat.nivel || 99;
      out.push({
        codigo: cod,
        nombre: texto(o.nombre) || cat.nombre || cod,
        creditos: (o.creditos !== undefined && o.creditos !== null && o.creditos !== '')
          ? Math.max(0, numero(o.creditos, 0)) : (cat.creditos || 0),
        nivel: nivel
      });
    });
    return out;
  }

  function normalizarNotas(v) {
    var out = {};
    if (!esObjeto(v)) return out;
    Object.keys(v).forEach(function (k) {
      var c = codigo(k);
      if (!c) return;
      if (v[k] === null || v[k] === undefined || v[k] === '') return;
      var n = Number(v[k]);
      if (!isFinite(n)) return;
      out[c] = n;
    });
    return out;
  }

  // ajustes.av: se conservan las claves que traiga el respaldo y se normaliza `colores`.
  // Los colores vienen del usuario (no son tokens del kit): solo se aceptan #rgb o #rrggbb.
  function normalizarAjustes(v) {
    var av = {};
    if (esObjeto(v) && esObjeto(v.av)) {
      Object.keys(v.av).forEach(function (k) {
        if (k !== 'colores') av[k] = v.av[k];
      });
      var colores = {};
      if (esObjeto(v.av.colores)) {
        Object.keys(v.av.colores).forEach(function (k) {
          var s = texto(v.av.colores[k]).trim();
          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) colores[String(k).toLowerCase()] = s;
        });
      }
      av.colores = colores;
    }
    return { av: av };
  }

  function normalizarNiveles(v) {
    if (!Array.isArray(v)) return [];
    var out = [], visto = {};
    v.forEach(function (n) {
      if (!esObjeto(n)) return;
      var num = Number(n.nivel !== undefined ? n.nivel : n.n);
      if (!isFinite(num) || num <= 0) return;
      if (visto[num]) return;
      visto[num] = true;
      out.push({
        nivel: num,
        titulo: texto(n.titulo),
        ramos: listaCodigos(n.ramos)
      });
    });
    out.sort(function (a, b) { return a.nivel - b.nivel; });
    return out;
  }

  function normalizar(d) {
    var o = esObjeto(d) ? d : {};
    var catalogo = normalizarCatalogo(o.catalogo);
    return {
      _v: VERSION,
      catalogo: catalogo,
      aprobados: normalizarAprobados(o.aprobados),
      importado: normalizarImportado(o.importado),
      ramos: normalizarRamos(o.ramos, catalogo),
      notas: normalizarNotas(o.notas),
      ajustes: normalizarAjustes(o.ajustes),
      niveles: normalizarNiveles(o.niveles)
    };
  }

  function vacio() {
    return normalizar({});
  }

  /* ----------------------------------------------- puerta unica al almacen --
     Nadie mas en el bloque toca localStorage. Si no existe (Node, modo privado,
     cuota llena) el dato vive en memoria: leer() siempre devuelve algo. */
  function almacen() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
    } catch (e) { /* acceso bloqueado por el navegador */ }
    return null;
  }

  function invalidarMemos() {
    _memoEstados = null;
    _memoEstadosVersion = -1;
    _memoInverso = null;
    _memoInversoVersion = -1;
  }

  function leer() {
    if (_datos) return _datos;
    var bruto = null;
    var ls = almacen();
    if (ls) {
      try { bruto = ls.getItem(CLAVE); } catch (e) { bruto = null; }
    }
    if (!bruto) {
      _datos = vacio();
    } else {
      try {
        _datos = normalizar(JSON.parse(bruto));
      } catch (e) {
        // Dato corrupto en el almacen: se arranca vacio en vez de romper la pantalla.
        _datos = vacio();
      }
    }
    _version++;
    return _datos;
  }

  function escribir(datos) {
    if (datos === null || datos === undefined) datos = {};
    if (!esObjeto(datos)) {
      throw new Error('MimoMallaMotor.escribir() espera un objeto de datos');
    }
    var n = normalizar(datos);
    var ls = almacen();
    if (ls) {
      try { ls.setItem(CLAVE, JSON.stringify(n)); } catch (e) { /* queda en memoria */ }
    }
    _datos = n;
    _version++;
    invalidarMemos();
    return _datos;
  }

  // Igual que escribir(); se mantiene el nombre porque la spec §3 lo declara y porque
  // deja claro que lo guardado invalida todo lo derivado (estados, inverso, semestres).
  function establecer(datos) {
    return escribir(datos);
  }

  function tieneDatos() {
    return Object.keys(leer().catalogo).length > 0;
  }

  /* --------------------------------------------------------- derivados ---- */
  function aplanar(grupos) {
    // portado de malla/03-dibujo.js:51
    return [].concat.apply([], grupos || []);
  }

  // 'desbloquea' es el inverso de 'requisitos' (comun/03-catalogo.js:107-116).
  // Se deriva siempre de los requisitos para que no queden flechas colgando; incluye
  // tambien los grupos "basta uno", que el original no miraba al recalcular.
  function inverso() {
    if (_memoInverso && _memoInversoVersion === _version) return _memoInverso;
    var d = leer();
    var inv = {};
    Object.keys(d.catalogo).forEach(function (cod) { inv[cod] = []; });
    Object.keys(d.catalogo).forEach(function (cod) {
      var c = d.catalogo[cod];
      var fuentes = (c.requisitos || []).concat(aplanar(c.requisitos_o));
      fuentes.forEach(function (r) {
        if (!r || r === cod) return;
        var lista = inv[r] || (inv[r] = []);
        if (lista.indexOf(cod) < 0) lista.push(cod);
      });
    });
    Object.keys(inv).forEach(function (k) { inv[k].sort(); });
    _memoInverso = inv;
    _memoInversoVersion = _version;
    return inv;
  }

  /* ------------------------------------------------------------ estados ----
     Portado de malla/03-dibujo.js:22-48 SIN cambios de criterio:
       aprobado > en curso > disponible si TODOS los requisitos estan aprobados
       y CADA grupo de requisitos_o tiene al menos uno aprobado > bloqueado.
     Se calcula con memo y con `visto`, asi un ciclo del grafo no cuelga la recursion.
     Diferencia declarada: se recorren tambien los codigos aprobados o en curso que
     no esten en el catalogo, para que getEstadoCurso() nunca devuelva undefined. */
  function calcularCon(aprob) {
    var d = leer();
    var cat = d.catalogo;
    var enCurso = {};
    d.ramos.forEach(function (r) { enCurso[r.codigo] = true; });

    var memo = {};
    function est(cod, visto) {
      if (Object.prototype.hasOwnProperty.call(memo, cod)) return memo[cod];
      visto = visto || {};
      if (visto[cod]) return 'bloqueado';          // por si el grafo trajera un ciclo
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
          if (est(reqs[i], visto) !== 'aprobado') ok = false;
        }
        for (var j = 0; j < uno.length && ok; j++) {
          var grupo = uno[j] || [];
          var alguno = false;
          for (var k = 0; k < grupo.length; k++) {
            if (est(grupo[k], visto) === 'aprobado') { alguno = true; break; }
          }
          if (!alguno) ok = false;
        }
        v = ok ? 'disponible' : 'bloqueado';
      }
      memo[cod] = v;
      return v;
    }

    var todos = Object.keys(cat);
    Object.keys(aprob).forEach(function (c) {
      if (todos.indexOf(c) < 0) todos.push(c);
    });
    d.ramos.forEach(function (r) {
      if (todos.indexOf(r.codigo) < 0) todos.push(r.codigo);
    });
    todos.forEach(function (c) { est(c); });

    // La memo interna recoge tambien codigos que solo aparecen como prerrequisito y no
    // estan en el catalogo (el respaldo real tiene 6: CR240, MI4900, CR264, MI5901...).
    // estados() devuelve solo los cursos conocidos: catalogo, aprobados y ramos en curso.
    // Asi la UI nunca pinta un ramo fantasma y el conteo es 84, no 90.
    var out = {};
    todos.forEach(function (c) { out[c] = memo[c]; });
    return out;
  }

  function estados() {
    if (_memoEstados && _memoEstadosVersion === _version) return _memoEstados;
    var d = leer();
    var aprob = {};
    Object.keys(d.aprobados).forEach(function (c) { if (d.aprobados[c]) aprob[c] = true; });
    _memoEstados = calcularCon(aprob);
    _memoEstadosVersion = _version;
    return _memoEstados;
  }

  /* --------------------------------------------------------- semestres ---- */
  // Reparto de comun/03-catalogo.js:25-68: los titulos y el orden salen de las columnas
  // del archivo si vienen; cada ramo se coloca por su nivel ACTUAL en el catalogo.
  // El 99 (electivos) va siempre al final.
  function getSemestres() {
    var d = leer();
    var cat = d.catalogo;
    var titulos = {}, orden = [];
    d.niveles.forEach(function (n) {
      if (orden.indexOf(n.nivel) < 0) orden.push(n.nivel);
      if (n.titulo) titulos[n.nivel] = n.titulo;
    });
    var por = {};
    Object.keys(cat).forEach(function (cod) {
      var c = cat[cod];
      if (c.en_malla === false) return;
      var nv = (c.nivel > 0) ? Number(c.nivel) : 99;
      if (!isFinite(nv) || nv <= 0) nv = 99;
      if (nv > 99) nv = 99;
      if (orden.indexOf(nv) < 0) orden.push(nv);
      (por[nv] = por[nv] || []).push(cod);
    });
    orden.sort(function (a, b) {
      if (a === b) return 0;
      if (a === 99) return 1;
      if (b === 99) return -1;
      return a - b;
    });
    return orden.map(function (n) {
      return {
        n: n,
        titulo: titulos[n] || (n === 99 ? 'Electivos' : 'Nivel ' + n),
        cursos: (por[n] || []).slice().sort()
      };
    });
  }

  function getCursosDeSemestre(n) {
    var num = Number(n);
    if (!isFinite(num)) return [];
    var d = leer();
    var out = [], visto = {};
    var niveles = getSemestres();
    for (var i = 0; i < niveles.length; i++) {
      if (niveles[i].n !== num) continue;
      niveles[i].cursos.forEach(function (c) {
        if (!visto[c]) { visto[c] = true; out.push(c); }
      });
    }
    // La spec §3 pide "nivel o semestre_num": si la estructura vino partida de otra
    // forma, se agregan los ramos cuyo semestre_num coincide.
    Object.keys(d.catalogo).forEach(function (cod) {
      var c = d.catalogo[cod];
      if (c.en_malla === false) return;
      if (c.semestre_num === num && !visto[cod]) {
        visto[cod] = true;
        out.push(cod);
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ API ------ */
  function getCurso(cod) {
    return leer().catalogo[codigo(cod)] || null;
  }

  function getEstadoCurso(cod) {
    return estados()[codigo(cod)] || 'bloqueado';
  }

  function getRamosActivos() {
    return leer().ramos.map(function (r) {
      return { codigo: r.codigo, nombre: r.nombre, creditos: r.creditos, nivel: r.nivel };
    });
  }

  function getAprobados() {
    var d = leer(), out = {};
    Object.keys(d.aprobados).forEach(function (c) { if (d.aprobados[c]) out[c] = true; });
    return out;
  }

  function getCatalogo() { return leer().catalogo; }
  function getAjustes() { return leer().ajustes; }

  function getNota(cod) {
    var d = leer();
    var n = d.notas[codigo(cod)];
    return (typeof n === 'number' && isFinite(n)) ? n : null;
  }

  // portado de malla/03-dibujo.js:52-61 (sin cambios)
  function requisitosFaltantes(cod) {
    var e = estados();
    var c = leer().catalogo[codigo(cod)] || {};
    var faltan = (c.requisitos || []).filter(function (r) { return e[r] !== 'aprobado'; });
    (c.requisitos_o || []).forEach(function (g) {
      var alguno = g.some(function (r) { return e[r] === 'aprobado'; });
      if (!alguno) faltan.push(g.join(' o '));
    });
    return faltan;
  }

  function desbloquea(cod) {
    return (inverso()[codigo(cod)] || []).slice();
  }

  // portado de malla/03-dibujo.js:62-72. El original concatenaba ramas y repetia codigos
  // cuando dos caminos llegaban al mismo ramo (MA1002 aparecia dos veces en la linea de
  // MA2002). Aqui se conserva el primer orden de aparicion y se quita el repetido: la UI
  // pinta la linea y no debe listar dos veces el mismo ramo.
  function cadena(cod, direccion) {
    var cat = leer().catalogo;
    var out = [], puestos = {};
    function andar(c, visto) {
      if (visto[c]) return;
      visto[c] = true;
      var cc = cat[c] || {};
      var base = (direccion === 'antes')
        ? (cc.requisitos || []).concat(aplanar(cc.requisitos_o))
        : desbloquea(c);
      base.forEach(function (x) {
        if (!puestos[x] && x !== cod) {
          puestos[x] = true;
          out.push(x);
        }
        andar(x, visto);
      });
    }
    andar(codigo(cod), {});
    return out;
  }

  // portado de malla/03-dibujo.js:73-77, con la seleccion como parametro (la UI la tiene).
  function herederoDe(cod, seleccion) {
    if (!seleccion) return true;
    if (cod === seleccion) return true;
    return cadena(seleccion, 'antes').indexOf(cod) >= 0 ||
           cadena(seleccion, 'despues').indexOf(cod) >= 0;
  }

  // portado de malla/03-dibujo.js:82, 91-95
  function esAnual(cod) {
    return !!(leer().catalogo[codigo(cod)] || {}).anual;
  }

  function semestresQueOcupa(cod) {
    if (!esAnual(cod)) return 1;
    var n = parseInt((leer().catalogo[codigo(cod)] || {}).semestres, 10);
    return n > 1 ? n : 2;
  }

  function creditosAprobados() {
    var d = leer(), e = estados(), total = 0;
    Object.keys(d.catalogo).forEach(function (cod) {
      var c = d.catalogo[cod];
      if (c.en_malla === false) return;
      if (e[cod] !== 'aprobado') return;
      total += Number(c.creditos) || 0;
    });
    return total;
  }

  // Estados con un juego de aprobados dado (para el simulador de la UI). No toca el
  // almacen ni las memos: devuelve un objeto nuevo.
  function simularCon(aprobados) {
    return calcularCon(normalizarAprobados(aprobados));
  }

  return {
    CLAVE: CLAVE,
    leer: leer,
    escribir: escribir,
    establecer: establecer,
    vacio: vacio,
    tieneDatos: tieneDatos,

    // las cuatro de `ofrece` del manifiesto
    getCurso: getCurso,
    getCursosDeSemestre: getCursosDeSemestre,
    getEstadoCurso: getEstadoCurso,
    getRamosActivos: getRamosActivos,

    // apoyo para la UI
    getSemestres: getSemestres,
    getAprobados: getAprobados,
    getCatalogo: getCatalogo,
    getAjustes: getAjustes,
    getNota: getNota,
    requisitosFaltantes: requisitosFaltantes,
    desbloquea: desbloquea,
    cadena: cadena,
    estados: estados,
    creditosAprobados: creditosAprobados,
    simularCon: simularCon,

    // apoyo adicional (no forma parte del contrato §3; existe para la ficha y el filtro)
    esAnual: esAnual,
    semestresQueOcupa: semestresQueOcupa,
    herederoDe: herederoDe
  };
})();

// Unica linea que nombra `window`: la exportacion (spec §3).
if (typeof window !== 'undefined') window.MimoMallaMotor = MimoMallaMotor;
