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
      tema: "clasico", instalados: [], kits: {}, panel: {}, tareas: [], notas: [], eventos: [],
      periodos: [], periodoActivo: null, sesiones: [], tiempoVinculo: "", splitSeccion: "tareas",
      notaSel: null, tareaSel: null, eventoSel: null, tiempoHijos: HIJOS.map(function (x) { return x[0]; })
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
  function icono(id) { return '<svg class="icono" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function nombre(id) {
    if (id === "calendario") return "Calendario";
    if (id === "tareas") return "Tareas";
    if (id === "notas") return "Notas";
    if (id === "ajustes") return "Ajustes";
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
  }

  function ir(id) {
    if (secciones().indexOf(id) === -1) return;
    pantalla = id;
    $$(".seccion[data-pantalla]").forEach(function (s) {
      s.hidden = s.getAttribute("data-pantalla") !== id;
    });
    pintarTabs();
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
    return '<button class="evento-chip" type="button" data-evento="' + e.id + '" title="' + esc(e.titulo) + '">' +
      (e.hora ? '<b>' + esc(e.hora) + "</b> " : "") + esc(e.titulo) + "</button>";
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
        return '<button class="cal-agenda__item" type="button" data-evento="' + e.id + '"><span><b>' + esc(e.titulo) + "</b><small>" + esc(e.fecha) + (e.hora ? " · " + esc(e.hora) : "") + (e.contexto ? " · " + esc(e.contexto) : "") + "</small></span><span class=\"pill\">" + (e.fecha >= hoyISO() ? "próximo" : "pasado") + "</span></button>";
      }).join("") : '<p class="empty">Sin eventos todavía.</p>';
    } else if (vistaCalendario === "semana") {
      var lunes = new Date(calCursor.getFullYear(), calCursor.getMonth(), calCursor.getDate());
      lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
      var dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
      grid.className = "cal-grid cal-grid--semana";
      $("#cal-mes-titulo").textContent = "Semana del " + lunes.getDate() + "/" + (lunes.getMonth() + 1);
      grid.innerHTML = dias.map(function (d, i) {
        var f = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
        var iso = f.getFullYear() + "-" + String(f.getMonth() + 1).padStart(2, "0") + "-" + String(f.getDate()).padStart(2, "0");
        var evs = eventosDe(iso); visibles += evs.length;
        return '<div class="cal-semana-dia' + (iso === hoyISO() ? " hoy" : "") + '"><b>' + d + " " + f.getDate() + "</b>" +
          (evs.length ? evs.map(chipEvento).join("") : '<span class="cal-vacio-dia">—</span>') + "</div>";
      }).join("");
    } else {
      var primero = new Date(y, m, 1);
      var offset = (primero.getDay() + 6) % 7;
      var inicio = new Date(y, m, 1 - offset);
      var dias2 = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
      grid.className = "cal-grid";
      $("#cal-mes-titulo").textContent = new Date(y, m, 1).toLocaleDateString("es-CL", { month: "long", year: "numeric" });
      var html = dias2.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
      for (var i = 0; i < 42; i++) {
        var f2 = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
        var iso2 = f2.getFullYear() + "-" + String(f2.getMonth() + 1).padStart(2, "0") + "-" + String(f2.getDate()).padStart(2, "0");
        var evs2 = eventosDe(iso2); if (f2.getMonth() === m) visibles += evs2.length;
        html += '<div class="cal-dia' + (f2.getMonth() !== m ? " fuera" : "") + (iso2 === hoyISO() ? " hoy" : "") + '"><b>' + f2.getDate() + "</b>" +
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
    guardar(); pintarCalendario(); pintarPanel();
  }

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
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
    var html = '<div class="tarea-fila' + (estado.tareaSel === t.id ? " sel" : "") + '" data-tarea="' + t.id + '" role="button" tabindex="0" style="--nivel:' + nivel + '">' +
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
    return '<button class="tarjeta-tarea' + (estado.tareaSel === t.id ? " sel" : "") + '" type="button" data-tarea="' + t.id + '">' +
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
    guardar(); pintarTareas(); pintarPanel();
  }

  function notaActual() {
    return estado.notas.filter(function (n) { return n.id === estado.notaSel; })[0] || null;
  }
  function pintarNotasLista(destino, conClick) {
    var cont = $(destino);
    if (!cont) return;
    var q = notaBusqueda.toLowerCase();
    var vis = estado.notas.filter(function (n) {
      return !q || (n.titulo + " " + n.cuerpo).toLowerCase().indexOf(q) !== -1;
    });
    cont.innerHTML = vis.map(function (n) {
      return '<button class="nota-item' + (n.id === estado.notaSel ? " on" : "") + '" type="button" data-nota="' + n.id + '"><b>' +
        esc(n.titulo || "Sin título") + "</b><small>" + esc((n.cuerpo || "").slice(0, 70) || "Vacía") + "</small></button>";
    }).join("");
    if (conClick) {
      $$(destino + " [data-nota]").forEach(function (b) {
        b.addEventListener("click", function () {
          estado.notaSel = b.getAttribute("data-nota"); guardar(); pintarNotas(); pintarPanel();
        });
      });
    }
  }
  function pintarNotas() {
    pintarNotasLista("#notas-items", true);
    pintarNotasLista("#notas-lista-b", true);
    $("#notas-vacio").hidden = estado.notas.length > 0;
    var n = notaActual();
    $("#nota-titulo").disabled = !n;
    $("#nota-cuerpo").disabled = !n;
    $("#nota-titulo").value = n ? n.titulo : "";
    $("#nota-cuerpo").value = n ? n.cuerpo : "";
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
      if (ev && pantalla === "calendario") {
        html = "<h2>Evento</h2><h3>" + esc(ev.titulo) + "</h3>" +
          '<div class="panel__bloque"><span>Fecha</span><small>' + esc(ev.fecha) + "</small></div>" +
          (ev.hora ? '<div class="panel__bloque"><span>Hora</span><small>' + esc(ev.hora) + "</small></div>" : "") +
          (ev.contexto ? '<div class="panel__bloque"><span>Contexto</span><small>' + esc(ev.contexto) + "</small></div>" : "") +
          (ev.nota ? '<p class="panel__nota">' + esc(ev.nota) + "</p>" : "") +
          '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-editar-evento="' + ev.id + '">Editar</button>' +
          '<button class="btn btn--chico btn-peligro" type="button" data-borrar-evento="' + ev.id + '">Borrar</button></div>';
      } else if (t) {
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
      } else if (n) {
        html = "<h2>Detalle de la nota</h2><h3>" + esc(n.titulo || "Sin título") +
          '</h3><p class="panel__nota">' + esc((n.cuerpo || "").slice(0, 240) || "Vacía") + "</p>";
      } else {
        html = '<h2>Detalle</h2><p class="panel__nota">Selecciona una tarea o una nota. El detalle vive aquí, no en un modal que tapa la lista.</p>';
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
    var pie = $("#pie-centro");
    if (pie) pie.textContent = nombre(pantalla);
  }

  function periodoActivoObj() {
    return (estado.periodos || []).filter(function (p) { return p.id === estado.periodoActivo; })[0] || null;
  }
  function pintarPeriodo() {
    var p = periodoActivoObj();
    var b = $("#btn-periodo");
    if (b) b.textContent = p ? p.nombre : "Sin periodo";
    var lista = $("#periodos-lista");
    if (lista) {
      lista.innerHTML = (estado.periodos || []).length ? estado.periodos.map(function (x) {
        return '<div class="periodo-item' + (x.id === estado.periodoActivo ? " on" : "") + '"><span><b>' + esc(x.nombre) + '</b><br><small class="muted">' + esc(x.inicio) + " · " + x.semanas.length + " semanas</small></span><button class='btn btn--chico' type='button' data-periodo='" + x.id + "'>Usar</button></div>";
      }).join("") : '<p class="muted">Todavía no hay periodos.</p>';
      $$("#periodos-lista [data-periodo]").forEach(function (x) {
        x.addEventListener("click", function () { estado.periodoActivo = x.getAttribute("data-periodo"); guardar(); pintarPeriodo(); aviso("Periodo activo."); });
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
    pintarTabs(); pintarCalendario(); pintarTemaIcono(); pintarPeriodo(); pintarSplit();
    $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-vista") === vistaTareas); });
    pintarTareas(); pintarNotas();
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
    $("#btn-panel-ajustes").addEventListener("click", abrirPanel);
    $("#pie-panel").addEventListener("click", alternarPanel);
    $("#pie-sync").addEventListener("click", function () { aviso("Guardado en este equipo. El respaldo es un archivo .json."); });
    $("#pie-ayuda").addEventListener("click", function () { aviso("Panel derecho: Contexto, Detalle, Notas y Bloques. El pie queda fijo; el panel no mueve el header."); });
    $("#modal-x").addEventListener("click", cerrarModal);
    $("#modal").addEventListener("click", function (e) { if (e.target === $("#modal")) cerrarModal(); });
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
    $("#btn-nueva-nota").addEventListener("click", function () {
      var n = { id: "n" + Date.now(), titulo: "Sin título", cuerpo: "", actualizado: new Date().toISOString().slice(0, 16).replace("T", " ") };
      estado.notas.unshift(n);
      estado.notaSel = n.id;
      guardar(); pintarNotas(); pintarPanel();
      $("#nota-titulo").focus(); $("#nota-titulo").select();
    });
    $("#buscar-nota").addEventListener("input", function (e) {
      notaBusqueda = e.target.value; pintarNotasLista("#notas-items", true);
    });
    $("#nota-titulo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.titulo = e.target.value;
      n.actualizado = new Date().toISOString().slice(0, 16).replace("T", " ");
      guardar();
    });
    $("#nota-titulo").addEventListener("change", function () {
      pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#nota-cuerpo").addEventListener("input", function (e) {
      var n = notaActual(); if (!n) return;
      n.cuerpo = e.target.value;
      n.actualizado = new Date().toISOString().slice(0, 16).replace("T", " ");
      guardar(); pintarNotasLista("#notas-items", true); pintarPanel();
    });
    $("#btn-hoy").addEventListener("click", function () { calCursor = new Date(); pintarCalendario(); });
    $("#btn-periodo").addEventListener("click", abrirPeriodo);
    $("#btn-mimo").addEventListener("click", function () { $("#mimo-menu").hidden = !$("#mimo-menu").hidden; });
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
      if (e.key === "Escape") { cerrarModal(); cerrarPanel(); }
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
