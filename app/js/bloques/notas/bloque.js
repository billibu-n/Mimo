/* bloque.js — bloque Notas: estado propio, vista, Markdown y ciclo de vida.
   Depende del núcleo por contexto; no llama funciones internas de otro bloque. */
(function () {
  "use strict";

  var C = null;
  var SIG = null;
  var notaBusqueda = "";
  var notaModo = "editar";

  function q(s) { return C ? C.$(s) : null; }
  function qq(s) { return C ? C.$$(s) : []; }
  function L(es, en, zh) { return C ? C.L(es, en, zh) : es; }
  function t(k) { return C ? C.t(k) : k; }
  function E() { return C ? C.estado : null; }

  function conservar(destino, origen) {
    Object.keys(origen || {}).forEach(function (k) {
      if (!(k in destino)) destino[k] = origen[k];
    });
    return destino;
  }

  function normalizarLista(lista) {
    return (Array.isArray(lista) ? lista : []).map(function (n, i) {
      return conservar({
        id: n.id || "n" + i,
        titulo: n.titulo || "Sin título",
        cuerpo: n.cuerpo || "",
        contexto: n.contexto || "",
        etiquetas: Array.isArray(n.etiquetas) ? n.etiquetas : (n.tags || []),
        enlaces: Array.isArray(n.enlaces) ? n.enlaces : [],
        fijada: !!n.fijada,
        actualizado: n.actualizado || ""
      }, n);
    });
  }

  function normalizarEstado(e) {
    if (!e) return;
    e.notas = normalizarLista(e.notas);
  }

  function porId(id) {
    var e = E();
    return e ? (e.notas || []).filter(function (n) { return n.id === id; })[0] || null : null;
  }

  function actual() {
    var e = E();
    return e ? (e.notas || []).filter(function (n) { return n.id === e.notaSel; })[0] || null : null;
  }

  function crear() {
    if (!C) return null;
    var n = {
      id: "n" + Date.now(), titulo: "Sin título", cuerpo: "", contexto: "", etiquetas: [],
      enlaces: [], fijada: false, actualizado: C.selloLocal()
    };
    E().notas.unshift(n);
    E().notaSel = n.id;
    C.guardar(); pintar(); C.pintarPanel();
    var campo = q("#nota-titulo");
    if (campo) { campo.focus(); campo.select(); }
    return n;
  }

  function abrir(id) {
    if (!C || !porId(id)) return;
    E().notaSel = id;
    E().panel.notas = "detalle";
    C.guardar();
    if (C.pantalla !== "notas") C.ir("notas");
    else { pintar(); C.pintarPanel(); }
    if (window.innerWidth <= 1255) C.abrirPanel();
  }

  function borrar(id) {
    if (!C) return;
    var n = porId(id); if (!n) return;
    var titulo = !n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo;
    if (!window.confirm(L("¿Borrar la nota \"" + titulo + "\"?", "Delete the note \"" + titulo + "\"?", "删除笔记“" + titulo + "”？"))) return;
    var copia = Object.assign({}, n), pos = E().notas.map(function (x) { return x.id; }).indexOf(id);
    E().notas = E().notas.filter(function (x) { return x.id !== id; });
    if (E().notaSel === id) E().notaSel = E().notas.length ? E().notas[0].id : null;
    C.guardar(); pintar(); C.pintarPanel();
    C.aviso(L("Nota borrada.", "Note deleted.", "笔记已删除。"), function () {
      E().notas.splice(Math.max(0, Math.min(pos, E().notas.length)), 0, copia);
      E().notaSel = copia.id; C.guardar(); pintar(); C.pintarPanel();
      C.aviso(L("Nota restaurada.", "Note restored.", "笔记已恢复。"));
    });
  }

  function marcarInline(txt) {
    var s = C.esc(txt);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }

  function renderMathHTML(html) {
    if (typeof window.renderMathInElement !== "function") return html;
    var cont = document.createElement("div");
    cont.innerHTML = html;
    try {
      window.renderMathInElement(cont, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "\\[", right: "\\]", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false }
        ],
        throwOnError: false,
        errorColor: "#b91c1c",
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"]
      });
    } catch (e) { /* si KaTeX falla, la nota sigue en texto plano */ }
    return cont.innerHTML;
  }

  function renderMarkdownBasico(txt) {
    var guardados = [];
    var fuente = String(txt || "").replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g, function (m) {
      guardados.push(m);
      return "@@MATH" + (guardados.length - 1) + "@@";
    });
    var lineas = fuente.split("\n"), out = [], lista = false;
    function cerrar() { if (lista) { out.push("</ul>"); lista = false; } }
    lineas.forEach(function (l) {
      var x = l.trim();
      if (!x) { cerrar(); return; }
      if (/^###\s+/.test(x)) { cerrar(); out.push("<h3>" + marcarInline(x.slice(4)) + "</h3>"); return; }
      if (/^##\s+/.test(x)) { cerrar(); out.push("<h2>" + marcarInline(x.slice(3)) + "</h2>"); return; }
      if (/^#\s+/.test(x)) { cerrar(); out.push("<h1>" + marcarInline(x.slice(2)) + "</h1>"); return; }
      if (/^[-*]\s+\[[ xX]\]\s+/.test(x)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        var m = x.match(/^[-*]\s+\[([ xX])\]\s+(.*)$/);
        out.push('<li class="check-item"><input type="checkbox" disabled ' + (m[1].toLowerCase() === "x" ? "checked" : "") + "> " + marcarInline(m[2]) + "</li>");
        return;
      }
      if (/^[-*]\s+/.test(x)) {
        if (!lista) { out.push("<ul>"); lista = true; }
        out.push("<li>" + marcarInline(x.slice(2)) + "</li>");
        return;
      }
      cerrar();
      out.push("<p>" + marcarInline(x) + "</p>");
    });
    cerrar();
    var html = out.join("").replace(/@@MATH(\d+)@@/g, function (_, i) {
      return C.esc(guardados[parseInt(i, 10)] || "");
    });
    return renderMathHTML(html);
  }

  function renderMarkdown(txt) {
    if (!window.marked || !window.DOMPurify) return renderMarkdownBasico(txt);
    var guardados = [];
    var fuente = String(txt || "").replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g, function (m) {
      guardados.push(m);
      return "@@MATH" + (guardados.length - 1) + "@@";
    });
    fuente = fuente.replace(/^([ \t]*)([-*+])\s+\[([ xX])\]\s+(.+)$/gm, function (_, ind, bullet, ch, texto) {
      return ind + bullet + ' <input type="checkbox" disabled' + (ch.toLowerCase() === "x" ? " checked" : "") + "> " + texto;
    });
    var renderer = new marked.Renderer();
    renderer.link = function (href, title, text) {
      var h = String(href || "").trim();
      if (!/^(https?:\/\/|mailto:|#)/i.test(h)) h = "#";
      return '<a href="' + C.esc(h) + '" target="_blank" rel="noopener noreferrer"' +
        (title ? ' title="' + C.esc(title) + '"' : "") + ">" + text + "</a>";
    };
    var html;
    try {
      html = marked.parse(fuente, { gfm: true, breaks: false, headerIds: false, mangle: false, renderer: renderer });
    } catch (e) {
      return renderMarkdownBasico(txt);
    }
    html = DOMPurify.sanitize(html, {
      ADD_ATTR: ["target", "rel", "checked", "disabled", "type", "class"],
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data:image\/)|#|\/|\.{1,2}\/|[^:]*$)/i
    });
    html = html.replace(/@@MATH(\d+)@@/g, function (_, i) {
      return C.esc(guardados[parseInt(i, 10)] || "");
    });
    return renderMathHTML(html);
  }

  function lista(destino, conClick) {
    if (!C) return;
    var cont = q(destino);
    if (!cont) return;
    var busq = notaBusqueda.toLowerCase();
    var vis = (E().notas || []).filter(function (n) {
      return !busq || (n.titulo + " " + n.cuerpo + " " + n.contexto + " " + n.etiquetas.join(" ")).toLowerCase().indexOf(busq) !== -1;
    }).sort(function (a, b) { return (b.fijada ? 1 : 0) - (a.fijada ? 1 : 0); });
    cont.innerHTML = vis.map(function (n) {
      return '<button class="nota-item' + (n.id === E().notaSel ? " on" : "") + '" type="button" data-nota="' + n.id + '" title="' + C.esc(t("cal.clicDerecho")) + '"><b>' +
        (n.fijada ? "★ " : "") + C.esc(!n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo) + "</b><small>" +
        C.esc((n.cuerpo || "").slice(0, 70) || L("Vacía", "Empty", "空白")) + (n.contexto ? " · " + C.esc(n.contexto) : "") + "</small></button>";
    }).join("");
    if (conClick) {
      qq(destino + " [data-nota]").forEach(function (b) {
        b.addEventListener("click", function () {
          var ctx = C.ctxDe(b);
          E().notaSel = b.getAttribute("data-nota");
          E().panel[ctx] = "detalle";
          C.guardar(); pintar(); C.pintarPanelDe(ctx);
        }, SIG ? { signal: SIG } : false);
      });
    }
  }

  function vinculoActual(n) {
    return n && n.enlaces && n.enlaces[0] ? n.enlaces[0].tipo + ":" + n.enlaces[0].id : "";
  }

  function aplicarFormato(tipo) {
    if (!C) return;
    var ta = q("#nota-cuerpo");
    if (!ta || ta.disabled || !actual()) return;
    var ini = ta.selectionStart, fin = ta.selectionEnd, val = ta.value, sel = val.slice(ini, fin);
    function cambiar(a, b, texto, cIni, cFin) {
      ta.value = val.slice(0, a) + texto + val.slice(b);
      ta.focus();
      ta.setSelectionRange(cIni, cFin);
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    }
    var par = { negrita: ["**", "**"], cursiva: ["*", "*"], subrayado: ["<u>", "</u>"], tachado: ["~~", "~~"] }[tipo];
    if (par) {
      var pre = par[0], post = par[1];
      if (sel.length >= pre.length + post.length && sel.indexOf(pre) === 0 && sel.slice(-post.length) === post) {
        var dentro = sel.slice(pre.length, sel.length - post.length);
        cambiar(ini, fin, dentro, ini, ini + dentro.length);
      } else {
        var texto = sel || L("texto", "text", "文本");
        cambiar(ini, fin, pre + texto + post, ini + pre.length, ini + pre.length + texto.length);
      }
      return;
    }
    if (tipo === "codigo") {
      if (sel.indexOf("\n") !== -1) {
        var bloque = "```\n" + sel + "\n```";
        cambiar(ini, fin, bloque, ini + 4, ini + 4 + sel.length);
      } else {
        var cod = sel || L("código", "code", "代码");
        cambiar(ini, fin, "`" + cod + "`", ini + 1, ini + 1 + cod.length);
      }
      return;
    }
    if (tipo === "h1" || tipo === "h2" || tipo === "h3") {
      var marca = { h1: "# ", h2: "## ", h3: "### " }[tipo];
      var linea = val.lastIndexOf("\n", ini - 1) + 1;
      if (val.slice(linea, linea + marca.length) === marca) {
        cambiar(linea, linea + marca.length, "", Math.max(linea, ini - marca.length), Math.max(linea, fin - marca.length));
      } else {
        cambiar(linea, linea, marca, ini + marca.length, fin + marca.length);
      }
      return;
    }
    if (tipo === "cita" || tipo === "lista" || tipo === "tarea") {
      var pref = tipo === "cita" ? "> " : tipo === "tarea" ? "- [ ] " : "- ";
      var desde = val.lastIndexOf("\n", ini - 1) + 1;
      var hasta = fin;
      if (desde === hasta) { hasta = val.indexOf("\n", fin); if (hasta < 0) hasta = val.length; }
      var lineas = val.slice(desde, hasta).split("\n").map(function (l) {
        return l.indexOf(pref) === 0 ? l.slice(pref.length) : pref + l;
      });
      var nuevo = lineas.join("\n");
      cambiar(desde, hasta, nuevo, desde, desde + nuevo.length);
      return;
    }
    if (tipo === "tabla") {
      var col = L("Columna", "Column", "列"), celda = L("Texto", "Text", "文本");
      var tabla = "| " + col + " | " + col + " |\n| --- | --- |\n| " + celda + " | " + celda + " |\n";
      cambiar(ini, fin, tabla, ini + tabla.length, ini + tabla.length);
    }
  }

  function pintar() {
    if (!C) return;
    normalizarEstado(E());
    lista("#notas-items", true);
    lista("#notas-lista-b", true);
    var vacio = q("#notas-vacio"); if (vacio) vacio.hidden = E().notas.length > 0;
    var n = actual();
    ["#nota-titulo", "#nota-cuerpo", "#nota-contexto", "#nota-etiquetas", "#nota-vinculo", "#nota-modo", "#nota-fijar", "#btn-borrar-nota"].forEach(function (sel) {
      var el = q(sel); if (el) el.disabled = !n;
    });
    var formato = q("#nota-formato"); if (formato) formato.hidden = !n || notaModo === "preview";
    qq("#nota-formato [data-formato]").forEach(function (b) { b.disabled = !n; });
    if (q("#nota-titulo")) q("#nota-titulo").value = n ? n.titulo : "";
    if (q("#nota-cuerpo")) q("#nota-cuerpo").value = n ? n.cuerpo : "";
    if (q("#nota-contexto")) q("#nota-contexto").value = n ? n.contexto : "";
    if (q("#nota-etiquetas")) q("#nota-etiquetas").value = n ? n.etiquetas.join(", ") : "";
    if (q("#nota-fijar")) {
      q("#nota-fijar").textContent = n && n.fijada ? L("Fijada", "Pinned", "已置顶") : L("Fijar", "Pin", "置顶");
      q("#nota-fijar").setAttribute("aria-pressed", n && n.fijada ? "true" : "false");
    }
    var sel = q("#nota-vinculo");
    if (sel) {
      var ops = ['<option value="">' + C.esc(L("Enlazar a…", "Link to…", "链接到…")) + '</option>'];
      (E().tareas || []).forEach(function (x) { ops.push('<option value="tarea:' + x.id + '">' + C.esc(L("Tarea", "Task", "任务")) + " · " + C.esc(x.titulo) + "</option>"); });
      (E().eventos || []).forEach(function (ev) { ops.push('<option value="evento:' + ev.id + '">' + C.esc(L("Evento", "Event", "事件")) + " · " + C.esc(ev.titulo) + "</option>"); });
      sel.innerHTML = ops.join("");
      sel.value = n ? vinculoActual(n) : "";
    }
    if (q("#nota-modo")) q("#nota-modo").textContent = notaModo === "preview" ? L("Editar", "Edit", "编辑") : L("Vista previa", "Preview", "预览");
    if (q("#nota-cuerpo")) q("#nota-cuerpo").hidden = notaModo === "preview";
    if (q("#nota-preview")) {
      q("#nota-preview").hidden = notaModo !== "preview";
      q("#nota-preview").innerHTML = notaModo === "preview" && n ? renderMarkdown(n.cuerpo) : "";
    }
    if (q("#nota-meta")) q("#nota-meta").textContent = n ? L("Guardada en este equipo · ", "Saved on this device · ", "已保存到本设备 · ") + n.actualizado : L("Sin nota abierta.", "No note open.", "没有打开的笔记。");
  }

  function on(root, sel, evento, fn) {
    var el = root.querySelector(sel);
    if (!el) return;
    el.addEventListener(evento, fn, SIG ? { signal: SIG } : false);
  }

  function montar(api) {
    C = api.ctx;
    SIG = api.signal;
    api.pintar = pintar;
    var root = api.root;
    on(root, "#btn-nueva-nota", "click", crear);
    on(root, "#btn-borrar-nota", "click", function () { if (E().notaSel) borrar(E().notaSel); });
    on(root, "#buscar-nota", "input", function (e) {
      notaBusqueda = e.target.value; lista("#notas-items", true);
    });
    on(root, "#nota-titulo", "input", function (e) {
      var n = actual(); if (!n) return;
      n.titulo = e.target.value; n.actualizado = C.selloLocal(); C.guardar();
    });
    on(root, "#nota-titulo", "change", function () { lista("#notas-items", true); C.pintarPanel(); });
    on(root, "#nota-cuerpo", "input", function (e) {
      var n = actual(); if (!n) return;
      n.cuerpo = e.target.value; n.actualizado = C.selloLocal();
      C.guardar(); lista("#notas-items", true); C.pintarPanel();
    });
    on(root, "#nota-cuerpo", "keydown", function (e) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      var atajo = { b: "negrita", i: "cursiva", u: "subrayado" }[String(e.key || "").toLowerCase()];
      if (!atajo) return;
      e.preventDefault(); aplicarFormato(atajo);
    });
    root.querySelectorAll("#nota-formato [data-formato]").forEach(function (b) {
      b.addEventListener("click", function () { aplicarFormato(b.getAttribute("data-formato")); }, SIG ? { signal: SIG } : false);
    });
    on(root, "#nota-modo", "click", function () { notaModo = notaModo === "preview" ? "editar" : "preview"; pintar(); });
    on(root, "#nota-fijar", "click", function () {
      var n = actual(); if (!n) return;
      n.fijada = !n.fijada; C.guardar(); pintar(); C.pintarPanel();
    });
    on(root, "#nota-contexto", "input", function (e) {
      var n = actual(); if (!n) return;
      n.contexto = e.target.value; C.guardar(); lista("#notas-items", true); C.pintarPanel();
    });
    on(root, "#nota-etiquetas", "input", function (e) {
      var n = actual(); if (!n) return;
      n.etiquetas = e.target.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      C.guardar(); lista("#notas-items", true); C.pintarPanel();
    });
    on(root, "#nota-vinculo", "change", function (e) {
      var n = actual(); if (!n) return;
      var v = e.target.value, tipo = v.split(":")[0], id = v.split(":")[1];
      if (!v) n.enlaces = [];
      else {
        var titulo = "";
        if (tipo === "tarea") { var x = C.tareaPorId(id); titulo = x ? x.titulo : ""; }
        else { var ev = C.eventoPorId(id); titulo = ev ? ev.titulo : ""; }
        n.enlaces = [{ tipo: tipo, id: id, titulo: titulo }];
      }
      C.guardar(); pintar(); C.pintarPanel();
    });
  }

  function desmontar() {
    C = null;
    SIG = null;
  }

  window.MimoBloqueNotas = {
    normalizarEstado: normalizarEstado,
    normalizar: function () { normalizarEstado(E()); },
    pintar: pintar,
    montar: montar,
    desmontar: desmontar,
    crear: crear,
    abrir: abrir,
    borrar: borrar,
    porId: porId,
    actual: actual,
    renderMarkdown: function (txt) { return C ? renderMarkdown(txt) : ""; },
    buscar: function (consulta, out) {
      var low = String(consulta || "").toLowerCase().trim();
      if (!low || !C) return;
      (E().notas || []).forEach(function (n) {
        var texto = [n.titulo, n.cuerpo, n.contexto, (n.etiquetas || []).join(" ")].join(" ");
        if (texto.toLowerCase().indexOf(low) === -1) return;
        out.push({
          tipo: L("Nota", "Note", "笔记"),
          titulo: n.titulo || L("Sin título", "Untitled", "无标题"),
          sub: (n.contexto || L("Sin contexto", "No context", "无情境")) + " · " + ((n.cuerpo || "").slice(0, 45) || L("Vacía", "Empty", "空白")),
          run: function () { abrir(n.id); }
        });
      });
    },
    panel: function () {
      var n = actual();
      if (!n) return null;
      return "<h2>" + C.esc(L("Detalle de la nota", "Note details", "笔记详情")) + "</h2><h3>" + (n.fijada ? "★ " : "") + C.esc(!n.titulo || n.titulo === "Sin título" ? L("Sin título", "Untitled", "无标题") : n.titulo) +
        '</h3><p class="panel__nota">' + C.esc((n.cuerpo || "").slice(0, 240) || L("Vacía", "Empty", "空白")) + "</p>" +
        (n.contexto ? '<div class="panel__bloque"><span>' + C.esc(L("Contexto", "Context", "情境")) + '</span><small>' + C.esc(n.contexto) + "</small></div>" : "") +
        (n.etiquetas.length ? '<div class="panel__bloque"><span>' + C.esc(L("Etiquetas", "Tags", "标签")) + '</span><small>' + C.esc(n.etiquetas.join(", ")) + "</small></div>" : "") +
        (n.enlaces.length ? '<div class="panel__bloque"><span>' + C.esc(L("Enlazada a", "Linked to", "链接到")) + '</span><small><button class="btn btn--chico" type="button" data-abrir-enlace="' + C.esc(n.enlaces[0].tipo) + ':' + C.esc(n.enlaces[0].id) + '">' + C.esc(n.enlaces[0].titulo) + "</button></small></div>" : "") +
        '<div class="fila" style="margin-top:10px"><button class="btn btn--chico" type="button" data-abrir-nota="' + n.id + '">' + C.esc(L("Abrir", "Open", "打开")) + '</button>' +
        '<button class="btn btn--chico btn-peligro" type="button" data-borrar-nota="' + n.id + '">' + C.esc(L("Borrar", "Delete", "删除")) + "</button></div>";
    }
  };
})();
