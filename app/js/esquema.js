/* esquema.js — contratos de datos de Mimo.
 *
 * Tres documentos, una sola verdad:
 *   mimo.entorno  -> lo general: prefs, tareas, notas, eventos, periodos, tiempo, estudio.
 *   mimo.malla    -> lo académico: cursos/plan y calificaciones.
 *   mimo.backup   -> los dos anteriores en un solo archivo.
 *
 * Regla aditiva: un lector de la misma versión mayor conserva las claves que no
 * conoce. Nunca se borra un bloque, un campo de curso ni una extensión por el
 * hecho de no entenderla. El formato 2 de Mimo Academics se migra completo.
 */
(function () {
  "use strict";

  var APP = "Mimo", APP_VERSION = "1.2.0", V = 1;
  var ENTORNO = "mimo.entorno", MALLA = "mimo.malla", BACKUP = "mimo.backup";

  function dict(x) { return x && typeof x === "object" && !Array.isArray(x) ? x : {}; }
  function lista(x) { return Array.isArray(x) ? x : []; }
  function clon(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  function ahora() { return new Date().toISOString(); }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d === undefined ? 0 : d); }
  function nota(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
  }
  function nivelDeCodigo(cod, tipo) {
    if (String(tipo || "") === "cupo" || /^CUPO/i.test(String(cod || ""))) return 99;
    var m = String(cod || "").match(/(\d{4})/);
    return m ? Math.max(1, Math.min(99, parseInt(m[1].slice(0, 2), 10) || 1)) : 1;
  }
  function califDefecto() {
    return {
      categorias: [{ nombre: "General", peso: 100 }], componentes: [],
      examen: { activo: true, peso: 40, nota: null, reemplaza: null },
      eximicion: { activa: false, modo: "todas", condiciones: [] },
      notaMin: 4, meta: 5
    };
  }
  function general(estado) {
    var datos = {};
    Object.keys(estado || {}).forEach(function (k) {
      if (k === "cursos" || k === "califs" || k === "extensiones") return;
      datos[k] = clon(estado[k]);
    });
    return datos;
  }
  function extensiones(estado) {
    var ext = clon(dict(estado && estado.extensiones));
    Object.keys(estado || {}).forEach(function (k) {
      if (k.charAt(0) === "_" && k !== "_") ext[k] = clon(estado[k]);
    });
    return ext;
  }
  function sobre(tipo, datos, ext) {
    return {
      schema: tipo, version: V, app: APP, appVersion: APP_VERSION,
      exportado: ahora(), datos: clon(datos), extensiones: clon(ext || {})
    };
  }

  function exportarEntorno(estado) {
    return sobre(ENTORNO, general(estado), extensiones(estado));
  }
  function exportarMalla(estado) {
    return sobre(MALLA, { cursos: clon(estado.cursos || []), calificaciones: clon(estado.califs || {}) },
      { plan: clon(estado.plan || []), asistencia: clon(estado.asistencia || {}) });
  }
  function exportarBackup(estado) {
    var ent = exportarEntorno(estado);
    var mal = exportarMalla(estado);
    return {
      schema: BACKUP, version: V, app: APP, appVersion: APP_VERSION, exportado: ahora(),
      entorno: ent.datos, malla: mal.datos, extensiones: Object.assign({}, ent.extensiones, mal.extensiones)
    };
  }

  function detectar(doc) {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return null;
    if (doc.schema === BACKUP) return "backup";
    if (doc.schema === ENTORNO) return "entorno";
    if (doc.schema === MALLA) return "malla";
    if (doc.formato === 2 && doc.estado && typeof doc.estado === "object") return "legacy";
    if (doc.tipo === "mimo-malla" && Array.isArray(doc.cursos)) return "malla-vieja";
    if (doc.cursos || doc.califs || doc.tareas || doc.notas || doc.prefs) return "estado";
    return null;
  }

  function aplicar(actual, entorno, malla, ext) {
    var out = clon(actual || {});
    if (entorno) {
      Object.keys(entorno).forEach(function (k) {
        if (k === "cursos" || k === "califs" || k === "extensiones") return;
        out[k] = clon(entorno[k]);
      });
    }
    if (malla) {
      out.cursos = clon(malla.cursos || []);
      out.califs = clon(malla.calificaciones || malla.califs || {});
    }
    if (ext) out.extensiones = Object.assign({}, dict(out.extensiones), clon(ext));
    return out;
  }

  function resumen(estado) {
    return {
      cursos: (estado.cursos || []).length,
      calificaciones: Object.keys(estado.califs || {}).length,
      tareas: (estado.tareas || []).length,
      eventos: (estado.eventos || []).length,
      notas: (estado.notas || []).length,
      sesiones: (estado.sesiones || []).length,
      periodos: (estado.periodos || []).length
    };
  }

  /* ---------- formato 2 de Mimo Academics ---------- */
  function periodoDe(p, i) {
    var semanas = lista(p.semanas).map(function (w, j) {
      return {
        n: j + 1,
        desde: String(w.lunes || w.desde || ""),
        hasta: String(w.domingo || w.hasta || ""),
        tipo: w.tipo === "receso" || w.tipo === "examenes" ? w.tipo : "clases"
      };
    });
    return {
      id: String(p.id || ("periodo-" + i)), nombre: String(p.nombre || p.id || ("Periodo " + (i + 1))),
      inicio: String(p.inicio || (semanas[0] && semanas[0].desde) || ""), semanas: semanas
    };
  }
  function horaDe(e) {
    if (e.hora) return String(e.hora);
    var m = String(e.detalle || e.texto || "").match(/(\d{1,2})[.:](\d{2})/);
    return m ? String(m[1]).padStart(2, "0") + ":" + m[2] : "";
  }
  function notaDe(e, ficha) {
    var f = dict(ficha);
    return [e.detalle, f.descripcion, f.temario].map(function (x) { return String(x || "").trim(); })
      .filter(Boolean).join("\n\n");
  }
  function convertirAcademics(x) {
    var e = dict(x && x.estado);
    var activo = String(e.activo || "");
    var sem = dict(dict(e.sem)[activo]);
    var fichas = dict(sem.fichas);
    var extras = lista(e.extras);
    var fuentes = extras.concat(lista(x && x.semestres));
    var vistos = {};
    fuentes = fuentes.filter(function (p) { if (!p || !p.id || vistos[p.id]) return false; vistos[p.id] = 1; return true; });
    Object.keys(dict(e.sem)).forEach(function (id) {
      if (!vistos[id]) { vistos[id] = 1; fuentes.push({ id: id, nombre: id, semanas: [] }); }
    });
    var periodos = fuentes.map(periodoDe);
    if (!periodos.length) periodos.push({ id: "periodo-1", nombre: "Periodo 1", inicio: "", semanas: [] });

    var eventos = [], tareas = [], sesiones = [], metasSemana = {};
    var hechas = dict(sem.hechas), prios = dict(sem.prioridades);
    fuentes.forEach(function (p) {
      lista(p.eventos).forEach(function (ev) {
        var id = String(ev.id || ("ev" + eventos.length));
        var ficha = fichas[id];
        eventos.push({
          id: "ev" + id, titulo: String(ev.texto || ev.titulo || "Sin título"),
          fecha: String(ev.fecha || ""), hora: horaDe(ev),
          contexto: ev.ramo && ev.ramo !== "OTROS" ? String(ev.ramo) : "",
          nota: notaDe(ev, ficha), tipoLegacy: String(ev.tipo || ""),
          hecha: !!hechas[id], semana: String(ev.semana || ""), periodo: String(p.id || "")
        });
      });
    });
    lista(sem.nuevas).forEach(function (t, i) {
      var id = String(t.id || ("t" + i)), ficha = fichas[id];
      var hecha = !!hechas[id];
      tareas.push({
        id: "ti" + id, titulo: String(t.texto || t.titulo || "Sin título"), tipo: "tarea",
        padre_id: null, estado: hecha ? "hecha" : "pendiente", hecha: hecha,
        prioridad: prios[id] || "media", fecha: String(t.fecha || ""),
        contexto: t.ramo && t.ramo !== "OTROS" ? String(t.ramo) : "",
        nota: notaDe(t, ficha), orden: i, creada: "",
        hora: String(t.hora || ""), tipoLegacy: String(t.tipo || "tarea"),
        semana: String(t.semana || "")
      });
    });
    var per = dict(e.personal);
    lista(per.nuevas).forEach(function (t, i) {
      var id = String(t.id || ("p" + i)), ficha = dict(per.fichas)[id];
      var hecha = !!dict(per.hechas)[id];
      tareas.push({
        id: "tp" + id, titulo: String(t.texto || t.titulo || "Sin título"), tipo: "tarea",
        padre_id: null, estado: hecha ? "hecha" : "pendiente", hecha: hecha,
        prioridad: dict(per.prioridades)[id] || "media", fecha: String(t.fecha || ""),
        contexto: "", nota: notaDe(t, ficha), orden: tareas.length, creada: "",
        hora: String(t.hora || ""), tipoLegacy: String(t.tipo || "personal"), origen: "personal"
      });
    });
    Object.keys(dict(e.sem)).forEach(function (sid) {
      var s = dict(e.sem[sid]);
      lista(s.sesiones).forEach(function (x, i) {
        sesiones.push({
          id: "si" + sid + "-" + String(x.id || i), fecha: String(x.fecha || ""),
          minutos: Math.max(0, num(x.minutos, 0)), ramo: String(x.ramo || "").toUpperCase(),
          vinculo: "", hora: String(x.hora || ""), tipo: "importado"
        });
      });
      Object.keys(dict(s.metas_semana)).forEach(function (k) { metasSemana[k] = num(s.metas_semana[k], 0); });
    });

    // Cursos: el plan completo del catálogo + los que estaban activos o aprobados.
    var cat = dict(e.catalogo);
    if (!Object.keys(cat).length) cat = dict(x && x.catalogo);
    var porCod = {};
    function meter(cod, src) {
      cod = String(cod || (src && src.codigo) || "").trim().toUpperCase();
      if (!cod || !/^[A-Z0-9]{2,}$/.test(cod)) return;
      if (!porCod[cod]) porCod[cod] = { codigo: cod };
      var c = porCod[cod], s = dict(src), m = dict(cat[cod]);
      c.nombre = String(s.nombre || s.alias || m.nombre || c.nombre || cod);
      c.alias = String(s.alias || m.alias || c.alias || "");
      c.creditos = Math.max(0, parseInt(s.creditos !== undefined ? s.creditos : m.creditos, 10) || 0);
      c.nivel = parseInt(s.nivel !== undefined ? s.nivel : m.nivel, 10) || nivelDeCodigo(cod, m.tipo);
      c.requisitos = lista(s.requisitos || m.requisitos).map(function (r) { return String(r).toUpperCase(); });
      c.requisitos_o = lista(s.requisitos_o || m.requisitos_o).map(function (g) {
        return lista(g).map(function (r) { return String(r).toUpperCase(); });
      });
      c.aprobacion = num(s.aprobacion !== undefined ? s.aprobacion : m.aprobacion, null);
      c.tipo = String(s.tipo || m.tipo || (/^CUPO/i.test(cod) ? "cupo" : ""));
      c.enMalla = m.en_malla !== false && s.en_malla !== false;
      c.color = String(s.color || m.color || "");
      c.semestre = String(s.semestre || m.semestre || "");
      c.semestreNum = num(s.semestre_num !== undefined ? s.semestre_num : m.semestre_num, 0);
      c.desbloquea = lista(m.desbloquea).map(String);
      c.enCurso = false; c.cerrado = false; c.aprobado = false; c.resultado = ""; c.notaCierre = null; c.cerradoEn = "";
    }
    Object.keys(cat).forEach(function (cod) {
      var m = dict(cat[cod]);
      if (m.en_malla !== false) meter(cod, m);
    });
    Object.keys(dict(e.agregados)).forEach(function (k) {
      lista(e.agregados[k]).forEach(function (c) { if (c && c.codigo) meter(c.codigo, c); });
    });
    lista(sem.ramos).forEach(function (c) { if (c && c.codigo) meter(c.codigo, c); });
    Object.keys(dict(e.aprobados)).forEach(function (cod) { if (e.aprobados[cod]) meter(cod, null); });
    Object.keys(dict(sem.cats)).forEach(function (cod) { if (cod !== "OTROS") meter(cod, null); });
    Object.keys(porCod).forEach(function (cod) {
      var c = porCod[cod];
      c.aprobado = !!(e.aprobados && e.aprobados[cod]);
      c.cerrado = c.aprobado;
      c.resultado = c.aprobado ? "aprobado" : "";
      c.enCurso = !c.aprobado && lista(dict(e.agregados)[activo]).some(function (z) { return String(z.codigo || "").toUpperCase() === cod; });
    });

    // Calificaciones: solo los ramos con datos académicos o en curso.
    var cats = dict(sem.cats), comps = dict(sem.comps), exam = dict(sem.examen),
      exim = dict(sem.exim), metasRamo = dict(sem.metas_ramo);
    var califs = {};
    Object.keys(porCod).forEach(function (cod) {
      var tiene = cats[cod] || comps[cod] || exam[cod] || exim[cod] || metasRamo[cod] || porCod[cod].enCurso;
      if (!tiene) return;
      var q = califDefecto();
      q.categorias = lista(cats[cod]).map(function (cat) {
        return { nombre: String(cat.nombre || "General"), peso: Math.max(0, num(cat.peso, 0)) };
      });
      if (!q.categorias.length) q.categorias = [{ nombre: "General", peso: 100 }];
      var suma = q.categorias.reduce(function (a, c) { return a + c.peso; }, 0);
      if (suma > 0 && suma <= 1.5) q.categorias.forEach(function (c) { c.peso = Math.round(c.peso * 100 / suma * 100) / 100; });
      q.componentes = lista(comps[cod]).map(function (c, i) {
        return { nombre: String(c.nombre || ("Componente " + (i + 1))), categoria: String(c.categoria || q.categorias[0].nombre),
          nota: nota(c.nota), fecha: String(c.fecha || ""), peso: Math.max(0.1, num(c.peso, 1)) };
      });
      var ex = dict(exam[cod]), peso = num(ex.peso, 40);
      q.examen = { activo: ex.activo !== false, peso: Math.max(0, Math.min(100, peso <= 1 ? Math.round(peso * 100) : peso)),
        nota: nota(ex.nota), reemplaza: null };
      var rep = parseInt(ex.reemplaza, 10);
      if (!isNaN(rep) && rep >= 0 && rep < q.componentes.length) q.examen.reemplaza = rep;
      var exi = dict(exim[cod]);
      q.eximicion = { activa: !!exi.activa, modo: exi.modo === "alguna" ? "alguna" : "todas",
        condiciones: lista(exi.condiciones).map(function (c) {
          var tipo = ["presentacion", "categoria", "componente"].indexOf(c.tipo) !== -1 ? c.tipo : "presentacion";
          if (!c.ref && tipo !== "presentacion") tipo = "presentacion";
          return { tipo: tipo, ref: String(c.ref || ""), op: [">=", ">", "<=", "<"].indexOf(c.op) !== -1 ? c.op : ">=", valor: nota(c.valor) || 1 };
        }) };
      var mr = dict(metasRamo[cod]), meta = num(mr.nota, 0);
      q.meta = meta > 0 ? Math.min(7, meta) : 5;
      califs[cod] = q;
    });

    var av = dict(dict(e.ajustes).av);
    var entorno = {
      tema: String(av.tema || "clasico"),
      prefs: { temaClaro: String(av.temaClaro || "clasico"), temaOscuro: String(av.temaOscuro || "deepsea"),
        idioma: ["en", "zh"].indexOf(String(e.idioma || av.idioma || "").toLowerCase()) !== -1 ? String(e.idioma || av.idioma).toLowerCase() : "es" },
      periodos: periodos, periodoActivo: periodos.some(function (p) { return p.id === activo; }) ? activo : periodos[0].id,
      tareas: tareas, eventos: eventos, sesiones: sesiones,
      estudio: { metaSemanal: Math.max(0, num(dict(sem.metas).semanal, 0)), metasRamo: {}, metasSemana: metasSemana,
        minutosSemana: clon(dict(sem.minutos)), semanasEstudio: clon(lista(dict(extras[0]).semanas_estudio)) },
      instalados: ["tiempo", "malla", "calificaciones", "estudio", "evaluaciones"],
      kits: { academics: ["malla", "calificaciones", "estudio", "evaluaciones"] }
    };
    Object.keys(metasRamo).forEach(function (cod) {
      var v = dict(metasRamo[cod]);
      entorno.estudio.metasRamo[String(cod).toUpperCase()] = Math.max(0, num(v.horas !== undefined ? v.horas : v, 0));
    });
    entorno.asistencia = clon(dict(e.asistencia));
    entorno.tiposLegacy = clon(dict(e.tipos));
    var t = dict(e.tiempo);
    if (t.modo) entorno.tiempoModo = ["crono", "temporizador", "pomodoro", "alarmas"].indexOf(t.modo) !== -1 ? t.modo : "crono";
    if (dict(t.pomodoro).config) {
      var pc = dict(t.pomodoro.config);
      entorno.pomo = { trabajo: num(pc.trabajo, 25), corto: num(pc.corto, 5), largo: num(pc.largo, 15), cada: num(pc.cada, 4) };
    }
    if (t.temp && t.temp.objetivoSeg) entorno.tempMin = Math.max(0.1, num(t.temp.objetivoSeg, 0) / 60);

    return {
      estado: aplicar({}, entorno, { cursos: Object.keys(porCod).map(function (c) { return porCod[c]; }), calificaciones: califs }, {}),
      resumen: { cursos: Object.keys(porCod).length, calificaciones: Object.keys(califs).length,
        tareas: tareas.length, eventos: eventos.length, sesiones: sesiones.length, periodos: periodos.length },
      legacy: { formato: 2, claves: Object.keys(x || {}), estado_claves: Object.keys(e),
        catalogo: Object.keys(cat).length, eventos: eventos.length, tareas: tareas.length }
    };
  }

  function importar(doc, actual) {
    var tipo = detectar(doc);
    if (!tipo) return null;
    if (tipo === "legacy") {
      var m = convertirAcademics(doc);
      return { estado: aplicar(actual, m.estado, { cursos: m.estado.cursos, calificaciones: m.estado.califs }, {}), tipo: "Mimo Academics (formato 2)", resumen: m.resumen, legacy: m.legacy };
    }
    if (tipo === "backup") {
      var out = aplicar(actual, doc.entorno, doc.malla, doc.extensiones);
      return { estado: out, tipo: "Mimo (entorno + malla)", resumen: resumen(out), legacy: { schema: doc.schema, version: doc.version } };
    }
    if (tipo === "entorno") {
      var oe = aplicar(actual, doc.datos, null, doc.extensiones);
      return { estado: oe, tipo: "Mimo (entorno)", resumen: resumen(oe), legacy: { schema: doc.schema, version: doc.version } };
    }
    if (tipo === "malla") {
      var om = aplicar(actual, null, doc.datos, doc.extensiones);
      return { estado: om, tipo: "Mimo (malla)", resumen: resumen(om), legacy: { schema: doc.schema, version: doc.version } };
    }
    if (tipo === "malla-vieja") {
      var ov = aplicar(actual, null, { cursos: doc.cursos, calificaciones: doc.califs || doc.calificaciones || {} }, doc.extensiones);
      return { estado: ov, tipo: "Mimo (malla anterior)", resumen: resumen(ov), legacy: { tipo: doc.tipo } };
    }
    var os = aplicar(actual, doc, { cursos: doc.cursos, calificaciones: doc.califs }, {});
    return { estado: os, tipo: "Mimo (estado completo)", resumen: resumen(os), legacy: { claves: Object.keys(doc) } };
  }

  window.MimoEsquema = {
    ENTORNO: ENTORNO, MALLA: MALLA, BACKUP: BACKUP, VERSION: V,
    detectar: detectar, exportarEntorno: exportarEntorno, exportarMalla: exportarMalla,
    exportarBackup: exportarBackup, convertirAcademics: convertirAcademics,
    importar: importar, resumen: resumen
  };
})();
