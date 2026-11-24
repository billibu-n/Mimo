/* selector-iconos.js — el único selector de iconos de Mimo.

   Se usa en dos formas, con la misma lógica y el mismo manifiesto:
     - en línea, dentro de la ventana de identidad de un ramo;
     - compacto, con vista previa y una ventana secundaria, para Progreso.
   En ambas se elige el paquete (nativo, KDE o uno importado), se busca, se filtra
   por categoría y se importa una carpeta de SVG. La atribución del paquete se
   muestra siempre debajo del selector.

   No guarda estado propio de negocio: recibe `valor` y avisa con `onCambio`.
   Los packs y su persistencia viven en iconos-pack.js. */
(function () {
  "use strict";

  var overlay = null, overlayFoco = null;

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function normal(v) {
    var s = String(v == null ? "" : v).toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s;
  }
  function L(es) { return es; }

  function packs() { return window.MimoIconosPack ? MimoIconosPack.packs() : []; }
  function packDe(id) { return window.MimoIconosPack ? MimoIconosPack.pack(id) : null; }
  function packInicial(valor) {
    if (window.MimoIconosPack) {
      var r = MimoIconosPack.resolver(valor);
      if (r.ok && r.pack) return r.pack.id;
      var a = MimoIconosPack.packActivo();
      return a ? a.id : "nativo";
    }
    return "nativo";
  }
  function opcionesPack(sel) {
    return packs().map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === sel ? " selected" : "") + ">" +
        esc(p.nombre) + "</option>";
    }).join("");
  }
  function categoriasDe(pack) {
    var vistas = {}, out = [];
    var nombres = {};
    if (window.MimoIconosRamo) {
      (MimoIconosRamo.CATEGORIAS || []).forEach(function (c) { nombres[c.id] = c.nombre; });
    }
    (pack ? pack.iconos : []).forEach(function (i) {
      if (!i.cat || vistas[i.cat]) return;
      vistas[i.cat] = 1;
      var n = nombres[i.cat];
      out.push({ id: i.cat, nombre: n && (n[document.documentElement.lang.slice(0, 2)] || n.es) || i.cat });
    });
    return out;
  }
  function credito(pack) {
    if (!pack) return "";
    if (window.MimoIconosPack) return MimoIconosPack.credito(pack);
    return [pack.procedencia, pack.licencia].filter(Boolean).join(" · ");
  }

  function filaPack(pack, idp) {
    return '<div class="sel-pack">' +
      '<label class="sel-pack__campo"><span>' + esc(L("Paquete de iconos")) + "</span>" +
        '<select id="' + idp + '-pack">' + opcionesPack(pack ? pack.id : "nativo") + "</select></label>" +
      '<label class="sel-pack__campo"><span>' + esc(L("Nombre del pack nuevo")) + "</span>" +
        '<input id="' + idp + '-nombre" type="text" maxlength="60" placeholder="' + esc(L("Mi pack")) + '" autocomplete="off"></label>' +
      '<button class="btn btn--chico" type="button" data-sel-importar>' + esc(L("+ Cargar carpeta")) + "</button>" +
      '<input id="' + idp + '-file" type="file" accept=".svg,image/svg+xml" webkitdirectory multiple hidden>' +
      '<p class="sel-pack__credito" id="' + idp + '-credito">' + esc(credito(pack)) + "</p>" +
      '<p class="sel-pack__estado" id="' + idp + '-estado" role="status" aria-live="polite"></p>' +
      "</div>";
  }

  function panelHTML(opts) {
    opts = opts || {};
    var idp = opts.idPrefijo || "selico";
    var pack = packDe(opts.pack) || packDe(packInicial(opts.valor));
    var cats = categoriasDe(pack);
    return filaPack(pack, idp) +
      '<input class="entrada ident-buscar" id="' + idp + '-buscar" type="search" placeholder="' +
        esc(L("Buscar icono")) + '" aria-label="' + esc(L("Buscar icono")) + '" autocomplete="off">' +
      '<div class="ident-filtros" role="group" aria-label="' + esc(L("Filtrar por categoría")) + '">' +
        '<button class="ident-cat on" type="button" data-sel-cat="todas" data-ident-cat="todas" aria-pressed="true">' + esc(L("Todas")) + "</button>" +
        cats.map(function (c) {
          return '<button class="ident-cat" type="button" data-sel-cat="' + esc(c.id) + '" data-ident-cat="' + esc(c.id) + '" aria-pressed="false">' + esc(c.nombre) + "</button>";
        }).join("") +
      "</div>" +
      '<div class="ident-iconos" id="' + idp + '-iconos" role="group" aria-label="' + esc(L("Iconos del paquete")) + '"></div>' +
      '<p class="ident-cuenta" id="' + idp + '-cuenta" role="status" aria-live="polite"></p>' +
      (opts.sinIcono ? '<button class="btn ident-sin" type="button" data-sel-sin data-ident-sin-icono aria-pressed="false">' + esc(L("Sin icono")) + "</button>" : "");
  }

  function montarPanel(raiz, opts) {
    opts = opts || {};
    var idp = opts.idPrefijo || "selico";
    if (typeof opts.L === "function") L = opts.L;
    var valor = String(opts.valor == null ? "" : opts.valor);
    var packId = packDe(opts.pack) ? opts.pack : packInicial(valor);
    var cat = "todas";
    var color = opts.color || "";

    if (!raiz) return null;
    raiz.innerHTML = panelHTML({ idPrefijo: idp, valor: valor, pack: packId, sinIcono: opts.sinIcono });

    var q = function (s) { return raiz.querySelector(s); };
    var sel = q("#" + idp + "-pack");
    var buscar = q("#" + idp + "-buscar");
    var caja = q("#" + idp + "-iconos");
    var cuenta = q("#" + idp + "-cuenta");
    var creditoEl = q("#" + idp + "-credito");
    var estadoEl = q("#" + idp + "-estado");
    var nombrePack = q("#" + idp + "-nombre");
    var file = q("#" + idp + "-file");
    var importar = q("[data-sel-importar]");
    var sin = q("[data-sel-sin],[data-ident-sin-icono]");

    function packActual() { return packDe(packId) || packDe("nativo"); }
    function pintarCats() {
      var cats = categoriasDe(packActual());
      var cajaCats = q(".ident-filtros");
      if (!cajaCats) return;
      cajaCats.innerHTML = '<button class="ident-cat' + (cat === "todas" ? " on" : "") + '" type="button" data-sel-cat="todas" data-ident-cat="todas" aria-pressed="' + (cat === "todas") + '">' + esc(L("Todas")) + "</button>" +
        cats.map(function (c) {
          return '<button class="ident-cat' + (cat === c.id ? " on" : "") + '" type="button" data-sel-cat="' + esc(c.id) + '" data-ident-cat="' + esc(c.id) + '" aria-pressed="' + (cat === c.id) + '">' + esc(c.nombre) + "</button>";
        }).join("");
    }
    function pintar() {
      var pack = packActual();
      var qq = normal(buscar.value);
      var lista = (pack ? pack.iconos : []).filter(function (i) {
        if (cat !== "todas" && i.cat !== cat) return false;
        if (!qq) return true;
        return normal(i.nombre + " " + (i.tags || []).join(" ") + " " + i.id).indexOf(qq) !== -1;
      });
      caja.innerHTML = lista.length ? lista.map(function (i) {
        var ref = pack.id === "nativo" ? i.id : pack.id + ":" + i.id;
        return '<button class="ident-ico" type="button" data-ident-icono="' + esc(ref) + '" aria-pressed="' + (ref === valor) +
          '" aria-label="' + esc(i.nombre) + '" title="' + esc(i.nombre) + '">' +
          (window.MimoIconosPack ? MimoIconosPack.html(ref, { clase: "ramo-ico", style: color ? "--ramo:" + color : "" }) : "") +
          '<span class="ident-ico__nom">' + esc(i.nombre) + "</span></button>";
      }).join("") : '<p class="muted ident-vacio">' + esc(L("Sin resultados en este paquete.")) + "</p>";
      cuenta.textContent = lista.length + " " + (lista.length === 1 ? L("icono") : L("iconos"));
      if (sin) sin.setAttribute("aria-pressed", valor ? "false" : "true");
      creditoEl.textContent = credito(pack);
    }
    function cambiarPack(id) {
      if (!packDe(id)) return;
      packId = id;
      cat = "todas";
      if (window.MimoIconosPack) MimoIconosPack.activarPack(id);
      pintarCats();
      pintar();
    }

    sel.addEventListener("change", function () { cambiarPack(sel.value); });
    buscar.addEventListener("input", pintar);
    raiz.addEventListener("click", function (e) {
      var b = e.target.closest("[data-sel-cat],[data-ident-cat]");
      if (b) {
        cat = b.getAttribute("data-sel-cat") || b.getAttribute("data-ident-cat");
        Array.prototype.forEach.call(raiz.querySelectorAll("[data-sel-cat],[data-ident-cat]"), function (x) {
          x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false");
        });
        pintar();
        return;
      }
      var ico = e.target.closest("[data-ident-icono]");
      if (ico && caja.contains(ico)) {
        valor = ico.getAttribute("data-ident-icono");
        Array.prototype.forEach.call(caja.querySelectorAll("[data-ident-icono]"), function (x) {
          x.setAttribute("aria-pressed", x === ico ? "true" : "false");
        });
        if (typeof opts.onCambio === "function") opts.onCambio(valor);
        if (opts.cerrarAlElegir) cerrarOverlay();
      }
    });
    if (sin) sin.addEventListener("click", function () {
      valor = "";
      pintar();
      if (typeof opts.onCambio === "function") opts.onCambio(valor);
      if (opts.cerrarAlElegir) cerrarOverlay();
    });
    if (importar) importar.addEventListener("click", function () { if (file) file.click(); });
    if (file) file.addEventListener("change", function () {
      if (!file.files || !file.files.length) return;
      var nombre = nombrePack && nombrePack.value.trim() ? nombrePack.value.trim() : L("Mi pack");
      if (estadoEl) estadoEl.textContent = L("Leyendo la carpeta…");
      importar.disabled = true;
      MimoIconosPack.importar(file.files, nombre).then(function (r) {
        packId = r.pack.id;
        sel.innerHTML = opcionesPack(packId);
        cat = "todas";
        pintarCats();
        pintar();
        if (estadoEl) estadoEl.textContent = r.agregados + " " + (r.agregados === 1 ? L("icono importado") : L("iconos importados")) +
          (r.descartados ? " · " + r.descartados + " " + L("descartados") : "");
        if (nombrePack) nombrePack.value = "";
        if (typeof opts.onPackImportado === "function") opts.onPackImportado(r.pack);
      }).catch(function (e) {
        if (estadoEl) estadoEl.textContent = (e && e.message) || L("No se pudo leer la carpeta.");
      }).then(function () { importar.disabled = false; file.value = ""; });
    });

    pintarCats();
    pintar();
    return {
      valor: function () { return valor; },
      pack: function () { return packId; },
      refrescar: function () { sel.innerHTML = opcionesPack(packId); pintarCats(); pintar(); }
    };
  }

  function campoHTML(opts) {
    opts = opts || {};
    var id = opts.id || "icono";
    var valor = String(opts.valor == null ? "" : opts.valor);
    var r = window.MimoIconosPack ? MimoIconosPack.resolver(valor) : null;
    var nombre = r && r.icono ? r.icono.nombre : L("Sin icono");
    var pack = r && r.pack ? r.pack.nombre : "";
    var prev = valor && window.MimoIconosPack ? MimoIconosPack.html(valor, { clase: "ramo-ico" }) : '<span class="sel-ico-campo__vacio">—</span>';
    return '<div class="sel-ico-campo-caja' + (opts.todo ? " todo" : "") + '">' +
      '<span class="sel-ico-campo__etq">' + esc(opts.etiqueta || L("Icono")) + "</span>" +
      '<button class="sel-ico-campo" type="button" data-sel-abrir>' +
        '<span class="sel-ico-campo__prev">' + prev + "</span>" +
        '<span class="sel-ico-campo__t"><b data-sel-nombre>' + esc(nombre) + "</b><small data-sel-pack>" + esc(pack) + "</small></span>" +
        '<span class="sel-ico-campo__accion">' + esc(L("Cambiar")) + "</span>" +
      "</button>" +
      '<input id="' + esc(id) + '" type="hidden" value="' + esc(valor) + '">' +
      "</div>";
  }

  function montarCampo(raiz, opts) {
    opts = opts || {};
    if (typeof opts.L === "function") L = opts.L;
    if (!raiz) return null;
    raiz.innerHTML = campoHTML(opts);
    var boton = raiz.querySelector("[data-sel-abrir]");
    var input = raiz.querySelector("input[type=hidden]");
    var prev = raiz.querySelector(".sel-ico-campo__prev");
    var nom = raiz.querySelector("[data-sel-nombre]");
    var pk = raiz.querySelector("[data-sel-pack]");
    function pintar(v) {
      var r = window.MimoIconosPack ? MimoIconosPack.resolver(v) : null;
      prev.innerHTML = v && window.MimoIconosPack ? MimoIconosPack.html(v, { clase: "ramo-ico" }) : '<span class="sel-ico-campo__vacio">—</span>';
      nom.textContent = r && r.icono ? r.icono.nombre : L("Sin icono");
      pk.textContent = r && r.pack ? r.pack.nombre : "";
    }
    boton.addEventListener("click", function () {
      abrirOverlay({
        valor: input.value,
        L: L,
        onElegir: function (v) {
          input.value = v;
          pintar(v);
          if (typeof opts.onCambio === "function") opts.onCambio(v);
        }
      });
    });
    return { valor: function () { return input.value; }, pintar: pintar };
  }

  function crearOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.className = "sel-ico-overlay";
    overlay.id = "sel-ico-overlay";
    overlay.hidden = true;
    overlay.innerHTML = '<div class="sel-ico-caja" role="dialog" aria-modal="true" aria-labelledby="sel-ico-tit">' +
      '<div class="sel-ico-cab"><h2 id="sel-ico-tit"></h2>' +
        '<button class="icono-btn" type="button" data-sel-cerrar aria-label="' + esc(L("Cerrar")) + '">×</button></div>' +
      '<div class="sel-ico-cuerpo" id="sel-ico-cuerpo"></div>' +
      '<div class="sel-ico-pie"><span class="crece"></span>' +
        '<button class="btn" type="button" data-sel-cerrar>' + esc(L("Cerrar")) + "</button></div></div>";
    document.body.appendChild(overlay);
    overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) cerrarOverlay(); });
    overlay.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrarOverlay(); return; }
      if (e.key !== "Tab") return;
      var piezas = overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled])');
      if (!piezas.length) return;
      var primero = piezas[0], ultimo = piezas[piezas.length - 1];
      if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
    });
    overlay.addEventListener("click", function (e) { if (e.target.closest("[data-sel-cerrar]")) cerrarOverlay(); });
    return overlay;
  }

  function abrirOverlay(opts) {
    opts = opts || {};
    if (typeof opts.L === "function") L = opts.L;
    var el = crearOverlay();
    overlayFoco = document.activeElement;
    el.querySelector("#sel-ico-tit").textContent = opts.titulo || L("Elegir icono");
    var cuerpo = el.querySelector("#sel-ico-cuerpo");
    cuerpo.innerHTML = "";
    montarPanel(cuerpo, {
      idPrefijo: "selico", valor: opts.valor, L: L, sinIcono: opts.sinIcono,
      cerrarAlElegir: true,
      onCambio: function (v) { if (typeof opts.onElegir === "function") opts.onElegir(v); }
    });
    el.hidden = false;
    var foco = el.querySelector("#selico-buscar");
    if (foco) foco.focus();
  }
  function cerrarOverlay() {
    if (!overlay || overlay.hidden) return;
    overlay.hidden = true;
    var cuerpo = overlay.querySelector("#sel-ico-cuerpo");
    if (cuerpo) cuerpo.innerHTML = "";
    if (overlayFoco && document.contains(overlayFoco) && overlayFoco.focus) overlayFoco.focus();
    overlayFoco = null;
  }

  window.MimoSelectorIconos = {
    panelHTML: panelHTML,
    montarPanel: montarPanel,
    campoHTML: campoHTML,
    montarCampo: montarCampo,
    abrir: abrirOverlay,
    cerrar: cerrarOverlay
  };
})();
