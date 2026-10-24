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
      tema: "clasico", instalados: [], kits: {}, panel: {}, tareas: [], notas: [], eventos: [], cursos: [],
      periodos: [], periodoActivo: null, sesiones: [], tiempoVinculo: "", splitSeccion: "tareas",
      prefs: { inicioSemana: "lunes", hora: "24", panelAncho: "320", navPos: "arriba", idioma: "es", notificaciones: true, panelAbierto: true },
      notaSel: null, tareaSel: null, eventoSel: null, ramoSel: null, tiempoHijos: HIJOS.map(function (x) { return x[0]; })
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
  var tiempoSeg = 0, tiempoInt = null;
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
    guardar(); pintarTiempo(); aviso("Sesión borrada.");
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
        { accion: "ramo-estado", texto: r.aprobado ? "Reabrir" : "Marcar aprobado", run: function () { alternarRamo(r.codigo); } },
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
      var nivel = parseInt(c.nivel, 10); if (!nivel || nivel < 1) nivel = 1; if (nivel > 99) nivel = 99;
      out.push({
        codigo: cod, nombre: String(c.nombre || cod).trim() || cod,
        creditos: Math.max(0, parseInt(c.creditos, 10) || 0), nivel: nivel,
        requisitos: reqs, requisitos_o: grupos,
        aprobado: !!c.aprobado, enCurso: !!c.enCurso && !c.aprobado
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
    if (c.aprobado) return "aprobado";
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
  function pintarMalla() {
    var tabla = $("#malla-tablero"); if (!tabla) return;
    normalizarCursos();
    var cursos = estado.cursos, total = 0, aprobCred = 0, aprobN = 0, cursoN = 0, libres = 0;
    cursos.forEach(function (c) {
      var e = estadoDeRamo(c);
      total += creditosDe(c);
      if (e === "aprobado") { aprobCred += creditosDe(c); aprobN++; }
      if (e === "curso") cursoN++;
      if (e === "disponible") libres++;
    });
    var pct = total ? Math.round(aprobCred / total * 100) : 0;
    if ($("#malla-k-creditos")) $("#malla-k-creditos").textContent = aprobCred + " / " + total;
    if ($("#malla-k-pct")) $("#malla-k-pct").textContent = pct + " %";
    if ($("#malla-k-ramos")) $("#malla-k-ramos").textContent = aprobN + (cursoN ? " · " + cursoN + " curso" + (cursoN === 1 ? "" : "s") : "");
    if ($("#malla-k-libres")) $("#malla-k-libres").textContent = String(libres);
    var vacio = $("#malla-vacio");
    if (!cursos.length) {
      if (vacio) vacio.hidden = false;
      tabla.innerHTML = "";
      return;
    }
    if (vacio) vacio.hidden = true;
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
      tabla.innerHTML = '<p class="muted malla-sin">Ningún ramo coincide con el filtro.</p>';
      return;
    }
    var niveles = {};
    visibles.forEach(function (c) { (niveles[c.nivel] = niveles[c.nivel] || []).push(c); });
    tabla.innerHTML = Object.keys(niveles).map(Number).sort(function (a, b) { return a - b; }).map(function (n) {
      var lista = niveles[n].slice().sort(function (a, b) { return a.codigo < b.codigo ? -1 : 1; });
      var cr = lista.reduce(function (a, c) { return a + creditosDe(c); }, 0);
      var cards = lista.map(function (c) {
        var e = estadoDeRamo(c), req = requisitosTexto(c);
        var faltan = faltantesDe(c);
        var titulo = c.nombre + (req ? " · requiere " + req : "") + (faltan.length ? " · faltan: " + faltan.join(", ") : "");
        return '<button class="ramo-card ramo-card--' + e + '" type="button" data-ramo="' + esc(c.codigo) + '" title="' + esc(titulo) + '">' +
          '<span class="ramo-card__top"><b>' + esc(c.codigo) + '</b><span class="ramo-card__est">' + e + "</span></span>" +
          '<span class="ramo-card__nom">' + esc(c.nombre) + "</span>" +
          '<span class="ramo-card__meta">' + creditosDe(c) + " cr · " + esc(etiquetaNivel(c.nivel)) + "</span>" +
          (req ? '<span class="ramo-card__req">Requiere: ' + esc(req) + "</span>" : "") +
          (faltan.length && e !== "aprobado" ? '<span class="ramo-card__falta">Falta: ' + esc(faltan.join(", ")) + "</span>" : "") +
          "</button>";
      }).join("");
      return '<section class="malla-nivel"><h3>' + esc(etiquetaNivel(n)) +
        " <span>" + lista.length + " ramo" + (lista.length === 1 ? "" : "s") + " · " + cr + " cr</span></h3>" +
        '<div class="malla-ramos">' + cards + "</div></section>";
    }).join("");
    $$("#malla-tablero [data-ramo]").forEach(function (b) {
      b.addEventListener("click", function () {
        var cod = b.getAttribute("data-ramo");
        if (mallaRapido) { alternarRamo(cod); return; }
        estado.ramoSel = cod; estado.panel.malla = "detalle";
        guardar(); pintarMalla(); pintarPanel();
        if (window.innerWidth <= 1255) abrirPanel();
      });
    });
  }
  function alternarRamo(cod) {
    var c = ramoPorCodigo(cod); if (!c) return;
    c.aprobado = !c.aprobado;
    if (c.aprobado) c.enCurso = false;
    guardar(); pintarMalla(); pintarPanel();
    aviso(c.codigo + (c.aprobado ? " aprobado." : " reabierto."));
  }
  function abrirFormularioRamo(c) {
    normalizarCursos();
    formRamoId = c ? c.codigo : null;
    $("#ramo-codigo").value = c ? c.codigo : "";
    $("#ramo-nombre").value = c ? c.nombre : "";
    $("#ramo-creditos").value = c ? c.creditos : 6;
    $("#ramo-nivel").value = c ? c.nivel : 1;
    $("#ramo-requisitos").value = c ? (c.requisitos || []).join(", ") : "";
    $("#ramo-aprobado").checked = !!(c && c.aprobado);
    $("#ramo-curso").checked = !!(c && c.enCurso);
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
    if (!window.confirm("¿Borrar \"" + c.codigo + " — " + c.nombre + "\"?" +
      (dependientes ? " Se quitará de los requisitos de " + dependientes + " ramo(s)." : ""))) return;
    estado.cursos = estado.cursos.filter(function (x) { return x.codigo !== cod; });
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
    var raw = [], aprob = {};
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
        nivel: parseInt(c.nivel || c.semestre_num, 10) || 1,
        requisitos: Array.isArray(c.requisitos) ? c.requisitos : [],
        requisitos_o: Array.isArray(c.requisitos_o) ? c.requisitos_o : [],
        aprobado: !!(c.aprobado || (Array.isArray(aprob) ? aprob.indexOf(cod) !== -1 : aprob[cod])),
        enCurso: !!c.enCurso || c.estado === "curso"
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

  function pintarTiempo() {
    var c = $("#estanteria-tiempo");
    if (!c) return;
    var html = estado.tiempoHijos.map(function (id) {
      var nom = (HIJOS.filter(function (h) { return h[0] === id; })[0] || [id, id])[1];
      return '<button class="estante" type="button" data-hijo="' + id + '"><span>' + esc(nom) +
        '</span><span class="quitar" data-quitar-hijo="' + id + '" role="button" tabindex="0" title="Quitar de Tiempo">×</span></button>';
    }).join("");
    html += '<button class="estante estante-add" type="button" id="btn-add-hijo">+</button>';
    html += '<button class="btn" type="button" id="btn-editar-tiempo">Editar</button>';
    c.innerHTML = html;
    $$("#estanteria-tiempo [data-hijo]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        if (ev.target.getAttribute("data-quitar-hijo")) return;
        $$("#estanteria-tiempo .estante").forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        aviso(b.textContent.replace("×", "").trim() + " · vista del bloque.");
      });
    });
    $$("#estanteria-tiempo [data-quitar-hijo]").forEach(function (x) {
      x.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var id = x.getAttribute("data-quitar-hijo");
        estado.tiempoHijos = estado.tiempoHijos.filter(function (h) { return h !== id; });
        guardar(); pintarTiempo(); pintarPanel();
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
    var v = $("#tiempo-vinculo");
    if (v) {
      var ops = ['<option value="">Sin vínculo</option>'];
      estado.tareas.forEach(function (t) { ops.push('<option value="' + t.id + '">' + esc(t.titulo) + "</option>"); });
      v.innerHTML = ops.join("");
      v.value = estado.tiempoVinculo || "";
      v.onchange = function () { estado.tiempoVinculo = v.value; guardar(); };
    }
    var ses = estado.sesiones || [], min = 0;
    ses.forEach(function (x) { min += Number(x.minutos || 0); });
    if ($("#tiempo-sesiones")) $("#tiempo-sesiones").textContent = String(ses.length);
    if ($("#tiempo-horas")) $("#tiempo-horas").textContent = Math.round(min / 60) + " h";
    var listaSes = $("#tiempo-lista-sesiones");
    if (listaSes) {
      listaSes.innerHTML = ses.length ? ses.map(function (x, i) {
        var vin = x.vinculo ? tareaPorId(x.vinculo) : null;
        return '<div class="sesion-item" data-sesion="' + i + '" title="Clic derecho: borrar"><span><b>' +
          esc(fechaCorta(x.fecha)) + "</b>" + (vin ? " · " + esc(vin.titulo) : "") + "</span><small>" +
          Number(x.minutos || 0) + " min</small>" +
          '<button class="sesion-x" type="button" data-borrar-sesion="' + i + '" title="Borrar sesión" aria-label="Borrar sesión">×</button></div>';
      }).join("") : '<p class="muted">Sin sesiones todavía.</p>';
      $$("#tiempo-lista-sesiones [data-borrar-sesion]").forEach(function (b) {
        b.addEventListener("click", function () { borrarSesion(parseInt(b.getAttribute("data-borrar-sesion"), 10)); });
      });
    }
  }
  function pintaReloj() {
    var h = Math.floor(tiempoSeg / 3600), m = Math.floor((tiempoSeg % 3600) / 60), s = tiempoSeg % 60;
    $("#reloj").textContent = [h, m, s].map(function (x) { return String(x).padStart(2, "0"); }).join(":");
  }
  function empezarTiempo() {
    if (tiempoInt) return;
    tiempoInt = setInterval(function () { tiempoSeg++; pintaReloj(); }, 1000);
    $("#btn-empezar").disabled = true; $("#btn-pausar").disabled = false; $("#btn-parar").disabled = false;
    $("#tiempo-estado").textContent = "Cronómetro · corriendo" + (estado.tiempoVinculo ? " · vinculado" : "");
  }
  function pausarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    $("#btn-empezar").disabled = false; $("#btn-pausar").disabled = true;
    $("#tiempo-estado").textContent = "Cronómetro · en pausa · " + $("#reloj").textContent;
  }
  function pararTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    if (tiempoSeg > 0) {
      estado.sesiones = estado.sesiones || [];
      estado.sesiones.push({ fecha: hoyISO(), minutos: Math.max(1, Math.round(tiempoSeg / 60)), vinculo: estado.tiempoVinculo || "" });
      guardar(); pintarTiempo(); aviso("Sesión registrada. Estudio la leerá en U5.");
    }
    tiempoSeg = 0; pintaReloj();
    $("#btn-empezar").disabled = false; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    $("#tiempo-estado").textContent = "Cronómetro · parado";
  }
  function reiniciarTiempo() {
    if (tiempoInt) { clearInterval(tiempoInt); tiempoInt = null; }
    tiempoSeg = 0; pintaReloj();
    $("#btn-empezar").disabled = false; $("#btn-pausar").disabled = true; $("#btn-parar").disabled = true;
    $("#tiempo-estado").textContent = "Cronómetro · parado";
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
      if (pantalla === "malla" && ramo) {
        var estR = estadoDeRamo(ramo), faltanR = faltantesDe(ramo), reqR = requisitosTexto(ramo);
        html = "<h2>Ramo</h2><h3>" + esc(ramo.codigo) + " — " + esc(ramo.nombre) + "</h3>" +
          '<div class="panel__bloque"><span>Estado</span><small>' + esc(estR) + "</small></div>" +
          '<div class="panel__bloque"><span>Créditos</span><small>' + creditosDe(ramo) + "</small></div>" +
          '<div class="panel__bloque"><span>Nivel</span><small>' + esc(etiquetaNivel(ramo.nivel)) + "</small></div>" +
          (reqR ? '<div class="panel__bloque"><span>Requiere</span><small>' + esc(reqR) + "</small></div>" : "") +
          (faltanR.length ? '<h2>Falta</h2><p class="panel__nota">' + esc(faltanR.join(", ")) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-ramo="' + esc(ramo.codigo) + '">Editar</button>' +
          '<button class="btn btn--chico" type="button" data-toggle-ramo="' + esc(ramo.codigo) + '">' + (ramo.aprobado ? "Reabrir" : "Aprobar") + "</button>" +
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
    pintarTareas(); pintarNotas(); pintarMalla();
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
          pintarTabs(); pintarCalendario(); pintarTareas(); pintarNotas(); pintarMalla(); pintarTiempo(); pintarPeriodo(); pintarPanel();
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
        estado.cursos.forEach(function (x) {
          x.requisitos = x.requisitos.map(function (r) { return r === original.codigo ? cod : r; });
          x.requisitos_o = (x.requisitos_o || []).map(function (g) {
            return g.map(function (r) { return r === original.codigo ? cod : r; });
          });
        });
        if (estado.ramoSel === original.codigo) estado.ramoSel = cod;
        original.codigo = cod;
      }
      var c = original || { codigo: cod };
      c.nombre = nombre;
      c.creditos = Math.max(0, parseInt($("#ramo-creditos").value, 10) || 0);
      c.nivel = Math.max(1, Math.min(99, parseInt($("#ramo-nivel").value, 10) || 1));
      c.requisitos = reqs;
      c.requisitos_o = c.requisitos_o || [];
      c.aprobado = $("#ramo-aprobado").checked;
      c.enCurso = $("#ramo-curso").checked && !c.aprobado;
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
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1255) document.body.classList.remove("panel-abierto");
      else document.body.classList.remove("panel-oculto");
      if (window.innerWidth <= 1255 && splitOn) {
        splitOn = false;
        document.body.classList.remove("split");
        $("#contenido-b").hidden = true;
        $("#btn-split").setAttribute("aria-pressed", "false");
      }
    });
    guardar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
