/* iconos-pack.js — paquetes de iconos, con origen, licencia y respaldo.

   Un icono ya no es "un id del sprite": es una referencia `pack:icono`. El pack
   declara su nombre, su procedencia y su licencia; la interfaz los muestra y la
   documentación los repite. Hay tres clases de pack:

     1. `nativo` — los iconos de Mimo (catálogo de ramo, Lucide/ISC). No se
        copian: se resuelven contra el sprite que ya está en index.html.
     2. `kde` — muestra de terceros: KDE Breeze (LGPL), en pack-kde.js. Sirve
        para demostrar que un pack ajeno entra sin tocar el código.
     3. `usuario-*` — carpetas que importa el usuario. Se guardan saneadas en
        `estado.iconos` (localStorage) y viajan en el respaldo como un campo más.

   Reglas de tolerancia:
     - Los ids son estables: `pack:archivo`. Reimportar un pack conserva lo elegido.
     - Si un pack o un icono falta, `resolver()` devuelve el nativo de respaldo y
       marca `data-fallback="1"`; el id guardado no se pierde y vuelve a resolver
       solo si el pack reaparece.
     - Un SVG de usuario se sanea antes de guardarlo: se quitan scripts, eventos,
       referencias externas, animaciones y estilos ejecutables. Solo quedan
       geometría y pintura.

   Sin dependencias: DOMParser y FileReader del navegador, nada más. */
