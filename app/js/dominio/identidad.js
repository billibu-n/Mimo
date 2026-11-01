/* identidad.js — la identidad de un ramo: su color y su icono, en un solo sitio.

   Antes cada vista se inventaba el color: `colorAutoDe()` lo sacaba del índice del
   ramo en la lista, así que al crear o reordenar ramos los colores cambiaban
   solos. Ahora:

   1. Si el ramo trae `color` válido, ese manda.
   2. Si no, el color sale de un hash estable de su código (mismo ramo, mismo
      color, para siempre y en cualquier equipo). Ya no hay azar ni índices.
   3. El icono funciona igual: `icono` guardado (un id del catálogo) o el que
      toque por el hash del código.

   Lo que se guarda es el id del icono (`"i-libro"`), nunca HTML ni SVG suelto.
   La paleta y el catálogo salen de los iconos que ya tiene el proyecto.

   Referencia medida en Mimo Académics (`js/comun/03-catalogo.js`): la paleta de
   ramos era fija y el color se guardaba por ramo (`color`); los ramos nuevos
   tomaban el primer color libre de la paleta. Aquí el criterio es el mismo
   (paleta fija, color por ramo) pero el reparto es reproducible, no por orden. */
(function () {
  "use strict";

  var PALETA = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0e7490", "#be123c", "#0f766e", "#a16207", "#dc2626"];

  /* El catálogo ya no vive aquí: lo pone js/dominio/iconos-ramo.js (121 iconos
     con categoría y etiquetas). Esta lista corta es el respaldo por si el módulo
     no cargó: la app sigue funcionando con los iconos de siempre. */
  var RESPALDO = ["i-libro", "i-cal", "i-malla", "i-estudio", "i-tiempo", "i-tareas", "i-notas",
                  "i-bloque", "i-corazon", "i-play", "i-lupa", "i-alerta", "i-check", "i-sol",
                  "i-luna", "i-nube"];
  /* Los iconos de la ronda anterior se traducen al catálogo nuevo para no perder
     la elección de nadie. */
  var MIGRACION = {
    "i-libro": "i-ramo-libro", "i-cal": "i-ramo-grafico", "i-malla": "i-ramo-engranaje",
    "i-estudio": "i-ramo-cuaderno", "i-tiempo": "i-ramo-historia", "i-tareas": "i-ramo-texto",
    "i-notas": "i-ramo-lapiz", "i-bloque": "i-ramo-puzzle", "i-corazon": "i-ramo-pulso",
    "i-play": "i-ramo-musica", "i-lupa": "i-ramo-buscar", "i-alerta": "i-ramo-bombilla",
    "i-check": "i-ramo-codigo", "i-sol": "i-ramo-sol", "i-luna": "i-ramo-luna", "i-nube": "i-ramo-nube"
  };

  function hex(v) {
    return /^#[0-9a-f]{6}$/i.test(String(v == null ? "" : v)) ? String(v).toLowerCase() : "";
  }

  /* djb2: chico, estable y sin estado. El mismo código da siempre el mismo número. */
  function hash(txt) {
    var s = String(txt == null ? "" : txt), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h;
  }

  function codigoDe(c) {
    if (typeof c === "string") return c;
    return (c && c.codigo) || "";
  }
  function catalogo() { return window.MimoIconosRamo || null; }
  function idsDeIconos() {
    var c = catalogo();
    return c && c.IDS && c.IDS.length ? c.IDS : RESPALDO;
  }
  function colorAuto(codigo) { return PALETA[hash(codigo) % PALETA.length]; }
  function iconoAuto(codigo) {
    var ids = idsDeIconos();
    return ids[hash("icono:" + codigo) % ids.length];
  }
  /* Un icono guardado vale si está en el catálogo o si es uno de los antiguos
     (se traduce al catálogo nuevo en cuanto se normaliza el ramo). */
  function esIcono(id) {
    var v = String(id || "");
    if (!v) return false;
    var c = catalogo();
    if (c && c.esIcono(v)) return true;
    return Object.prototype.hasOwnProperty.call(MIGRACION, v);
  }
  function iconoVigente(id) {
    var v = String(id || "");
    if (!v) return "";
    var c = catalogo();
    if (c && c.esIcono(v)) return v;
    if (Object.prototype.hasOwnProperty.call(MIGRACION, v)) return MIGRACION[v];
    return "";
  }

  function colorDe(c) {
    var propio = c && typeof c === "object" ? hex(c.color) : "";
    return propio || colorAuto(codigoDe(c));
  }
  function iconoDe(c) {
    var guardado = c && typeof c === "object" ? String(c.icono || "") : "";
    return iconoVigente(guardado) || iconoAuto(codigoDe(c));
  }
  function esColor(v) { return !!hex(v); }

  /* El icono del ramo, listo para pintar. Lleva el color como variable CSS para
     que el estilo lo use sin que cada vista repita el hex. */
  function iconoHTML(c, clase) {
    return '<svg class="icono ramo-ico' + (clase ? " " + clase : "") + '" style="--ramo:' + colorDe(c) +
      '" aria-hidden="true"><use href="#' + iconoDe(c) + '"/></svg>';
  }
  /* Punto de color para listas densas (chips del calendario, filas de sesiones). */
  function puntoHTML(c, clase) {
    return '<i class="ramo-punto' + (clase ? " " + clase : "") + '" style="--ramo:' + colorDe(c) +
      '" aria-hidden="true"></i>';
  }

  /* Deja el ramo con datos válidos: un color que no sea #rrggbb se descarta y un
     icono que no esté en el catálogo también (vuelven al criterio automático). */
  function normalizar(c) {
    if (!c || typeof c !== "object") return c;
    if (c.color != null && !hex(c.color)) delete c.color;
    else if (hex(c.color)) c.color = hex(c.color);
    if (c.icono != null) {
      var vigente = iconoVigente(c.icono);
      if (vigente) c.icono = vigente;
      else delete c.icono;
    }
    return c;
  }

  window.MimoIdentidad = {
    PALETA: PALETA.slice(),
    ICONOS: idsDeIconos().slice(),
    hash: hash,
    colorAuto: colorAuto,
    iconoAuto: iconoAuto,
    colorDe: colorDe,
    iconoDe: iconoDe,
    esColor: esColor,
    esIcono: esIcono,
    iconoVigente: iconoVigente,
    iconoHTML: iconoHTML,
    puntoHTML: puntoHTML,
    normalizar: normalizar
  };
})();
