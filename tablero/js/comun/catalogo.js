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

  Mimo.CAT = CAT;
  Mimo.invalidarCatalogo = invalidarCatalogo;
  Mimo.ramoEnCatalogo = ramoEnCatalogo;
  Mimo.borrarRamo = borrarRamo;
  Mimo.requisitosDesdeTexto = requisitosDesdeTexto;
  Mimo.recalcularDesbloquea = recalcularDesbloquea;
})(MimoComun);
