/* progreso.js — motor de metas y registros de Mimo.
   Una meta declara qué se mide, cómo se agrega, cada cuánto y en qué sentido.
   Un registro es una medición con fecha. El progreso no se guarda: se calcula.
   No toca el DOM, no lee el estado global y no formatea para un idioma concreto:
   recibe datos y devuelve números y claves. El bloque decide cómo pintarlos. */
(function () {
  "use strict";

  var TIPOS = ["suma", "ultimo", "mejor", "conteo"];
  var SENTIDOS = ["subir", "bajar"];
  var PERIODOS = ["dia", "semana", "mes", "anio", "unica"];
  var TONOS = ["ac", "ok", "warn", "q", "bad"];
  var ICONOS = ["agua", "libro", "pesa", "estudio", "peso", "diana", "corazon", "dinero", "otro"];
  var TOPE = 5000;
  var CATEGORIA_DEFECTO = "general";

  function texto(v) { return typeof v === "string" ? v.trim() : ""; }
  function numero(v, def) {
    var n = Number(v);
    return isFinite(n) ? n : def;
  }
  function entero(v, min, max, def) {
    var n = parseInt(v, 10);
    if (!isFinite(n)) n = def;
    return Math.max(min, Math.min(max, n));
  }
  function conservar(destino, origen) {
    Object.keys(origen || {}).forEach(function (k) {
      if (!(k in destino)) destino[k] = origen[k];
    });
    return destino;
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function isoDe(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function aFecha(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var f = new Date(y, mo - 1, d, 12, 0, 0, 0);
    return f.getFullYear() === y && f.getMonth() === mo - 1 && f.getDate() === d ? f : null;
  }
  function hoyISO() { return isoDe(new Date()); }
  function selloLocal() {
    var d = new Date();
    return hoyISO() + "T" + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function sumaDias(iso, n) {
    var f = aFecha(iso);
    if (!f) return "";
    f.setDate(f.getDate() + n);
    return isoDe(f);
  }
  function lunesDe(iso) {
    var f = aFecha(iso);
    if (!f) return "";
    var d = (f.getDay() + 6) % 7;
    f.setDate(f.getDate() - d);
    return isoDe(f);
  }
  function finDeMes(iso) {
    var f = aFecha(iso);
    if (!f) return "";
    return isoDe(new Date(f.getFullYear(), f.getMonth() + 1, 0, 12, 0, 0, 0));
  }
  function inicioDeAnio(iso) {
    var f = aFecha(iso);
    return f ? f.getFullYear() + "-01-01" : "";
  }
  function finDeAnio(iso) {
    var f = aFecha(iso);
    return f ? f.getFullYear() + "-12-31" : "";
  }

  /* Una categoría agrupa metas y solo aporta nombre, icono, color y si está
     plegada. No guarda datos de las metas: eso vive en cada meta. */
  function normalizarCategoria(c, i) {
    if (!c || typeof c !== "object") return null;
    return conservar({
      id: texto(c.id) || "c" + (i + 1),
      nombre: texto(c.nombre) || "Categoría",
      icono: ICONOS.indexOf(String(c.icono)) !== -1 ? String(c.icono) : "diana",
      tono: TONOS.indexOf(String(c.tono)) !== -1 ? String(c.tono) : "ac",
      orden: entero(c.orden, 0, 9999, i),
      colapsada: !!c.colapsada
    }, c);
  }

  function normalizarMeta(m, i) {
    if (!m || typeof m !== "object") return null;
    var tipo = TIPOS.indexOf(String(m.tipo)) !== -1 ? String(m.tipo) : "suma";
    var sentido = SENTIDOS.indexOf(String(m.sentido)) !== -1 ? String(m.sentido) : "subir";
    var periodo = PERIODOS.indexOf(String(m.periodo)) !== -1 ? String(m.periodo) : "dia";
    var objetivo = numero(m.objetivo, 1);
    if (objetivo <= 0) objetivo = 1;
    var inicio = (m.inicio === "" || m.inicio === null || m.inicio === undefined) ? null : numero(m.inicio, null);
    if (inicio === null || !isFinite(inicio)) inicio = null;
    var paso = numero(m.paso, 1);
    if (paso <= 0) paso = 1;
    var desde = aFecha(m.desde) ? String(m.desde).slice(0, 10) : hoyISO();
    var hasta = aFecha(m.hasta) ? String(m.hasta).slice(0, 10) : "";
    var decimales = entero(m.decimales, 0, 3, tipo === "conteo" ? 0 : 1);
    var fuente = String(m.fuente) === "sesiones" ? "sesiones" : "manual";
    return conservar({
      id: texto(m.id) || "m" + (i + 1),
      nombre: texto(m.nombre) || "Meta",
      unidad: texto(m.unidad),
      tipo: tipo,
      sentido: sentido,
      periodo: periodo,
      objetivo: objetivo,
      inicio: inicio,
      desde: desde,
      hasta: hasta,
      paso: paso,
      decimales: decimales,
      tono: TONOS.indexOf(String(m.tono)) !== -1 ? String(m.tono) : "ac",
      icono: ICONOS.indexOf(String(m.icono)) !== -1 ? String(m.icono) : "diana",
      categoriaId: texto(m.categoriaId) || CATEGORIA_DEFECTO,
      orden: entero(m.orden, 0, 99999, i),
      fuente: fuente,
      tareaId: texto(m.tareaId),
      notaId: texto(m.notaId),
      archivada: !!m.archivada,
      creada: texto(m.creada) || selloLocal()
    }, m);
  }

  function normalizarRegistro(r, i) {
    if (!r || typeof r !== "object") return null;
    var cuando = texto(r.cuando);
    if (!aFecha(cuando)) cuando = hoyISO();
    var valor = numero(r.valor, 0);
    return conservar({
      id: texto(r.id) || "r" + (i + 1),
      metaId: texto(r.metaId),
      valor: valor,
      cuando: cuando,
      nota: texto(r.nota),
      tareaId: texto(r.tareaId),
      notaId: texto(r.notaId),
      origen: texto(r.origen) || "manual"
    }, r);
  }

  /* Normaliza el bloque completo sin borrar nada que no entienda. Los registros
     huérfanos se conservan: si la meta vuelve, los datos siguen ahí. */
  function normalizarEstado(doc) {
    if (!doc || typeof doc !== "object") return null;
    var p = doc.progreso && typeof doc.progreso === "object" ? doc.progreso : {};
    var categorias = [], cats = {};
    (Array.isArray(p.categorias) ? p.categorias : []).forEach(function (c, i) {
      var n = normalizarCategoria(c, i);
      if (!n || cats[n.id]) return;
      cats[n.id] = true;
      categorias.push(n);
    });
    if (!cats[CATEGORIA_DEFECTO]) {
      categorias.unshift(normalizarCategoria({ id: CATEGORIA_DEFECTO, nombre: "General", icono: "diana", tono: "ac", orden: 0 }, 0));
      cats[CATEGORIA_DEFECTO] = true;
    }
    categorias.sort(function (a, b) { return a.orden - b.orden; });
    var metas = [], vistos = {};
    (Array.isArray(p.metas) ? p.metas : []).forEach(function (m, i) {
      var n = normalizarMeta(m, i);
      if (!n || vistos[n.id]) return;
      vistos[n.id] = true;
      metas.push(n);
    });
    metas.forEach(function (m) {
      if (!m.categoriaId || !cats[m.categoriaId]) m.categoriaId = CATEGORIA_DEFECTO;
    });
    var registros = [], ids = {};
    (Array.isArray(p.registros) ? p.registros : []).forEach(function (r, i) {
      var n = normalizarRegistro(r, i);
      if (!n || ids[n.id]) return;
      ids[n.id] = true;
      registros.push(n);
    });
    doc.progreso = conservar({ v: 1, categorias: categorias, metas: metas, registros: registros }, p);
    doc.progreso.v = 1;
    doc.progreso.categorias = categorias;
    doc.progreso.metas = metas;
    doc.progreso.registros = registros;
    return doc.progreso;
  }

  function clavePeriodo(meta, fecha) {
    if (!meta) return "";
    var f = aFecha(fecha) ? String(fecha).slice(0, 10) : hoyISO();
    if (meta.periodo === "dia") return f;
    if (meta.periodo === "semana") return lunesDe(f);
    if (meta.periodo === "mes") return f.slice(0, 7);
    if (meta.periodo === "anio") return f.slice(0, 4);
    return "unica";
  }

  function rangoPeriodo(meta, clave) {
    if (!meta) return { desde: "", hasta: "" };
    if (meta.periodo === "dia") return { desde: clave, hasta: clave };
    if (meta.periodo === "semana") return { desde: clave, hasta: sumaDias(clave, 6) };
    if (meta.periodo === "mes") {
      var primero = clave + "-01";
      return { desde: primero, hasta: finDeMes(primero) };
    }
    if (meta.periodo === "anio") return { desde: clave + "-01-01", hasta: clave + "-12-31" };
    return { desde: meta.desde || "", hasta: meta.hasta || hoyISO() };
  }

  function siguiente(meta, clave) {
    if (meta.periodo === "dia") return sumaDias(clave, 1);
    if (meta.periodo === "semana") return sumaDias(clave, 7);
    if (meta.periodo === "mes") {
      var f = aFecha(clave + "-01");
      if (!f) return "";
      return isoDe(new Date(f.getFullYear(), f.getMonth() + 1, 1, 12, 0, 0, 0)).slice(0, 7);
    }
    if (meta.periodo === "anio") return String(parseInt(clave, 10) + 1);
    return "unica";
  }

  function anterior(meta, clave) {
    if (meta.periodo === "dia") return sumaDias(clave, -1);
    if (meta.periodo === "semana") return sumaDias(clave, -7);
    if (meta.periodo === "mes") {
      var f = aFecha(clave + "-01");
      if (!f) return "";
      return isoDe(new Date(f.getFullYear(), f.getMonth() - 1, 1, 12, 0, 0, 0)).slice(0, 7);
    }
    if (meta.periodo === "anio") return String(parseInt(clave, 10) - 1);
    return "unica";
  }

  /* Las claves de periodo van de la más vieja a la más nueva. Para `unica`
     hay una sola: no se reinicia. */
  function periodosDe(meta, hoy, n) {
    if (!meta || meta.periodo === "unica") return ["unica"];
    var total = Math.max(1, Math.min(TOPE, parseInt(n, 10) || 1));
    var out = [], clave = clavePeriodo(meta, hoy);
    for (var i = 0; i < total && clave; i++) {
      out.unshift(clave);
      clave = anterior(meta, clave);
    }
    return out;
  }

  function periodosEntre(meta, desde, hasta) {
    if (!meta || meta.periodo === "unica") return ["unica"];
    var out = [], clave = clavePeriodo(meta, desde), fin = clavePeriodo(meta, hasta);
    for (var i = 0; i < TOPE && clave; i++) {
      out.push(clave);
      if (clave === fin) break;
      clave = siguiente(meta, clave);
      if (!clave) break;
    }
    return out;
  }

  function registrosDe(meta, registros) {
    if (!meta) return [];
    return (Array.isArray(registros) ? registros : []).filter(function (r) {
      return r && r.metaId === meta.id;
    }).sort(function (a, b) {
      return String(a.cuando).localeCompare(String(b.cuando));
    });
  }

  function registrosEn(meta, registros, clave) {
    if (!meta) return [];
    var r = rangoPeriodo(meta, clave);
    return registrosDe(meta, registros).filter(function (x) {
      var d = String(x.cuando).slice(0, 10);
      return (!r.desde || d >= r.desde) && (!r.hasta || d <= r.hasta);
    });
  }

  function tieneDatos(meta, registros, clave) {
    return registrosEn(meta, registros, clave).length > 0;
  }

  function valorEn(meta, registros, clave) {
    if (!meta) return null;
    var lista = registrosEn(meta, registros, clave);
    if (meta.tipo === "conteo") return lista.length;
    if (meta.tipo === "suma") {
      return lista.reduce(function (s, x) { return s + (isFinite(x.valor) ? x.valor : 0); }, 0);
    }
    if (meta.tipo === "ultimo") return lista.length ? lista[lista.length - 1].valor : null;
    if (!lista.length) return null;
    var mejor = lista[0].valor;
    lista.forEach(function (x) {
      if (meta.sentido === "bajar" ? x.valor < mejor : x.valor > mejor) mejor = x.valor;
    });
    return mejor;
  }

  function cumple(meta, valor) {
    if (valor === null || valor === undefined || !isFinite(valor)) return false;
    return meta.sentido === "bajar" ? valor <= meta.objetivo : valor >= meta.objetivo;
  }

  /* Un periodo con `suma` vale 0 aunque no haya registros. Para una racha, un
     día sin datos no es un día cumplido: se corta, no se regala. */
  function cumplePeriodo(meta, registros, clave) {
    var v = valorEn(meta, registros, clave);
    if (v === null) return false;
    if ((meta.tipo === "suma" || meta.tipo === "conteo") && !tieneDatos(meta, registros, clave)) return false;
    return cumple(meta, v);
  }

  function proyecto(meta, registros, hoy) {
    var clave = clavePeriodo(meta, hoy);
    var rango = rangoPeriodo(meta, clave);
    var valor = valorEn(meta, registros, clave);
    var objetivo = meta.objetivo;
    var cerrado = meta.periodo === "unica"
      ? !!(meta.hasta && meta.hasta < String(hoy || hoyISO()).slice(0, 10))
      : clave !== clavePeriodo(meta, hoy);
    var cumplido = cumple(meta, valor);
    var exceso = meta.sentido === "bajar" && valor !== null ? Math.max(0, valor - objetivo) : 0;
    var resto = valor === null ? objetivo
      : (meta.sentido === "subir" ? Math.max(0, objetivo - valor) : Math.max(0, valor - objetivo));
    var avance = null;
    if (valor !== null) {
      if (meta.inicio !== null && meta.inicio !== objetivo) {
        avance = (valor - meta.inicio) / (objetivo - meta.inicio);
      } else if (meta.tipo === "suma" || meta.tipo === "conteo" || meta.sentido === "subir") {
        avance = valor / objetivo;
      }
    }
    if (avance !== null && !isFinite(avance)) avance = null;
    return {
      clave: clave,
      desde: rango.desde,
      hasta: rango.hasta,
      valor: valor,
      objetivo: objetivo,
      cumplido: cumplido,
      cerrado: cerrado,
      exceso: exceso,
      resto: resto,
      avance: avance,
      avancePct: avance === null ? null : Math.max(0, Math.min(100, Math.round(avance * 100))),
      pct: valor === null || !objetivo ? 0 : Math.max(0, Math.min(100, Math.round((valor / objetivo) * 100))),
      excedido: meta.sentido === "bajar" && valor !== null && valor > objetivo
    };
  }

  function serie(meta, registros, hoy, n) {
    n = Math.max(1, Math.min(400, parseInt(n, 10) || 14));
    if (meta.periodo === "unica") {
      return registrosDe(meta, registros).map(function (r) {
        return {
          clave: r.cuando,
          desde: String(r.cuando).slice(0, 10),
          hasta: String(r.cuando).slice(0, 10),
          valor: r.valor,
          objetivo: meta.objetivo,
          cumplido: cumple(meta, r.valor),
          actual: false
        };
      });
    }
    var actual = clavePeriodo(meta, hoy);
    return periodosDe(meta, hoy, n).map(function (c) {
      var r = rangoPeriodo(meta, c);
      var v = valorEn(meta, registros, c);
      return {
        clave: c,
        desde: r.desde,
        hasta: r.hasta,
        valor: v,
        objetivo: meta.objetivo,
        cumplido: v !== null && cumple(meta, v),
        actual: c === actual
      };
    });
  }

  function racha(meta, registros, hoy) {
    if (!meta || meta.periodo === "unica") return { actual: 0, mejor: 0 };
    var claves = periodosEntre(meta, meta.desde, hoy);
    if (!claves.length) return { actual: 0, mejor: 0 };
    var ultima = claves.length - 1;
    var actual = 0, i = ultima;
    if (meta.sentido === "subir") {
      /* El periodo actual está abierto: si ya se cumplió, suma; si no, no rompe
         la racha de los anteriores. El día aún no termina. */
      if (cumplePeriodo(meta, registros, claves[i])) { actual++; i--; }
      else i--;
      while (i >= 0 && cumplePeriodo(meta, registros, claves[i])) { actual++; i--; }
    } else {
      /* Un techo no se cumple hasta que el periodo cierra: el actual no cuenta. */
      i--;
      while (i >= 0 && cumplePeriodo(meta, registros, claves[i])) { actual++; i--; }
    }
    var mejor = 0, run = 0;
    for (var j = 0; j < claves.length; j++) {
      if (meta.sentido === "bajar" && j === ultima) break;
      if (cumplePeriodo(meta, registros, claves[j])) {
        run++;
        if (run > mejor) mejor = run;
      } else run = 0;
    }
    if (actual > mejor) mejor = actual;
    return { actual: actual, mejor: mejor };
  }

  function resumen(metas, registros, hoy) {
    var out = { total: 0, activas: 0, cumplidas: 0, pendientes: 0, vencidas: 0 };
    (metas || []).forEach(function (m) {
      if (m.archivada) return;
      out.total++;
      var p = proyecto(m, registros, hoy);
      if (p.cumplido && (m.sentido === "subir" || p.cerrado)) out.cumplidas++;
      else if (p.cerrado) out.vencidas++;
      else out.pendientes++;
    });
    out.activas = out.total - out.vencidas;
    return out;
  }

  function formatoValor(v, meta, locale) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    var d = entero(meta && meta.decimales, 0, 3, 1);
    try {
      return Number(v).toLocaleString(locale || "es-CL", {
        minimumFractionDigits: 0,
        maximumFractionDigits: d
      });
    } catch (e) {
      return String(Math.round(v * Math.pow(10, d)) / Math.pow(10, d));
    }
  }

  function nuevoId(prefijo) {
    return (prefijo || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  window.MimoProgreso = {
    TIPOS: TIPOS,
    SENTIDOS: SENTIDOS,
    PERIODOS: PERIODOS,
    TONOS: TONOS,
    ICONOS: ICONOS,
    CATEGORIA_DEFECTO: CATEGORIA_DEFECTO,
    normalizarCategoria: normalizarCategoria,
    normalizarMeta: normalizarMeta,
    normalizarRegistro: normalizarRegistro,
    normalizarEstado: normalizarEstado,
    clavePeriodo: clavePeriodo,
    rangoPeriodo: rangoPeriodo,
    periodosDe: periodosDe,
    periodosEntre: periodosEntre,
    registrosDe: registrosDe,
    registrosEn: registrosEn,
    tieneDatos: tieneDatos,
    valorEn: valorEn,
    cumple: cumple,
    cumplePeriodo: cumplePeriodo,
    proyecto: proyecto,
    serie: serie,
    racha: racha,
    resumen: resumen,
    formatoValor: formatoValor,
    nuevoId: nuevoId,
    hoyISO: hoyISO,
    selloLocal: selloLocal,
    sumaDias: sumaDias
  };
})();