(function () {
  "use strict";

  var L = function (es) { return es; };
  var usuario = { v: 1, activo: "nativo", packs: [] };
  var proveedor = null;
  var nativo = null, kde = null;
  var packsCache = [];
  var simbolos = {};
  var sprite = null;

  var LEGADO = {
    diana: "i-ramo-diana", agua: "i-ramo-gota", libro: "i-ramo-libro",
    pesa: "i-ramo-actividad", estudio: "i-ramo-cuaderno", peso: "i-ramo-balanza",
    corazon: "i-ramo-pulso", dinero: "i-ramo-monedas", otro: "i-ramo-estrella"
  };
  var RESPALDO = "nativo:i-ramo-estrella";
  var MAX_ICONOS = 300, MAX_BYTES = 300 * 1024, MAX_TOTAL = 3 * 1024 * 1024;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function slug(v) {
    var s = String(v == null ? "" : v).toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "sin-nombre";
  }
  function titulo(v) {
    return String(v == null ? "" : v).replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function hex(v) { return /^#[0-9a-f]{6}$/i.test(String(v == null ? "" : v)) ? String(v).toLowerCase() : ""; }

  function nombreNativo(id) {
    var clave = "ico." + String(id).replace(/^i-ramo-/, "");
    if (window.MimoI18n && typeof window.MimoI18n.clave === "function") {
      var v = window.MimoI18n.clave(clave);
      if (v && v !== clave) return v;
    }
    return titulo(String(id).replace(/^i-ramo-/, ""));
  }

  function manifiestoNativo() {
    var cat = window.MimoIconosRamo;
    var iconos = [];
    if (cat && cat.ICONOS) {
      cat.ICONOS.forEach(function (i) {
        iconos.push({
          id: i.id, nombre: nombreNativo(i.id), cat: i.cat || "varios",
          tags: (i.tags || []).slice(), tipo: "simbolo"
        });
      });
    }
    return {
      id: "nativo", nombre: "Mimo nativo", procedencia: "Mimo · Lucide",
      licencia: "ISC", origen: "https://lucide.dev", iconos: iconos
    };
  }

  /* ---- saneado de SVG ---------------------------------------------------- */
  var TAGS = {
    svg: 1, g: 1, path: 1, circle: 1, rect: 1, ellipse: 1, line: 1, polyline: 1,
    polygon: 1, title: 1, desc: 1, use: 1, defs: 1, linearGradient: 1,
    radialGradient: 1, stop: 1
  };
  var ATTRS = {
    d: 1, cx: 1, cy: 1, r: 1, rx: 1, ry: 1, x: 1, y: 1, x1: 1, y1: 1, x2: 1, y2: 1,
    width: 1, height: 1, viewbox: 1, transform: 1, points: 1, offset: 1,
    fill: 1, stroke: 1, "stroke-width": 1, "stroke-linecap": 1, "stroke-linejoin": 1,
    "stroke-miterlimit": 1, "stroke-dasharray": 1, "stroke-dashoffset": 1,
    "fill-rule": 1, "clip-rule": 1, opacity: 1, "fill-opacity": 1, "stroke-opacity": 1,
    "stop-color": 1, "stop-opacity": 1, "gradientunits": 1, "gradienttransform": 1,
    "preserveaspectratio": 1, href: 1, "xlink:href": 1
  };
  var ESTILOS = {
    fill: 1, stroke: 1, "stroke-width": 1, "stroke-linecap": 1, "stroke-linejoin": 1,
    "fill-opacity": 1, "stroke-opacity": 1, "fill-rule": 1, "clip-rule": 1, opacity: 1,
    color: 1, "stop-color": 1, "stop-opacity": 1
  };
  function estiloAAttrs(nodo, texto) {
    String(texto || "").split(";").forEach(function (parte) {
      var i = parte.indexOf(":");
      if (i < 1) return;
      var k = parte.slice(0, i).trim().toLowerCase();
      var v = parte.slice(i + 1).trim();
      if (!ESTILOS[k] || !v || /url\s*\(|expression|javascript|@import/i.test(v)) return;
      nodo.setAttribute(k, v);
    });
  }
  function limpiarNodo(nodo) {
    if (nodo.nodeType !== 1) return;
    var tag = String(nodo.tagName || "").toLowerCase();
    if (!TAGS[tag]) { if (nodo.parentNode) nodo.parentNode.removeChild(nodo); return; }
    Array.prototype.slice.call(nodo.attributes || []).forEach(function (a) {
      var n = String(a.name || "").toLowerCase();
      if (!ATTRS[n]) { nodo.removeAttribute(a.name); return; }
      var v = String(a.value || "");
      if ((n === "href" || n === "xlink:href") && !/^#/.test(v)) { nodo.removeAttribute(a.name); return; }
      if (/url\s*\(|expression|javascript:/i.test(v)) { nodo.removeAttribute(a.name); return; }
    });
    var estilo = nodo.getAttribute("style");
    if (estilo) { estiloAAttrs(nodo, estilo); nodo.removeAttribute("style"); }
    Array.prototype.slice.call(nodo.childNodes || []).forEach(limpiarNodo);
  }
  function sanear(texto) {
    if (!texto || typeof texto !== "string") return null;
    try {
      var doc = new DOMParser().parseFromString(texto, "image/svg+xml");
      if (!doc || doc.querySelector("parsererror")) return null;
      var raiz = doc.documentElement;
      if (!raiz || String(raiz.tagName).toLowerCase() !== "svg") return null;
      var viewBox = raiz.getAttribute("viewBox") || "0 0 24 24";
      limpiarNodo(raiz);
      var cuerpo = String(raiz.innerHTML || "").trim();
      if (!/<(path|circle|rect|ellipse|line|polyline|polygon|use)\b/i.test(cuerpo)) return null;
      return { viewBox: viewBox, cuerpo: cuerpo };
    } catch (e) { return null; }
  }

  /* ---- packs -------------------------------------------------------------- */
  function normalizarIcono(i) {
    if (!i || i.id == null) return null;
    var s = i.svg && i.svg.cuerpo ? { viewBox: i.svg.viewBox || "0 0 24 24", cuerpo: i.svg.cuerpo }
      : sanear(i.svg || "");
    if (!s) return null;
    return {
      id: String(i.id), nombre: String(i.nombre || titulo(i.id)), cat: String(i.cat || "general"),
      tags: Array.isArray(i.tags) ? i.tags.map(String) : [],
      viewBox: s.viewBox, cuerpo: s.cuerpo
    };
  }
  function normalizarPack(p) {
    if (!p || !p.id) return null;
    var iconos = (Array.isArray(p.iconos) ? p.iconos : []).map(normalizarIcono).filter(Boolean);
    if (!iconos.length) return null;
    return {
      id: slug(p.id), nombre: String(p.nombre || p.id).slice(0, 80),
      procedencia: String(p.procedencia || "").slice(0, 160),
      licencia: String(p.licencia || "").slice(0, 120),
      origen: String(p.origen || "").slice(0, 200),
      iconos: iconos
    };
  }
  function leerEstado(d) {
    d = d && typeof d === "object" ? d : {};
    return {
      v: 1,
      activo: String(d.activo || "nativo"),
      packs: (Array.isArray(d.packs) ? d.packs : []).map(normalizarPack).filter(Boolean)
    };
  }
  function guardarEstado() {
    if (proveedor && typeof proveedor.guardar === "function") {
      try { proveedor.guardar(usuario); } catch (e) {}
    }
  }

  function crearSimbolo(id, cuerpo) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
    s.setAttribute("id", id);
    s.innerHTML = cuerpo;
    return s;
  }
  function inyectar() {
    if (!document.body) return;
    if (!sprite) {
      sprite = document.getElementById("mimo-pack-sprite");
      if (!sprite) {
        sprite = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        sprite.setAttribute("id", "mimo-pack-sprite");
        sprite.setAttribute("aria-hidden", "true");
        sprite.setAttribute("focusable", "false");
        sprite.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
        document.body.appendChild(sprite);
      }
    }
    sprite.innerHTML = "";
    simbolos = {};
    packsCache.forEach(function (pack) {
      if (pack.id === "nativo") return;
      pack.iconos.forEach(function (ico) {
        var ref = pack.id + ":" + ico.id;
        var sid = "pk-" + slug(pack.id) + "-" + slug(ico.id);
        var base = sid, n = 2;
        while (document.getElementById(sid)) sid = base + "-" + (n++);
        simbolos[ref] = sid;
        var sym = crearSimbolo(sid, ico.cuerpo);
        sym.setAttribute("viewBox", ico.viewBox || "0 0 24 24");
        sprite.appendChild(sym);
      });
    });
  }

  function construir() {
    nativo = manifiestoNativo();
    var k = window.MimoPackKDE ? normalizarPack(window.MimoPackKDE) : null;
    kde = k && k.id === "kde" ? k : null;
    packsCache = [nativo];
    if (kde) packsCache.push(kde);
    packsCache = packsCache.concat(usuario.packs);
    inyectar();
    return packsCache;
  }

  function packPorId(id) {
    id = String(id || "");
    for (var i = 0; i < packsCache.length; i++) if (packsCache[i].id === id) return packsCache[i];
    return null;
  }
  function canonico(ref) {
    var s = String(ref == null ? "" : ref).trim();
    if (!s) return "";
    if (s.indexOf(":") > 0) return s;
    if (LEGADO[s]) return "nativo:" + LEGADO[s];
    if (window.MimoIconosRamo && window.MimoIconosRamo.esIcono(s)) return "nativo:" + s;
    return "";
  }
  function partes(ref) {
    var c = canonico(ref);
    if (!c) return null;
    var i = c.indexOf(":");
    return { pack: c.slice(0, i), id: c.slice(i + 1), ref: c };
  }
  function resolver(ref) {
    var p = partes(ref);
    var pack = p ? packPorId(p.pack) : null;
    var ico = null;
    if (pack) {
      for (var i = 0; i < pack.iconos.length; i++) if (pack.iconos[i].id === p.id) { ico = pack.iconos[i]; break; }
    }
    if (ico) return { ok: true, faltante: false, ref: p.ref, pack: pack, icono: ico };
    var fb = partes(RESPALDO);
    var fp = packPorId(fb.pack);
    var fi = fp && fp.iconos.filter(function (x) { return x.id === fb.id; })[0];
    return { ok: false, faltante: true, ref: p ? p.ref : String(ref || ""), pack: fp, icono: fi, original: String(ref || "") };
  }
  function html(ref, opts) {
    opts = opts || {};
    var r = resolver(ref);
    if (!r.icono) return "";
    var clases = "icono" + (opts.clase ? " " + opts.clase : "");
    var attrs = ' class="' + esc(clases) + '" data-icono="' + esc(r.ref) + '"' +
      (r.faltante ? ' data-fallback="1"' : "") +
      (opts.style ? ' style="' + esc(opts.style) + '"' : "") +
      ' aria-hidden="true" focusable="false"';
    if (r.icono.tipo === "simbolo") {
      return "<svg" + attrs + '><use href="#' + esc(r.icono.id) + '"/></svg>';
    }
    var sid = simbolos[r.pack.id + ":" + r.icono.id];
    if (!sid) return html(RESPALDO, opts);
    return "<svg" + attrs + '><use href="#' + esc(sid) + '"/></svg>';
  }
  function nombre(ref) {
    var r = resolver(ref);
    return r.icono ? r.icono.nombre : "";
  }
  function credito(pack) {
    if (!pack) return "";
    var partes = [pack.procedencia, pack.licencia].filter(Boolean);
    if (pack.origen) partes.push(pack.origen);
    return partes.join(" · ");
  }

  /* ---- importación de una carpeta ---------------------------------------- */
  function leerTexto(file) {
    return new Promise(function (resolve) {
      try {
        var fr = new FileReader();
        fr.onload = function () { resolve(String(fr.result || "")); };
        fr.onerror = function () { resolve(""); };
        fr.readAsText(file);
      } catch (e) { resolve(""); }
    });
  }
  function importar(files, nombre) {
    var lista = Array.prototype.slice.call(files || []).filter(function (f) {
      return /\.svg$/i.test(String(f.name || "")) && (Number(f.size) || 0) <= MAX_BYTES;
    }).slice(0, MAX_ICONOS);
    if (!lista.length) return Promise.reject(new Error(L("No hay archivos SVG en esa carpeta.")));
    var total = 0;
    var elegidos = [];
    lista.forEach(function (f) { if (total + (Number(f.size) || 0) <= MAX_TOTAL) { elegidos.push(f); total += Number(f.size) || 0; } });
    return Promise.all(elegidos.map(function (f) { return leerTexto(f).then(function (t) { return { f: f, t: t }; }); }))
      .then(function (leidos) {
        var iconos = [], usados = {}, descartados = 0;
        leidos.forEach(function (x) {
          var s = sanear(x.t);
          if (!s) { descartados++; return; }
          var base = slug(String(x.f.name || "").replace(/\.svg$/i, "")) || "icono";
          var id = base, n = 2;
          while (usados[id]) id = base + "-" + (n++);
          usados[id] = 1;
          iconos.push({ id: id, nombre: titulo(base), cat: "general", tags: [], viewBox: s.viewBox, cuerpo: s.cuerpo });
        });
        if (!iconos.length) throw new Error(L("Los SVG de esa carpeta no se pudieron leer."));
        var nombrePack = String(nombre || "").trim() || L("Mi pack");
        var pid = "usuario-" + slug(nombrePack);
        var existente = null;
        usuario.packs.forEach(function (p) { if (p.id === pid) existente = p; });
        var pack = {
          id: pid, nombre: nombrePack, procedencia: L("Carpeta local"), licencia: L("Uso personal"),
          origen: "", iconos: iconos
        };
        if (existente) {
          var porId = {};
          existente.iconos.forEach(function (i) { porId[i.id] = i; });
          iconos.forEach(function (i) { porId[i.id] = i; });
          existente.iconos = Object.keys(porId).map(function (k) { return porId[k]; });
          existente.nombre = nombrePack;
          pack = existente;
        } else {
          usuario.packs.push(pack);
        }
        usuario.activo = pid;
        guardarEstado();
        construir();
        return { pack: pack, agregados: iconos.length, descartados: descartados };
      });
  }
  function quitarPack(id) {
    if (String(id).indexOf("usuario-") !== 0) return false;
    usuario.packs = usuario.packs.filter(function (p) { return p.id !== id; });
    if (usuario.activo === id) usuario.activo = "nativo";
    guardarEstado();
    construir();
    return true;
  }

  function configurar(c) {
    c = c || {};
    proveedor = { leer: c.leer, guardar: c.guardar };
    if (typeof c.L === "function") L = c.L;
    var datos = null;
    try { datos = c.leer ? c.leer() : null; } catch (e) {}
    usuario = leerEstado(datos);
    construir();
  }
  function refrescar() {
    if (!proveedor) { construir(); return; }
    var datos = null;
    try { datos = proveedor.leer ? proveedor.leer() : null; } catch (e) {}
    usuario = leerEstado(datos);
    construir();
  }

  window.MimoIconosPack = {
    configurar: configurar,
    refrescar: refrescar,
    packs: function () { return packsCache.slice(); },
    pack: packPorId,
    packActivo: function () { return packPorId(usuario.activo) || nativo; },
    activarPack: function (id) {
      if (!packPorId(id)) return false;
      usuario.activo = id; guardarEstado(); return true;
    },
    resolver: resolver,
    html: html,
    nombre: nombre,
    credito: credito,
    importar: importar,
    quitarPack: quitarPack,
    sanear: sanear,
    LEGADO: LEGADO,
    RESPALDO: RESPALDO,
    MAX_ICONOS: MAX_ICONOS
  };
})();
