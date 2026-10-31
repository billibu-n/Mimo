/* registro.js — registro de bloques de Mimo.
   No conoce el DOM ni el estado del usuario: solo guarda manifiestos, valida
   dependencias y calcula el orden de las secciones. El shell decide qué hacer
   con cada bloque. */
(function () {
  "use strict";

  var API = 1;
  var TIPOS = ["seccion", "aporte", "pack", "hijo"];
  var porId = {};
  var orden = [];
  var errores = [];

  function texto(v) { return typeof v === "string" ? v.trim() : ""; }

  function normalizar(m) {
    if (!m || typeof m !== "object") throw new Error("manifiesto vacío");
    var id = texto(m.id);
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error("id inválido: " + id);
    if (porId[id]) throw new Error("bloque duplicado: " + id);
    var tipo = TIPOS.indexOf(m.tipo) !== -1 ? m.tipo : "seccion";
    var api = Number(m.api) || 1;
    if (api > API) throw new Error(id + ": api " + api + " no soportada");
    var n = {
      id: id,
      api: api,
      nombre: texto(m.nombre) || id,
      version: texto(m.version) || "1.0.0",
      tipo: tipo,
      origen: texto(m.origen) || "nativo",
      naturaleza: texto(m.naturaleza) || (tipo === "pack" ? "kit" : "base"),
      icono: texto(m.icono) || "i-bloque",
      codigo: texto(m.codigo),
      desc: texto(m.desc),
      tags: Array.isArray(m.tags) ? m.tags.slice() : [],
      fija: !!m.fija,
      oculto: !!m.oculto,
      padre: texto(m.padre) || null,
      instala: Array.isArray(m.instala) ? m.instala.slice() : [],
      orden: typeof m.orden === "number" ? m.orden : 100,
      requiere: Array.isArray(m.requiere) ? m.requiere.slice() : [],
      opcional: Array.isArray(m.opcional) ? m.opcional.slice() : [],
      provee: Array.isArray(m.provee) ? m.provee.slice() : [],
      montar: typeof m.montar === "function" ? m.montar : null,
      desmontar: typeof m.desmontar === "function" ? m.desmontar : null,
      pintar: typeof m.pintar === "function" ? m.pintar : null,
      panel: typeof m.panel === "function" ? m.panel : null,
      buscar: typeof m.buscar === "function" ? m.buscar : null,
      vista: typeof m.vista === "function" ? m.vista : (typeof m.vista === "string" ? m.vista : ""),
      css: texto(m.css),
      detalle: m.detalle && typeof m.detalle === "object" ? m.detalle : null,
      i18n: m.i18n && typeof m.i18n === "object" ? m.i18n : null
    };
    if (n.tipo === "hijo" && !n.padre) throw new Error(id + ": un hijo necesita padre");
    if (n.tipo === "pack" && !n.instala.length) throw new Error(id + ": un pack necesita instala");
    if (n.fija && n.tipo !== "seccion") throw new Error(id + ": solo una sección puede ser fija");
    return n;
  }

  function registrar(m) {
    var n;
    try {
      n = normalizar(m);
    } catch (e) {
      errores.push(String(e.message || e));
      throw e;
    }
    porId[n.id] = n;
    orden.push(n.id);
    return n;
  }

  function obtener(id) { return porId[id] || null; }

  function todos() {
    return orden.map(function (id) { return porId[id]; });
  }

  function visibles() {
    return todos().filter(function (b) { return !b.oculto; });
  }

  function base() {
    return todos().filter(function (b) { return b.fija && b.tipo === "seccion"; });
  }

  function opcionales() {
    return todos().filter(function (b) { return !b.fija && b.tipo === "seccion"; });
  }

  function hijosDe(padre) {
    return todos().filter(function (b) { return b.tipo === "hijo" && b.padre === padre; });
  }

  var instancias = {};

  function montar(id, root, ctx) {
    var b = porId[id];
    if (!b || !b.montar) return false;
    desmontar(id);
    var controlador = typeof AbortController === "function" ? new AbortController() : null;
    var api = {
      id: id,
      bloque: b,
      root: root || null,
      signal: controlador ? controlador.signal : null,
      ctx: ctx || {}
    };
    instancias[id] = { bloque: b, root: root || null, controlador: controlador, api: api };
    try {
      b.montar(api);
      return true;
    } catch (e) {
      delete instancias[id];
      throw e;
    }
  }

  function desmontar(id) {
    var inst = instancias[id];
    if (!inst) return false;
    try {
      if (inst.bloque.desmontar) inst.bloque.desmontar(inst.api);
    } finally {
      if (inst.controlador) inst.controlador.abort();
      delete instancias[id];
    }
    return true;
  }

  function montado(id) { return !!instancias[id]; }

  function pintar(id) {
    var b = porId[id];
    if (!b) return false;
    var inst = instancias[id];
    if (inst && inst.api.pintar) { inst.api.pintar(); return true; }
    if (b.pintar) { b.pintar(); return true; }
    return false;
  }

  function secciones(instalados) {
    var puestos = {};
    var out = [];
    function meter(id) {
      if (puestos[id]) return;
      var b = porId[id];
      if (!b || b.tipo !== "seccion") return;
      puestos[id] = 1;
      out.push(id);
    }
    base().sort(function (a, b) { return a.orden - b.orden; }).forEach(function (b) { meter(b.id); });
    opcionales().sort(function (a, b) { return a.orden - b.orden; }).forEach(function (b) {
      if ((instalados || []).indexOf(b.id) !== -1) meter(b.id);
    });
    if (porId.ajustes) {
      out = out.filter(function (id) { return id !== "ajustes"; });
      out.push("ajustes");
    }
    return out;
  }

  function validar() {
    var fallas = errores.slice();
    var visitando = {}, hecho = {};
    function visitar(b, ruta) {
      if (hecho[b.id]) return;
      if (visitando[b.id]) { fallas.push(b.id + ": ciclo de dependencias " + ruta.concat(b.id).join(" -> ")); return; }
      visitando[b.id] = 1;
      b.requiere.forEach(function (id) {
        var dep = porId[id];
        if (!dep) fallas.push(b.id + ": requiere un bloque inexistente: " + id);
        else visitar(dep, ruta.concat(b.id));
      });
      delete visitando[b.id];
      hecho[b.id] = 1;
    }
    todos().forEach(function (b) {
      if (b.tipo === "pack") {
        b.instala.forEach(function (id) {
          if (!porId[id]) fallas.push(b.id + ": instala un bloque inexistente: " + id);
        });
      }
      if (b.tipo === "hijo" && !porId[b.padre]) {
        fallas.push(b.id + ": padre inexistente: " + b.padre);
      }
      if (b.fija && b.tipo !== "seccion") {
        fallas.push(b.id + ": fija no es sección");
      }
      visitar(b, []);
    });
    return fallas;
  }

  function puedeInstalar(id, instalados) {
    var b = porId[id];
    if (!b) return { ok: false, motivo: "bloque inexistente: " + id };
    if (b.tipo === "pack") {
      var faltan = b.instala.filter(function (x) { return (instalados || []).indexOf(x) === -1; });
      return { ok: faltan.length > 0, motivo: faltan.length ? "" : "ya estaba completo", faltan: faltan, requiere: [] };
    }
    if ((instalados || []).indexOf(id) !== -1) return { ok: false, motivo: "ya estaba instalado", faltan: [], requiere: [] };
    var req = b.requiere.filter(function (x) { return (instalados || []).indexOf(x) === -1; });
    return { ok: req.length === 0, motivo: req.length ? "faltan dependencias" : "", faltan: [], requiere: req };
  }

  function puedeQuitar(id, instalados) {
    var b = porId[id];
    if (!b) return { ok: false, motivo: "bloque inexistente: " + id };
    if (b.fija) return { ok: false, motivo: "es base fija" };
    var fuera = b.tipo === "pack" ? b.instala.slice() : [id];
    var dependientes = todos().filter(function (x) {
      return fuera.indexOf(x.id) === -1 && (instalados || []).indexOf(x.id) !== -1 &&
        x.requiere.some(function (r) { return fuera.indexOf(r) !== -1; });
    }).map(function (x) { return x.id; });
    return { ok: dependientes.length === 0, motivo: dependientes.length ? "hay bloques que lo requieren" : "", fuera: fuera, dependientes: dependientes };
  }

  function contribucion(metodo, id) {
    var b = porId[id];
    return b && typeof b[metodo] === "function" ? b[metodo] : null;
  }

  window.MimoRegistro = {
    API: API,
    registrar: registrar,
    obtener: obtener,
    todos: todos,
    visibles: visibles,
    base: base,
    opcionales: opcionales,
    hijosDe: hijosDe,
    secciones: secciones,
    montar: montar,
    desmontar: desmontar,
    montado: montado,
    pintar: pintar,
    contribucion: contribucion,
    validar: validar,
    puedeInstalar: puedeInstalar,
    puedeQuitar: puedeQuitar,
    errores: function () { return errores.slice(); }
  };
})();
