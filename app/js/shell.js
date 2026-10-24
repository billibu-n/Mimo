/* shell.js — armazón M11/M12: pestañas base + bloques, panel de 4 y estado local.
   Sin motores: los datos son del usuario y viven en localStorage['mimo.shell.v1']. */
(function () {
  "use strict";

  var CLAVE = "mimo.shell.v1";
  var RESET = /[?&]reset=1\b/.test(location.search);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };

  var I18N = {
    es: { "nav.calendario": "Calendario", "nav.tareas": "Tareas", "nav.notas": "Notas", "nav.tiempo": "Tiempo", "nav.malla": "Malla", "nav.calificaciones": "Calificaciones", "nav.estudio": "Estudio", "nav.ajustes": "Ajustes", "panel.contexto": "Contexto", "panel.detalle": "Detalle", "panel.notas": "Notas", "panel.bloques": "Bloques" },
    en: { "nav.calendario": "Calendar", "nav.tareas": "Tasks", "nav.notas": "Notes", "nav.tiempo": "Time", "nav.malla": "Degree plan", "nav.calificaciones": "Grades", "nav.estudio": "Study", "nav.ajustes": "Settings", "panel.contexto": "Context", "panel.detalle": "Details", "panel.notas": "Notes", "panel.bloques": "Blocks" }
  };
  function idioma() { return (estado && estado.prefs && estado.prefs.idioma) || "es"; }
  function t(k) {
    var d = I18N[idioma()] || I18N.es;
    return d[k] || I18N.es[k] || k;
  }
  var TEMAS = [
    ["clasico", "Clásico"], ["deepsea", "DeepSea"], ["medianoche", "Medianoche"],
    ["negro", "Negro"], ["vino", "Vino"], ["bosque", "Bosque"],
    ["sepia", "Sepia"], ["pinky", "Pinky"], ["alto-contraste", "Alto contraste"]
  ];
  var BLOQUES = {
    tiempo: { nombre: "Tiempo", tipo: "seccion", icono: "i-tiempo", desc: "Cronómetro, temporizador, pomodoro y alarmas." },
    malla: { nombre: "Malla", tipo: "seccion", icono: "i-malla", desc: "Cursos, niveles y prerrequisitos." },
    calificaciones: { nombre: "Calificaciones", tipo: "seccion", icono: "i-libro", desc: "Categorías, examen y eximición." },
    estudio: { nombre: "Estudio", tipo: "seccion", icono: "i-tiempo", desc: "Horas por ramo y metas." },
    evaluaciones: { nombre: "Evaluaciones", tipo: "aporte", icono: "i-cal", desc: "Aporta evaluaciones al calendario." },
    academics: { nombre: "Academics", tipo: "pack", icono: "i-libro", desc: "Kit: Malla, Calificaciones, Estudio y Evaluaciones.", instala: ["malla", "calificaciones", "estudio", "evaluaciones"] }
  };
  var BASE = ["calendario", "tareas", "notas", "ajustes"];
  var ORDEN = ["tiempo", "malla", "calificaciones", "estudio"];
  var HIJOS = [["crono", "Cronómetro"], ["temporizador", "Temporizador"], ["pomodoro", "Pomodoro"], ["alarmas", "Alarmas"]];

  function porDefecto() {
    return {
      tema: "clasico", instalados: [], kits: {}, panel: {}, tareas: [], notas: [], eventos: [], cursos: [], califs: {},
      periodos: [], periodoActivo: null, sesiones: [], tiempoVinculo: "", tiempoRamo: "",
      tiempoModo: "crono", tempMin: 25, pomo: { trabajo: 25, corto: 5, largo: 15, cada: 4, fase: "trabajo", trabajos: 0 },
      alarmas: [], estudio: { metaSemanal: 10, metasRamo: {} }, splitSeccion: "tareas",
      prefs: { inicioSemana: "lunes", hora: "24", panelAncho: "320", navPos: "arriba", idioma: "es", notificaciones: true, panelAbierto: true },
      notaSel: null, tareaSel: null, eventoSel: null, ramoSel: null, califSel: null, tiempoHijos: HIJOS.map(function (x) { return x[0]; })
    };
  }
  function leer() {
    var d = porDefecto();
    if (RESET) { try { localStorage.removeItem(CLAVE); } catch (e) {} return d; }
    try {
      var bruto = localStorage.getItem(CLAVE);
      if (bruto) {
        var x = JSON.parse(bruto);
        if (x && typeof x === "object") {
          Object.keys(d).forEach(function (k) { if (x[k] !== undefined) d[k] = x[k]; });
          if (!Array.isArray(d.instalados)) d.instalados = [];
          if (!Array.isArray(d.tareas)) d.tareas = [];
          if (!Array.isArray(d.notas)) d.notas = [];
          if (!Array.isArray(d.cursos)) d.cursos = [];
          if (!d.califs || typeof d.califs !== "object") d.califs = {};
          if (!d.pomo || typeof d.pomo !== "object") d.pomo = { trabajo: 25, corto: 5, largo: 15, cada: 4, fase: "trabajo", trabajos: 0 };
          if (!Array.isArray(d.alarmas)) d.alarmas = [];
          if (!d.estudio || typeof d.estudio !== "object") d.estudio = { metaSemanal: 10, metasRamo: {} };
          if (!d.estudio.metasRamo || typeof d.estudio.metasRamo !== "object") d.estudio.metasRamo = {};
          if (!Array.isArray(d.tiempoHijos)) d.tiempoHijos = HIJOS.map(function (y) { return y[0]; });
          if (!d.kits || typeof d.kits !== "object") d.kits = {};
          if (!d.panel || typeof d.panel !== "object") d.panel = {};
        }
      }
    } catch (e) {}
    return d;
  }
  var estado = leer();
  var pantalla = "calendario";
  var notaBusqueda = "";
  var notaModo = "editar";
  var vistaTareas = estado.vistaTareas || "hoy";
  var vistaCalendario = estado.vistaCalendario || "mes";
  var calCursor = new Date();
  var formEventoId = null;
  var tiempoSeg = 0, tiempoInt = null, tempSeg = 0, tempInicial = 0, pomoSeg = 0, pomoInicial = 0;
  var splitOn = false;

  function guardar() { try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {} }
  function aviso(texto) {
    var t = $("#toast"); t.textContent = texto; t.classList.add("on");
    clearTimeout(t._t); t._t = setTimeout(function () { t.classList.remove("on"); }, 2600);
  }

  /* ---- acciones: menú de clic derecho + borrado en toda la app ---- */
  var menuAcciones = {};

  function notaPorId(id) {
    return estado.notas.filter(function (n) { return n.id === id; })[0] || null;
  }
  function crearNota() {
    var n = {
      id: "n" + Date.now(), titulo: "Sin título", cuerpo: "", contexto: "", etiquetas: [],
      enlaces: [], fijada: false, actualizado: selloLocal()
    };
    estado.notas.unshift(n);
    estado.notaSel = n.id;
    guardar(); pintarNotas(); pintarPanel();
    $("#nota-titulo").focus(); $("#nota-titulo").select();
  }
  function crearTarea(tipo) {
    abrirFormulario(null);
    if (tipo === "proyecto") $("#tarea-tipo").value = "proyecto";
  }
  function abrirNota(id) {
    if (!notaPorId(id)) return;
    estado.notaSel = id;
    estado.panel.notas = "detalle";
    guardar();
    if (pantalla !== "notas") ir("notas"); else { pintarNotas(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function abrirTarea(id) {
    if (!tareaPorId(id)) return;
    estado.tareaSel = id;
    estado.panel.tareas = "detalle";
    guardar();
    if (pantalla !== "tareas") ir("tareas"); else { pintarTareas(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function abrirEventoDetalle(id) {
    if (!eventoPorId(id)) return;
    estado.eventoSel = id;
    estado.panel.calendario = "detalle";
    guardar();
    if (pantalla !== "calendario") ir("calendario"); else { pintarCalendario(); pintarPanel(); }
    if (window.innerWidth <= 1255) abrirPanel();
  }
  function alternarTarea(id) {
    var x = tareaPorId(id); if (!x) return;
    x.hecha = !x.hecha; x.estado = x.hecha ? "hecha" : "pendiente";
    guardar(); pintarTareas(); pintarPanel();
  }
  function crearEventoEn(fecha) {
    abrirEvento(null);
    if (fecha) $("#evento-fecha").value = fecha;
    $("#evento-titulo").focus();
  }
  function borrarNota(id) {
    var n = notaPorId(id); if (!n) return;
    if (!window.confirm("¿Borrar la nota \"" + (n.titulo || "Sin título") + "\"?")) return;
    estado.notas = estado.notas.filter(function (x) { return x.id !== id; });
    if (estado.notaSel === id) estado.notaSel = estado.notas.length ? estado.notas[0].id : null;
    guardar(); pintarNotas(); pintarPanel(); aviso("Nota borrada.");
  }
  function borrarPeriodo(id) {
    var p = (estado.periodos || []).filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    if (!window.confirm("¿Borrar el periodo \"" + p.nombre + "\" y sus semanas?")) return;
    estado.periodos = estado.periodos.filter(function (x) { return x.id !== id; });
    if (estado.periodoActivo === id) estado.periodoActivo = estado.periodos.length ? estado.periodos[0].id : null;
    guardar(); pintarPeriodo(); aviso("Periodo borrado. Sus eventos no se tocan.");
  }
  function borrarSesion(indice) {
    var s = (estado.sesiones || [])[indice]; if (!s) return;
    if (!window.confirm("¿Borrar la sesión de " + s.minutos + " min del " + s.fecha + "?")) return;
    estado.sesiones.splice(indice, 1);
    guardar(); pintarTiempo(); pintarEstudio(); aviso("Sesión borrada.");
  }
  function menuTitulo(tipo, texto) { return tipo + " · " + (texto || "Sin título"); }
  function menuDeContexto(el) {
    var rEl = el.closest("[data-ramo]");
    if (rEl) {
      var r = ramoPorCodigo(rEl.getAttribute("data-ramo"));
      if (!r) return null;
      return { titulo: menuTitulo("Ramo", r.codigo + " — " + r.nombre), items: [
        { accion: "ramo-abrir", texto: "Abrir ficha", run: function () {
          estado.ramoSel = r.codigo; estado.panel.malla = "detalle";
          guardar(); pintarMalla(); pintarPanel();
          if (window.innerWidth <= 1255) abrirPanel();
        } },
        { accion: "ramo-editar", texto: "Editar", run: function () { abrirFormularioRamo(r); } },
        { accion: "ramo-estado", texto: r.cerrado ? "Reabrir" : "Cerrar curso", run: function () { alternarRamo(r.codigo); } },
        { sep: true },
        { accion: "ramo-borrar", texto: "Borrar ramo", peligro: true, run: function () { borrarRamo(r.codigo); } }
      ] };
    }

    var nEl = el.closest("[data-nota]");
    if (nEl) {
      var n = notaPorId(nEl.getAttribute("data-nota"));
      if (!n) return null;
      var ni = [
        { accion: "nota-abrir", texto: "Abrir", run: function () { abrirNota(n.id); } },
        { accion: "nota-fijar", texto: n.fijada ? "Quitar fijada" : "Fijar", run: function () {
          n.fijada = !n.fijada; guardar(); pintarNotas(); pintarPanel();
          aviso(n.fijada ? "Nota fijada." : "Nota suelta.");
        } }
      ];
      if (n.enlaces && n.enlaces.length) {
        ni.push({ accion: "nota-desenlazar", texto: "Quitar enlace", run: function () {
          n.enlaces = []; guardar(); pintarNotas(); pintarPanel(); aviso("Enlace quitado.");
        } });
      }
      ni.push({ sep: true });
      ni.push({ accion: "nota-borrar", texto: "Borrar nota", peligro: true, run: function () { borrarNota(n.id); } });
      return { titulo: menuTitulo("Nota", n.titulo), items: ni };
    }

    var eEl = el.closest("[data-evento]");
    if (eEl) {
      var ev = eventoPorId(eEl.getAttribute("data-evento"));
      if (!ev) return null;
      return { titulo: menuTitulo("Evento", ev.titulo), items: [
        { accion: "evento-abrir", texto: "Abrir detalle", run: function () { abrirEventoDetalle(ev.id); } },
        { accion: "evento-editar", texto: "Editar", run: function () { abrirEvento(ev); } },
        { sep: true },
        { accion: "evento-borrar", texto: "Borrar evento", peligro: true, run: function () { borrarEvento(ev.id); } }
      ] };
    }

    var tEl = el.closest("[data-tarea]");
    if (tEl) {
      var t = tareaPorId(tEl.getAttribute("data-tarea"));
      if (!t) return null;
      return { titulo: menuTitulo(t.tipo === "proyecto" ? "Proyecto" : "Tarea", t.titulo), items: [
        { accion: "tarea-abrir", texto: "Abrir detalle", run: function () { abrirTarea(t.id); } },
        { accion: "tarea-editar", texto: "Editar", run: function () { abrirFormulario(t); } },
        { accion: "tarea-estado", texto: t.hecha ? "Reabrir" : "Marcar hecha", run: function () { alternarTarea(t.id); } },
        { accion: "tarea-sub", texto: "Añadir subtarea", run: function () { abrirFormulario(null, t.id); } },
        { sep: true },
        { accion: "tarea-borrar", texto: t.tipo === "proyecto" ? "Borrar proyecto y sus tareas" : "Borrar tarea", peligro: true,
          run: function () { borrarTarea(t.id); } }
      ] };
    }

    var pEl = el.closest("[data-periodo-item]");
    if (pEl) {
      var p = (estado.periodos || []).filter(function (x) { return x.id === pEl.getAttribute("data-periodo-item"); })[0];
      if (!p) return null;
      var pi = [];
      if (estado.periodoActivo !== p.id) {
        pi.push({ accion: "periodo-usar", texto: "Usar este periodo", run: function () {
          estado.periodoActivo = p.id; guardar(); pintarPeriodo(); aviso("Periodo activo.");
        } });
      }
      if (pi.length) pi.push({ sep: true });
      pi.push({ accion: "periodo-borrar", texto: "Borrar periodo", peligro: true, run: function () { borrarPeriodo(p.id); } });
      return { titulo: menuTitulo("Periodo", p.nombre), items: pi };
    }

    var sEl = el.closest("[data-sesion]");
    if (sEl) {
      var i = parseInt(sEl.getAttribute("data-sesion"), 10);
      var s = (estado.sesiones || [])[i];
      if (!s) return null;
      return { titulo: menuTitulo("Sesión", s.fecha), items: [
        { accion: "sesion-borrar", texto: "Borrar sesión", peligro: true, run: function () { borrarSesion(i); } }
      ] };
    }

    var dEl = el.closest("[data-cal-dia]");
    if (dEl) {
      var fecha = dEl.getAttribute("data-cal-dia");
      return { titulo: "Día " + fecha.split("-").reverse().join("/"), items: [
        { accion: "dia-evento", texto: "Nuevo evento este día", run: function () { crearEventoEn(fecha); } }
      ] };
    }

    var zEl = el.closest("[data-ctx-zona]");
    if (zEl) {
      var zona = zEl.getAttribute("data-ctx-zona");
      if (zona === "notas") {
        return { titulo: "Notas", items: [{ accion: "zona-nota", texto: "Nueva nota", run: crearNota }] };
      }
      if (zona === "tareas") {
        return { titulo: "Tareas", items: [
          { accion: "zona-tarea", texto: "Nueva tarea", run: function () { crearTarea("tarea"); } },
          { accion: "zona-proyecto", texto: "Nuevo proyecto", run: function () { crearTarea("proyecto"); } }
        ] };
      }
      if (zona === "calendario") {
        return { titulo: "Calendario", items: [
          { accion: "zona-evento", texto: "Nuevo evento", run: function () { crearEventoEn(""); } },
          { accion: "zona-periodo", texto: "Nuevo periodo", run: abrirPeriodo }
        ] };
      }
      if (zona === "malla") {
        return { titulo: "Malla", items: [
          { accion: "zona-ramo", texto: "Nuevo ramo", run: function () { abrirFormularioRamo(null); } },
          { accion: "zona-importar-malla", texto: "Importar malla", run: function () { $("#archivo-malla").click(); } }
        ] };
      }
    }
    return null;
  }
  function abrirMenu(x, y, titulo, items) {
    var m = $("#menu-ctx"); if (!m || !items.length) return;
    menuAcciones = {};
    var html = titulo ? '<div class="menu-ctx__cab">' + esc(titulo) + "</div>" : "";
    items.forEach(function (it) {
      if (it.sep) { html += '<div class="menu-ctx__sep"></div>'; return; }
      menuAcciones[it.accion] = it.run;
      html += '<button type="button" role="menuitem" data-accion="' + esc(it.accion) + '"' +
        (it.peligro ? ' class="peligro"' : "") + ">" + esc(it.texto) + "</button>";
    });
    m.innerHTML = html;
    m.hidden = false;
    m.style.left = "0px"; m.style.top = "0px";
    var r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(x, window.innerWidth - r.width - 8)) + "px";
    m.style.top = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + "px";
    var primero = m.querySelector("button");
    if (primero) primero.focus({ preventScroll: true });
  }
  function cerrarMenu() {
    var m = $("#menu-ctx");
    if (!m || m.hidden) return;
    m.hidden = true; m.innerHTML = ""; menuAcciones = {};
  }
  function menuPorTeclado(el) {
    var ctx = menuDeContexto(el); if (!ctx) return;
    var r = el.getBoundingClientRect();
    abrirMenu(r.left, r.bottom + 4, ctx.titulo, ctx.items);
  }
  function icono(id) { return '<svg class="icono" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function nombre(id) {
    if (["calendario", "tareas", "notas", "ajustes", "tiempo", "malla", "calificaciones", "estudio"].indexOf(id) !== -1) return t("nav." + id);
    return BLOQUES[id] ? BLOQUES[id].nombre : id;
  }
  function iconoDe(id) {
    return { calendario: "i-cal", tareas: "i-tareas", notas: "i-notas", ajustes: "i-ajustes" }[id] ||
      (BLOQUES[id] ? BLOQUES[id].icono : "i-plus");
  }
  function instalado(id) { return estado.instalados.indexOf(id) !== -1; }
  function secciones() {
    var out = BASE.slice(0, 3);
    ORDEN.forEach(function (id) { if (instalado(id)) out.push(id); });
    out.push("ajustes");
    return out;
  }

  function pintarTabs() {
    $("#tabs").innerHTML = secciones().map(function (id) {
      var on = id === pantalla ? " on" : "";
      return '<button class="tab' + on + '" type="button" role="tab" aria-selected="' + (id === pantalla) + '" data-ir="' + id + '" title="' + esc(nombre(id)) + '" aria-label="' + esc(nombre(id)) + '">' +
        icono(iconoDe(id)) + "</button>";
    }).join("");
    $$("#tabs .tab").forEach(function (b) {
      b.addEventListener("click", function () { ir(b.getAttribute("data-ir")); });
    });
    var kb = $("#kpi-bloques");
    if (kb) kb.textContent = String(estado.instalados.length);
    pintarAjustes();
  }

  function ir(id) {
    if (secciones().indexOf(id) === -1) return;
    pantalla = id;
    $$(".seccion[data-pantalla]").forEach(function (s) {
      s.hidden = s.getAttribute("data-pantalla") !== id;
    });
    pintarTabs();
    if (id === "malla") pintarMalla();
    if (id === "calificaciones") pintarCalificaciones();
    if (id === "estudio") pintarEstudio();
    if (id === "tiempo") pintarTiempo();
    pintarPanel();
    if (window.innerWidth <= 1255) cerrarPanel();
  }

  function aplicarTema(t) {
    document.body.setAttribute("data-tema", t);
    estado.tema = t;
    pintarTemas();
    pintarTemaIcono();
    guardar();
  }
  function pintarTemaIcono() {
    var b = $("#btn-tema");
    if (!b) return;
    var oscuro = estado.tema !== "clasico" && estado.tema !== "bosque" && estado.tema !== "sepia" && estado.tema !== "pinky";
    b.innerHTML = icono(oscuro ? "i-sol" : "i-luna");
    b.title = oscuro ? "Cambiar a claro" : "Cambiar a oscuro";
  }
  function pintarTemas() {
    var c = $("#temas");
    if (!c) return;
    c.innerHTML = TEMAS.map(function (t) {
      return '<button class="tema" type="button" data-tema="' + t[0] + '" aria-pressed="' +
        (estado.tema === t[0]) + '"><i aria-hidden="true"></i>' + esc(t[1]) + "</button>";
    }).join("");
    $$("#temas .tema").forEach(function (b) {
      b.addEventListener("click", function () {
        aplicarTema(b.getAttribute("data-tema"));
        aviso("Tema " + b.textContent.trim() + " aplicado.");
      });
    });
  }

  function normalizarEventos() {
    estado.eventos = (estado.eventos || []).map(function (e, i) {
      return {
        id: e.id || "e" + i,
        titulo: e.titulo || "Sin título",
        fecha: e.fecha || hoyISO(),
        hora: e.hora || "",
        contexto: e.contexto || "",
        nota: e.nota || ""
      };
    });
  }
  function eventoPorId(id) { return estado.eventos.filter(function (e) { return e.id === id; })[0] || null; }
  function eventosDe(fecha) {
    return estado.eventos.filter(function (e) { return e.fecha === fecha; })
      .sort(function (a, b) { return (a.hora || "99:99") < (b.hora || "99:99") ? -1 : 1; });
  }
  function chipEvento(e) {
    return '<button class="evento-chip" type="button" data-evento="' + e.id + '" title="' + esc(e.titulo) + ' · clic derecho: acciones">' +
      (e.hora ? '<b>' + esc(horaTexto(e.hora)) + "</b> " : "") + esc(e.titulo) + "</button>";
  }
  function pintarCalendario() {
    normalizarEventos();
    var hoy = new Date(), y = calCursor.getFullYear(), m = calCursor.getMonth();
    var total = estado.eventos.length;
    $("#kpi-eventos").textContent = String(total);
    $("#kpi-tareas").textContent = String(estado.tareas.filter(function (t) { return t.fecha; }).length);
    $$("#vista-calendario button").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-cal-vista") === vistaCalendario);
    });
    var grid = $("#cal-grid"), agenda = $("#cal-agenda");
    agenda.hidden = vistaCalendario !== "agenda";
    grid.hidden = vistaCalendario === "agenda";
    var visibles = 0;
    if (vistaCalendario === "agenda") {
      var orden = estado.eventos.slice().sort(function (a, b) {
        return (a.fecha + " " + (a.hora || "")) < (b.fecha + " " + (b.hora || "")) ? -1 : 1;
      });
      visibles = orden.length;
      $("#cal-mes-titulo").textContent = "Agenda";
      agenda.innerHTML = orden.length ? orden.map(function (e) {
        return '<button class="cal-agenda__item" type="button" data-evento="' + e.id + '" title="Clic derecho: acciones"><span><b>' + esc(e.titulo) + "</b><small>" + esc(e.fecha) + (e.hora ? " · " + esc(horaTexto(e.hora)) : "") + (e.contexto ? " · " + esc(e.contexto) : "") + "</small></span><span class=\"pill\">" + (e.fecha >= hoyISO() ? "próximo" : "pasado") + "</span></button>";
      }).join("") : '<p class="empty">Sin eventos todavía.</p>';
    } else if (vistaCalendario === "semana") {
      var lunes = new Date(calCursor.getFullYear(), calCursor.getMonth(), calCursor.getDate());
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      lunes.setDate(lunes.getDate() - (domingo ? lunes.getDay() : ((lunes.getDay() + 6) % 7)));
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      var dias = domingo ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
      grid.className = "cal-grid cal-grid--semana";
      $("#cal-mes-titulo").textContent = "Semana del " + lunes.getDate() + "/" + (lunes.getMonth() + 1);
      grid.innerHTML = dias.map(function (d, i) {
        var f = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
        var iso = f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
        var evs = eventosDe(iso); visibles += evs.length;
        return '<div class="cal-semana-dia' + (iso === hoyISO() ? " hoy" : "") + '" data-cal-dia="' + iso + '"><b>' + d + " " + f.getDate() + "</b>" +
          (evs.length ? evs.map(chipEvento).join("") : '<span class="cal-vacio-dia">—</span>') + "</div>";
      }).join("");
    } else {
      var primero = new Date(y, m, 1);
      var domingo = (estado.prefs || {}).inicioSemana === "domingo";
      var offset = domingo ? primero.getDay() : (primero.getDay() + 6) % 7;
      var inicio = new Date(y, m, 1 - offset);
      var dias2 = domingo ? ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
      grid.className = "cal-grid";
      $("#cal-mes-titulo").textContent = new Date(y, m, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      var html = dias2.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
      for (var i = 0; i < 42; i++) {
        var f2 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        var iso2 = f2.getFullYear() + "-" + String(f2.getMonth() + 1).padStart(2, "0") + "-" + String(f2.getDate()).padStart(2, "0");
        var evs2 = eventosDe(iso2); if (f2.getMonth() === m) visibles += evs2.length;
        html += '<div class="cal-dia' + (f2.getMonth() !== m ? " fuera" : "") + (iso2 === hoyISO() ? " hoy" : "") + '" data-cal-dia="' + iso2 + '"><b>' + f2.getDate() + "</b>" +
          (evs2.length ? '<div class="cal-eventos">' + evs2.slice(0, 2).map(chipEvento).join("") + (evs2.length > 2 ? '<span class="cal-mas">+' + (evs2.length - 2) + "</span>" : "") + "</div>" : "") + "</div>";
      }
      grid.innerHTML = html;
    }
    $("#cal-cuenta").textContent = visibles + " evento" + (visibles === 1 ? "" : "s");
    $("#cal-vacio").hidden = visibles > 0;
    $$("#cal-grid [data-evento], #cal-agenda [data-evento]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.eventoSel = b.getAttribute("data-evento");
        estado.panel[pantalla] = "detalle";
        guardar(); pintarPanel(); pintarCalendario();
        if (window.innerWidth <= 1255) abrirPanel();
      });
    });
  }
  function abrirEvento(ev) {
    normalizarEventos();
    formEventoId = ev ? ev.id : null;
    $("#evento-titulo").value = ev ? ev.titulo : "";
    $("#evento-fecha").value = ev ? ev.fecha : hoyISO();
    $("#evento-hora").value = ev ? ev.hora : "";
    $("#evento-contexto").value = ev ? ev.contexto : "";
    $("#evento-form").hidden = false;
    $("#evento-titulo").focus();
  }
  function borrarEvento(id) {
    var ev = eventoPorId(id); if (!ev) return;
    if (!window.confirm("¿Borrar \"" + ev.titulo + "\"?")) return;
    estado.eventos = estado.eventos.filter(function (e) { return e.id !== id; });
    if (estado.eventoSel === id) estado.eventoSel = null;
    guardar(); pintarCalendario(); pintarPanel(); aviso("Evento borrado.");
  }

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function selloLocal() {
    var d = new Date();
    return hoyISO() + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  function normalizarTareas() {
    estado.tareas = (estado.tareas || []).map(function (t, i) {
      var e = t.estado || (t.hecha ? "hecha" : "pendiente");
      return {
        id: t.id || "t" + i,
        titulo: t.titulo || "Sin título",
        tipo: t.tipo === "proyecto" ? "proyecto" : "tarea",
        padre_id: t.padre_id || null,
        estado: e,
        hecha: e === "hecha",
        prioridad: t.prioridad || "media",
        fecha: t.fecha || "",
        contexto: t.contexto || "",
        nota: t.nota || "",
        orden: typeof t.orden === "number" ? t.orden : i,
        creada: t.creada || ""
      };
    });
  }
  function tareaPorId(id) { return estado.tareas.filter(function (t) { return t.id === id; })[0] || null; }
  function hijosDe(id) { return estado.tareas.filter(function (t) { return t.padre_id === id; }); }
  function raicesTareas() {
    return estado.tareas.filter(function (t) { return !t.padre_id || !tareaPorId(t.padre_id); });
  }
  function profundidad(t) {
    var n = 0, p = t.padre_id, visto = {};
    while (p && !visto[p]) { visto[p] = 1; n++; var x = tareaPorId(p); p = x ? x.padre_id : null; }
    return n;
  }
  function descendientes(t) {
    var out = [], pila = hijosDe(t.id).slice();
    while (pila.length) {
      var x = pila.shift(); out.push(x);
      hijosDe(x.id).forEach(function (h) { pila.push(h); });
    }
    return out;
  }
  function progreso(t) {
    var ds = descendientes(t), hechas = ds.filter(function (x) { return x.hecha; }).length;
    var total = ds.length;
    return { total: total, hechas: hechas, pct: total ? Math.round(hechas / total * 100) : (t.hecha ? 100 : 0) };
  }
  function fechaCorta(f) {
    if (!f) return "sin fecha";
    if (f === hoyISO()) return "hoy";
    var p = f.split("-");
    return p.length === 3 ? p[2] + "/" + p[1] : f;
  }
  function filaTarea(t, nivel) {
    var p = progreso(t), hijos = hijosDe(t.id);
    var sub = t.tipo === "proyecto"
      ? '<span class="tarea-progreso" title="' + p.hechas + " de " + p.total + '"><i style="width:' + p.pct + '%"></i></span><small class="tarea-pct">' + p.pct + "%</small>"
      : "";
    var html = '<div class="tarea-fila' + (estado.tareaSel === t.id ? " sel" : "") + '" data-tarea="' + t.id + '" role="button" tabindex="0" title="Clic derecho: acciones" style="--nivel:' + nivel + '">' +
      '<button class="tarea-check' + (t.hecha ? " hecha" : "") + '" type="button" data-check="' + t.id + '" aria-label="' + (t.hecha ? "Marcar abierta" : "Marcar hecha") + '">' + (t.hecha ? "✓" : "") + "</button>" +
      '<span class="tarea-nom' + (t.hecha ? " hecha" : "") + '">' + esc(t.titulo) + (t.tipo === "proyecto" ? ' <small class="tarea-tipo">proyecto</small>' : "") + "</span>" +
      '<span class="tarea-meta">' + esc(fechaCorta(t.fecha)) + "</span>" +
      '<span class="pill pill--' + esc(t.prioridad) + '">' + esc(t.prioridad) + "</span>" + sub +
      '<button class="tarea-add" type="button" data-add-sub="' + t.id + '" title="Añadir una tarea dentro">+</button></div>';
    if (hijos.length) html += hijos.map(function (h) { return filaTarea(h, nivel + 1); }).join("");
    return html;
  }
  function tarjetaTablero(t) {
    var p = progreso(t);
    return '<button class="tarjeta-tarea' + (estado.tareaSel === t.id ? " sel" : "") + '" type="button" data-tarea="' + t.id + '" title="Clic derecho: acciones">' +
      '<b>' + esc(t.titulo) + "</b><small>" + esc(fechaCorta(t.fecha)) + " · " + esc(t.contexto || "sin contexto") + "</small>" +
      (t.tipo === "proyecto" ? '<span class="tarea-progreso"><i style="width:' + p.pct + '%"></i></span>' : "") + "</button>";
  }
  function bindTareas() {
    $$("#tareas-lista [data-tarea]").forEach(function (fila) {
      fila.addEventListener("click", function (ev) {
        if (ev.target.getAttribute("data-check") || ev.target.getAttribute("data-add-sub")) return;
        estado.tareaSel = fila.getAttribute("data-tarea");
        estado.panel[pantalla] = "detalle";
        guardar(); pintarTareas(); pintarPanel();
        if (window.innerWidth <= 1255) abrirPanel();
      });
      fila.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fila.click(); }
      });
    });
    $$("#tareas-lista [data-check]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var t = tareaPorId(b.getAttribute("data-check"));
        if (!t) return;
        var marcar = !t.hecha;
        t.hecha = marcar; t.estado = marcar ? "hecha" : "pendiente";
        if (marcar && t.tipo === "proyecto") descendientes(t).forEach(function (h) { h.hecha = true; h.estado = "hecha"; });
        guardar(); pintarTareas(); pintarPanel();
      });
    });
    $$("#tareas-lista [data-add-sub]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var padre = b.getAttribute("data-add-sub");
        abrirFormulario(null, padre);
      });
    });
  }
  function pintarTareas() {
    normalizarTareas();
    var lista = $("#tareas-lista"), vacio = $("#tareas-vacio"), tareas = estado.tareas;
    var hoy = tareas.filter(function (t) { return !t.hecha && t.fecha === hoyISO(); });
    var abiertas = tareas.filter(function (t) { return !t.hecha; });
    var hechas = tareas.filter(function (t) { return t.hecha; });
    $("#kpi-hoy").textContent = String(hoy.length);
    $("#kpi-abiertas").textContent = String(abiertas.length);
    $("#kpi-hechas").textContent = String(hechas.length);
    $("#kpi-progreso").textContent = (tareas.length ? Math.round(hechas.length / tareas.length * 100) : 0) + " %";
    if (!tareas.length) { lista.innerHTML = ""; vacio.hidden = false; return; }
    vacio.hidden = true;
    if (vistaTareas === "arbol") {
      lista.innerHTML = raicesTareas().map(function (t) { return filaTarea(t, 0); }).join("");
    } else if (vistaTareas === "tablero") {
      var lunes = new Date(); lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
      var domingo = new Date(lunes); domingo.setDate(lunes.getDate() + 6);
      var iso = function (d) { return d.toISOString().slice(0, 10); };
      var colHoy = tareas.filter(function (t) { return !t.hecha && (!t.fecha || t.fecha <= hoyISO()); });
      var colSemana = tareas.filter(function (t) { return !t.hecha && t.fecha > hoyISO(); });
      var colHechas = tareas.filter(function (t) { return t.hecha; });
      var col = function (titulo, items) {
        return '<div class="tablero-col"><h3>' + titulo + " <span>" + items.length + "</span></h3>" + (items.map(tarjetaTablero).join("") || '<p class="muted">Nada.</p>') + "</div>";
      };
      lista.innerHTML = '<div class="tablero">' + col("Hoy / atrasadas", colHoy) + col("Próximas", colSemana) + col("Hechas", colHechas) + "</div>";
    } else {
      var v = tareas.filter(function (t) { return !t.hecha && t.fecha && t.fecha <= hoyISO(); });
      lista.innerHTML = v.length ? v.map(function (t) { return filaTarea(t, 0); }).join("") : '<p class="muted">Nada para hoy. Cambia a Árbol o Tablero.</p>';
    }
    bindTareas();
  }
  var formEditId = null;
  function opcionesPadre(t) {
    var excluir = {};
    if (t) { excluir[t.id] = 1; descendientes(t).forEach(function (x) { excluir[x.id] = 1; }); }
    return '<option value="">Sin padre</option>' + estado.tareas.filter(function (x) {
      return !excluir[x.id] && profundidad(x) < 4;
    }).map(function (x) {
      return '<option value="' + x.id + '">' + esc("— ".repeat(profundidad(x)) + (x.tipo === "proyecto" ? "Proyecto: " : "") + x.titulo) + "</option>";
    }).join("");
  }
  function abrirFormulario(t, padreId) {
    normalizarTareas();
    formEditId = t ? t.id : null;
    $("#tarea-titulo").value = t ? t.titulo : "";
    $("#tarea-tipo").value = t ? t.tipo : "tarea";
    $("#tarea-padre").innerHTML = opcionesPadre(t);
    $("#tarea-padre").value = t ? (t.padre_id || "") : (padreId || "");
    $("#tarea-fecha").value = t ? t.fecha : hoyISO();
    $("#tarea-prioridad").value = t ? t.prioridad : "media";
    $("#tarea-contexto").value = t ? t.contexto : "";
    $("#tarea-form").hidden = false;
    $("#tarea-form button[type=submit]").textContent = t ? "Guardar" : "Crear";
    $("#tarea-titulo").focus();
  }
  function borrarTarea(id) {
    var t = tareaPorId(id); if (!t) return;
    var familia = [t.id].concat(descendientes(t).map(function (x) { return x.id; }));
    if (!window.confirm("¿Borrar \"" + t.titulo + "\" y sus " + (familia.length - 1) + " tareas dentro?")) return;
    estado.tareas = estado.tareas.filter(function (x) { return familia.indexOf(x.id) === -1; });
    if (familia.indexOf(estado.tareaSel) !== -1) estado.tareaSel = null;
    guardar(); pintarTareas(); pintarPanel(); aviso("Tarea borrada.");
  }

  /* ---- U4a: Malla de cursos, niveles, prerrequisitos y créditos ---- */
  var formRamoId = null, mallaBusqueda = "", mallaFiltro = "todos", mallaRapido = false;

  function normalizarCursos() {
    var vistos = {}, out = [];
    (estado.cursos || []).forEach(function (c) {
      if (!c || typeof c !== "object") return;
      var cod = String(c.codigo || "").trim().toUpperCase();
      if (!cod || vistos[cod]) return;
      vistos[cod] = 1;
      var reqs = Array.isArray(c.requisitos) ? c.requisitos : [];
      reqs = reqs.map(function (r) { return String(r || "").trim().toUpperCase(); })
        .filter(function (r) { return r && r !== cod; });
      reqs = reqs.filter(function (r, i) { return reqs.indexOf(r) === i; });
      var grupos = Array.isArray(c.requisitos_o) ? c.requisitos_o : [];
      grupos = grupos.map(function (g) {
        var lista = Array.isArray(g) ? g : [g];
        return lista.map(function (r) { return String(r || "").trim().toUpperCase(); })
          .filter(function (r) { return r && r !== cod; });
      }).filter(function (g) { return g.length; });
      var nivel = parseInt(c.nivel, 10);
      if (!nivel || nivel < 1) nivel = String(c.tipo || "") === "cupo" ? 99 : 1;
      if (nivel > 99) nivel = 99;
      var cerrado = c.cerrado !== undefined ? !!c.cerrado : !!c.aprobado;
      var aprobado = !!c.aprobado && cerrado;
      var resultado = cerrado ? String(c.resultado || (aprobado ? "aprobado" : "reprobado")) : "";
      out.push({
        codigo: cod, nombre: String(c.nombre || cod).trim() || cod,
        creditos: Math.max(0, parseInt(c.creditos, 10) || 0), nivel: nivel,
        requisitos: reqs, requisitos_o: grupos, aprobacion: Number(c.aprobacion) || null,
        tipo: String(c.tipo || ""), enMalla: c.enMalla !== false && c.en_malla !== false,
        cerrado: cerrado, aprobado: aprobado, resultado: resultado,
        notaCierre: c.notaCierre === null || c.notaCierre === undefined ? null : Number(c.notaCierre),
        cerradoEn: String(c.cerradoEn || ""),
        enCurso: !!c.enCurso && !cerrado
      });
    });
    estado.cursos = out;
  }
  function ramoPorCodigo(cod) {
    var c = String(cod || "").trim().toUpperCase();
    return (estado.cursos || []).filter(function (x) { return x.codigo === c; })[0] || null;
  }
  function creditosDe(c) { return Number(c.creditos) || 0; }
  function etiquetaNivel(n) { return Number(n) === 99 ? "Electivos" : "Nivel " + n; }
  function requisitosTexto(c) {
    var reqs = (c.requisitos || []).slice();
    (c.requisitos_o || []).forEach(function (g) { reqs.push(g.join(" o ")); });
    return reqs.join(" · ");
  }
  // aprobado manda; si no, en curso; si no, disponible solo cuando TODOS los requisitos
  // (y al menos uno de cada grupo "o") están aprobados. Un código que no existe bloquea.
  function estadoDeRamo(c, visto) {
    if (!c) return "bloqueado";
    if (c.cerrado) return c.aprobado ? "aprobado" : "reprobado";
    if (visto && visto[c.codigo]) return "bloqueado";
    if (c.enCurso) return "curso";
    var reqs = c.requisitos || [], grupos = c.requisitos_o || [];
    if (!reqs.length && !grupos.length) return "disponible";
    var v2 = Object.assign({}, visto || {}); v2[c.codigo] = 1;
    var ok = reqs.every(function (r) {
      var x = ramoPorCodigo(r);
      return !!x && estadoDeRamo(x, v2) === "aprobado";
    });
    (grupos || []).forEach(function (g) {
      if (!ok) return;
      var uno = g.some(function (r) {
        var x = ramoPorCodigo(r);
        return !!x && estadoDeRamo(x, v2) === "aprobado";
      });
      if (!uno) ok = false;
    });
    return ok ? "disponible" : "bloqueado";
  }
  function faltantesDe(c) {
    var out = [];
    (c.requisitos || []).forEach(function (r) {
      var x = ramoPorCodigo(r);
      if (!x || estadoDeRamo(x) !== "aprobado") out.push(r);
    });
    (c.requisitos_o || []).forEach(function (g) {
      var uno = g.some(function (r) { var x = ramoPorCodigo(r); return !!x && estadoDeRamo(x) === "aprobado"; });
      if (!uno) out.push(g.join(" o "));
    });
    return out;
  }
  function iconoEstado(e) {
    return { aprobado: "i-check", curso: "i-play", disponible: "i-plus", bloqueado: "i-lock", reprobado: "i-x" }[e] || "i-plus";
  }
  function desbloqueaDe(cod) {
    return estado.cursos.filter(function (x) {
      if (x.enMalla === false) return false;
      return (x.requisitos || []).indexOf(cod) !== -1 ||
        (x.requisitos_o || []).some(function (g) { return g.indexOf(cod) !== -1; });
    });
  }
  function chipRamo(cod, alternativa) {
    if (!cod) return '<span class="pt-chip bloqueado">' + esc(alternativa) + "</span>";
    var c = ramoPorCodigo(cod);
    var e = c ? estadoDeRamo(c) : "bloqueado";
    return '<button class="pt-chip ' + e + '" type="button" data-chip-ramo="' + esc(cod) + '">' + esc(alternativa || cod) + "</button>";
  }
  function detalleMallaHTML() {
    var c = ramoPorCodigo(estado.ramoSel);
    if (!c) {
      return '<div class="malla-detalle__vacio"><span class="malla-detalle__icono">' + icono("i-malla") +
        "</span><div><b>Elige un ramo</b><p>Las líneas tenues muestran todos los prerrequisitos. Al elegir uno, el grafo enciende en azul lo que necesita y en naranjo lo que desbloquea.</p></div></div>";
    }
    var e = estadoDeRamo(c), faltan = faltantesDe(c);
    var antes = [];
    (c.requisitos || []).forEach(function (r) {
      if (antes.map(function (x) { return x.cod; }).indexOf(r) === -1) antes.push({ cod: r, txt: r });
    });
    (c.requisitos_o || []).forEach(function (g) {
      antes.push({ cod: g.length === 1 ? g[0] : null, txt: g.join(" o ") });
    });
    var desp = desbloqueaDe(c.codigo);
    var aprob = Number(c.aprobacion);
    return '<div class="malla-detalle__cab"><div><span class="malla-detalle__cod">' + esc(c.codigo) + "</span>" +
      "<h3>" + esc(c.nombre) + "</h3><p>" + creditosDe(c) + " cr · " + esc(etiquetaNivel(c.nivel)) +
      " · <b class=\"malla-estado-" + e + "\">" + esc(e) + "</b>" +
      (aprob ? " · " + Math.round(aprob) + " % de aprobación" : "") + "</p></div>" +
      '<div class="fila"><button class="btn btn--chico" type="button" data-malla-editar="' + esc(c.codigo) + '">Editar</button>' +
      '<button class="btn btn--chico" type="button" data-malla-limpiar>Quitar selección</button></div></div>' +
      '<div class="malla-chips"><div><b>Antes necesitas</b>' +
      (antes.length ? antes.map(function (x) { return chipRamo(x.cod, x.txt); }).join("") : '<span class="muted">Sin prerrequisitos.</span>') +
      "</div><div><b>Este ramo desbloquea</b>" +
      (desp.length ? desp.map(function (x) { return chipRamo(x.codigo, x.codigo); }).join("") : '<span class="muted">No desbloquea otro ramo del plan.</span>') +
      "</div></div>" +
      (faltan.length ? '<p class="malla-falta">Todavía falta: ' + esc(faltan.join(", ")) + "</p>" : "");
  }
  function pintarMalla() {
    var cols = $("#malla-cols"); if (!cols) return;
    normalizarCursos();
    var cursos = estado.cursos.filter(function (c) { return c.enMalla !== false; });
    var total = 0, aprobCred = 0, aprobN = 0, cursoN = 0, libres = 0;
    var cuenta = { aprobado: 0, curso: 0, disponible: 0, bloqueado: 0, reprobado: 0 };
    cursos.forEach(function (c) {
      var e = estadoDeRamo(c);
      total += creditosDe(c);
      cuenta[e] = (cuenta[e] || 0) + 1;
      if (e === "aprobado") aprobCred += creditosDe(c);
      if (e === "aprobado" && c.tipo !== "cupo") aprobN++;
      if (e === "curso") cursoN++;
      if (e === "disponible" && c.tipo !== "cupo") libres++;
    });
    var pct = total ? Math.round(aprobCred / total * 100) : 0;
    if ($("#malla-k-creditos")) $("#malla-k-creditos").textContent = aprobCred + " / " + total;
    if ($("#malla-k-pct")) $("#malla-k-pct").textContent = pct + " %";
    if ($("#malla-k-ramos")) $("#malla-k-ramos").textContent = aprobN + (cursoN ? " · " + cursoN + " curso" + (cursoN === 1 ? "" : "s") : "");
    if ($("#malla-k-libres")) $("#malla-k-libres").textContent = String(libres);
    if ($("#malla-progreso-barra")) $("#malla-progreso-barra").style.width = pct + "%";
    if ($("#malla-progreso-txt")) $("#malla-progreso-txt").textContent = pct + " %";
    var pg = $(".malla-progreso"); if (pg) pg.setAttribute("aria-valuenow", String(pct));
    Object.keys(cuenta).forEach(function (k) { var el = $("#malla-lg-" + k); if (el) el.textContent = String(cuenta[k]); });
    var nivelesTodos = {};
    cursos.forEach(function (c) { nivelesTodos[c.nivel] = 1; });
    if ($("#malla-niveles-cuenta")) $("#malla-niveles-cuenta").textContent = Object.keys(nivelesTodos).length + " niveles";
    var vacio = $("#malla-vacio"), scroll = $("#malla-scroll"), detalle = $("#malla-detalle");
    if (!cursos.length) {
      if (vacio) vacio.hidden = false;
      if (scroll) scroll.hidden = true;
      if (detalle) { detalle.hidden = true; detalle.innerHTML = ""; }
      cols.innerHTML = "";
      var svg0 = $("#malla-lineas"); if (svg0) svg0.innerHTML = "";
      return;
    }
    if (vacio) vacio.hidden = true;
    if (scroll) scroll.hidden = false;
    if (detalle) detalle.hidden = false;
    if (estado.ramoSel && !ramoPorCodigo(estado.ramoSel)) estado.ramoSel = null;
    if ($("#malla-quitar-sel")) $("#malla-quitar-sel").hidden = !estado.ramoSel;
    if ($("#malla-pista")) $("#malla-pista").textContent = estado.ramoSel
      ? "Ves solo las líneas de este ramo: azul lo que necesita, naranjo lo que desbloquea. Vuelve a pulsarlo para quitar la selección."
      : "Las líneas tenues son prerrequisitos. Elige un ramo para encender solo las suyas: azul lo que necesita, naranjo lo que desbloquea.";
    var q = mallaBusqueda.toLowerCase();
    var visibles = cursos.filter(function (c) {
      var e = estadoDeRamo(c);
      if (mallaFiltro === "aprobados" && e !== "aprobado") return false;
      if (mallaFiltro === "disponibles" && e !== "disponible") return false;
      if (mallaFiltro === "bloqueados" && e !== "bloqueado") return false;
      if (mallaFiltro === "curso" && e !== "curso") return false;
      return !q || (c.codigo + " " + c.nombre).toLowerCase().indexOf(q) !== -1;
    });
    if (!visibles.length) {
      cols.innerHTML = '<p class="muted malla-sin">Ningún ramo coincide con el filtro.</p>';
      var svg1 = $("#malla-lineas"); if (svg1) svg1.innerHTML = "";
      if (detalle) detalle.innerHTML = detalleMallaHTML();
      return;
    }
    var niveles = {};
    visibles.forEach(function (c) { (niveles[c.nivel] = niveles[c.nivel] || []).push(c); });
    cols.innerHTML = Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
      var lista = niveles[n].slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; });
      var cr = lista.reduce(function (a, c) { return a + creditosDe(c); }, 0);
      return '<section class="malla-col" data-nivel="' + n + '"><header class="malla-col__cab"><b>' + esc(etiquetaNivel(n)) +
        "</b><span>" + cr + " cr · " + lista.length + " ramo" + (lista.length === 1 ? "" : "s") + "</span></header>" +
        '<div class="malla-col__nodos">' + lista.map(function (c) {
          var e = estadoDeRamo(c), req = requisitosTexto(c), faltan = faltantesDe(c);
          var titulo = c.nombre + (req ? " · requiere " + req : "") + (faltan.length ? " · faltan: " + faltan.join(", ") : "");
          return '<button class="ramo-card ramo-card--' + e + (c.codigo === estado.ramoSel ? ' sel' : '') + '" type="button" data-ramo="' + esc(c.codigo) + '" title="' + esc(titulo) + '">' +
            '<span class="ramo-card__top"><b>' + esc(c.codigo) + '</b><span class="ramo-card__ico">' + icono(iconoEstado(e)) + "</span></span>" +
            '<span class="ramo-card__nom">' + esc(c.nombre) + "</span>" +
            '<span class="ramo-card__meta">' + creditosDe(c) + " cr</span>" +
            '<span class="ramo-card__est">' + esc(e) + "</span></button>";
        }).join("") + "</div></section>";
    }).join("");
    $$("#malla-cols [data-ramo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cod = b.getAttribute("data-ramo");
        if (mallaRapido) { alternarRamo(cod); return; }
        estado.ramoSel = estado.ramoSel === cod ? null : cod;
        estado.panel.malla = "detalle";
        guardar(); pintarMalla(); pintarPanel();
        if (window.innerWidth <= 1255 && estado.ramoSel) abrirPanel();
      });
    });
    if (detalle) detalle.innerHTML = detalleMallaHTML();
    $$("#malla-detalle [data-chip-ramo]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.ramoSel = b.getAttribute("data-chip-ramo"); estado.panel.malla = "detalle";
        guardar(); pintarMalla(); pintarPanel();
      });
    });
    var ed = $("#malla-detalle [data-malla-editar]");
    if (ed) ed.addEventListener("click", function () { abrirFormularioRamo(ramoPorCodigo(ed.getAttribute("data-malla-editar"))); });
    var limpiar = $("#malla-detalle [data-malla-limpiar]");
    if (limpiar) limpiar.addEventListener("click", limpiarSeleccionMalla);
    if (window.requestAnimationFrame) window.requestAnimationFrame(dibujarLineasMalla); else setTimeout(dibujarLineasMalla, 30);
  }
  function limpiarSeleccionMalla() {
    estado.ramoSel = null; guardar(); pintarMalla(); pintarPanel();
  }
  function dibujarLineasMalla() {
    var cont = $("#malla-tablero"), svg = $("#malla-lineas");
    if (!cont || !svg) return;
    var ancho = Math.max(cont.scrollWidth, cont.clientWidth), alto = Math.max(cont.scrollHeight, cont.clientHeight);
    if (!ancho || !alto) return;
    svg.setAttribute("viewBox", "0 0 " + ancho + " " + alto);
    svg.setAttribute("width", ancho); svg.setAttribute("height", alto);
    var caja = cont.getBoundingClientRect(), nodos = {};
    $$("#malla-cols [data-ramo]").forEach(function (el) { nodos[el.getAttribute("data-ramo")] = el; });
    var sel = estado.ramoSel, partes = [];
    estado.cursos.forEach(function (c) {
      var destino = nodos[c.codigo]; if (!destino) return;
      var reqs = (c.requisitos || []).slice();
      (c.requisitos_o || []).forEach(function (g) {
        g.forEach(function (r) { if (reqs.indexOf(r) === -1) reqs.push(r); });
      });
      reqs.forEach(function (req) {
        var origen = nodos[req]; if (!origen) return;
        var clase = sel ? (c.codigo === sel ? "req" : req === sel ? "des" : "tenue") : "tenue";
        var a = origen.getBoundingClientRect(), b = destino.getBoundingClientRect();
        var x1 = a.right - caja.left, y1 = a.top + a.height / 2 - caja.top;
        var x2 = b.left - caja.left, y2 = b.top + b.height / 2 - caja.top;
        var dx = Math.max(18, Math.abs(x2 - x1) * 0.45);
        var d = "M" + x1.toFixed(1) + " " + y1.toFixed(1) + " C" + (x1 + dx).toFixed(1) + " " + y1.toFixed(1) + " " +
          (x2 - dx).toFixed(1) + " " + y2.toFixed(1) + " " + x2.toFixed(1) + " " + y2.toFixed(1);
        partes.push('<path class="malla-linea malla-linea--' + clase + '" d="' + d + '"/>');
      });
    });
    svg.innerHTML = partes.join("");
  }
  function alternarRamo(cod) {
    var c = ramoPorCodigo(cod); if (!c) return;
    if (c.cerrado) { reabrirCurso(cod); return; }
    var q = califDe(cod), P = presentacionDe(q), nf = notaFinalDe(q);
    if (P === null) {
      if (!window.confirm("\"" + c.codigo + "\" no tiene notas. ¿Marcarlo como aprobado manualmente y cerrar el curso?")) return;
      c.cerrado = true; c.aprobado = true; c.resultado = "aprobado";
      c.notaCierre = null; c.cerradoEn = selloLocal(); c.enCurso = false;
      guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
      aviso(c.codigo + " cerrado como aprobado (sin notas).");
      return;
    }
    if (nf === null) { aviso("Falta la nota del examen o la eximición para cerrar el curso."); return; }
    cerrarCurso(cod);
  }
  function cerrarCurso(cod) {
    var c = ramoPorCodigo(cod); if (!c) return;
    if (c.cerrado) { aviso("El curso ya está cerrado."); return; }
    var q = califDe(cod), P = presentacionDe(q), nf = notaFinalDe(q);
    if (P === null) { aviso("No hay notas para calcular el resultado del curso."); return; }
    if (nf === null) { aviso("Falta la nota del examen o la eximición para cerrar el curso."); return; }
    var res = nf >= q.notaMin ? "aprobado" : "reprobado";
    if (!window.confirm("¿Cerrar \"" + c.codigo + " — " + c.nombre + "\" con final " + fmtNota(nf) +
      "? Quedará " + res.toUpperCase() + ".")) return;
    c.cerrado = true; c.aprobado = res === "aprobado"; c.resultado = res;
    c.notaCierre = Math.round(nf * 10) / 10; c.cerradoEn = selloLocal(); c.enCurso = false;
    guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
    aviso("Curso cerrado: " + res + " · " + fmtNota(nf));
  }
  function reabrirCurso(cod) {
    var c = ramoPorCodigo(cod); if (!c || !c.cerrado) return;
    if (!window.confirm("¿Reabrir \"" + c.codigo + " — " + c.nombre + "\"? Dejará de contar como " +
      (c.aprobado ? "aprobado" : "reprobado") + " y volverá a en curso.")) return;
    c.cerrado = false; c.aprobado = false; c.resultado = "";
    c.notaCierre = null; c.cerradoEn = ""; c.enCurso = true;
    guardar(); pintarMalla(); pintarCalificaciones(); pintarPanel();
    aviso("Curso reabierto. Sus notas siguen ahí.");
  }
  function abrirFormularioRamo(c) {
    normalizarCursos();
    formRamoId = c ? c.codigo : null;
    $("#ramo-codigo").value = c ? c.codigo : "";
    $("#ramo-nombre").value = c ? c.nombre : "";
    $("#ramo-creditos").value = c ? c.creditos : 6;
    $("#ramo-nivel").value = c ? c.nivel : 1;
    $("#ramo-requisitos").value = c ? (c.requisitos || []).join(", ") : "";
    $("#ramo-aprobado").checked = !!(c && c.cerrado && c.aprobado);
    $("#ramo-curso").checked = !!(c && !c.cerrado && c.enCurso);
    $("#ramo-form").hidden = false;
    $("#ramo-form button[type=submit]").textContent = c ? "Guardar" : "Crear";
    $("#ramo-codigo").focus(); $("#ramo-codigo").select();
  }
  function cerrarFormularioRamo() {
    var f = $("#ramo-form"); if (f) f.hidden = true;
    formRamoId = null;
  }
  function borrarRamo(cod) {
    normalizarCursos();
    var c = ramoPorCodigo(cod); if (!c) return;
    var dependientes = estado.cursos.filter(function (x) {
      return (x.requisitos || []).indexOf(cod) !== -1 ||
        (x.requisitos_o || []).some(function (g) { return g.indexOf(cod) !== -1; });
    }).length;
    if (!window.confirm("¿Borrar \"" + c.codigo + " — " + c.nombre + "\"? Se borran también sus calificaciones." +
      (dependientes ? " Se quitará de los requisitos de " + dependientes + " ramo(s)." : ""))) return;
    estado.cursos = estado.cursos.filter(function (x) { return x.codigo !== cod; });
    if (estado.califs) delete estado.califs[cod];
    estado.cursos.forEach(function (x) {
      x.requisitos = (x.requisitos || []).filter(function (r) { return r !== cod; });
      x.requisitos_o = (x.requisitos_o || []).map(function (g) {
        return g.filter(function (r) { return r !== cod; });
      }).filter(function (g) { return g.length; });
    });
    if (estado.ramoSel === cod) estado.ramoSel = null;
    guardar(); pintarMalla(); pintarPanel(); aviso("Ramo borrado.");
  }
  function cursosDesdeDoc(doc) {
    var raw = [], aprob = {}, enCurso = {};
    if (doc && doc.estado && typeof doc.estado === "object") {
      var act = doc.estado.activo;
      var sem = (doc.estado.sem || {})[act] || {};
      (sem.ramos || []).forEach(function (r) { if (r && r.codigo) enCurso[String(r.codigo).toUpperCase()] = 1; });
      ((doc.estado.agregados || {})[act] || []).forEach(function (r) { if (r && r.codigo) enCurso[String(r.codigo).toUpperCase()] = 1; });
    }
    if (doc && doc.datos && Array.isArray(doc.datos.cursos)) {
      raw = doc.datos.cursos;
      var ap = doc.datos.aprobados;
      if (Array.isArray(ap)) ap.forEach(function (c) { aprob[c] = 1; });
      else if (ap && typeof ap === "object") aprob = ap;
    } else if (doc && doc.estado && doc.estado.catalogo && typeof doc.estado.catalogo === "object") {
      raw = Object.keys(doc.estado.catalogo).map(function (k) {
        return Object.assign({ codigo: k }, doc.estado.catalogo[k]);
      });
      aprob = doc.estado.aprobados || {};
    } else if (doc && Array.isArray(doc.cursos)) {
      raw = doc.cursos;
    } else return null;
    return raw.map(function (c) {
      if (!c || typeof c !== "object") return null;
      var cod = String(c.codigo || c.code || "").trim().toUpperCase();
      if (!cod) return null;
      return {
        codigo: cod, nombre: c.nombre || c.name || cod,
        creditos: parseInt(c.creditos || c.credits, 10) || 0,
        nivel: parseInt(c.nivel, 10) || 0,
        aprobacion: Number(c.aprobacion) || null,
        tipo: String(c.tipo || ""), enMalla: c.en_malla !== false,
        requisitos: Array.isArray(c.requisitos) ? c.requisitos : [],
        requisitos_o: Array.isArray(c.requisitos_o) ? c.requisitos_o : [],
        aprobado: !!(c.aprobado || (Array.isArray(aprob) ? aprob.indexOf(cod) !== -1 : aprob[cod])),
        enCurso: !!c.enCurso || c.estado === "curso" || !!enCurso[cod]
      };
    }).filter(Boolean);
  }
  function importarMalla(file) {
    var lector = new FileReader();
    lector.onload = function () {
      try {
        var cursos = cursosDesdeDoc(JSON.parse(lector.result));
        if (!cursos || !cursos.length) { aviso("El archivo no trae cursos de malla."); return; }
        if (estado.cursos.length && !window.confirm("¿Reemplazar la malla actual (" + estado.cursos.length +
          " ramos) por " + cursos.length + "?")) return;
        estado.cursos = cursos; estado.ramoSel = null;
        normalizarCursos(); guardar(); pintarMalla(); pintarPanel();
        aviso("Malla importada: " + estado.cursos.length + " ramos.");
      } catch (e) { aviso("No se pudo leer la malla."); }
    };
    lector.readAsText(file);
  }
  function exportarMalla() {
    normalizarCursos();
    var blob = new Blob([JSON.stringify({ v: 1, tipo: "mimo-malla", cursos: estado.cursos }, null, 2)],
      { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "mimo-malla.json"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    aviso("Malla exportada.");
  }

  /* ---- U4b: Calificaciones, notas por categoría, examen y eximición ---- */
  var califSel = null;

  function califPorDefecto() {
    return {
      categorias: [{ nombre: "General", peso: 100 }],
      componentes: [],
      examen: { activo: true, peso: 40, nota: null, reemplaza: null },
      eximicion: { activa: false, modo: "todas", condiciones: [] },
      notaMin: 4, meta: 5
    };
  }
  function notaNum(v) {
    if (v === "" || v === null || v === undefined) return null;
    var n = Number(String(v).replace(",", "."));
    if (!isFinite(n)) return null;
    while (n >= 10) n = n / 10;
    if (n > 7) n = 7;
    if (n < 1) n = 1;
    return Math.round(n * 10) / 10;
  }
  function fmtNota(v) { return v === null || v === undefined ? "—" : (Math.round(v * 10) / 10).toFixed(1); }
  function fmtNota2(v) { return v === null || v === undefined ? "—" : (Math.round(v * 100) / 100).toFixed(2); }
  function textoNecesario(v) {
    if (v === null || v === undefined) return "—";
    if (v <= 1) return "no hace falta";
    if (v > 7) return "imposible";
    return fmtNota2(v);
  }
  function normalizarCalifs() {
    normalizarCursos();
    if (!estado.califs || typeof estado.califs !== "object") estado.califs = {};
    var vigentes = {};
    estado.cursos.forEach(function (cur) {
      var q = estado.califs[cur.codigo];
      if (!q || typeof q !== "object") q = califPorDefecto();
      if (!Array.isArray(q.categorias) || !q.categorias.length) q.categorias = [{ nombre: "General", peso: 100 }];
      q.categorias = q.categorias.map(function (cat, i) {
        return { nombre: String(cat.nombre || "Categoría " + (i + 1)), peso: Math.max(0, Number(cat.peso) || 0) };
      });
      var vistosCat = {};
      q.categorias.forEach(function (cat) {
        var base = cat.nombre, n = 1;
        while (vistosCat[cat.nombre]) { n++; cat.nombre = base + " " + n; }
        vistosCat[cat.nombre] = 1;
      });
      q.componentes = (Array.isArray(q.componentes) ? q.componentes : []).map(function (x, i) {
        return {
          nombre: String(x.nombre || "Componente " + (i + 1)),
          categoria: String(x.categoria || q.categorias[0].nombre),
          nota: notaNum(x.nota), fecha: String(x.fecha || ""), peso: Math.max(0.1, Number(x.peso) || 1)
        };
      });
      q.componentes.forEach(function (x) {
        if (!q.categorias.some(function (c) { return c.nombre === x.categoria; })) x.categoria = q.categorias[0].nombre;
      });
      var ex = q.examen || {};
      q.examen = {
        activo: ex.activo !== false,
        peso: Math.max(0, Math.min(100, Number(ex.peso))),
        nota: notaNum(ex.nota),
        reemplaza: null
      };
      if (isNaN(q.examen.peso)) q.examen.peso = 40;
      var rep = parseInt(ex.reemplaza, 10);
      if (!isNaN(rep) && rep >= 0 && rep < q.componentes.length) q.examen.reemplaza = rep;
      var exi = q.eximicion || {};
      q.eximicion = { activa: !!exi.activa, modo: exi.modo === "alguna" ? "alguna" : "todas", condiciones: [] };
      (Array.isArray(exi.condiciones) ? exi.condiciones : []).forEach(function (c) {
        var tipo = ["presentacion", "categoria", "componente"].indexOf(c.tipo) !== -1 ? c.tipo : "presentacion";
        var op = [">=", ">", "<=", "<"].indexOf(c.op) !== -1 ? c.op : ">=";
        q.eximicion.condiciones.push({ tipo: tipo, ref: String(c.ref || ""), op: op, valor: notaNum(c.valor) || 1 });
      });
      q.notaMin = notaNum(q.notaMin) || 4;
      q.meta = notaNum(q.meta) || 5;
      estado.califs[cur.codigo] = q; vigentes[cur.codigo] = 1;
    });
    Object.keys(estado.califs).forEach(function (cod) { if (!vigentes[cod]) delete estado.califs[cod]; });
  }
  function califDe(cod) {
    if (!estado.califs || typeof estado.califs !== "object") estado.califs = {};
    if (!estado.califs[cod]) estado.califs[cod] = califPorDefecto();
    return estado.califs[cod];
  }
  function valorComp(c, i) {
    if (!c.componentes[i]) return null;
    var ex = c.examen;
    if (ex && ex.reemplaza === i && ex.nota !== null && ex.nota !== undefined) return Number(ex.nota);
    var n = c.componentes[i].nota;
    return n === null || n === undefined ? null : Number(n);
  }
  function promedioCategoria(c, cat) {
    var sp = 0, sn = 0;
    c.componentes.forEach(function (x, i) {
      if ((x.categoria || "General") !== cat.nombre) return;
      var v = valorComp(c, i); if (v === null) return;
      var p = Number(x.peso) || 1;
      sp += p; sn += p * v;
    });
    return sp ? sn / sp : null;
  }
  function presentacionDe(c) {
    var sp = 0, sn = 0;
    c.categorias.forEach(function (cat) {
      var p = promedioCategoria(c, cat); if (p === null) return;
      var w = Number(cat.peso) || 0;
      sp += w; sn += w * p;
    });
    return sp ? sn / sp : null;
  }
  function condicionValor(c, cond) {
    if (cond.tipo === "presentacion") return presentacionDe(c);
    if (cond.tipo === "categoria") {
      var cat = c.categorias.filter(function (x) { return x.nombre === cond.ref; })[0];
      return cat ? promedioCategoria(c, cat) : null;
    }
    var i = c.componentes.map(function (x) { return x.nombre; }).indexOf(cond.ref);
    return i >= 0 ? valorComp(c, i) : null;
  }
  function estadoEximicion(c) {
    var ex = c.eximicion;
    var detalle = (ex.condiciones || []).map(function (cond) {
      var v = condicionValor(c, cond);
      var ok = false;
      if (v !== null) {
        var x = Number(cond.valor);
        ok = cond.op === ">=" ? v >= x : cond.op === "<=" ? v <= x : cond.op === ">" ? v > x : v < x;
      }
      return { cond: cond, actual: v, ok: ok };
    });
    var cumple = ex.activa && detalle.length > 0 &&
      (ex.modo === "alguna" ? detalle.some(function (d) { return d.ok; }) : detalle.every(function (d) { return d.ok; }));
    return { activa: ex.activa, modo: ex.modo, detalle: detalle, cumple: cumple,
      sinDatos: detalle.some(function (d) { return d.actual === null; }) };
  }
  function notaFinalDe(c) {
    var P = presentacionDe(c); if (P === null) return null;
    if (estadoEximicion(c).cumple) return P;
    if (!c.examen.activo) return P;
    if (c.examen.nota === null || c.examen.nota === undefined) return null;
    return (1 - c.examen.peso / 100) * P + (c.examen.peso / 100) * c.examen.nota;
  }
  function estadoCalifDe(c, curso) {
    if (!curso || !curso.cerrado) return { texto: "en curso", clase: "" };
    return curso.aprobado
      ? { texto: "aprobado", clase: "pill-ok" }
      : { texto: "reprobado", clase: "pill-bad" };
  }
  function necesarioDe(c, objetivo) {
    if (!c.examen.activo || c.examen.peso <= 0) return null;
    var P = presentacionDe(c); if (P === null) return null;
    var f0 = (1 - c.examen.peso / 100) * P;
    var f1 = f0 + (c.examen.peso / 100);
    if (Math.abs(f1 - f0) < 1e-9) return null;
    return (objetivo - f0) / (f1 - f0);
  }
  function htmlDetalleCalif(cur, q) {
    if (!cur) return '<p class="muted">Selecciona un ramo.</p>';
    var P = presentacionDe(q), nf = notaFinalDe(q), est = estadoCalifDe(q, cur), ex = estadoEximicion(q);
    var necMin = necesarioDe(q, q.notaMin), necMeta = necesarioDe(q, q.meta);
    var filasCat = q.categorias.map(function (cat, i) {
      var p = promedioCategoria(q, cat);
      return '<tr><td><input class="entrada calif-entrada" type="text" data-cat-nombre="' + i + '" value="' + esc(cat.nombre) + '"></td>' +
        '<td class="num"><input class="entrada calif-entrada calif-num" type="number" min="0" max="100" step="5" data-cat-peso="' + i + '" value="' + (Number(cat.peso) || 0) + '"></td>' +
        '<td class="num">' + fmtNota(p) + '</td>' +
        '<td class="num"><button class="calif-x" type="button" data-accion-calif="cat-quitar" data-i="' + i + '" title="Quitar categoría" aria-label="Quitar categoría">×</button></td></tr>';
    }).join("");
    var opcionesCat = q.categorias.map(function (cat) {
      return '<option value="' + esc(cat.nombre) + '">' + esc(cat.nombre) + "</option>";
    }).join("");
    var filasComp = q.componentes.map(function (comp, i) {
      var reemplaza = q.examen.reemplaza === i;
      var celdaNota = reemplaza
        ? '<span class="muted">' + (q.examen.nota === null ? "lo pone el examen" : fmtNota(q.examen.nota)) + "</span>"
        : '<input class="entrada calif-entrada calif-num" type="number" min="1" max="7" step="0.1" data-comp-nota="' + i + '" value="' + (comp.nota === null ? "" : comp.nota) + '">';
      return '<tr><td><input class="entrada calif-entrada" type="text" data-comp-nombre="' + i + '" value="' + esc(comp.nombre) + '"></td>' +
        '<td><select class="entrada calif-entrada" data-comp-cat="' + i + '">' + q.categorias.map(function (cat) {
          return '<option value="' + esc(cat.nombre) + '"' + (cat.nombre === comp.categoria ? " selected" : "") + ">" + esc(cat.nombre) + "</option>";
        }).join("") + "</select></td>" +
        '<td class="num">' + celdaNota + "</td>" +
        '<td><input class="entrada calif-entrada" type="date" data-comp-fecha="' + i + '" value="' + esc(comp.fecha) + '"></td>' +
        '<td class="num"><button class="calif-x" type="button" data-accion-calif="comp-quitar" data-i="' + i + '" title="Quitar componente" aria-label="Quitar componente">×</button></td></tr>';
    }).join("");
    var opcionesComp = q.componentes.map(function (comp, i) {
      return '<option value="' + i + '"' + (q.examen.reemplaza === i ? " selected" : "") + ">" + esc(comp.nombre) + "</option>";
    }).join("");
    var filasCond = q.eximicion.condiciones.map(function (cond, i) {
      var ref = "";
      if (cond.tipo === "presentacion") ref = '<span class="muted calif-ref">la presentación</span>';
      else if (cond.tipo === "categoria") {
        ref = '<select class="entrada calif-entrada" data-cond-ref="' + i + '">' + q.categorias.map(function (cat) {
          return '<option value="' + esc(cat.nombre) + '"' + (cat.nombre === cond.ref ? " selected" : "") + ">" + esc(cat.nombre) + "</option>";
        }).join("") + "</select>";
      } else {
        ref = '<select class="entrada calif-entrada" data-cond-ref="' + i + '">' + q.componentes.map(function (comp) {
          return '<option value="' + esc(comp.nombre) + '"' + (comp.nombre === cond.ref ? " selected" : "") + ">" + esc(comp.nombre) + "</option>";
        }).join("") + "</select>";
      }
      return '<div class="calif-cond">' +
        '<select class="entrada calif-entrada" data-cond-tipo="' + i + '">' +
          '<option value="presentacion"' + (cond.tipo === "presentacion" ? " selected" : "") + ">Presentación</option>" +
          '<option value="categoria"' + (cond.tipo === "categoria" ? " selected" : "") + ">Categoría</option>" +
          '<option value="componente"' + (cond.tipo === "componente" ? " selected" : "") + ">Componente</option></select>" +
        ref +
        '<select class="entrada calif-entrada calif-op" data-cond-op="' + i + '">' +
          ["<", "<=", ">=", ">"].map(function (op) { return '<option' + (cond.op === op ? " selected" : "") + ">" + op + "</option>"; }).join("") +
        "</select>" +
        '<input class="entrada calif-entrada calif-num" type="number" min="1" max="7" step="0.1" data-cond-valor="' + i + '" value="' + cond.valor + '">' +
        '<button class="calif-x" type="button" data-accion-calif="cond-quitar" data-i="' + i + '" title="Quitar condición" aria-label="Quitar condición">×</button></div>';
    }).join("");
    var textoExim = !q.eximicion.activa ? "La eximición está desactivada para este ramo." :
      !q.eximicion.condiciones.length ? "Sin condiciones: con ninguna, el ramo no se exime." :
      ex.sinDatos ? "Faltan notas para saber si te eximes." :
      ex.cumple ? "Con estas notas, ya te eximes." : "Con estas notas, todavía no te eximes.";
    var claseFinal = cur.cerrado ? (cur.aprobado ? "ok" : "bad") : "warn";
    var cierre = cur.cerrado
      ? '<div class="calif-cierre calif-cierre--' + (cur.aprobado ? "ok" : "bad") + '"><div><b>Curso cerrado · ' +
        (cur.aprobado ? "APROBADO" : "REPROBADO") + "</b><span>Final " +
        fmtNota(cur.notaCierre !== null ? cur.notaCierre : nf) + (cur.cerradoEn ? " · " + esc(cur.cerradoEn) : "") +
        '</span></div><button class="btn btn--chico" type="button" data-accion-calif="reabrir-curso">Reabrir curso</button></div>'
      : '<div class="calif-cierre"><div><b>Curso abierto</b><span>La final es provisional. Al cerrar, el resultado se fija con las notas, el examen y la eximición.</span></div><button class="btn btn-primario btn--chico" type="button" data-accion-calif="cerrar-curso">Cerrar curso</button></div>';
    return '<div class="card calif-card">' +
      '<div class="calif-cab"><div><h2>' + esc(cur.codigo) + " — " + esc(cur.nombre) + "</h2>" +
        '<p class="muted">' + creditosDe(cur) + " créditos · " + esc(etiquetaNivel(cur.nivel)) + " · meta " + fmtNota(q.meta) + "</p></div>" +
        '<span class="pill ' + est.clase + '">' + esc(est.texto) + "</span></div>" +
      '<div class="calif-resumen">' +
        '<div class="calif-caja calif-caja--ac"><b>' + fmtNota(P) + "</b><span>Presentación</span></div>" +
        '<div class="calif-caja calif-caja--' + claseFinal + '"><b>' + fmtNota(nf) + "</b><span>" + (cur.cerrado ? "Final" : "Final provisional") + "</span></div>" +
        '<div class="calif-caja calif-caja--est"><b>' + esc(est.texto) + "</b><span>Estado</span></div>" +
        '<div class="calif-caja calif-caja--warn"><b>' + (ex.cumple ? "eximido" : q.examen.activo ? textoNecesario(necMin) : "sin examen") + "</b><span>Examen para " + fmtNota(q.notaMin) + "</span></div>" +
      "</div>" + cierre +
      '<div class="calif-ajustes">' +
        '<label class="campo">Nota mínima <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-nota-min value="' + q.notaMin + '"></label>' +
        '<label class="campo">Meta <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-meta value="' + q.meta + '"></label>' +
        '<span class="muted">Examen para la meta: ' + (q.examen.activo ? textoNecesario(necMeta) : "sin examen") + "</span>" +
      "</div>" +
      '<section class="calif-bloque"><h3>Categorías <span>peso sobre la presentación</span></h3>' +
        '<div class="calif-tabla-wrap"><table class="calif-tabla"><thead><tr><th>Categoría</th><th class="num">Peso %</th><th class="num">Promedio</th><th></th></tr></thead><tbody>' +
        (filasCat || '<tr><td colspan="4" class="muted">Sin categorías.</td></tr>') + "</tbody></table></div>" +
        '<button class="btn btn--chico" type="button" data-accion-calif="cat-add">+ Categoría</button></section>' +
      '<section class="calif-bloque"><h3>Componentes y notas</h3>' +
        '<div class="calif-tabla-wrap"><table class="calif-tabla"><thead><tr><th>Componente</th><th>Categoría</th><th class="num">Nota</th><th>Fecha</th><th></th></tr></thead><tbody>' +
        (filasComp || '<tr><td colspan="5" class="muted">Sin componentes todavía.</td></tr>') + "</tbody></table></div>" +
        '<button class="btn btn--chico" type="button" data-accion-calif="comp-add">+ Componente</button></section>' +
      '<section class="calif-bloque"><h3>Examen</h3><div class="calif-examen">' +
        '<label class="check"><input type="checkbox" data-exam-activo' + (q.examen.activo ? " checked" : "") + "> Activo</label>" +
        '<label class="campo">Peso % <input class="entrada calif-num" type="number" min="0" max="100" step="5" data-exam-peso value="' + q.examen.peso + '"></label>' +
        '<label class="campo">Nota <input class="entrada calif-num" type="number" min="1" max="7" step="0.1" data-exam-nota value="' + (q.examen.nota === null ? "" : q.examen.nota) + '"></label>' +
        '<label class="campo">Reemplaza <select class="entrada calif-entrada" data-exam-reemplaza><option value="">—</option>' + opcionesComp + "</select></label>" +
      "</div></section>" +
      '<section class="calif-bloque"><h3>Eximición</h3>' +
        '<label class="check"><input type="checkbox" data-exim-activa' + (q.eximicion.activa ? " checked" : "") + "> El ramo se puede eximir</label>" +
        '<label class="campo">Deben cumplirse <select class="entrada" data-exim-modo>' +
          '<option value="todas"' + (q.eximicion.modo === "todas" ? " selected" : "") + ">Todas</option>" +
          '<option value="alguna"' + (q.eximicion.modo === "alguna" ? " selected" : "") + ">Al menos una</option></select></label>" +
        (filasCond || '<p class="muted">Sin condiciones: mientras no haya ninguna, el ramo no se exime.</p>') +
        '<button class="btn btn--chico" type="button" data-accion-calif="cond-add">+ Condición</button>' +
        '<p class="calif-exim-estado ' + (ex.cumple ? "ok" : "") + '">' + esc(textoExim) + "</p></section>" +
      "</div>";
  }
  function pintarCalificaciones() {
    var lista = $("#calif-lista"), det = $("#calif-detalle");
    if (!lista || !det) return;
    normalizarCursos(); normalizarCalifs();
    var cursos = estado.cursos, vacio = $("#calif-vacio"), layout = $("#calif-layout");
    if (!cursos.length) {
      if (vacio) vacio.hidden = false;
      if (layout) layout.hidden = true;
      return;
    }
    if (vacio) vacio.hidden = true;
    if (layout) layout.hidden = false;
    if (!califSel || !ramoPorCodigo(califSel)) califSel = estado.califSel && ramoPorCodigo(estado.califSel) ? estado.califSel : cursos[0].codigo;
    estado.califSel = califSel; estado.ramoSel = califSel;
    lista.innerHTML = cursos.slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; }).map(function (cur) {
      var q = califDe(cur.codigo), est = estadoCalifDe(q, cur);
      return '<button class="calif-item' + (cur.codigo === califSel ? " on" : "") + '" type="button" data-calif="' + esc(cur.codigo) + '">' +
        '<span class="calif-item__nom"><b>' + esc(cur.codigo) + "</b> " + esc(cur.nombre) + "</span>" +
        '<small>P ' + fmtNota(presentacionDe(q)) + " · Final " + fmtNota(notaFinalDe(q)) + "</small>" +
        '<em class="pill ' + est.clase + '">' + esc(est.texto) + "</em></button>";
    }).join("");
    det.innerHTML = htmlDetalleCalif(ramoPorCodigo(califSel), califDe(califSel));
  }
  function cambioCalif(e) {
    var el = e.target, q = califDe(califSel); if (!q || !el) return;
    var i = parseInt(el.getAttribute("data-i"), 10);
    if (el.hasAttribute("data-cat-nombre") || el.hasAttribute("data-cat-peso")) {
      var ic = parseInt(el.getAttribute("data-cat-nombre") || el.getAttribute("data-cat-peso"), 10);
      if (!q.categorias[ic]) return;
      if (el.hasAttribute("data-cat-nombre")) {
        var viejo = q.categorias[ic].nombre, nuevo = el.value.trim() || "Categoría";
        q.categorias[ic].nombre = nuevo;
        q.componentes.forEach(function (x) { if (x.categoria === viejo) x.categoria = nuevo; });
        q.eximicion.condiciones.forEach(function (c) { if (c.tipo === "categoria" && c.ref === viejo) c.ref = nuevo; });
      } else q.categorias[ic].peso = Math.max(0, Number(el.value) || 0);
    } else if (el.hasAttribute("data-comp-nombre") || el.hasAttribute("data-comp-cat") || el.hasAttribute("data-comp-nota") || el.hasAttribute("data-comp-fecha")) {
      var ix = parseInt(el.getAttribute("data-comp-nombre") || el.getAttribute("data-comp-cat") || el.getAttribute("data-comp-nota") || el.getAttribute("data-comp-fecha"), 10);
      if (!q.componentes[ix]) return;
      if (el.hasAttribute("data-comp-nombre")) q.componentes[ix].nombre = el.value.trim() || "Componente";
      else if (el.hasAttribute("data-comp-cat")) q.componentes[ix].categoria = el.value;
      else if (el.hasAttribute("data-comp-nota")) q.componentes[ix].nota = notaNum(el.value);
      else q.componentes[ix].fecha = el.value;
    } else if (el.hasAttribute("data-exam-activo")) q.examen.activo = el.checked;
    else if (el.hasAttribute("data-exam-peso")) q.examen.peso = Math.max(0, Math.min(100, Number(el.value) || 0));
    else if (el.hasAttribute("data-exam-nota")) q.examen.nota = notaNum(el.value);
    else if (el.hasAttribute("data-exam-reemplaza")) q.examen.reemplaza = el.value === "" ? null : parseInt(el.value, 10);
    else if (el.hasAttribute("data-exim-activa")) q.eximicion.activa = el.checked;
    else if (el.hasAttribute("data-exim-modo")) q.eximicion.modo = el.value;
    else if (el.hasAttribute("data-cond-tipo") || el.hasAttribute("data-cond-ref") || el.hasAttribute("data-cond-op") || el.hasAttribute("data-cond-valor")) {
      var icond = parseInt(el.getAttribute("data-cond-tipo") || el.getAttribute("data-cond-ref") || el.getAttribute("data-cond-op") || el.getAttribute("data-cond-valor"), 10);
      var cond = q.eximicion.condiciones[icond]; if (!cond) return;
      if (el.hasAttribute("data-cond-tipo")) { cond.tipo = el.value; cond.ref = ""; }
      else if (el.hasAttribute("data-cond-ref")) cond.ref = el.value;
      else if (el.hasAttribute("data-cond-op")) cond.op = el.value;
      else cond.valor = notaNum(el.value) || 1;
    } else if (el.hasAttribute("data-nota-min")) q.notaMin = notaNum(el.value) || 4;
    else if (el.hasAttribute("data-meta")) q.meta = notaNum(el.value) || 5;
    guardar(); pintarCalificaciones(); pintarPanel();
  }
  function accionCalif(e) {
    var b = e.target.closest("[data-accion-calif]"); if (!b) return;
    var q = califDe(califSel); if (!q) return;
    var accion = b.getAttribute("data-accion-calif"), i = parseInt(b.getAttribute("data-i"), 10);
    if (accion === "cerrar-curso") { cerrarCurso(califSel); return; }
    if (accion === "reabrir-curso") { reabrirCurso(califSel); return; }
    if (accion === "cat-add") q.categorias.push({ nombre: "Categoría " + (q.categorias.length + 1), peso: 0 });
    else if (accion === "comp-add") q.componentes.push({ nombre: "Componente " + (q.componentes.length + 1), categoria: q.categorias[0].nombre, nota: null, fecha: "", peso: 1 });
    else if (accion === "cond-add") q.eximicion.condiciones.push({ tipo: "presentacion", ref: "", op: ">=", valor: 5 });
    else if (accion === "cat-quitar") {
      if (q.categorias.length <= 1) { aviso("Debe quedar al menos una categoría."); return; }
      if (!window.confirm("¿Quitar la categoría \"" + q.categorias[i].nombre + "\"?")) return;
      var nombre = q.categorias[i].nombre;
      q.categorias.splice(i, 1);
      q.componentes.forEach(function (x) { if (x.categoria === nombre) x.categoria = q.categorias[0].nombre; });
    } else if (accion === "comp-quitar") {
      q.componentes.splice(i, 1);
      if (q.examen.reemplaza === i) q.examen.reemplaza = null;
      else if (q.examen.reemplaza > i) q.examen.reemplaza--;
    } else if (accion === "cond-quitar") q.eximicion.condiciones.splice(i, 1);
    guardar(); pintarCalificaciones(); pintarPanel();
  }

  /* ---- U4c: Estudio, horas por ramo y meta semanal ---- */
  var PALETA_ESTUDIO = ["#2563eb", "#16a34a", "#b45309", "#7c3aed", "#0e7490", "#be123c", "#0f766e", "#a16207", "#dc2626"];
  function normalizarEstudio() {
    if (!estado.estudio || typeof estado.estudio !== "object") estado.estudio = { metaSemanal: 10, metasRamo: {} };
    estado.estudio.metaSemanal = Math.max(0, Number(estado.estudio.metaSemanal) || 0);
    if (!estado.estudio.metasRamo || typeof estado.estudio.metasRamo !== "object") estado.estudio.metasRamo = {};
    estado.sesiones = (estado.sesiones || []).map(function (s, i) {
      return {
        fecha: String(s.fecha || hoyISO()), minutos: Math.max(0, Number(s.minutos) || 0),
        ramo: String(s.ramo || "").trim().toUpperCase(), vinculo: String(s.vinculo || "")
      };
    });
  }
  function colorEstudio(cod) {
    var i = estado.cursos.map(function (c) { return c.codigo; }).indexOf(cod);
    return i < 0 ? "var(--muted)" : PALETA_ESTUDIO[i % PALETA_ESTUDIO.length];
  }
  function fmtHoras(min) {
    min = Number(min) || 0;
    if (min <= 0) return "0 h";
    if (min < 60) return Math.round(min) + " min";
    return (Math.round(min / 6) / 10).toString().replace(".", ",") + " h";
  }
  function isoDeFecha(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function lunesDe(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  function semanasEstudio() {
    var p = periodoActivoObj();
    if (p && p.semanas && p.semanas.length) {
      return p.semanas.map(function (w) {
        return { etiqueta: "S" + w.n, desde: w.desde, hasta: w.hasta, tipo: w.tipo || "clases" };
      });
    }
    var l = lunesDe(new Date()), out = [];
    for (var i = 7; i >= 0; i--) {
      var a = new Date(l.getTime()); a.setDate(a.getDate() - i * 7);
      var b = new Date(a.getTime()); b.setDate(b.getDate() + 6);
      out.push({ etiqueta: (a.getDate()) + "/" + (a.getMonth() + 1), desde: isoDeFecha(a), hasta: isoDeFecha(b), tipo: "clases" });
    }
    return out;
  }
  function pintarEstudio() {
    if (!$("#est-grafico")) return;
    normalizarCursos(); normalizarEstudio();
    var cursos = estado.cursos;
    var semanas = semanasEstudio();
    var meta = Number(estado.estudio.metaSemanal) || 0;
    if ($("#est-meta")) $("#est-meta").value = meta;
    if ($("#est-fecha") && !$("#est-fecha").value) $("#est-fecha").value = hoyISO();
    var sel = $("#est-ramo");
    if (sel) {
      var val = sel.value;
      sel.innerHTML = '<option value="">Sin ramo</option>' + cursos.map(function (c) {
        return '<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + " — " + esc(c.nombre) + "</option>";
      }).join("");
      if (val && (val === "" || ramoPorCodigo(val))) sel.value = val;
    }
    var ses = estado.sesiones || [], totalMin = 0, totalRamo = {}, porSemana = {};
    ses.forEach(function (s) {
      totalMin += s.minutos;
      if (s.ramo) totalRamo[s.ramo] = (totalRamo[s.ramo] || 0) + s.minutos;
    });
    semanas.forEach(function (w) { porSemana[w.desde] = 0; });
    ses.forEach(function (s) {
      semanas.forEach(function (w) {
        if (s.fecha >= w.desde && s.fecha <= w.hasta) porSemana[w.desde] += s.minutos;
      });
    });
    var sobre = semanas.filter(function (w) { return porSemana[w.desde] > meta * 60 && meta > 0; }).length;
    var conDatos = semanas.filter(function (w) { return porSemana[w.desde] > 0; });
    var prom = conDatos.length ? conDatos.reduce(function (a, w) { return a + porSemana[w.desde]; }, 0) / conDatos.length : 0;
    if ($("#est-k-horas")) $("#est-k-horas").textContent = fmtHoras(totalMin);
    if ($("#est-k-sesiones")) $("#est-k-sesiones").textContent = String(ses.length);
    if ($("#est-k-semanas")) $("#est-k-semanas").textContent = String(sobre);
    if ($("#est-k-promedio")) $("#est-k-promedio").textContent = fmtHoras(prom);
    if ($("#est-periodo")) $("#est-periodo").textContent = periodoActivoObj()
      ? "Periodo " + periodoActivoObj().nombre + " · " + semanas.length + " semanas"
      : "Últimas " + semanas.length + " semanas";
    if ($("#est-resumen")) $("#est-resumen").textContent = ses.length
      ? ses.length + " sesiones · " + fmtHoras(totalMin) + " registradas · meta " + fmtHoras(meta * 60) + " por semana."
      : "Sin sesiones todavía. Registra una o usa el cronómetro de Tiempo.";
    var max = Math.max(meta * 60, 1);
    semanas.forEach(function (w) { max = Math.max(max, porSemana[w.desde]); });
    max *= 1.15;
    var cols = semanas.map(function (w) {
      var total = porSemana[w.desde], pct = Math.min(100, total / max * 100);
      var segs = Object.keys(totalRamo).length ? "" : "";
      var porCurso = {};
      ses.forEach(function (s) {
        if (s.fecha >= w.desde && s.fecha <= w.hasta) {
          var k = s.ramo || "_";
          porCurso[k] = (porCurso[k] || 0) + s.minutos;
        }
      });
      var barras = Object.keys(porCurso).map(function (k) {
        return '<i style="flex:' + porCurso[k] + ';background:' + colorEstudio(k) + '" title="' +
          esc(k === "_" ? "Sin ramo" : k) + ": " + fmtHoras(porCurso[k]) + '"></i>';
      }).join("");
      return '<div class="est-col" title="' + esc(w.etiqueta) + " · " + fmtHoras(total) + '">' +
        '<span class="est-total">' + (total ? fmtHoras(total) : "") + "</span>" +
        '<div class="est-pila" style="height:' + pct + '%">' + barras + "</div>" +
        '<span class="est-etq">' + esc(w.etiqueta) + "</span></div>";
    }).join("");
    $("#est-grafico").innerHTML = ses.length || meta
      ? '<div class="est-plot"><div class="est-meta-line" style="bottom:' + Math.min(98, meta * 60 / max * 100) + '%"><span>meta ' +
        fmtHoras(meta * 60) + '</span></div><div class="est-cols">' + cols + "</div></div>"
      : '<p class="empty">Sin horas todavía. Registra una sesión para ver el gráfico.</p>';
    var leyenda = cursos.filter(function (c) { return totalRamo[c.codigo]; }).map(function (c) {
      return '<span><i style="background:' + colorEstudio(c.codigo) + '"></i>' + esc(c.codigo) + " " + fmtHoras(totalRamo[c.codigo]) + "</span>";
    });
    if (totalRamo._) leyenda.push('<span><i style="background:var(--muted)"></i>Sin ramo ' + fmtHoras(totalRamo._) + "</span>");
    $("#est-leyenda").innerHTML = leyenda.join("");
    var filas = cursos.map(function (c) {
      var h = totalRamo[c.codigo] || 0, m = Number(estado.estudio.metasRamo[c.codigo]) || 0;
      var pct = m ? Math.min(100, Math.round(h / (m * 60 * Math.max(1, semanas.length)) * 100)) : 0;
      return '<tr><td><i class="est-punto" style="background:' + colorEstudio(c.codigo) + '"></i>' + esc(c.codigo) + " — " + esc(c.nombre) + "</td>" +
        '<td class="num">' + fmtHoras(h) + "</td>" +
        '<td class="num"><input class="entrada est-num" type="number" min="0" max="40" step="0.5" data-est-meta-ramo="' + esc(c.codigo) + '" value="' + m + '"> h</td>' +
        '<td><div class="est-barra"><i style="width:' + pct + '%"></i></div><small>' + (m ? pct + " % de " + (m * semanas.length) + " h" : "sin meta") + "</small></td></tr>";
    }).join("");
    if (totalRamo._) filas += '<tr><td><i class="est-punto" style="background:var(--muted)"></i>Sin ramo</td><td class="num">' +
      fmtHoras(totalRamo._) + '</td><td class="num">—</td><td class="muted">Asigna un ramo para medirlo</td></tr>';
    $("#est-tabla").innerHTML = filas || '<tr><td colspan="4" class="muted">Sin ramos. Crea uno en Malla.</td></tr>';
    var recientes = ses.map(function (s, i) { return { s: s, i: i }; }).sort(function (a, b) { return a.s.fecha < b.s.fecha ? 1 : -1; }).slice(0, 12);
    $("#est-sesiones").innerHTML = recientes.length ? recientes.map(function (x) {
      var c = x.s.ramo ? ramoPorCodigo(x.s.ramo) : null;
      return '<div class="est-sesion"><span><b>' + esc(c ? c.codigo : "Sin ramo") + "</b> " + esc(c ? c.nombre : "") +
        "</span><small>" + esc(x.s.fecha) + " · " + fmtHoras(x.s.minutos) + '</small>' +
        '<button class="calif-x" type="button" data-borrar-estudio="' + x.i + '" title="Borrar sesión" aria-label="Borrar sesión">×</button></div>';
    }).join("") : '<p class="muted">Sin sesiones todavía.</p>';
    if (pantalla === "estudio") pintarPanel();
  }
  function normalizarNotas() {
    estado.notas = (estado.notas || []).map(function (n, i) {
      return {
        id: n.id || "n" + i,
        titulo: n.titulo || "Sin título",
        cuerpo: n.cuerpo || "",
        contexto: n.contexto || "",
        etiquetas: Array.isArray(n.etiquetas) ? n.etiquetas : (n.tags || []),
        enlaces: Array.isArray(n.enlaces) ? n.enlaces : [],
        fijada: !!n.fijada,
        actualizado: n.actualizado || ""
      };
    });
  }
  function notaActual() {
    return estado.notas.filter(function (n) { return n.id === estado.notaSel; })[0] || null;
  }
  function marcaInline(txt) {
    var s = esc(txt);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function renderMarkdown(txt) {
    var lineas = String(txt || "").split("\n"), out = [], lista = false;
    function cerrar() { if (lista) { out.push("</ul>"); lista = false; } }
    lineas.forEach(function (l) {
      var t = l.trim();
      if (!t) { cerrar(); return; }
      if (/^###\s+/.test(t)) { cerrar(); out.push("<h3>" + marcaInline(t.slice(4)) + "</h3>"); return; }
      if (/^##\s+/.test(t)) { cerrar(); out.push("<h2>" + marcaInline(t.slice(3)) + "</h2>"); return; }
      if (/^#\s+/.test(t)) { cerrar(); out.push("<h1>" + marcaInline(t.slice(2)) + "</h1>"); return; }
      if (/^[-*]\s+\[[ xX]\]\s+/.test(t)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        var m = t.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        out.push('<li class="check-item"><input type="checkbox" disabled ' + (m[1].toLowerCase() === "x" ? "checked" : "") + "> " + marcaInline(m[2]) + "</li>");
        return;
      }
      if (/^[-*]\s+/.test(t)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        out.push("<li>" + marcaInline(t.slice(2)) + "</li>");
        return;
      }
      cerrar();
      out.push("<p>" + marcaInline(t) + "</p>");
    });
    cerrar();
    return out.join("");
  }
  function pintarNotasLista(destino, conClick) {
    var cont = $(destino);
    if (!cont) return;
    var q = notaBusqueda.toLowerCase();
    var vis = estado.notas.filter(function (n) {
      return !q || (n.titulo + " " + n.cuerpo + " " + n.contexto + " " + n.etiquetas.join(" ")).toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0); });
    cont.innerHTML = vis.map(function (n) {
      return '<button class="nota-item' + (n.id === estado.notaSel ? " on" : "") + '" type="button" data-nota="' + n.id + '" title="Clic derecho: acciones"><b>' +
        (n.fijada ? "★ " : "") + esc(n.titulo || "Sin título") + "</b><small>" +
        esc((n.cuerpo || "").slice(0, 70) || "Vacía") + (n.contexto ? " · " + esc(n.contexto) : "") + "</small></button>";
    }).join("");
    if (conClick) {
      $$(destino + " [data-nota]").forEach(function (b) {
        b.addEventListener("click", function () {
          estado.notaSel = b.getAttribute("data-nota"); guardar(); pintarNotas(); pintarPanel();
        });
      });
    }
  }
  function notaVinculoActual(n) {
    return n && n.enlaces && n.enlaces[0] ? n.enlaces[0].tipo + ":" + n.enlaces[0].id : "";
  }
  function pintarNotas() {
    normalizarNotas();
    pintarNotasLista("#notas-items", true);
    pintarNotasLista("#notas-lista-b", true);
    $("#notas-vacio").hidden = estado.notas.length > 0;
    var n = notaActual();
    $("#nota-titulo").disabled = !n;
    $("#nota-cuerpo").disabled = !n;
    $("#nota-contexto").disabled = !n;
    $("#nota-etiquetas").disabled = !n;
    $("#nota-vinculo").disabled = !n;
    $("#nota-modo").disabled = !n;
    $("#nota-fijar").disabled = !n;
    $("#btn-borrar-nota").disabled = !n;
    $("#nota-titulo").value = n ? n.titulo : "";
    $("#nota-cuerpo").value = n ? n.cuerpo : "";
    $("#nota-contexto").value = n ? n.contexto : "";
    $("#nota-etiquetas").value = n ? n.etiquetas.join(", ") : "";
    $("#nota-fijar").textContent = n && n.fijada ? "Fijada" : "Fijar";
    $("#nota-fijar").setAttribute("aria-pressed", n && n.fijada ? "true" : "false");
    var sel = $("#nota-vinculo");
    var ops = ['<option value="">Enlazar a…</option>'];
    estado.tareas.forEach(function (t) { ops.push('<option value="tarea:' + t.id + '">Tarea · ' + esc(t.titulo) + "</option>"); });
    estado.eventos.forEach(function (e) { ops.push('<option value="evento:' + e.id + '">Evento · ' + esc(e.titulo) + "</option>"); });
    sel.innerHTML = ops.join("");
    sel.value = n ? notaVinculoActual(n) : "";
    $("#nota-modo").textContent = notaModo === "preview" ? "Editar" : "Vista previa";
    $("#nota-cuerpo").hidden = notaModo === "preview";
    $("#nota-preview").hidden = notaModo !== "preview";
    $("#nota-preview").innerHTML = notaModo === "preview" && n ? renderMarkdown(n.cuerpo) : "";
    $("#nota-meta").textContent = n ? "Guardada en este equipo · " + n.actualizado : "Sin nota abierta.";
  }

  function nombreModo(id) {
    var h = HIJOS.filter(function (x) { return x[0] === id; })[0];
    return h ? h[1] : id;
  }
  function duracionPomo() {
    var p = estado.pomo || {};
    var v = p[estado.pomo.fase] !== undefined ? p[estado.pomo.fase] : p.trabajo;
    return Math.max(0.1, Number(v) || 25);
  }
  function pintaReloj() {
    var modo = estado.tiempoModo || "crono";
    if (modo === "alarmas") {
      var d = new Date();
      $("#reloj").textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (x) { return String(x).padStart(2, "0"); }).join(":");
      return;
    }
    var seg = modo === "crono" ? tiempoSeg : modo === "temporizador" ? tempSeg : pomoSeg;
    var h = Math.floor(seg / 3600), m = Math.floor((seg % 3600) / 60), s = seg % 60;
    $("#reloj").textContent = [h, m, s].map(function (x) { return String(x).padStart(2, "0"); }).join(":");
  }
  function pintarEstadoTiempo() {
    var modo = estado.tiempoModo || "crono", txt;
    if (modo === "alarmas") {
      var act = (estado.alarmas || []).filter(function (a) { return a.activa; }).length;
      txt = "Alarmas · " + act + " activa" + (act === 1 ? "" : "s");
    } else if (modo === "pomodoro") {
      var fase = estado.pomo.fase === "trabajo" ? "trabajo" : estado.pomo.fase === "corto" ? "pausa corta" : "pausa larga";
      txt = "Pomodoro · " + fase + (tiempoInt ? " · corriendo" : " · parado");
    } else {
      txt = nombreModo(modo) + (tiempoInt ? " · corriendo" : modo === "temporizador" && tempSeg ? " · listo" : " · parado");
    }
    if (estado.tiempoRamo && modo !== "alarmas") txt += " · " + estado.tiempoRamo;
    if (estado.tiempoVinculo && modo !== "alarmas") txt += " · tarea";
    $("#tiempo-estado").textContent = txt;
  }
  function pintarTiempo() {
    var c = $("#estanteria-tiempo");
    if (!c) return;
    if (estado.tiempoHijos.indexOf(estado.tiempoModo) === -1) estado.tiempoModo = estado.tiempoHijos[0] || "crono";
    var html = estado.tiempoHijos.map(function (id) {
      return '<button class="estante' + (id === estado.tiempoModo ? " on" : "") + '" type="button" data-hijo="' + id + '"><span>' +
        esc(nombreModo(id)) + '</span><span class="quitar" data-quitar-hijo="' + id + '" role="button" tabindex="0" title="Quitar de Tiempo">×</span></button>';
    }).join("");
    html += '<button class="estante estante-add" type="button" id="btn-add-hijo">+</button>';
    html += '<button class="btn" type="button" id="btn-editar-tiempo">Editar</button>';
    c.innerHTML = html;
    $$("#estanteria-tiempo [data-hijo]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        if (ev.target.getAttribute("data-quitar-hijo")) return;
        cambiarModoTiempo(b.getAttribute("data-hijo"));
      });
    });
    $$("#estanteria-tiempo [data-quitar-hijo]").forEach(function (x) {
      x.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var id = x.getAttribute("data-quitar-hijo");
        estado.tiempoHijos = estado.tiempoHijos.filter(function (h) { return h !== id; });
        if (estado.tiempoModo === id) cambiarModoTiempo(estado.tiempoHijos[0] || "crono");
        else { guardar(); pintarTiempo(); }
        aviso("Bloque quitado de Tiempo. El padre y sus datos siguen.");
      });
    });
    $("#btn-editar-tiempo").addEventListener("click", function () {
      document.body.classList.toggle("edit-tiempo");
      aviso(document.body.classList.contains("edit-tiempo") ? "Editar Tiempo: quita un bloque con ×." : "Edición cerrada.");
    });
    $("#btn-add-hijo").addEventListener("click", function () {
      var falta = HIJOS.filter(function (h) { return estado.tiempoHijos.indexOf(h[0]) === -1; })[0];
      if (!falta) { aviso("Los 4 bloques de Tiempo ya están dentro."); return; }
      estado.tiempoHijos.push(falta[0]); guardar(); pintarTiempo(); aviso(falta[1] + " añadido a Tiempo.");
    });
    var cfg = $("#tiempo-config");
    if (cfg) cfg.innerHTML = "";
    if (estado.tiempoModo === "temporizador" && !tiempoInt && tempSeg === 0) tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60);
    if (estado.tiempoModo === "pomodoro" && !tiempoInt && pomoSeg === 0) pomoSeg = Math.round(duracionPomo() * 60);
    if (cfg && estado.tiempoModo === "temporizador") {
      cfg.innerHTML = '<div class="tiempo-config-fila"><label class="campo">Minutos <input class="entrada tiempo-num" id="temp-min" type="number" min="0.1" max="180" step="0.1" value="' +
        (Number(estado.tempMin) || 25) + '"></label><span class="muted">Cuenta atrás; al llegar a cero registra la sesión.</span></div>';
      $("#temp-min").addEventListener("change", function (e) {
        estado.tempMin = Math.max(0.1, Number(e.target.value) || 25);
        if (!tiempoInt) { tempSeg = Math.round(estado.tempMin * 60); tempInicial = tempSeg; pintaReloj(); }
        guardar(); pintarEstadoTiempo();
      });
    } else if (cfg && estado.tiempoModo === "pomodoro") {
      cfg.innerHTML = '<div class="tiempo-config-fila"><label class="campo">Trabajo <input class="entrada tiempo-num" id="pomo-trabajo" type="number" min="0.1" max="180" step="0.1" value="' + estado.pomo.trabajo + '"></label>' +
        '<label class="campo">Corto <input class="entrada tiempo-num" id="pomo-corto" type="number" min="0.1" max="60" step="0.1" value="' + estado.pomo.corto + '"></label>' +
        '<label class="campo">Largo <input class="entrada tiempo-num" id="pomo-largo" type="number" min="0.1" max="120" step="0.1" value="' + estado.pomo.largo + '"></label>' +
        '<label class="campo">Cada <input class="entrada tiempo-num" id="pomo-cada" type="number" min="1" max="12" step="1" value="' + estado.pomo.cada + '"></label></div>' +
        '<p class="muted">Fase actual: <b>' + esc(estado.pomo.fase) + "</b> · " + (estado.pomo.trabajos || 0) + " trabajo(s) completados. Al terminar una fase se detiene para que decidas seguir.</p>";
      ["trabajo", "corto", "largo"].forEach(function (k) {
        $("#pomo-" + k).addEventListener("change", function (e) {
          estado.pomo[k] = Math.max(0.1, Number(e.target.value) || 1);
          if (!tiempoInt) { pomoSeg = Math.round(duracionPomo() * 60); pintaReloj(); }
          guardar(); pintarTiempo();
        });
      });
      $("#pomo-cada").addEventListener("change", function (e) { estado.pomo.cada = Math.max(1, Number(e.target.value) || 4); guardar(); });
    } else if (cfg && estado.tiempoModo === "alarmas") {
      cfg.innerHTML = '<form class="alarma-form" id="alarma-form"><input class="entrada" id="alarma-hora" type="time" aria-label="Hora de la alarma">' +
        '<input class="entrada" id="alarma-texto" type="text" placeholder="Para qué es" aria-label="Texto de la alarma">' +
        '<button class="btn btn--chico btn-primario" type="submit">+ Alarma</button></form>' +
        '<div class="alarma-lista" id="alarma-lista"></div>';
      $("#alarma-form").addEventListener("submit", function (e) {
        e.preventDefault();
        var hora = $("#alarma-hora").value;
        if (!hora) { aviso("Elige una hora para la alarma."); return; }
        estado.alarmas.push({ id: "a" + Date.now(), hora: hora, texto: $("#alarma-texto").value.trim() || "Alarma", activa: true, ultima: "" });
        guardar(); pintarTiempo(); aviso("Alarma a las " + hora + ".");
      });
      $("#alarma-lista").innerHTML = (estado.alarmas || []).length ? estado.alarmas.map(function (a) {
        return '<div class="alarma-item' + (a.activa ? "" : " off") + '"><b>' + esc(a.hora) + "</b><span>" + esc(a.texto) + "</span>" +
          '<button class="btn btn--chico" type="button" data-alarma-toggle="' + esc(a.id) + '">' + (a.activa ? "Activa" : "Apagada") + "</button>" +
          '<button class="calif-x" type="button" data-alarma-borrar="' + esc(a.id) + '" title="Quitar alarma" aria-label="Quitar alarma">×</button></div>';
      }).join("") : '<p class="muted">Sin alarmas.</p>';
      $$("#alarma-lista [data-alarma-toggle]").forEach(function (b) {
        b.addEventListener("click", function () {
          var a = estado.alarmas.filter(function (x) { return x.id === b.getAttribute("data-alarma-toggle"); })[0];
          if (!a) return; a.activa = !a.activa; if (a.activa) a.ultima = ""; guardar(); pintarTiempo();
        });
      });
      $$("#alarma-lista [data-alarma-borrar]").forEach(function (b) {
        b.addEventListener("click", function () {
          estado.alarmas = estado.alarmas.filter(function (x) { return x.id !== b.getAttribute("data-alarma-borrar"); });
          guardar(); pintarTiempo(); aviso("Alarma quitada.");
        });
      });
    } else if (cfg && estado.tiempoModo === "crono") {
      cfg.innerHTML = '<p class="muted">Cuenta hacia arriba. Al parar, la sesión se guarda con el ramo y la tarea elegidos.</p>';
    }
    var v = $("#tiempo-vinculo");
    if (v) {
      var ops = ['<option value="">Sin vínculo</option>'];
      estado.tareas.forEach(function (t) { ops.push('<option value="' + t.id + '">' + esc(t.titulo) + "</option>"); });
      v.innerHTML = ops.join(""); v.value = estado.tiempoVinculo || "";
      v.onchange = function () { estado.tiempoVinculo = v.value; guardar(); };
    }
    var r = $("#tiempo-ramo");
    if (r) {
      var opsR = ['<option value="">Sin ramo</option>'];
      (estado.cursos || []).forEach(function (c) { opsR.push('<option value="' + esc(c.codigo) + '">' + esc(c.codigo) + " — " + esc(c.nombre) + "</option>"); });
      r.innerHTML = opsR.join(""); r.value = estado.tiempoRamo || "";
      r.onchange = function () { estado.tiempoRamo = r.value; guardar(); };
    }
    var ses = estado.sesiones || [], min = 0;
    ses.forEach(function (x) { min += Number(x.minutos || 0); });
    if ($("#tiempo-sesiones")) $("#tiempo-sesiones").textContent = String(ses.length);
    if ($("#tiempo-horas")) $("#tiempo-horas").textContent = fmtHoras(min);
    var listaSes = $("#tiempo-lista-sesiones");
    if (listaSes) {
      listaSes.innerHTML = ses.length ? ses.map(function (x, i) {
        var vin = x.vinculo ? tareaPorId(x.vinculo) : null;
        var ram = x.ramo ? ramoPorCodigo(x.ramo) : null;
        return '<div class="sesion-item" data-sesion="' + i + '" title="Clic derecho: borrar"><span><b>' +
          esc(fechaCorta(x.fecha)) + "</b>" + (ram ? " · " + esc(ram.codigo) : "") + (vin ? " · " + esc(vin.titulo) : "") + "</span><small>" +
          Number(x.minutos || 0) + " min</small>" +
          '<button class="sesion-x" type="button" data-borrar-sesion="' + i + '" title="Borrar sesión" aria-label="Borrar sesión">×</button></div>';
      }).join("") : '<p class="muted">Sin sesiones todavía.</p>';
      $$("#tiempo-lista-sesiones [data-borrar-sesion]").forEach(function (b) {
        b.addEventListener("click", function () { borrarSesion(parseInt(b.getAttribute("data-borrar-sesion"), 10)); });
      });
    }
    var fila = document.querySelector(".tiempo-caja .fila");
    if (fila) fila.hidden = estado.tiempoModo === "alarmas";
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas" || !!tiempoInt;
    $("#btn-pausar").disabled = !tiempoInt;
    $("#btn-parar").disabled = !tiempoInt;
    pintaReloj(); pintarEstadoTiempo();
  }
  function registrarSesion(minutos, tipo) {
    minutos = Math.max(1, Math.round(Number(minutos) || 0));
    if (!minutos) return;
    estado.sesiones = estado.sesiones || [];
    estado.sesiones.push({ fecha: hoyISO(), minutos: minutos, vinculo: estado.tiempoVinculo || "",
      ramo: estado.tiempoRamo || "", tipo: tipo || "crono" });
    guardar(); pintarTiempo(); pintarEstudio();
  }
  function pitido() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 880; o.type = "sine"; g.gain.value = 0.08;
      o.connect(g); g.connect(ac.destination); o.start();
      setTimeout(function () { o.stop(); ac.close(); }, 700);
    } catch (e) {}
  }
  function tickTiempo() {
    var modo = estado.tiempoModo || "crono";
    if (modo === "crono") tiempoSeg++;
    else if (modo === "temporizador") {
      tempSeg--;
      if (tempSeg <= 0) {
        tempSeg = 0; clearInterval(tiempoInt); tiempoInt = null;
        registrarSesion(tempInicial / 60, "temporizador");
        aviso("Temporizador terminado. Sesión registrada."); pitido(); pintarTiempo(); return;
      }
    } else if (modo === "pomodoro") {
      pomoSeg--;
      if (pomoSeg <= 0) {
        pomoSeg = 0; clearInterval(tiempoInt); tiempoInt = null;
        if (estado.pomo.fase === "trabajo") {
          registrarSesion(pomoInicial / 60, "pomodoro");
          estado.pomo.trabajos = (estado.pomo.trabajos || 0) + 1;
          estado.pomo.fase = estado.pomo.trabajos % (estado.pomo.cada || 4) === 0 ? "largo" : "corto";
          aviso("Pomodoro completado. Descansa: " + estado.pomo.fase + ".");
        } else {
          estado.pomo.fase = "trabajo";
          aviso("Pausa terminada. Vuelve al trabajo.");
        }
        guardar(); pitido(); pintarTiempo(); return;
      }
    }
    pintaReloj(); pintarEstadoTiempo();
  }
  function empezarTiempo() {
    if (tiempoInt || estado.tiempoModo === "alarmas") return;
    if (estado.tiempoModo === "temporizador" && tempSeg <= 0) tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60);
    if (estado.tiempoModo === "temporizador") tempInicial = tempSeg;
    if (estado.tiempoModo === "pomodoro" && pomoSeg <= 0) pomoSeg = Math.round(duracionPomo() * 60);
    if (estado.tiempoModo === "pomodoro") pomoInicial = pomoSeg;
    tiempoInt = setInterval(tickTiempo, 1000);
    $("#btn-empezar").disabled = true; $("#btn-pausar").disabled = false; $("#btn-parar").disabled = false;
    pintarEstadoTiempo();
  }
  function pausarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    $("#btn-empezar").disabled = false; $("#btn-pausar").disabled = true;
    pintarEstadoTiempo();
  }
  function pararTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    if (estado.tiempoModo === "crono" && tiempoSeg > 0) registrarSesion(tiempoSeg / 60, "crono");
    else if (estado.tiempoModo === "temporizador" && tempInicial > tempSeg) registrarSesion((tempInicial - tempSeg) / 60, "temporizador");
    else if (estado.tiempoModo === "pomodoro" && estado.pomo.fase === "trabajo" && pomoInicial > pomoSeg) registrarSesion((pomoInicial - pomoSeg) / 60, "pomodoro");
    tiempoSeg = 0; tempSeg = 0; pomoSeg = 0; tempInicial = 0; pomoInicial = 0;
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas"; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    pintaReloj(); pintarEstadoTiempo();
  }
  function reiniciarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    tiempoSeg = 0; tempSeg = 0; pomoSeg = 0; tempInicial = 0; pomoInicial = 0;
    $("#btn-empezar").disabled = estado.tiempoModo === "alarmas"; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    pintarTiempo();
  }
  function cambiarModoTiempo(id) {
    if (estado.tiempoHijos.indexOf(id) === -1) return;
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    estado.tiempoModo = id;
    if (id === "temporizador") { tempSeg = Math.round(Math.max(0.1, Number(estado.tempMin) || 25) * 60); tempInicial = tempSeg; }
    if (id === "pomodoro") { pomoSeg = Math.round(duracionPomo() * 60); pomoInicial = pomoSeg; }
    guardar(); pintarTiempo();
  }
  function comprobarAlarmas() {
    var d = new Date(), hh = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    var hoy = hoyISO();
    (estado.alarmas || []).forEach(function (a) {
      if (!a.activa || a.hora !== hh || a.ultima === hoy) return;
      a.ultima = hoy; guardar(); aviso("Alarma: " + a.texto); pitido();
    });
  }
  function tarjetaPanel(id) {
    var b = BLOQUES[id] || { nombre: nombre(id), desc: "Sección base." };
    return '<div class="panel__bloque"><span>' + esc(b.nombre) + "</span><small>" +
      (BASE.indexOf(id) !== -1 ? "base" : "instalado") + "</small></div>";
  }
  function panelTab() { return estado.panel[pantalla] || "contexto"; }
  function pintarPanel() {
    var tab = panelTab();
    $$(".panel__tab").forEach(function (b) {
      var on = b.getAttribute("data-ptab") === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    var html = "";
    if (tab === "detalle") {
      var t = tareaPorId(estado.tareaSel);
      var n = notaActual();
      var ev = eventoPorId(estado.eventoSel);
      var ramo = ramoPorCodigo(estado.ramoSel);
      if (pantalla === "calificaciones" && ramo) {
        var qc = califDe(ramo.codigo), estC = estadoCalifDe(qc, ramo);
        html = "<h2>Calificaciones</h2><h3>" + esc(ramo.codigo) + " — " + esc(ramo.nombre) + "</h3>" +
          '<div class="panel__bloque"><span>Presentación</span><small>' + fmtNota(presentacionDe(qc)) + "</small></div>" +
          '<div class="panel__bloque"><span>Final</span><small>' + fmtNota(notaFinalDe(qc)) + "</small></div>" +
          '<div class="panel__bloque"><span>Estado</span><small>' + esc(estC.texto) + "</small></div>" +
          '<div class="panel__bloque"><span>Componentes</span><small>' + qc.componentes.length + " · " + qc.categorias.length + " categorías</small></div>" +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-abrir-calif="' + esc(ramo.codigo) + '">Abrir</button></div>';
      } else if (pantalla === "malla" && ramo) {
        var estR = estadoDeRamo(ramo), faltanR = faltantesDe(ramo), reqR = requisitosTexto(ramo);
        html = "<h2>Ramo</h2><h3>" + esc(ramo.codigo) + " — " + esc(ramo.nombre) + "</h3>" +
          '<div class="panel__bloque"><span>Estado</span><small>' + esc(estR) + "</small></div>" +
          '<div class="panel__bloque"><span>Créditos</span><small>' + creditosDe(ramo) + "</small></div>" +
          '<div class="panel__bloque"><span>Nivel</span><small>' + esc(etiquetaNivel(ramo.nivel)) + "</small></div>" +
          (reqR ? '<div class="panel__bloque"><span>Requiere</span><small>' + esc(reqR) + "</small></div>" : "") +
          (faltanR.length ? '<h2>Falta</h2><p class="panel__nota">' + esc(faltanR.join(", ")) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-ramo="' + esc(ramo.codigo) + '">Editar</button>' +
          '<button class="btn btn--chico" type="button" data-toggle-ramo="' + esc(ramo.codigo) + '">' + (ramo.cerrado ? "Reabrir" : "Cerrar curso") + "</button>" +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-ramo="' + esc(ramo.codigo) + '">Borrar</button></div>';
      } else if (pantalla === "calendario" && ev) {
        html = "<h2>Evento</h2><h3>" + esc(ev.titulo) + "</h3>" +
          '<div class="panel__bloque"><span>Fecha</span><small>' + esc(ev.fecha) + "</small></div>" +
          (ev.hora ? '<div class="panel__bloque"><span>Hora</span><small>' + esc(ev.hora) + "</small></div>" : "") +
          (ev.contexto ? '<div class="panel__bloque"><span>Contexto</span><small>' + esc(ev.contexto) + "</small></div>" : "") +
          (ev.nota ? '<p class="panel__nota">' + esc(ev.nota) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-evento="' + ev.id + '">Editar</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-evento="' + ev.id + '">Borrar</button></div>';
      } else if (pantalla === "tareas" && t) {
        var p = progreso(t), hijos = hijosDe(t.id), padre = t.padre_id ? tareaPorId(t.padre_id) : null;
        html = "<h2>" + (t.tipo === "proyecto" ? "Proyecto" : "Tarea") + "</h2><h3>" + esc(t.titulo) + "</h3>" +
          '<div class="panel__bloque"><span>Estado</span><small>' + (t.hecha ? "hecha" : "abierta") + "</small></div>" +
          '<div class="panel__bloque"><span>Fecha</span><small>' + esc(fechaCorta(t.fecha)) + "</small></div>" +
          '<div class="panel__bloque"><span>Prioridad</span><small>' + esc(t.prioridad) + "</small></div>" +
          (t.contexto ? '<div class="panel__bloque"><span>Contexto</span><small>' + esc(t.contexto) + "</small></div>" : "") +
          (padre ? '<div class="panel__bloque"><span>Dentro de</span><small>' + esc(padre.titulo) + "</small></div>" : "") +
          (t.tipo === "proyecto" ? '<h2>Progreso</h2><div class="tarea-progreso" style="width:100%"><i style="width:' + p.pct + '%"></i></div><p class="panel__nota">' + p.pct + " % · " + p.hechas + " de " + p.total + " tareas dentro</p>" +
            '<h2>Subtareas</h2>' + (hijos.length ? hijos.map(function (h) { return '<div class="panel__bloque"><span>' + esc(h.titulo) + "</span><small>" + (h.hecha ? "hecha" : "abierta") + "</small></div>"; }).join("") : '<p class="panel__nota">Sin subtareas.</p>') : "") +
          (t.nota ? '<h2>Nota</h2><p class="panel__nota">' + esc(t.nota) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-tarea="' + t.id + '">Editar</button>' +
          '<button class="btn btn--chico" type="button" data-toggle-tarea="' + t.id + '">' + (t.hecha ? "Reabrir" : "Hecha") + "</button>" +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-tarea="' + t.id + '">Borrar</button></div>';
      } else if (pantalla === "notas" && n) {
        html = "<h2>Detalle de la nota</h2><h3>" + (n.fijada ? "★ " : "") + esc(n.titulo || "Sin título") +
          '</h3><p class="panel__nota">' + esc((n.cuerpo || "").slice(0, 240) || "Vacía") + "</p>" +
          (n.contexto ? '<div class="panel__bloque"><span>Contexto</span><small>' + esc(n.contexto) + "</small></div>" : "") +
          (n.etiquetas.length ? '<div class="panel__bloque"><span>Etiquetas</span><small>' + esc(n.etiquetas.join(", ")) + "</small></div>" : "") +
          (n.enlaces.length ? '<div class="panel__bloque"><span>Enlazada a</span><small>' + esc(n.enlaces[0].titulo) + "</small></div>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-abrir-nota="' + n.id + '">Abrir</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-nota="' + n.id + '">Borrar</button></div>';
      } else {
        html = '<h2>Detalle</h2><p class="panel__nota">Selecciona una tarea, una nota o un ramo. El detalle vive aquí, no en un modal que tapa la lista.</p>';
      }
    } else if (tab === "notas") {
      var nn = notaActual();
      html = '<h2>Nota abierta</h2>' + (nn
        ? "<h3>" + esc(nn.titulo || "Sin título") + '</h3><p class="panel__nota">' + esc((nn.cuerpo || "").slice(0, 240) || "Vacía") + "</p>"
        : '<p class="panel__nota">Sin nota abierta. Crea una en Notas.</p>');
    } else if (tab === "bloques") {
      html = '<h2>Base fija</h2>' + ["calendario", "tareas", "notas", "ajustes"].map(tarjetaPanel).join("") +
        '<h2>Instalados</h2>' + (estado.instalados.length ? estado.instalados.map(tarjetaPanel).join("")
          : '<p class="panel__nota">Ninguno. La app funciona solo con la base.</p>') +
        '<button class="btn panel__anadir" type="button" data-abrir-modal>+ Añadir bloque o kit</button>';
    } else {
      var cuentas = {
        calendario: [estado.eventos.length + " eventos", estado.eventos.length ? "El próximo evento aparece en la agenda." : "Sin eventos este mes."],
        tareas: [estado.tareas.length + " tareas", estado.tareas.filter(function (x) { return !x.hecha; }).length + " abiertas"],
        notas: [estado.notas.length + " notas", "Lista y editor en la misma sección."],
        malla: [(estado.cursos || []).length + " ramos", "Cursos, niveles, prerrequisitos y créditos."],
        calificaciones: [(estado.cursos || []).length + " ramos", "Notas por categoría, examen y eximición."],
        estudio: [(estado.sesiones || []).length + " sesiones", "Horas por ramo y meta semanal."],
        tiempo: [estado.tiempoHijos.length + " bloques dentro", "Cronómetro, temporizador, pomodoro y alarmas."],
        ajustes: ["9 temas", "Apariencia, paneles, bloques y laboratorio."]
      }[pantalla] || ["Sin contexto", "Esta sección no declara contexto."];
      html = "<h2>" + esc(nombre(pantalla)) + '</h2><p class="panel__nota">' + esc(cuentas[1]) +
        '</p><div class="panel__bloque"><span>Ahora</span><small>' + esc(cuentas[0]) + "</small></div>";
    }
    $("#panel-cuerpo").innerHTML = html;
    $$("#panel-cuerpo [data-abrir-modal]").forEach(function (b) { b.addEventListener("click", abrirModal); });
    $$("#panel-cuerpo [data-editar-tarea]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFormulario(tareaPorId(b.getAttribute("data-editar-tarea"))); });
    });
    $$("#panel-cuerpo [data-toggle-tarea]").forEach(function (b) {
      b.addEventListener("click", function () {
        var x = tareaPorId(b.getAttribute("data-toggle-tarea")); if (!x) return;
        x.hecha = !x.hecha; x.estado = x.hecha ? "hecha" : "pendiente";
        guardar(); pintarTareas(); pintarPanel();
      });
    });
    $$("#panel-cuerpo [data-borrar-tarea]").forEach(function (b) {
      b.addEventListener("click", function () { borrarTarea(b.getAttribute("data-borrar-tarea")); });
    });
    $$("#panel-cuerpo [data-editar-evento]").forEach(function (b) {
      b.addEventListener("click", function () { abrirEvento(eventoPorId(b.getAttribute("data-editar-evento"))); });
    });
    $$("#panel-cuerpo [data-borrar-evento]").forEach(function (b) {
      b.addEventListener("click", function () { borrarEvento(b.getAttribute("data-borrar-evento")); });
    });
    $$("#panel-cuerpo [data-abrir-nota]").forEach(function (b) {
      b.addEventListener("click", function () { abrirNota(b.getAttribute("data-abrir-nota")); });
    });
    $$("#panel-cuerpo [data-borrar-nota]").forEach(function (b) {
      b.addEventListener("click", function () { borrarNota(b.getAttribute("data-borrar-nota")); });
    });
    $$("#panel-cuerpo [data-abrir-calif]").forEach(function (b) {
      b.addEventListener("click", function () {
        califSel = b.getAttribute("data-abrir-calif"); estado.califSel = califSel;
        ir("calificaciones"); pintarCalificaciones();
        if (window.innerWidth <= 1255) abrirPanel();
      });
    });
    $$("#panel-cuerpo [data-editar-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { abrirFormularioRamo(ramoPorCodigo(b.getAttribute("data-editar-ramo"))); });
    });
    $$("#panel-cuerpo [data-toggle-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { alternarRamo(b.getAttribute("data-toggle-ramo")); });
    });
    $$("#panel-cuerpo [data-borrar-ramo]").forEach(function (b) {
      b.addEventListener("click", function () { borrarRamo(b.getAttribute("data-borrar-ramo")); });
    });
    var pie = $("#pie-centro");
    if (pie) pie.textContent = nombre(pantalla);
  }

  function aplicarPrefs() {
    var p = estado.prefs || {};
    document.documentElement.style.setProperty("--ancho-panel", (p.panelAncho || "320") + "px");
    document.body.classList.toggle("nav-izq", p.navPos === "izquierda");
    var fi = $("#pref-inicio"), fh = $("#pref-hora"), fp = $("#pref-panel-ancho");
    if (fi) fi.value = p.inicioSemana || "lunes";
    if (fh) fh.value = p.hora || "24";
    if (fp) fp.value = p.panelAncho || "320";
    if ($("#pref-nav")) $("#pref-nav").value = p.navPos || "arriba";
    if ($("#pref-idioma")) $("#pref-idioma").value = p.idioma || "es";
    if ($("#pref-notif")) $("#pref-notif").checked = p.notificaciones !== false;
    if ($("#pref-panel-abierto")) $("#pref-panel-abierto").checked = p.panelAbierto !== false;
    var lab = $("#lab-split"); if (lab) lab.checked = splitOn;
  }
  function aplicarIdioma() {
    document.documentElement.lang = idioma();
    $$("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) el.textContent = v;
    });
    pintarTabs();
  }
  function pintarAjustes() {
    var p = estado.prefs || {};
    var b = $("#ajustes-bloques"); if (b) b.textContent = estado.instalados.length + " bloques instalados.";
    var r = $("#ajustes-resumen");
    if (r) r.textContent = estado.tareas.length + " tareas · " + estado.eventos.length + " eventos · " + estado.notas.length + " notas · " + (estado.cursos || []).length + " ramos · " + (estado.periodos || []).length + " periodos.";
    var d = $("#ajustes-datos");
    if (d) d.textContent = "Datos en este equipo: " + estado.tareas.length + " tareas, " + estado.eventos.length + " eventos, " + estado.notas.length + " notas, " + (estado.cursos || []).length + " ramos. Nada sale de aquí.";
    var pl = $("#ajustes-periodos");
    if ($("#ajustes-idioma")) $("#ajustes-idioma").textContent = "Idioma activo: " + (p.idioma === "en" ? "English" : "Español") + ". Navegación y secciones cambian en caliente.";
    if (pl) {
      pl.innerHTML = (estado.periodos || []).length ? estado.periodos.map(function (x) {
        return '<div class="periodo-item' + (x.id === estado.periodoActivo ? " on" : "") + '" data-periodo-item="' + x.id + '"><span><b>' + esc(x.nombre) + '</b><br><small class="muted">' + x.semanas.length + ' semanas</small></span>' +
          '<span class="fila"><button class="btn btn--chico" type="button" data-periodo-aj="' + x.id + '">Usar</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-periodo="' + x.id + '">Borrar</button></span></div>';
      }).join("") : '<p class="muted">Sin periodos. Crea el primero.</p>';
      $$("#ajustes-periodos [data-periodo-aj]").forEach(function (x) {
        x.addEventListener("click", function () { estado.periodoActivo = x.getAttribute("data-periodo-aj"); guardar(); pintarPeriodo(); pintarAjustes(); });
      });
      $$("#ajustes-periodos [data-borrar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { borrarPeriodo(x.getAttribute("data-borrar-periodo")); });
      });
    }
    aplicarPrefs();
  }
  function horaTexto(h) {
    if (!h) return "";
    if ((estado.prefs || {}).hora === "12") {
      var p = h.split(":"); var n = parseInt(p[0], 10); var suf = n >= 12 ? "pm" : "am"; n = n % 12 || 12;
      return n + ":" + p[1] + " " + suf;
    }
    return h;
  }
  function periodoActivoObj() {
    return (estado.periodos || []).filter(function (p) { return p.id === estado.periodoActivo; })[0] || null;
  }
  function pintarPeriodo() {
    var p = periodoActivoObj();
    var b = $("#btn-periodo");
    if (b) b.textContent = p ? p.nombre : "Sin periodo";
    pintarAjustes();
    var lista = $("#periodos-lista");
    if (lista) {
      lista.innerHTML = (estado.periodos || []).length ? estado.periodos.map(function (x) {
        return '<div class="periodo-item' + (x.id === estado.periodoActivo ? " on" : "") + '" data-periodo-item="' + x.id + '"><span><b>' + esc(x.nombre) + '</b><br><small class="muted">' + esc(x.inicio) + " · " + x.semanas.length + " semanas</small></span>" +
          '<span class="fila"><button class="btn btn--chico" type="button" data-periodo="' + x.id + '">Usar</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-periodo="' + x.id + '">Borrar</button></span></div>';
      }).join("") : '<p class="muted">Todavía no hay periodos.</p>';
      $$("#periodos-lista [data-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { estado.periodoActivo = x.getAttribute("data-periodo"); guardar(); pintarPeriodo(); aviso("Periodo activo."); });
      });
      $$("#periodos-lista [data-borrar-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { borrarPeriodo(x.getAttribute("data-borrar-periodo")); });
      });
    }
  }
  function abrirPeriodo() {
    $("#modal-periodo").classList.add("on");
    $("#periodo-inicio").value = hoyISO();
    pintarPeriodo();
    $("#periodo-nombre").focus();
  }
  function cerrarPeriodo() { $("#modal-periodo").classList.remove("on"); }

  function abrirModal() {
    $("#modal").classList.add("on");
    pintarCatalogo();
  }
  function cerrarModal() { $("#modal").classList.remove("on"); }
  function estaKit(id) {
    var b = BLOQUES[id];
    return b && b.tipo === "pack" && b.instala.every(instalado);
  }
  function pintarCatalogo() {
    var ids = Object.keys(BLOQUES);
    var base = ["calendario", "tareas", "notas", "ajustes"];
    var html = base.map(function (id) {
      return '<article class="bcard"><div class="bcard__nom">' + esc(nombre(id)) +
        ' <span class="pill">base</span></div><div class="bcard__desc">Sección fija. No se quita.</div>' +
        '<div class="bcard__pie"><span>base fija</span><span class="pill">fija</span></div></article>';
    }).join("");
    html += ids.filter(function (id) { return id !== "evaluaciones"; }).map(function (id) {
      var b = BLOQUES[id];
      var esta = b.tipo === "pack" ? estaKit(id) : instalado(id);
      var accion = b.tipo === "pack"
        ? '<button class="btn btn--chico ' + (esta ? "btn-peligro" : "btn-primario") + '" type="button" data-' +
          (esta ? "quitar" : "instalar") + '="' + id + '">' + (esta ? "Quitar kit" : "Instalar kit") + "</button>"
        : '<button class="btn btn--chico ' + (esta ? "btn-peligro" : "") + '" type="button" data-' +
          (esta ? "quitar" : "instalar") + '="' + id + '">' + (esta ? "Quitar" : "Instalar") + "</button>";
      return '<article class="bcard"><div class="bcard__nom">' + esc(b.nombre) +
        ' <span class="pill">v1.0</span></div><div class="bcard__desc">' + esc(b.desc) +
        '</div><div class="bcard__pie"><span>' + (b.tipo === "pack" ? "kit" : b.tipo) + "</span>" + accion + "</div></article>";
    }).join("");
    $("#catalogo").innerHTML = html;
    $("#modal-sub").textContent = estado.instalados.length + " bloques instalados · " + (ids.length + 4) + " en el catálogo";
    $$("#catalogo [data-instalar]").forEach(function (x) {
      x.addEventListener("click", function () { instalar(x.getAttribute("data-instalar")); });
    });
    $$("#catalogo [data-quitar]").forEach(function (x) {
      x.addEventListener("click", function () { quitar(x.getAttribute("data-quitar")); });
    });
  }
  function instalar(id) {
    var b = BLOQUES[id];
    if (!b) return;
    if (b.tipo === "pack") {
      var faltan = b.instala.filter(function (h) { return !instalado(h); });
      faltan.forEach(function (h) { estado.instalados.push(h); });
      estado.kits[id] = (estado.kits[id] || []).concat(faltan);
      aviso(faltan.length ? b.nombre + ": " + faltan.length + " bloque(s) añadido(s)." : b.nombre + " ya estaba completo.");
    } else if (!instalado(id)) {
      estado.instalados.push(id);
      aviso(b.nombre + " instalado. Aparece en la barra.");
    }
    guardar(); pintarTabs(); pintarCatalogo(); pintarPanel();
    if (b.tipo === "seccion") ir(id);
  }
  function quitar(id) {
    var b = BLOQUES[id];
    if (!b) return;
    var fuera = b.tipo === "pack" ? (estado.kits[id] || []) : [id];
    estado.instalados = estado.instalados.filter(function (x) { return fuera.indexOf(x) === -1; });
    if (b.tipo === "pack") delete estado.kits[id];
    guardar(); pintarTabs(); pintarCatalogo(); pintarPanel();
    if (fuera.indexOf(pantalla) !== -1) ir("calendario");
    aviso(b.nombre + " quitado. Tus datos se conservan.");
  }

  function abrirPanel() {
    document.body.classList.remove("panel-oculto");
    document.body.classList.add("panel-abierto");
    $("#btn-panel").setAttribute("aria-expanded", "true");
  }
  function cerrarPanel() {
    document.body.classList.remove("panel-abierto");
    if (window.innerWidth > 1255) document.body.classList.add("panel-oculto");
    $("#btn-panel").setAttribute("aria-expanded", "false");
  }
  function alternarPanel() {
    if (window.innerWidth > 1255) {
      if (document.body.classList.contains("panel-oculto")) abrirPanel(); else cerrarPanel();
      return;
    }
    if (document.body.classList.contains("panel-abierto")) cerrarPanel(); else abrirPanel();
  }
  function opcionesSplit() {
    var ids = ["calendario", "tareas", "notas", "tiempo", "ajustes"].concat(estado.instalados.filter(function (x) { return ["malla", "calificaciones", "estudio"].indexOf(x) !== -1; }));
    return ids.filter(function (x, i) { return ids.indexOf(x) === i; });
  }
  function pintarSplit() {
    var sel = $("#split-seccion"), cuerpo = $("#split-cuerpo");
    if (!sel || !cuerpo) return;
    sel.innerHTML = opcionesSplit().map(function (id) { return '<option value="' + id + '">' + esc(nombre(id)) + "</option>"; }).join("");
    if (opcionesSplit().indexOf(estado.splitSeccion) === -1) estado.splitSeccion = "tareas";
    sel.value = estado.splitSeccion;
    var sec = estado.splitSeccion, html = "";
    if (sec === "calendario") {
      var evs = (estado.eventos || []).slice().sort(function (a, b) { return (a.fecha + a.hora) < (b.fecha + b.hora) ? -1 : 1; });
      html = evs.length ? evs.slice(0, 8).map(function (e) { return '<div class="mp-row"><span>' + esc(e.titulo) + "</span><small>" + esc(e.fecha) + "</small></div>"; }).join("") : '<p class="muted">Sin eventos.</p>';
    } else if (sec === "tareas") {
      html = estado.tareas.length ? estado.tareas.slice(0, 10).map(function (t) { return '<div class="mp-row"><span>' + (t.tipo === "proyecto" ? "▸ " : "") + esc(t.titulo) + "</span><small>" + (t.hecha ? "hecha" : "abierta") + "</small></div>"; }).join("") : '<p class="muted">Sin tareas.</p>';
    } else if (sec === "notas") {
      html = estado.notas.length ? estado.notas.slice(0, 8).map(function (n) { return '<div class="mp-row"><span>' + esc(n.titulo) + "</span><small>" + esc((n.cuerpo || "").slice(0, 24)) + "</small></div>"; }).join("") : '<p class="muted">Sin notas.</p>';
    } else if (sec === "malla") {
      html = (estado.cursos || []).length ? estado.cursos.slice(0, 10).map(function (c) {
        return '<div class="mp-row"><span>' + esc(c.codigo) + " · " + esc(c.nombre) + "</span><small>" + estadoDeRamo(c) + "</small></div>";
      }).join("") : '<p class="muted">Sin ramos.</p>';
    } else if (sec === "calificaciones") {
      normalizarCalifs();
      html = (estado.cursos || []).length ? estado.cursos.slice(0, 10).map(function (c) {
        var q = califDe(c.codigo);
        return '<div class="mp-row"><span>' + esc(c.codigo) + " · " + esc(c.nombre) + "</span><small>P " +
          fmtNota(presentacionDe(q)) + " · Final " + fmtNota(notaFinalDe(q)) + "</small></div>";
      }).join("") : '<p class="muted">Sin ramos.</p>';
    } else if (sec === "estudio") {
      normalizarEstudio();
      var tot = {}, min = 0;
      (estado.sesiones || []).forEach(function (x) {
        min += x.minutos;
        var k = x.ramo || "_";
        tot[k] = (tot[k] || 0) + x.minutos;
      });
      html = (estado.sesiones || []).length ? '<p class="muted">' + fmtHoras(min) + ' en ' + estado.sesiones.length +
        ' sesiones.</p>' + Object.keys(tot).slice(0, 8).map(function (k) {
          var c = k !== "_" ? ramoPorCodigo(k) : null;
          return '<div class="mp-row"><span>' + esc(c ? c.codigo : "Sin ramo") + '</span><small>' + fmtHoras(tot[k]) + "</small></div>";
        }).join("") : '<p class="muted">Sin sesiones.</p>';
    } else if (sec === "tiempo") {
      html = '<p class="muted">Modos: ' + estado.tiempoHijos.length + ". Sesiones: " + (estado.sesiones || []).length + ".</p>";
    } else if (sec === "ajustes") {
      html = '<p class="muted">Ajustes está en la ventana principal.</p>';
    } else {
      html = '<p class="muted">' + esc(nombre(sec)) + " se abre en la ventana principal; aquí va su resumen cuando el motor esté.</p>";
    }
    cuerpo.innerHTML = html;
  }
  function alternarSplit() {
    if (window.innerWidth <= 1255) { aviso("La vista dividida necesita al menos 1256 px."); return; }
    splitOn = !splitOn;
    document.body.classList.toggle("split", splitOn);
    $("#contenido-b").hidden = !splitOn;
    $("#btn-split").setAttribute("aria-pressed", splitOn ? "true" : "false");
    if (splitOn) pintarSplit();
  }

  function init() {
    aplicarTema(estado.tema || "clasico");
    aplicarPrefs(); aplicarIdioma(); pintarTabs(); pintarCalendario(); pintarTemaIcono(); pintarPeriodo(); pintarSplit();
    $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-vista") === vistaTareas); });
    pintarTareas(); pintarNotas(); pintarMalla(); pintarCalificaciones(); pintarEstudio();
    pintarTemas(); pintarTiempo(); pintarPanel();
    ir(pantalla);

    $("#btn-tema").addEventListener("click", function () {
      aplicarTema(estado.tema === "clasico" ? "deepsea" : "clasico");
    });
    $("#btn-ajustes").addEventListener("click", function () { ir("ajustes"); });
    $("#btn-panel").addEventListener("click", alternarPanel);
    $("#btn-panel-cerrar").addEventListener("click", cerrarPanel);
    $("#velo").addEventListener("click", cerrarPanel);
    $("#btn-split").addEventListener("click", alternarSplit);
    $("#btn-cerrar-split").addEventListener("click", alternarSplit);
    $("#btn-add").addEventListener("click", abrirModal);
    $("#btn-catalogo-ajustes").addEventListener("click", abrirModal);
    $("#btn-periodo-ajustes").addEventListener("click", abrirPeriodo);
    $("#pref-inicio").addEventListener("change", function (e) { estado.prefs.inicioSemana = e.target.value; guardar(); aplicarPrefs(); pintarCalendario(); });
    $("#pref-hora").addEventListener("change", function (e) { estado.prefs.hora = e.target.value; guardar(); aplicarPrefs(); pintarCalendario(); });
    $("#pref-panel-ancho").addEventListener("change", function (e) { estado.prefs.panelAncho = e.target.value; guardar(); aplicarPrefs(); });
    $("#pref-nav").addEventListener("change", function (e) { estado.prefs.navPos = e.target.value; guardar(); aplicarPrefs(); });
    $("#pref-idioma").addEventListener("change", function (e) { estado.prefs.idioma = e.target.value; guardar(); aplicarIdioma(); pintarAjustes(); });
    $("#pref-notif").addEventListener("change", function (e) { estado.prefs.notificaciones = e.target.checked; guardar(); });
    $("#pref-panel-abierto").addEventListener("change", function (e) { estado.prefs.panelAbierto = e.target.checked; guardar(); if (e.target.checked) abrirPanel(); else cerrarPanel(); });
    $("#lab-split").addEventListener("change", function (e) {
      if (e.target.checked !== splitOn) alternarSplit();
      pintarAjustes();
    });
    $("#btn-exportar").addEventListener("click", function () {
      var blob = new Blob([JSON.stringify(estado, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mimo-backup.json"; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      aviso("Respaldo exportado.");
    });
    $("#btn-importar").addEventListener("click", function () { $("#archivo-importar").click(); });
    $("#archivo-importar").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      var lector = new FileReader();
      lector.onload = function () {
        try {
          var x = JSON.parse(lector.result);
          estado = Object.assign(porDefecto(), x);
          if (!estado.prefs) estado.prefs = { inicioSemana: "lunes", hora: "24", panelAncho: "320" };
          guardar(); aplicarTema(estado.tema || "clasico"); aplicarPrefs();
          pintarTabs(); pintarCalendario(); pintarTareas(); pintarNotas(); pintarMalla(); pintarCalificaciones(); pintarEstudio(); pintarTiempo(); pintarPeriodo(); pintarPanel();
          aviso("Respaldo importado.");
        } catch (err) { aviso("No se pudo importar el archivo."); }
      };
      lector.readAsText(f); e.target.value = "";
    });
    $("#btn-panel-ajustes").addEventListener("click", abrirPanel);
    $("#pie-panel").addEventListener("click", alternarPanel);
    $("#pie-sync").addEventListener("click", function () { aviso("Guardado en este equipo. El respaldo es un archivo .json."); });
    $("#pie-ayuda").addEventListener("click", function () { aviso("Clic derecho en una nota, tarea, evento, periodo o sesión para abrir sus acciones y borrar. También Shift+F10."); });
    $("#modal-x").addEventListener("click", cerrarModal);
    $("#modal").addEventListener("click", function (e) { if (e.target === $("#modal")) cerrarModal(); });

    $("#menu-ctx").addEventListener("click", function (e) {
      var b = e.target.closest("[data-accion]");
      if (!b) return;
      e.stopPropagation();
      var fn = menuAcciones[b.getAttribute("data-accion")];
      cerrarMenu();
      if (fn) fn();
    });
    $("#menu-ctx").addEventListener("contextmenu", function (e) { e.preventDefault(); });
    $("#menu-ctx").addEventListener("keydown", function (e) {
      var bs = $$("#menu-ctx button");
      if (!bs.length) return;
      var i = bs.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
      else if (e.key === "Home") { e.preventDefault(); bs[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); bs[bs.length - 1].focus(); }
    });
    document.addEventListener("contextmenu", function (e) {
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      var ctx = menuDeContexto(e.target);
      if (!ctx) return;
      e.preventDefault();
      abrirMenu(e.clientX, e.clientY, ctx.titulo, ctx.items);
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#menu-ctx")) cerrarMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key !== "ContextMenu" && !(e.shiftKey && e.key === "F10")) return;
      if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;
      var el = e.target.closest("[data-nota],[data-evento],[data-tarea],[data-periodo-item],[data-sesion],[data-cal-dia],[data-ctx-zona]");
      if (!el) return;
      e.preventDefault();
      menuPorTeclado(el);
    });
    window.addEventListener("scroll", cerrarMenu, true);
    window.addEventListener("resize", cerrarMenu);
    $$(".panel__tab").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.panel[pantalla] = b.getAttribute("data-ptab");
        guardar(); pintarPanel();
      });
    });
    $$("#vista-tareas button").forEach(function (b) {
      b.addEventListener("click", function () {
        vistaTareas = b.getAttribute("data-vista");
        estado.vistaTareas = vistaTareas;
        $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x === b); });
        guardar(); pintarTareas();
      });
    });
    $("#btn-nueva-tarea").addEventListener("click", function () { abrirFormulario(null); });
    $("#tareas-crear").addEventListener("click", function () { abrirFormulario(null); });
    $("#tarea-cancelar").addEventListener("click", function () { $("#tarea-form").hidden = true; });
    $("#tarea-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var titulo = $("#tarea-titulo").value.trim();
      if (!titulo) return;
      var tipo = $("#tarea-tipo").value === "proyecto" ? "proyecto" : "tarea";
      var padre = $("#tarea-padre").value || null;
      var t;
      if (formEditId) {
        t = tareaPorId(formEditId);
        if (!t) return;
      } else {
        t = { id: "t" + Date.now(), creada: new Date().toISOString(), orden: estado.tareas.length };
        estado.tareas.push(t);
      }
      if (padre === t.id) padre = null;
      t.titulo = titulo;
      t.tipo = tipo;
      t.padre_id = padre;
      t.fecha = $("#tarea-fecha").value || "";
      t.prioridad = $("#tarea-prioridad").value;
      t.contexto = $("#tarea-contexto").value.trim();
      t.nota = t.nota || "";
      if (!t.estado) { t.estado = "pendiente"; t.hecha = false; }
      estado.tareaSel = t.id;
      estado.panel[pantalla] = "detalle";
      $("#tarea-form").hidden = true;
      formEditId = null;
      if (vistaTareas === "hoy") {
        vistaTareas = "arbol";
        estado.vistaTareas = "arbol";
        $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-vista") === "arbol"); });
      }
      guardar(); pintarTareas(); pintarPanel();
      aviso(tipo === "proyecto" ? "Proyecto creado. Añade tareas dentro." : "Tarea creada.");
    });
    $("#btn-nuevo-ramo").addEventListener("click", function () { abrirFormularioRamo(null); });
    $("#malla-crear").addEventListener("click", function () { abrirFormularioRamo(null); });
    $("#ramo-cancelar").addEventListener("click", cerrarFormularioRamo);
    $("#btn-importar-malla").addEventListener("click", function () { $("#archivo-malla").click(); });
    $("#malla-importar-vacio").addEventListener("click", function () { $("#archivo-malla").click(); });
    $("#btn-exportar-malla").addEventListener("click", exportarMalla);
    $("#archivo-malla").addEventListener("change", function (e) {
      var f = e.target.files[0]; if (!f) return;
      importarMalla(f); e.target.value = "";
    });
    $("#malla-buscar").addEventListener("input", function (e) { mallaBusqueda = e.target.value; pintarMalla(); });
    $("#malla-filtro").addEventListener("change", function (e) { mallaFiltro = e.target.value; pintarMalla(); });
    $("#malla-rapido").addEventListener("change", function (e) { mallaRapido = e.target.checked; });
    $("#malla-quitar-sel").addEventListener("click", limpiarSeleccionMalla);
    $("#btn-calif-malla").addEventListener("click", function () { ir("malla"); });
    $("#btn-estudio-malla").addEventListener("click", function () { ir("malla"); });
    $("#est-form").addEventListener("submit", function (e) {
      e.preventDefault();
      normalizarEstudio();
      var fecha = $("#est-fecha").value || hoyISO();
      var minutos = Math.max(1, Math.min(1440, parseInt($("#est-minutos").value, 10) || 0));
      if (!minutos) return;
      estado.sesiones.push({ fecha: fecha, minutos: minutos, ramo: $("#est-ramo").value || "", vinculo: "" });
      guardar(); pintarEstudio(); pintarTiempo();
      aviso("Sesión de estudio registrada.");
    });
    $("#est-meta").addEventListener("change", function (e) {
      normalizarEstudio(); estado.estudio.metaSemanal = Math.max(0, Number(e.target.value) || 0);
      guardar(); pintarEstudio();
    });
    $("#est-tabla").addEventListener("change", function (e) {
      var el = e.target.closest("[data-est-meta-ramo]"); if (!el) return;
      normalizarEstudio();
      estado.estudio.metasRamo[el.getAttribute("data-est-meta-ramo")] = Math.max(0, Number(el.value) || 0);
      guardar(); pintarEstudio();
    });
    $("#est-sesiones").addEventListener("click", function (e) {
      var b = e.target.closest("[data-borrar-estudio]"); if (!b) return;
      borrarSesion(parseInt(b.getAttribute("data-borrar-estudio"), 10));
    });
    $("#calif-crear-ramo").addEventListener("click", function () { ir("malla"); abrirFormularioRamo(null); });
    $("#calif-lista").addEventListener("click", function (e) {
      var b = e.target.closest("[data-calif]"); if (!b) return;
      califSel = b.getAttribute("data-calif"); estado.califSel = califSel;
      estado.ramoSel = califSel; estado.panel.calificaciones = "detalle";
      guardar(); pintarCalificaciones(); pintarPanel();
      if (window.innerWidth <= 1255) abrirPanel();
    });
    $("#calif-detalle").addEventListener("change", cambioCalif);
    $("#calif-detalle").addEventListener("click", accionCalif);

    $("#ramo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var cod = $("#ramo-codigo").value.trim().toUpperCase();
      var nombre = $("#ramo-nombre").value.trim();
      if (!cod || !nombre) { aviso("Código y nombre son obligatorios."); return; }
      normalizarCursos();
      var original = formRamoId ? ramoPorCodigo(formRamoId) : null;
      var choque = ramoPorCodigo(cod);
      if (choque && (!original || choque.codigo !== original.codigo)) { aviso("Ese código ya existe."); return; }
      var reqs = $("#ramo-requisitos").value.split(/[,;]+/).map(function (r) {
        return r.trim().toUpperCase();
      }).filter(function (r) { return r && r !== cod; });
      reqs = reqs.filter(function (r, i) { return reqs.indexOf(r) === i; });
      if (original && original.codigo !== cod) {
        var viejo = original.codigo;
        estado.cursos.forEach(function (x) {
          x.requisitos = x.requisitos.map(function (r) { return r === viejo ? cod : r; });
          x.requisitos_o = (x.requisitos_o || []).map(function (g) {
            return g.map(function (r) { return r === viejo ? cod : r; });
          });
        });
        if (estado.ramoSel === viejo) estado.ramoSel = cod;
        if (estado.califSel === viejo) estado.califSel = cod;
        if (estado.califs && estado.califs[viejo]) { estado.califs[cod] = estado.califs[viejo]; delete estado.califs[viejo]; }
        original.codigo = cod;
      }
      var c = original || { codigo: cod };
      c.nombre = nombre;
      c.creditos = Math.max(0, parseInt($("#ramo-creditos").value, 10) || 0);
      c.nivel = Math.max(1, Math.min(99, parseInt($("#ramo-nivel").value, 10) || 1));
      c.requisitos = reqs;
      c.requisitos_o = c.requisitos_o || [];
      var aprobado = $("#ramo-aprobado").checked;
      var enCurso = $("#ramo-curso").checked && !aprobado;
      var cerrado = aprobado || (!!original && original.cerrado && !original.aprobado && !enCurso);
      c.cerrado = cerrado;
      c.aprobado = cerrado && aprobado;
      c.resultado = cerrado ? (c.aprobado ? "aprobado" : "reprobado") : "";
      c.notaCierre = cerrado ? (original ? original.notaCierre : null) : null;
      c.cerradoEn = cerrado ? (original && original.cerradoEn ? original.cerradoEn : selloLocal()) : "";
      c.enCurso = enCurso;
      if (!original) estado.cursos.push(c);
      estado.ramoSel = c.codigo; estado.panel.malla = "detalle";
      guardar(); cerrarFormularioRamo(); pintarMalla(); pintarPanel();
      aviso(original ? "Ramo guardado." : "Ramo creado.");
    });

    $("#btn-nueva-nota").addEventListener("click", crearNota);
    $("#btn-borrar-nota").addEventListener("click", function () {
      if (estado.notaSel) borrarNota(estado.notaSel);
    });
    $("#buscar-nota").addEventListener("input", function (e) {
      notaBusqueda = e.target.value; pintarNotasLista("#notas-items", true);
    });
    $("#nota-titulo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.titulo = e.target.value;
      n.actualizado = selloLocal();
      guardar();
    });
    $("#nota-titulo").addEventListener("change", function () {
      pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-cuerpo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.cuerpo = e.target.value;
      n.actualizado = selloLocal();
      guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-modo").addEventListener("click", function () { notaModo = notaModo === "preview" ? "editar" : "preview"; pintarNotas(); });
    $("#nota-fijar").addEventListener("click", function () {
      var n = notaActual(); if (!n) return;
      n.fijada = !n.fijada; guardar(); pintarNotas(); pintarPanel();
    });
    $("#nota-contexto").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return; n.contexto = e.target.value; guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-etiquetas").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.etiquetas = e.target.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-vinculo").addEventListener("change", function (e) {
      var n = notaActual(); if (!n) return;
      var v = e.target.value, tipo = v.split(":")[0], id = v.split(":")[1];
      if (!v) { n.enlaces = []; }
      else {
        var titulo = "";
        if (tipo === "tarea") { var t = tareaPorId(id); titulo = t ? t.titulo : ""; }
        else { var ev = eventoPorId(id); titulo = ev ? ev.titulo : ""; }
        n.enlaces = [{ tipo: tipo, id: id, titulo: titulo }];
      }
      guardar(); pintarNotas(); pintarPanel();
    });
    $("#btn-hoy").addEventListener("click", function () { calCursor = new Date(); pintarCalendario(); });
    $("#btn-periodo").addEventListener("click", abrirPeriodo);
    $("#btn-mimo").addEventListener("click", function (e) {
      e.stopPropagation();
      $("#mimo-menu").hidden = false;
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest("#btn-mimo") && !e.target.closest("#mimo-menu")) $("#mimo-menu").hidden = true;
    });
    $("#mimo-menu").addEventListener("click", function (e) { e.stopPropagation(); });
    $$("#mimo-menu [data-menu]").forEach(function (b) {
      b.addEventListener("click", function () {
        $("#mimo-menu").hidden = true;
        var m = b.getAttribute("data-menu");
        if (m === "periodo") abrirPeriodo();
        else if (m === "evento") { ir("calendario"); abrirEvento(null); }
        else if (m === "tarea") { ir("tareas"); abrirFormulario(null); }
        else if (m === "nota") { ir("notas"); $("#btn-nueva-nota").click(); }
        else if (m === "ajustes") ir("ajustes");
      });
    });
    $("#periodo-x").addEventListener("click", cerrarPeriodo);
    $("#periodo-cancelar").addEventListener("click", cerrarPeriodo);
    $("#modal-periodo").addEventListener("click", function (e) { if (e.target === $("#modal-periodo")) cerrarPeriodo(); });
    $("#periodo-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var nombre = $("#periodo-nombre").value.trim(); if (!nombre) return;
      var inicio = $("#periodo-inicio").value || hoyISO();
      var total = Math.max(1, parseInt($("#periodo-semanas").value, 10) || 18);
      var receso = Math.max(0, parseInt($("#periodo-receso").value, 10) || 0);
      var exam = Math.max(0, parseInt($("#periodo-examenes").value, 10) || 0);
      var clases = Math.max(0, total - receso - exam);
      var semanas = [], base = new Date(inicio + "T12:00:00");
      for (var i = 0; i < total; i++) {
        var d = new Date(base.getTime()); d.setDate(d.getDate() + i * 7);
        var fin = new Date(d.getTime()); fin.setDate(fin.getDate() + 6);
        var tipo = i < clases ? "clases" : i < clases + receso ? "receso" : "examenes";
        semanas.push({ n: i + 1, desde: d.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10), tipo: tipo });
      }
      var p = { id: "p" + Date.now(), nombre: nombre, inicio: inicio, semanas: semanas };
      estado.periodos = estado.periodos || []; estado.periodos.push(p); estado.periodoActivo = p.id;
      guardar(); pintarPeriodo(); cerrarPeriodo(); $("#periodo-nombre").value = "";
      aviso("Periodo creado: " + clases + " clases, " + receso + " receso, " + exam + " exámenes.");
    });
    $("#split-seccion").addEventListener("change", function (e) {
      estado.splitSeccion = e.target.value; guardar(); pintarSplit();
    });
    $("#btn-empezar").addEventListener("click", empezarTiempo);
    $("#btn-pausar").addEventListener("click", pausarTiempo);
    $("#btn-parar").addEventListener("click", pararTiempo);
    $("#btn-reiniciar").addEventListener("click", reiniciarTiempo);
    $("#btn-buscar").addEventListener("click", function () { aviso("Buscador global Ctrl+K: llega con M27."); });
    $("#btn-sync").addEventListener("click", function () { aviso("Guardado en este equipo. La sincronización es opcional."); });
    $("#btn-nuevo").addEventListener("click", abrirPeriodo);
    $("#btn-nuevo-evento").addEventListener("click", function () { abrirEvento(null); });
    $("#evento-cancelar").addEventListener("click", function () { $("#evento-form").hidden = true; });
    $("#evento-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var titulo = $("#evento-titulo").value.trim();
      if (!titulo) return;
      var ev = formEventoId ? eventoPorId(formEventoId) : null;
      if (!ev) {
        ev = { id: "e" + Date.now() };
        estado.eventos.push(ev);
      }
      ev.titulo = titulo;
      ev.fecha = $("#evento-fecha").value || hoyISO();
      ev.hora = $("#evento-hora").value;
      ev.contexto = $("#evento-contexto").value.trim();
      ev.nota = ev.nota || "";
      estado.eventoSel = ev.id;
      estado.panel[pantalla] = "detalle";
      $("#evento-form").hidden = true;
      formEventoId = null;
      guardar(); pintarCalendario(); pintarPanel();
      aviso("Evento guardado.");
    });
    $$("#vista-calendario button").forEach(function (b) {
      b.addEventListener("click", function () {
        vistaCalendario = b.getAttribute("data-cal-vista");
        estado.vistaCalendario = vistaCalendario;
        guardar(); pintarCalendario();
      });
    });
    $("#cal-ant").addEventListener("click", function () {
      if (vistaCalendario === "semana") calCursor.setDate(calCursor.getDate() - 7);
      else calCursor.setMonth(calCursor.getMonth() - 1);
      pintarCalendario();
    });
    $("#cal-sig").addEventListener("click", function () {
      if (vistaCalendario === "semana") calCursor.setDate(calCursor.getDate() + 7);
      else calCursor.setMonth(calCursor.getMonth() + 1);
      pintarCalendario();
    });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); aviso("Buscador global Ctrl+K: llega con M27.");
      }
      if (e.key === "Escape") {
        if (!$("#menu-ctx").hidden) { e.preventDefault(); cerrarMenu(); return; }
        cerrarModal(); cerrarPanel();
      }
    });
    setInterval(comprobarAlarmas, 1000);
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1255) document.body.classList.remove("panel-abierto");
      else document.body.classList.remove("panel-oculto");
      if (window.innerWidth <= 1255 && splitOn) {
        splitOn = false;
        document.body.classList.remove("split");
        $("#contenido-b").hidden = true;
        $("#btn-split").setAttribute("aria-pressed", "false");
      }
      if (pantalla === "malla") setTimeout(dibujarLineasMalla, 60);
    });
    guardar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
