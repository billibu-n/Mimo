/* ============================================================================
   catalogo.js — Mimo Nuevo · sustrato comun · EL CATALOGO COMO MAQUINARIA
   (bloque T003; portado de `referencia/mimo-app-53cc22d/js/comun/03-catalogo.js`)

   QUE ES
   El catalogo es el diccionario de ramos con el que trabajan la malla, las
   calificaciones y el tiempo. En la app anterior se mezclaban dos fuentes: los
   ramos del archivo de datos (`D.catalogo`) y los que creaba el usuario
   (`E.catalogo`). Aqui NO hay archivo de datos: la version limpia arranca sin
   ningun ramo y `E.catalogo` es la unica fuente. Los ramos de fabrica llegan
   con T004; este bloque deja la maquinaria y su grafo, probados en vacio.

   QUE SE PORTA
   `CAT()`, `invalidarCatalogo()`, `ramoEnCatalogo()`, `borrarRamo()`,
   `requisitosDesdeTexto()` y `recalcularDesbloquea()`, con la misma forma de
   ramo (mismos campos, mismos nulos) para que lo que se escriba en T004 no
   tenga que distinguir un ramo propio de uno de fabrica.

   QUE NO SE PORTA (y por que)
   - `NIVELES()`, `SECCIONES`, `asignarSeccion()`: son el dibujo de la reticula,
     que es T004. Sin malla no hay columnas que repartir.
   - `ramosQueAbre()`: prioridad de percepcion del estudio, se porta con T005.
   - `ramosDeSem()`, `agregarRamo()`, `ramoNuevo()`: semestre activo y malla.
   - `memoEstados`: el calculo de estados de la malla (aprobado / en curso /
     disponible / bloqueado) es de T004: hoy no hay estados que invalidar, pero
     el gancho se deja escrito en `invalidarCatalogo()` para que T004 lo llene
     donde va y no en cada sitio que toque el catalogo.

   EL CATALOGO NO GUARDA SOLO. `ramoEnCatalogo()` y `borrarRamo()` mutan
   `E.catalogo` y recalculan; quien llama decide cuando se escribe a disco con
   `MimoComun.guardar()`. Guardar aqui dentro convertiria una importacion de
   300 ramos en 300 escrituras.

   API (todo cuelga de window.MimoComun):
     MimoComun.CAT()                    copia plana del catalogo efectivo (memoizada)
     MimoComun.invalidarCatalogo()      tira la copia y los estados calculados
     MimoComun.ramoEnCatalogo(cod,datos) crea o actualiza un ramo, con su nivel
     MimoComun.borrarRamo(cod)          lo borra y limpia las flechas que lo citan
     MimoComun.requisitosDesdeTexto(txt) 'A;B|C' -> {requisitos, requisitos_o}
     MimoComun.recalcularDesbloquea()   inverso de `requisitos`, entero

   LO QUE ANADIO T004 (la reticula ya existe y necesita columnas y semestre)
     MimoComun.estadoMalla()            siembra y devuelve E.malla (una sola puerta)
     MimoComun.NIVELES()                columnas de la reticula, 99 al final
     MimoComun.SECC()                   secciones de la carrera (E.malla.secciones)
     MimoComun.ramosDeSem(nivel)        ramos EN CURSO de esa columna
     MimoComun.ramoNuevo(cod)           entrada en curso fabricada desde CAT()
     MimoComun.agregarRamo(cod)         agrega a en curso sin duplicar y guarda
   ============================================================================ */
