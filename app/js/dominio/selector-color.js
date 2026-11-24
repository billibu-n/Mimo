/* selector-color.js — color por RGB y paleta, con vista previa.

   Un solo componente para el color de una meta:
     - tres campos R/G/B (0–255) que escriben un `#rrggbb`;
     - una ventana secundaria de colores predefinidos (tokens del tema y la
       paleta de identidad), más simple que mover tres números;
     - vista previa del resultado: muestra "Aa" sobre el color y una barra.
   El valor vive en un input oculto; quien lo usa lee ese campo al guardar.
   No guarda estado propio ni conoce el dominio. */
(function () {
  "use strict";

  var L = function (es) { return es; };
  var TOKENS = [
    { v: "--ac", n: "Azul" }, { v: "--ok", n: "Verde" }, { v: "--warn", n: "Ámbar" },
    { v: "--q", n: "Violeta" }, { v: "--bad", n: "Rojo" }
  ];

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function hex(v) { return /^#[0-9a-f]{6}$/i.test(String(v == null ? "" : v)) ? String(v).toLowerCase() : ""; }
  function rgb(hexv) {
    var h = hex(hexv).slice(1);
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function deRgb(r, g, b) {
    function dos(n) { n = Math.max(0, Math.min(255, Math.round(Number(n) || 0))); return (n < 16 ? "0" : "") + n.toString(16); }
    return "#" + dos(r) + dos(g) + dos(b);
  }
  function aHex(valor) {
    var v = String(valor || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(v)) {
      return ("#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3]).toLowerCase();
    }
    var m = v.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (m) return deRgb(m[1], m[2], m[3]);
    return "";
  }
  function token(nombre) {
    try {
      var v = getComputedStyle(document.body).getPropertyValue(nombre).trim();
      return aHex(v);
    } catch (e) { return ""; }
  }
  function contraste(hexv) {
    var c = rgb(hexv), l = 0;
    c.forEach(function (x) {
      x /= 255; l += x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    // Aproximación de luminancia relativa con los tres canales.
    return l > 0.5 ? "#111111" : "#ffffff";
  }
  function paleta() {
    var out = [], vistos = {};
    TOKENS.forEach(function (t) {
      var h = token(t.v);
      if (!h || vistos[h]) return;
      vistos[h] = 1;
      out.push({ hex: h, nombre: L(t.n) });
    });
    (window.MimoIdentidad && MimoIdentidad.PALETA ? MimoIdentidad.PALETA : []).forEach(function (h) {
      h = aHex(h);
      if (!h || vistos[h]) return;
      vistos[h] = 1;
      out.push({ hex: h, nombre: h });
    });
    return out;
  }
  function vistaHTML(valor) {
    var h = hex(valor) || "#2563eb";
    var t = contraste(h);
    return '<span class="sel-color__prev" data-prev style="--sel:' + esc(h) + ';--sel-txt:' + esc(t) + '">' +
      '<span class="sel-color__aa">Aa</span></span>';
  }
  function swatchesHTML(actual) {
    return paleta().map(function (c) {
      return '<button class="sel-color__sw" type="button" data-color="' + esc(c.hex) + '" style="--sw:' + esc(c.hex) +
        '" title="' + esc(c.nombre) + '" aria-label="' + esc(c.nombre) + '" aria-pressed="' + (c.hex === hex(actual)) + '"></button>';
    }).join("");
  }
  function campoHTML(opts) {
    opts = opts || {};
    var id = opts.id || "color";
    var valor = hex(opts.valor) || "#2563eb";
    var r = rgb(valor);
    return '<div class="sel-color-caja' + (opts.todo ? " todo" : "") + '">' +
      '<span class="sel-color__etq">' + esc(opts.etiqueta || L("Color")) + "</span>" +
      '<div class="sel-color">' +
        vistaHTML(valor) +
        '<div class="sel-color__rgb">' +
          '<label class="sel-color__num">R<input type="number" min="0" max="255" step="1" data-r value="' + r[0] + '" aria-label="' + esc(L("Rojo")) + '"></label>' +
          '<label class="sel-color__num">G<input type="number" min="0" max="255" step="1" data-g value="' + r[1] + '" aria-label="' + esc(L("Verde")) + '"></label>' +
          '<label class="sel-color__num">B<input type="number" min="0" max="255" step="1" data-b value="' + r[2] + '" aria-label="' + esc(L("Azul")) + '"></label>' +
        "</div>" +
        '<button class="btn btn--chico" type="button" data-paleta aria-expanded="false">' + esc(L("Paleta")) + "</button>" +
        '<span class="sel-color__hex" data-hex>' + esc(valor) + "</span>" +
        '<div class="sel-color__pop" data-pop hidden>' +
          '<div class="sel-color__pop-tit">' + esc(L("Colores predefinidos")) + "</div>" +
          '<div class="sel-color__sws">' + swatchesHTML(valor) + "</div>" +
        "</div>" +
      "</div>" +
      '<input id="' + esc(id) + '" type="hidden" value="' + esc(valor) + '">' +
      "</div>";
  }

  function montar(raiz, opts) {
    opts = opts || {};
    if (typeof opts.L === "function") L = opts.L;
    if (!raiz) return null;
    var valor = hex(opts.valor) || "#2563eb";
    raiz.innerHTML = campoHTML({ id: opts.id || "color", valor: valor, L: L, etiqueta: opts.etiqueta, todo: opts.todo });
    var input = raiz.querySelector("input[type=hidden]");
    var prev = raiz.querySelector("[data-prev]");
    var hexEl = raiz.querySelector("[data-hex]");
    var pop = raiz.querySelector("[data-pop]");
    var botonPaleta = raiz.querySelector("[data-paleta]");
    var r = raiz.querySelector("[data-r]"), g = raiz.querySelector("[data-g]"), b = raiz.querySelector("[data-b]");

    function pintar(v, desde) {
      v = hex(v) || "#2563eb";
      valor = v;
      input.value = v;
      var c = rgb(v);
      if (desde !== "r") r.value = c[0];
      if (desde !== "g") g.value = c[1];
      if (desde !== "b") b.value = c[2];
      prev.style.setProperty("--sel", v);
      prev.style.setProperty("--sel-txt", contraste(v));
      hexEl.textContent = v;
      raiz.querySelectorAll("[data-color]").forEach(function (x) {
        x.setAttribute("aria-pressed", x.getAttribute("data-color") === v ? "true" : "false");
      });
      if (typeof opts.onCambio === "function") opts.onCambio(v);
    }
    function deEntradas(desde) {
      pintar(deRgb(r.value, g.value, b.value), desde);
    }
    r.addEventListener("input", function () { deEntradas("r"); });
    g.addEventListener("input", function () { deEntradas("g"); });
    b.addEventListener("input", function () { deEntradas("b"); });
    raiz.addEventListener("click", function (e) {
      var sw = e.target.closest("[data-color]");
      if (sw) {
        pintar(sw.getAttribute("data-color"));
        pop.hidden = true;
        botonPaleta.setAttribute("aria-expanded", "false");
        return;
      }
    });
    botonPaleta.addEventListener("click", function () {
      pop.hidden = !pop.hidden;
      botonPaleta.setAttribute("aria-expanded", pop.hidden ? "false" : "true");
      if (!pop.hidden) {
        var primero = pop.querySelector("[data-color]");
        if (primero) primero.focus();
      }
    });
    raiz.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !pop.hidden) {
        e.preventDefault();
        pop.hidden = true;
        botonPaleta.setAttribute("aria-expanded", "false");
        botonPaleta.focus();
      }
    });
    r.addEventListener("blur", function () { r.value = rgb(valor)[0]; });
    g.addEventListener("blur", function () { g.value = rgb(valor)[1]; });
    b.addEventListener("blur", function () { b.value = rgb(valor)[2]; });
    return { valor: function () { return valor; }, pintar: pintar };
  }

  window.MimoSelectorColor = {
    campoHTML: campoHTML,
    montar: montar,
    token: token,
    hex: hex,
    aHex: aHex,
    paleta: paleta
  };
})();
