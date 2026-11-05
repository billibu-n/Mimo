/* editor-md.js — el editor Markdown de Mimo, en un solo sitio.
   Notas y el modal de Tareas comparten este motor: la misma sintaxis, la misma
   barra de formato, el mismo saneado y el mismo renderizado (marked + DOMPurify
   + KaTeX). Antes vivía dentro de Notas; se extrajo para no tener dos editores
   que se parecen pero no son iguales. */
(function () {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function marcarInline(txt) {
    var s = esc(txt);
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
    } catch (e) { /* si KaTeX falla, el texto sigue en plano */ }
    return cont.innerHTML;
  }

  function guardarMatematicas(txt) {
    var guardados = [];
    var fuente = String(txt || "").replace(/\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)/g, function (m) {
      guardados.push(m);
      return "@@MATH" + (guardados.length - 1) + "@@";
    });
    return { fuente: fuente, guardados: guardados };
  }

  function restituirMatematicas(html, guardados) {
    return html.replace(/@@MATH(\d+)@@/g, function (_, i) {
      return esc(guardados[parseInt(i, 10)] || "");
    });
  }

  function renderMarkdownBasico(txt) {
    var g = guardarMatematicas(txt);
    var lineas = g.fuente.split("\n"), out = [], lista = false;
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
    return renderMathHTML(restituirMatematicas(out.join(""), g.guardados));
  }

  function renderMarkdown(txt) {
    if (!window.marked || !window.DOMPurify) return renderMarkdownBasico(txt);
    var g = guardarMatematicas(txt);
    var fuente = g.fuente.replace(/^([ \t]*)([-*+])\s+\[([ xX])\]\s+(.+)$/gm, function (_, ind, bullet, ch, texto) {
      return ind + bullet + ' <input type="checkbox" disabled' + (ch.toLowerCase() === "x" ? " checked" : "") + "> " + texto;
    });
    var renderer = new marked.Renderer();
    renderer.link = function (href, title, text) {
      var h = String(href || "").trim();
      if (!/^(https?:\/\/|mailto:|#)/i.test(h)) h = "#";
      return '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer"' +
        (title ? ' title="' + esc(title) + '"' : "") + ">" + text + "</a>";
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
    return renderMathHTML(restituirMatematicas(html, g.guardados));
  }

  /* Aplica un formato sobre la selección de un textarea. Es el mismo motor que
     usa Notas; `L` solo aporta las palabras de relleno («texto», «código»…). */
  function aplicarFormato(ta, tipo, L) {
    if (!ta || ta.disabled) return;
    L = typeof L === "function" ? L : function (es) { return es; };
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

  var BOTONES = [
    ["h1", "H1", ["Título 1", "Heading 1", "一级标题"]],
    ["h2", "H2", ["Título 2", "Heading 2", "二级标题"]],
    ["h3", "H3", ["Título 3", "Heading 3", "三级标题"]],
    ["negrita", "<b>B</b>", ["Negrita (Ctrl+B)", "Bold (Ctrl+B)", "粗体 (Ctrl+B)"]],
    ["cursiva", "<i>I</i>", ["Cursiva (Ctrl+I)", "Italic (Ctrl+I)", "斜体 (Ctrl+I)"]],
    ["subrayado", "<u>U</u>", ["Subrayado (Ctrl+U)", "Underline (Ctrl+U)", "下划线 (Ctrl+U)"]],
    ["tachado", "<s>S</s>", ["Tachado", "Strikethrough", "删除线"]],
    ["codigo", "&lt;/&gt;", ["Código", "Code", "代码"]],
    ["cita", "❝", ["Cita", "Quote", "引用"]],
    ["lista", "•", ["Lista", "List", "列表"]],
    ["tarea", "☑", ["Tarea", "Task", "任务"]],
    ["tabla", "▦", ["Tabla", "Table", "表格"]]
  ];

  /* La barra es la misma de Notas: mismos botones y mismos data-formato. */
  function toolbarHTML(L) {
    L = typeof L === "function" ? L : function (es) { return es; };
    return BOTONES.map(function (b) {
      var titulo = L(b[2][0], b[2][1], b[2][2]);
      return '<button class="btn btn--chico" type="button" data-formato="' + b[0] + '" title="' + esc(titulo) +
        '" aria-label="' + esc(titulo) + '">' + b[1] + "</button>";
    }).join("");
  }

  /* Campo completo (etiqueta, barra, textarea y vista previa) para meter en el
     modal: no se declara HTML a mano en cada editor. */
  function campoHTML(o) {
    o = o || {};
    var L = typeof o.L === "function" ? o.L : function (es) { return es; };
    var id = esc(o.id || "editor-md");
    var et = esc(o.etiqueta || L("Descripción", "Description", "描述"));
    var ph = esc(o.ph || L("Escribe en Markdown. Fórmulas: $...$ o $$...$$", "Write in Markdown. Formulas: $...$ or $$...$$", "用 Markdown 书写。公式：$...$ 或 $$...$$"));
    return '<div class="campo editor-md" data-editor-md="' + id + '">' +
      "<span>" + et + "</span>" +
      '<div class="nota-formato" role="toolbar" aria-label="' + et + '">' + toolbarHTML(o.L) + "</div>" +
      '<textarea class="nota-cuerpo editor-md__campo" id="' + id + '" rows="' + (o.filas || 6) + '" placeholder="' + ph + '" autocomplete="off"></textarea>' +
      '<div class="nota-preview editor-md__vista" hidden></div>' +
      '<div class="fila editor-md__pie"><button class="btn btn--chico" type="button" data-md-vista>' +
      esc(L("Vista previa", "Preview", "预览")) + '</button><small class="muted">' +
      esc(L("Markdown, tablas y fórmulas con el mismo motor de Notas.", "Markdown, tables and formulas with the same engine as Notes.", "与笔记相同的 Markdown、表格和公式引擎。")) +
      "</small></div></div>";
  }

  /* Monta un campo ya dibujado: barra, atajos y vista previa. */
  function montar(root, opts) {
    opts = opts || {};
    var caja = root && root.querySelector('[data-editor-md="' + (opts.id || "editor-md") + '"]');
    if (!caja) return null;
    var ta = caja.querySelector(".editor-md__campo");
    var vista = caja.querySelector(".editor-md__vista");
    var btnVista = caja.querySelector("[data-md-vista]");
    var L = typeof opts.L === "function" ? opts.L : function (es) { return es; };
    if (opts.valor != null && ta) ta.value = String(opts.valor);
    caja.querySelectorAll("[data-formato]").forEach(function (b) {
      b.addEventListener("click", function () { aplicarFormato(ta, b.getAttribute("data-formato"), L); });
    });
    if (ta) {
      ta.addEventListener("keydown", function (e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        var atajo = { b: "negrita", i: "cursiva", u: "subrayado" }[String(e.key || "").toLowerCase()];
        if (!atajo) return;
        e.preventDefault();
        aplicarFormato(ta, atajo, L);
      });
      ta.addEventListener("input", function () { if (vista && !vista.hidden) vista.innerHTML = renderMarkdown(ta.value); });
    }
    if (btnVista && ta && vista) {
      btnVista.addEventListener("click", function () {
        var ver = vista.hidden;
        vista.hidden = !ver;
        ta.hidden = ver;
        btnVista.textContent = ver ? L("Editar", "Edit", "编辑") : L("Vista previa", "Preview", "预览");
        if (ver) vista.innerHTML = renderMarkdown(ta.value);
        else ta.focus();
      });
    }
    return {
      valor: function () { return ta ? ta.value : ""; },
      fijar: function (v) { if (ta) ta.value = String(v == null ? "" : v); if (vista && !vista.hidden) vista.innerHTML = renderMarkdown(ta.value); },
      campo: ta,
      vista: vista
    };
  }

  window.MimoEditorMD = {
    renderMarkdown: renderMarkdown,
    aplicarFormato: aplicarFormato,
    toolbarHTML: toolbarHTML,
    campoHTML: campoHTML,
    montar: montar
  };
})();
