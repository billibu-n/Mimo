/* mimo-panel.js — panel derecho, pie y botón de panel sobre Mimo Academics 1.1.2.
   Solo lee el estado que ya existe; no toca motores ni datos. */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var NOMBRES = { calendario: "Calendario", estudio: "Estudio", malla: "Malla", notas: "Ramos", tiempo: "Tiempo", tareas: "Tareas", ajustes: "Ajustes" };
  var ICONOS = { calendario: "TIE-28", estudio: "EDI-03", malla: "INT-28", notas: "EDI-02", tiempo: "TIE-03", tareas: "INT-02", ajustes: "ACC-03" };
  var TAGS = { calendario: "base", tareas: "base", ajustes: "base", tiempo: "universal", estudio: "kit", malla: "kit", notas: "kit" };

  var tab = "contexto";
  var abierto = false;

  function guardarClave(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function leerClave(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function actual() {
    var s = document.querySelector(".seccion.on");
    return s ? s.getAttribute("data-seccion") : "calendario";
  }
  function nombreSec(s) { return NOMBRES[s] || s; }
  function estado() {
    try { return (typeof est === "function") ? est() : null; } catch (e) { return null; }
  }
  function semestre() {
    try { return (typeof semActivo === "function") ? semActivo() : null; } catch (e) { return null; }
  }
  function fechaHoy() {
    try { return (typeof hoy === "function") ? hoy() : new Date().toISOString().slice(0, 10); } catch (e) { return ""; }
  }
  function colorDe(cod) {
    try { return (typeof window.colorDe === "function") ? window.colorDe(cod) : "var(--ac)"; } catch (e) { return "var(--ac)"; }
  }

  function kpis(pares) {
    return '<div class="mp-kpi">' + pares.map(function (p) {
      return "<div><b>" + esc(p[0]) + "</b><span>" + esc(p[1]) + "</span></div>";
    }).join("") + "</div>";
  }

  function panelContexto() {
    var sec = actual(), s = estado() || {}, sem = semestre() || {}, ev = sem.eventos || [];
    var d = (typeof D !== "undefined" && D) ? D : {};
    var html = "<h2>" + esc(nombreSec(sec)) + "</h2>";
    if (sec === "calendario") {
      var prox = ev.filter(function (e) { return e.fecha >= fechaHoy(); }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; })[0];
      html += '<p class="mp-muted">' + (sem.nombre ? esc(sem.nombre) : "Sin semestre activo") + "</p>" +
        kpis([[ev.length, "eventos"], [(sem.ramos || []).length, "ramos"]]) +
        (prox ? '<div class="mp-card"><b>' + esc(prox.titulo || prox.nombre || "Evento") + "</b><br><span class=\"mp-muted\">" + esc(prox.fecha) + "</span></div>" : '<p class="mp-muted">Sin eventos próximos.</p>');
    } else if (sec === "tareas") {
      var todos = [];
      try { todos = (typeof todosEventos === "function") ? todosEventos() : []; } catch (e) {}
      var hechas = s.hechas || {};
      var abiertas = todos.filter(function (e) { return !hechas[e.id]; }).length;
      html += kpis([[abiertas, "abiertas"], [todos.length - abiertas, "hechas"]]) +
        '<p class="mp-muted">Las tareas salen de los eventos del calendario; no se duplican.</p>';
    } else if (sec === "malla") {
      var cursos = Object.keys(d.catalogo || {}).length;
      html += kpis([[cursos, "cursos"], [(d.niveles || []).length, "niveles"]]) +
        '<p class="mp-muted">La malla es el catálogo de la carrera; los estados se calculan con los aprobados.</p>';
    } else if (sec === "notas") {
      var ramos = (sem.ramos || []);
      html += kpis([[ramos.length, "ramos"], [Object.keys(s.estado || {}).length, "con estado"]]) +
        (ramos.length ? ramos.slice(0, 5).map(function (r) {
          return '<div class="mp-row"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + colorDe(r.codigo) + ';margin-right:6px"></i>' + esc(r.alias || r.codigo) + "</span><small>" + esc(r.codigo) + "</small></div>";
        }).join("") : '<p class="mp-muted">Sin ramos en el semestre activo.</p>');
    } else if (sec === "estudio") {
      var ses = s.sesiones || [], min = 0;
      ses.forEach(function (x) { min += Number(x.minutos || 0); });
      html += kpis([[ses.length, "sesiones"], [Math.round(min / 60) + " h", "registradas"]]) +
        '<p class="mp-muted">Las horas se registran contra el ramo y el día.</p>';
    } else if (sec === "tiempo") {
      var t = (typeof E !== "undefined" && E.tiempo) ? E.tiempo : {};
      html += kpis([[(t.modo || "cronometro"), "modo"], [(s.sesiones || []).length, "sesiones"]]) +
        '<p class="mp-muted">Cronómetro, temporizador, pomodoro y recordatorios comparten el mismo registro.</p>';
    } else {
      html += '<p class="mp-muted">Ajustes es la sección de control: apariencia, navegación, paneles, respaldo y bloques.</p>' +
        kpis([["9", "temas"], ["2", "idiomas"]]);
    }
    return html;
  }

  function panelDetalle() {
    var sem = semestre();
    if (!sem || !sem.id) return "<h2>Detalle</h2><p class=\"mp-muted\">Sin semestre activo. Crea uno con «+ Semestre» para ver aquí sus datos.</p>";
    return "<h2>Semestre activo</h2>" +
      '<div class="mp-card"><b>' + esc(sem.nombre || sem.id) + "</b><br><span class=\"mp-muted\">" + esc(sem.id) + "</span></div>" +
      kpis([[(sem.semanas || []).length, "semanas"], [(sem.ramos || []).length, "ramos"], [(sem.eventos || []).length, "eventos"], ["—", "promedio"]]) +
      '<p class="mp-muted">El detalle de un ramo, una tarea o un evento aparece aquí cuando lo seleccionas en su sección.</p>';
  }

  function panelRamos() {
    var sem = semestre(), ramos = (sem && sem.ramos) || [];
    if (!ramos.length) return "<h2>Ramos</h2><p class=\"mp-muted\">Sin ramos. Se crean en Malla o al importar el respaldo.</p>";
    return "<h2>Ramos del semestre</h2>" + ramos.map(function (r) {
      return '<div class="mp-row"><span><i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + colorDe(r.codigo) + ';margin-right:6px"></i>' + esc(r.alias || r.codigo) + "</span><small>" + esc(r.codigo) + "</small></div>";
    }).join("");
  }

  function panelBloques() {
    return "<h2>Bloques</h2><p class=\"mp-muted\">Las siete secciones del viejo. En L3 se podrán instalar y quitar; ahora se navegan.</p>" +
      Object.keys(NOMBRES).map(function (id) {
        return '<button class="mp-nav" type="button" data-ir="' + id + '"><svg class="ic" aria-hidden="true"><use href="#' + ICONOS[id] + '"></use></svg><span>' +
          esc(NOMBRES[id]) + '</span><span class="tag">' + TAGS[id] + "</span></button>";
      }).join("") +
      '<p class="mp-muted" style="margin-top:10px">El kit Academics y los bloques universales llegan en L3.</p>';
  }

  function pintar() {
    var c = $("#mimo-panel-cuerpo");
    if (!c) return;
    var html = tab === "detalle" ? panelDetalle() : tab === "notas" ? panelRamos() : tab === "bloques" ? panelBloques() : panelContexto();
    c.innerHTML = html;
    $$("#mimo-panel-cuerpo [data-ir]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-ir");
        if (typeof mostrarSeccion === "function") mostrarSeccion(id, true);
      });
    });
    $$(".mimo-panel__tab").forEach(function (b) {
      var on = b.getAttribute("data-mptab") === tab;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $("#mimo-pie-centro").textContent = nombreSec(actual());
  }

  function abrir() {
    abierto = true;
    document.body.classList.add("mimo-panel-abierto");
    guardarClave("mimo-panel-abierto", "1");
    pintar();
  }
  function cerrar() {
    abierto = false;
    document.body.classList.remove("mimo-panel-abierto");
    guardarClave("mimo-panel-abierto", "0");
  }
  function alternar() { abierto ? cerrar() : abrir(); }

  function medidas() {
    var cab = document.querySelector(".g1 .b1"), pie = document.querySelector(".mimo-pie");
    if (cab) document.documentElement.style.setProperty("--mimo-panel-top", Math.round(cab.getBoundingClientRect().height) + "px");
    if (pie) document.documentElement.style.setProperty("--mimo-pie-alto", Math.round(pie.getBoundingClientRect().height) + "px");
  }

  function init() {
    var tabGuardado = leerClave("mimo-panel-tab");
    if (tabGuardado) tab = tabGuardado;
    var guardado = leerClave("mimo-panel-abierto");
    abierto = guardado === null ? window.innerWidth >= 1280 : guardado === "1";
    if (abierto) document.body.classList.add("mimo-panel-abierto");
    medidas();
    pintar();

    $("#mimo-panel-btn").addEventListener("click", alternar);
    $("#mimo-panel-cerrar").addEventListener("click", cerrar);
    $("#mimo-velo").addEventListener("click", cerrar);
    $("#mimo-pie-panel").addEventListener("click", alternar);
    $$(".mimo-panel__tab").forEach(function (b) {
      b.addEventListener("click", function () {
        tab = b.getAttribute("data-mptab");
        guardarClave("mimo-panel-tab", tab);
        pintar();
      });
    });
    $("#mimo-pie-sync").addEventListener("click", function () {
      var s = document.getElementById("btn-sync");
      if (s) s.click();
      $("#mimo-pie-sync").lastChild.textContent = "local · guardado";
    });
    $("#mimo-pie-ayuda").addEventListener("click", function () {
      if (typeof abrirAyuda === "function") {
        abrirAyuda("Panel y pie", "El panel derecho tiene Contexto, Detalle, Ramos y Bloques. El pie muestra el guardado local y el acceso al panel. Nada de esto cambia tus datos.");
      }
    });

    document.addEventListener("mimo:seccion", function (e) {
      var sec = e && e.detail && e.detail.seccion;
      if (sec && NOMBRES[sec]) $("#mimo-pie-centro").textContent = NOMBRES[sec];
      pintar();
    });
    $$(".nav").forEach(function (n) { n.addEventListener("click", function () { setTimeout(pintar, 30); }); });
    window.addEventListener("resize", function () { medidas(); if (window.innerWidth < 900 && abierto) cerrar(); });
    setInterval(function () { if (abierto && (tab === "contexto" || tab === "detalle")) pintar(); }, 2500);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && abierto) cerrar(); });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