var MimoComun = window.MimoComun = window.MimoComun || {};
(function (Mimo) {
  'use strict';

  var _catMemo = null;

  /* Los estados de la malla se calculan SOBRE el catalogo. Hoy no hay estados
     (T004), pero el memo se limpia desde aqui y no desde cada sitio que toca el
     catalogo: si se limpia desde los sitios, el proximo que se olvide deja la
     malla a medias. Cuando T004 traiga `memoEstados`, su limpieza va en esta
     misma funcion. */
  function invalidarCatalogo() { _catMemo = null; }

  function catalogo() { return Mimo.leer().catalogo; }

  function CAT() {
    if (!_catMemo) {
      var c = catalogo();
      var o = {};
      for (var k in c) {
        if (Object.prototype.hasOwnProperty.call(c, k)) { o[k] = c[k]; }
      }
      _catMemo = o;
    }
    return _catMemo;
  }

  /* 'desbloquea' es el inverso de 'requisitos'. Se recalcula ENTERO cada vez que
     cambia el grafo, para que no queden flechas colgando cuando alguien corrige
     un prerrequisito mal puesto. */
  function recalcularDesbloquea() {
    var c = catalogo();
    var claves = Object.keys(c);
    var i, k;
    for (i = 0; i < claves.length; i++) { c[claves[i]].desbloquea = []; }
    for (i = 0; i < claves.length; i++) {
      k = claves[i];
      var reqs = c[k].requisitos || [];
      for (var j = 0; j < reqs.length; j++) {
        if (c[reqs[j]]) { c[reqs[j]].desbloquea.push(k); }
      }
    }
    invalidarCatalogo();
  }

  /* 'MA1001;FI2004|IQ2212' -> todos los de la izquierda del ';' son requisitos
     (Y); dentro de un grupo, las alternativas separadas por '|' bastan una (O).
     Un grupo de una sola alternativa es un requisito simple. */
  function requisitosDesdeTexto(txt) {
    txt = String(txt || '').trim();
    if (!txt) { return { requisitos: [], requisitos_o: [] }; }
    var requisitos = [];
    var requisitos_o = [];
    var grupos = txt.split(';');
    for (var i = 0; i < grupos.length; i++) {
      var crudas = grupos[i].split('|');
      var alts = [];
      for (var j = 0; j < crudas.length; j++) {
        var a = crudas[j].replace(/^\s+|\s+$/g, '').toUpperCase();
        if (a) { alts.push(a); }
      }
      if (!alts.length) { continue; }
      if (alts.length === 1) { requisitos.push(alts[0]); }
      else { requisitos_o.push(alts); }
    }
    return { requisitos: requisitos, requisitos_o: requisitos_o };
  }

  /* Un ramo SIN nivel (electivo, o suelto) NO es nivel 1: va a la columna de
     electivos (99). Antes `Number(datos.nivel) || 1` lo arrojaba al semestre I
     y se amontonaban ramos que no corresponden ahi. Si quien llama no trae
     'nivel' (p. ej. solo marca `anual: true`), NO se toca el nivel que el ramo
     ya tenia: forzar 99 lo sacaba de su columna y lo dibujaba como electivo. */
  function ramoEnCatalogo(cod, datos) {
    cod = String(cod || '').replace(/^\s+|\s+$/g, '').toUpperCase();
    if (!cod) { return null; }
    datos = datos || {};
    var e = Mimo.leer();
    var prev = e.catalogo[cod];
    var traeNivel = (datos.nivel !== undefined && datos.nivel !== null && datos.nivel !== '');
    var raw = Number(datos.nivel);
    var n = traeNivel
      ? ((raw > 0 && raw < 99) ? raw : 99)
      : ((prev && prev.nivel !== undefined && prev.nivel !== null) ? Number(prev.nivel) : 99);

    var base = {
      nombre: cod, creditos: 0, aprobacion: null, requisitos: [], desbloquea: [],
      en_malla: true, tipo: 'obligatorio', requisitos_o: [],
      dificultad: null, prioridad: null, descripcion: null, equivalente: null,
      universidad: null, carrera: null,
      tramo: 'semestre',          // 'semestre' | 'trimestre' | 'nivel'
      espacio: null,              // {tipo, cantidad} o null
      equivalentes: [],           // [{cod, origen:'misma'|'externa'}]
      demanda_tiempo: null,       // 1..5
      demanda_academica: null     // 1..5
    };
    var mezcla = {};
    var claves;
    var i;
    claves = Object.keys(base);
    for (i = 0; i < claves.length; i++) { mezcla[claves[i]] = base[claves[i]]; }
    claves = Object.keys(prev || {});
    for (i = 0; i < claves.length; i++) { mezcla[claves[i]] = prev[claves[i]]; }
    claves = Object.keys(datos);
    for (i = 0; i < claves.length; i++) { mezcla[claves[i]] = datos[claves[i]]; }
    mezcla.nivel = n;
    mezcla.semestre_num = n;
    mezcla.semestre = String(n);

    e.catalogo[cod] = mezcla;
    invalidarCatalogo();
    recalcularDesbloquea();
    return e.catalogo[cod];
  }

  function borrarRamo(cod) {
    cod = String(cod || '').replace(/^\s+|\s+$/g, '').toUpperCase();
    var e = Mimo.leer();
    if (e.catalogo[cod]) { delete e.catalogo[cod]; }
    var c = CAT();
    var claves = Object.keys(c);
    for (var i = 0; i < claves.length; i++) {
      var r = c[claves[i]];
      r.requisitos = (r.requisitos || []).filter(function (x) { return x !== cod; });
      r.requisitos_o = (r.requisitos_o || []).filter(function (g) { return g !== cod; });
    }
    invalidarCatalogo();
    recalcularDesbloquea();
  }

  /* ===================== LAS PIEZAS DE LA MALLA (T004) ======================
     La reticula necesita tres cosas que este fichero no daba: las columnas
     (NIVELES), las secciones de la carrera (SECC) y el semestre en curso
     (ramosDeSem / ramoNuevo / agregarRamo). Se portan de
     `referencia/mimo-app-53cc22d/js/comun/03-catalogo.js:25-105,199-258` con dos
     cambios de forma, dichos aqui porque son los que se van a encontrar:

       1. La app anterior tenia DOS fuentes de ramos (archivo `D` + usuario `E`).
          Aqui solo hay `E.catalogo`, asi que NIVELES() mira CAT() y no fusiona.
       2. `ramosDeSem(sem)` de la referencia recibia un SEMESTRE con su lista de
          ramos. Aqui no hay semestre elegido: el semestre en curso es la lista
          `E.malla.ramos`, y `ramosDeSem(nivel)` devuelve solo los de esa columna.

     EL ESTADO DE MALLA VIVE EN `E.malla`. `almacen.js` normaliza campo a campo y
     descarta lo que no conoce, asi que el namespace se declaro en `estadoInicial()`
     y en `normalizar()` (lo sumo el Lead al revisar T004: el brief no dejaba tocar
     `almacen.js` y el hijo lo espejo en `E.ajustes.malla`; ese espejo se rescata una
     vez en `normalizar()` y ya no se escribe). El motor escribe SIEMPRE por esta
     puerta: una sola verdad, `E.malla`.
     ========================================================================= */

  function esObjeto(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  /* La foto de fabrica de `E.malla`. El contrato de T004 la fija con estas siete
     claves; las desconocidas se caen (una importacion vieja no debe meter basura). */
  function sembrarMalla(d) {
    var o = esObjeto(d) ? d : {};
    return {
      aprobados: esObjeto(o.aprobados) ? o.aprobados : {},
      secciones: Array.isArray(o.secciones) ? o.secciones : [],
      niveles: Array.isArray(o.niveles) ? o.niveles : [],
      ramos: Array.isArray(o.ramos) ? o.ramos : [],
      importado: (o.importado === undefined) ? null : o.importado,
      notas: esObjeto(o.notas) ? o.notas : {},
      ajustes: esObjeto(o.ajustes) ? o.ajustes : {}
    };
  }

  function estadoMalla() {
    var e = Mimo.leer();
    if (!esObjeto(e.malla)) {
      e.malla = sembrarMalla(esObjeto(e.ajustes) ? e.ajustes.malla : null);
    }
    return e.malla;
  }

  // Columna de un ramo: su `nivel`; sin nivel o fuera de rango, electivos (99).
  function nivelDeRamo(r) {
    var n = Number(r && r.nivel);
    if (!isFinite(n) || n <= 0) { return 99; }
    return n > 99 ? 99 : n;
  }

  /* LAS COLUMNAS, portadas de comun/03-catalogo.js:25-68. Diferencias declaradas:
     - las columnas guardadas (`E.malla.niveles`) fijan ORDEN y TITULO; los niveles
       que aparecen despues se agregan detras, en orden numerico, y si el usuario
       no guardo ninguna columna se ordenan todas igual que la referencia;
     - los electivos (99) van SIEMPRE al final, aunque una columna guardada los
       pusiera en medio: es una regla del encargo, no del dato.
     - un ramo con `en_malla === false` no se dibuja, pero sigue en el catalogo. */
  function NIVELES() {
    var m = estadoMalla();
    var c = CAT();
    var titulos = {}, guardados = [], nuevos = [], i, k, n;
    for (i = 0; i < m.niveles.length; i++) {
      n = Number(m.niveles[i] && m.niveles[i].nivel);
      if (!isFinite(n) || n <= 0 || guardados.indexOf(n) >= 0) { continue; }
      guardados.push(n);
      if (m.niveles[i].titulo) { titulos[n] = String(m.niveles[i].titulo); }
    }
    var por = {};
    var claves = Object.keys(c);
    for (i = 0; i < claves.length; i++) {
      k = claves[i];
      if (c[k].en_malla === false) { continue; }
      n = nivelDeRamo(c[k]);
      (por[n] = por[n] || []).push(k);
      if (guardados.indexOf(n) < 0 && nuevos.indexOf(n) < 0) { nuevos.push(n); }
    }
    nuevos.sort(function (a, b) {
      if (a === b) { return 0; }
      if (a === 99) { return 1; }
      if (b === 99) { return -1; }
      return a - b;
    });
    var orden = guardados.concat(nuevos);
    var i99 = orden.indexOf(99);
    if (i99 >= 0) { orden.splice(i99, 1); orden.push(99); }
    var salida = [];
    for (i = 0; i < orden.length; i++) {
      n = orden[i];
      salida.push({
        nivel: n,
        titulo: titulos[n] || (n === 99 ? 'Electivos' : 'Nivel ' + n),
        ramos: (por[n] || []).slice().sort()
      });
    }
    return salida;
  }

  function SECC() { return estadoMalla().secciones; }

  /* Los ramos EN CURSO de una columna. Sin argumento devuelve todos: el simulador
     y el importador necesitan la lista entera. */
  function ramosDeSem(nivel) {
    var m = estadoMalla();
    var filtro = (nivel === undefined || nivel === null || nivel === '') ? null : Number(nivel);
    var out = [];
    for (var i = 0; i < m.ramos.length; i++) {
      var r = m.ramos[i] || {};
      var n = Number(r.nivel);
      if (filtro !== null && n !== filtro) { continue; }
      out.push({
        codigo: String(r.codigo || '').toUpperCase(),
        nombre: String(r.nombre || r.codigo || ''),
        creditos: Number(r.creditos) || 0,
        nivel: isFinite(n) && n > 0 ? n : 99
      });
    }
    return out;
  }

  function ramoNuevo(cod) {
    cod = String(cod || '').replace(/^\s+|\s+$/g, '').toUpperCase();
    var c = CAT()[cod];
    if (!c) { return null; }
    return {
      codigo: cod,
      nombre: String(c.nombre || cod),
      creditos: Number(c.creditos) || 0,
      nivel: nivelDeRamo(c)
    };
  }

  /* Agrega a "en curso" sin duplicar y guarda con aviso. Devuelve la entrada nueva,
     o null si el ramo no esta en el catalogo o ya estaba en curso (no se inventa ni
     se duplica: dos entradas del mismo codigo son dos veces el mismo ramo). */
  function agregarRamo(cod) {
    var r = ramoNuevo(cod);
    if (!r) { return null; }
    var m = estadoMalla();
    for (var i = 0; i < m.ramos.length; i++) {
      if (String(m.ramos[i].codigo || '').toUpperCase() === r.codigo) { return null; }
    }
    m.ramos.push(r);
    Mimo.guardar(r.codigo + ' en curso');
    return r;
  }

  Mimo.CAT = CAT;
  Mimo.invalidarCatalogo = invalidarCatalogo;
  Mimo.ramoEnCatalogo = ramoEnCatalogo;
  Mimo.borrarRamo = borrarRamo;
  Mimo.requisitosDesdeTexto = requisitosDesdeTexto;
  Mimo.recalcularDesbloquea = recalcularDesbloquea;
  Mimo.estadoMalla = estadoMalla;
  Mimo.NIVELES = NIVELES;
  Mimo.SECC = SECC;
  Mimo.ramosDeSem = ramosDeSem;
  Mimo.ramoNuevo = ramoNuevo;
  Mimo.agregarRamo = agregarRamo;
})(MimoComun);
