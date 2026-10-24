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
      tema: "clasico", instalados: [], kits: {}, panel: {}, tareas: [], notas: [],
      notaSel: null, tareaSel: null, tiempoHijos: HIJOS.map(function (x) { return x[0]; })
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
  var vistaTareas = "hoy";
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
      return '<button class="tab' + on + '" type="button" role="tab" aria-selected="' + (id === pantalla) + '" data-ir="' + id + '">' +
        icono(iconoDe(id)) + "<span>" + esc(nombre(id)) + "</span></button>";
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
    guardar();
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

  function pintarCalendario() {
    var hoy = new Date();
    var y = hoy.getFullYear(), m = hoy.getMonth();
    $("#cal-mes-titulo").textContent = hoy.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
    var primero = new Date(y, m, 1);
    var offset = (primero.getDay() + 6) % 7;
    var inicio = new Date(y, m, 1 - offset);
    var dias = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
    var html = dias.map(function (d) { return '<div class="cal-dow">' + d + "</div>"; }).join("");
    for (var i = 0; i < 42; i++) {
      var f = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
      var fuera = f.getMonth() !== m;
      var esHoy = f.getFullYear() === y && f.getMonth() === m && f.getDate() === hoy.getDate();
      html += '<div class="cal-dia' + (fuera ? " fuera" : "") + (esHoy ? " hoy" : "") + '"><b>' + f.getDate() + "</b></div>";
    }
    $("#cal-grid").innerHTML = html;
    $("#cal-cuenta").textContent = "0 eventos";
    $("#kpi-eventos").textContent = "0";
    $("#kpi-tareas").textContent = String(estado.tareas.filter(function (t) { return t.fecha; }).length);
  }

  function hoyISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function pintarTareas() {
    var lista = $("#tareas-lista");
    var vacio = $("#tareas-vacio");
    var tareas = estado.tareas;
    $("#kpi-hoy").textContent = String(tareas.filter(function (t) { return !t.hecha && t.fecha === hoyISO(); }).length);
    $("#kpi-abiertas").textContent = String(tareas.filter(function (t) { return !t.hecha; }).length);
    $("#kpi-hechas").textContent = String(tareas.filter(function (t) { return t.hecha; }).length);
    if (!tareas.length) { lista.innerHTML = ""; vacio.hidden = false; return; }
    vacio.hidden = true;
    lista.innerHTML = tareas.map(function (t) {
      return '<div class="tarea-fila' + (estado.tareaSel === t.id ? " sel" : "") + '" data-tarea="' + t.id + '" role="button" tabindex="0">' +
        '<button class="tarea-check' + (t.hecha ? " hecha" : "") + '" type="button" data-check="' + t.id + '" aria-label="' +
        (t.hecha ? "Marcar abierta" : "Marcar hecha") + '">' + (t.hecha ? "✓" : "") + "</button>" +
        '<span class="tarea-nom' + (t.hecha ? " hecha" : "") + '">' + esc(t.titulo) + "</span>" +
        '<span class="tarea-meta">' + (t.fecha === hoyISO() ? "hoy" : esc(t.fecha || "sin fecha")) + "</span>" +
        '<span class="pill">' + (t.tipo === "proyecto" ? "proyecto" : "tarea") + "</span></div>";
    }).join("");
    $$("#tareas-lista [data-tarea]").forEach(function (fila) {
      fila.addEventListener("click", function () {
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
        var t = estado.tareas.filter(function (x) { return x.id === b.getAttribute("data-check"); })[0];
        if (!t) return;
        t.hecha = !t.hecha; guardar(); pintarTareas(); pintarPanel();
      });
    });
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
      var t = estado.tareas.filter(function (x) { return x.id === estado.tareaSel; })[0];
      var n = notaActual();
      if (t) {
        html = "<h2>Detalle de la tarea</h2><h3>" + esc(t.titulo) + '</h3><p class="panel__nota">' +
          (t.hecha ? "Hecha" : "Abierta") + " · " + esc(t.fecha || "sin fecha") +
          '</p><div class="panel__bloque"><span>Tipo</span><small>' +
          (t.tipo === "proyecto" ? "proyecto" : "tarea") + "</small></div>";
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
        calendario: ["0 eventos", "Sin eventos este mes."],
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
  }

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
    document.body.classList.add("panel-abierto");
    $("#btn-panel").setAttribute("aria-expanded", "true");
  }
  function cerrarPanel() {
    document.body.classList.remove("panel-abierto");
    $("#btn-panel").setAttribute("aria-expanded", "false");
  }
  function alternarPanel() {
    if (document.body.classList.contains("panel-abierto")) cerrarPanel(); else abrirPanel();
  }
  function alternarSplit() {
    if (window.innerWidth <= 1255) { aviso("La vista dividida necesita al menos 1256 px."); return; }
    splitOn = !splitOn;
    document.body.classList.toggle("split", splitOn);
    $("#contenido-b").hidden = !splitOn;
    $("#btn-split").setAttribute("aria-pressed", splitOn ? "true" : "false");
    if (splitOn) {
      pintarNotasLista("#notas-lista-b", true);
      if (pantalla === "calendario" || pantalla === "ajustes") ir("tareas");
    }
  }

  function init() {
    aplicarTema(estado.tema || "clasico");
    pintarTabs(); pintarCalendario(); pintarTareas(); pintarNotas();
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
        $$("#vista-tareas button").forEach(function (x) { x.classList.toggle("on", x === b); });
        aviso("Vista " + b.textContent + ": el árbol y el tablero llegan con M23/M25.");
      });
    });
    $("#btn-nueva-tarea").addEventListener("click", function () {
      $("#tarea-form").hidden = false; $("#tarea-titulo").focus();
    });
    $("#tareas-crear").addEventListener("click", function () {
      $("#tarea-form").hidden = false; $("#tarea-titulo").focus();
    });
    $("#tarea-cancelar").addEventListener("click", function () { $("#tarea-form").hidden = true; });
    $("#tarea-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var titulo = $("#tarea-titulo").value.trim();
      if (!titulo) return;
      estado.tareas.push({ id: "t" + Date.now(), titulo: titulo, hecha: false, tipo: "tarea", fecha: hoyISO(), creada: new Date().toISOString() });
      $("#tarea-titulo").value = "";
      $("#tarea-form").hidden = true;
      guardar(); pintarTareas(); pintarPanel();
      aviso("Tarea creada. El árbol y el tablero llegan con M23.");
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
    $("#btn-hoy").addEventListener("click", function () {
      aviso("Hoy es " + new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }) + ".");
    });
    $("#btn-periodo").addEventListener("click", function () { aviso("Periodo 2026-2 · el semestre lo declara el calendario."); });
    $("#btn-buscar").addEventListener("click", function () { aviso("Buscador global Ctrl+K: llega con M27."); });
    $("#btn-sync").addEventListener("click", function () { aviso("Guardado en este equipo. La sincronización es opcional."); });
    $("#btn-nuevo").addEventListener("click", function () {
      ir("tareas"); $("#tarea-form").hidden = false; $("#tarea-titulo").focus();
    });
    $("#btn-nuevo-evento").addEventListener("click", function () { aviso("Nuevo evento: el editor llega con M22."); });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); aviso("Buscador global Ctrl+K: llega con M27.");
      }
      if (e.key === "Escape") { cerrarModal(); cerrarPanel(); }
    });
    window.addEventListener("resize", function () {
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
