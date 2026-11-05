/* modal.js — la única ventana de edición de Mimo.

   Antes cada sección abría su propio formulario dentro de la ventana (el patrón
   de Mimo Académics que resultaba poco intuitivo): siete formularios, siete
   juegos de botones y siete maneras de cerrar. Aquí hay una sola: `MimoModal`
   dibuja la ventana, pone el título, los campos, Guardar/Cancelar, y se encarga
   del Escape, del foco y de devolverlo al cerrar.

   No conoce el estado de la app ni los datos: recibe los campos ya resueltos y
   una función `onGuardar` que devuelve `false` si la validación falla (entonces
   la ventana se queda abierta). Los textos llegan ya traducidos desde el shell,
   que es quien tiene el idioma (L / MIMO_I18N). */
(function () {
  "use strict";

  var capa = null, form = null, caja = null, campos = null, tituloEl = null, subEl = null;
  var btnGuardar = null, btnCancelar = null, btnBorrar = null, btnX = null;
  var conf = null, focoPrevio = null, idPrevio = "";
  var TEXTOS = { guardar: "Guardar", cancelar: "Cancelar", cerrar: "Cerrar", borrar: "Borrar" };

  function $(sel) { return document.querySelector(sel); }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* Un campo se declara con datos, no con HTML: así todos los editores se ven
     igual y no hay una plantilla distinta por vista. */
  function campoHTML(c) {
    var id = esc(c.id);
    var et = esc(c.etiqueta || "");
    var val = c.valor == null ? "" : c.valor;
    var ayuda = c.ayuda ? '<small class="muted">' + esc(c.ayuda) + "</small>" : "";
    var tipo = c.tipo || "text";

    /* Un campo puede traer su propio HTML (el editor Markdown, la fecha con
       atajos, el bloque de recurrencia). El modal solo lo coloca. */
    if (tipo === "html") return c.html || "";
    if (tipo === "check") {
      return '<label class="check"><input type="checkbox" id="' + id + '"' + (val ? " checked" : "") + "> <span>" + et + "</span></label>";
    }
    if (tipo === "select") {
      var ops = (c.opciones || []).map(function (o) {
        return '<option value="' + esc(o.v) + '"' + (String(o.v) === String(val) ? " selected" : "") + ">" + esc(o.t) + "</option>";
      }).join("");
      return '<label class="campo" for="' + id + '"><span>' + et + '</span><select class="entrada" id="' + id + '">' + ops + "</select>" + ayuda + "</label>";
    }
    if (tipo === "textarea") {
      return '<label class="campo" for="' + id + '"><span>' + et + '</span><textarea class="entrada" id="' + id + '" rows="' +
        esc(c.filas || 4) + '"' + (c.ph ? ' placeholder="' + esc(c.ph) + '"' : "") + ">" + esc(val) + "</textarea>" + ayuda + "</label>";
    }

    var extra = "";
    if (c.ph) extra += ' placeholder="' + esc(c.ph) + '"';
    if (c.min != null) extra += ' min="' + esc(c.min) + '"';
    if (c.max != null) extra += ' max="' + esc(c.max) + '"';
    if (c.paso != null) extra += ' step="' + esc(c.paso) + '"';
    if (c.lista) extra += ' list="' + esc(c.lista) + '"';
    if (c.inputmode) extra += ' inputmode="' + esc(c.inputmode) + '"';
    if (tipo === "color") extra += ' value="' + esc(val || "#2563eb") + '"';
    else extra += ' value="' + esc(val) + '"';
    if (c.deshabilitado) extra += " disabled";
    return '<label class="campo" for="' + id + '"><span>' + et + '</span><input class="entrada" id="' + id + '" type="' +
      esc(tipo) + '"' + extra + ' autocomplete="off">' + ayuda + "</label>";
  }

  function construir() {
    if (capa) return;
    capa = $("#modal-editor");
    if (!capa) return;
    form = $("#modal-form");
    caja = capa.querySelector(".modal__caja");
    campos = $("#modal-campos");
    tituloEl = $("#modal-editor-tit");
    subEl = $("#modal-editor-sub");
    btnGuardar = $("#modal-guardar");
    btnCancelar = $("#modal-cancelar");
    btnBorrar = $("#modal-borrar");
    btnX = $("#modal-editor-x");

    btnX.addEventListener("click", function () { cerrar("cancelar"); });
    btnCancelar.addEventListener("click", function () { cerrar("cancelar"); });
    capa.addEventListener("mousedown", function (e) { if (e.target === capa) { cerrar("cancelar"); } });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!conf || typeof conf.onGuardar !== "function") return;
      if (conf.onGuardar(form) === false) return;
      cerrar("guardar");
    });
    btnBorrar.addEventListener("click", function () {
      if (!conf || !conf.borrar) return;
      var accion = conf.borrar.run;
      cerrar("guardar");
      if (typeof accion === "function") accion();
    });
  }

  function abierto() { return !!(capa && capa.classList.contains("on")); }

  function abrir(c) {
    construir();
    if (!capa) return;
    conf = c || {};
    idPrevio = conf.id || "";
    capa.setAttribute("data-editor", idPrevio);
    tituloEl.textContent = conf.titulo || "";
    subEl.textContent = conf.sub || "";
    subEl.hidden = !conf.sub;
    campos.innerHTML = conf.campos ? conf.campos.map(function (c) {
      var html = campoHTML(c);
      if (!c.ancho) return html;
      return '<div class="campo-celda' + (c.ancho === "todo" ? " campo-celda--todo" : " campo-celda--mitad") + '">' + html + "</div>";
    }).join("") : (conf.html || "");
    campos.classList.toggle("modal-campos--dos", !!conf.columnas);
    caja.classList.toggle("modal-editor-caja--ancho", conf.ancho === "ancho");
    btnGuardar.textContent = conf.guardar || TEXTOS.guardar;
    btnCancelar.textContent = conf.cancelar || TEXTOS.cancelar;
    btnBorrar.hidden = !conf.borrar;
    if (conf.borrar) btnBorrar.textContent = conf.borrar.texto || TEXTOS.borrar;
    btnX.setAttribute("title", TEXTOS.cerrar);
    btnX.setAttribute("aria-label", TEXTOS.cerrar);
    if (!abierto()) focoPrevio = document.activeElement;
    capa.classList.add("on");
    document.body.classList.add("modal-abierto");
    if (typeof conf.despues === "function") conf.despues(form);
    var primero = form.querySelector("input:not([type=hidden]):not([disabled]), select, textarea");
    if (primero) { primero.focus(); if (conf.seleccionar !== false && primero.select) { try { primero.select(); } catch (e) {} } }
    else btnGuardar.focus();
  }

  function cerrar(motivo) {
    if (!abierto()) return;
    var c = conf;
    conf = null;
    capa.classList.remove("on");
    capa.setAttribute("data-editor", "");
    document.body.classList.remove("modal-abierto");
    campos.innerHTML = "";
    campos.classList.remove("modal-campos--dos");
    caja.classList.remove("modal-editor-caja--ancho");
    if (focoPrevio && document.contains(focoPrevio) && focoPrevio.focus) focoPrevio.focus();
    focoPrevio = null;
    if (motivo === "cancelar" && c && typeof c.onCancelar === "function") c.onCancelar();
  }

  /* Escape cierra; el Tabulador no se escapa de la ventana. Se escucha en captura
     para que el resto de atajos del shell no se disparen con la ventana abierta. */
  document.addEventListener("keydown", function (e) {
    if (!abierto()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cerrar("cancelar"); return; }
    if (e.key !== "Tab") return;
    var piezas = caja.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
    if (!piezas.length) return;
    var primero = piezas[0], ultimo = piezas[piezas.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }, true);

  window.MimoModal = {
    abrir: abrir,
    cerrar: cerrar,
    estaAbierto: abierto,
    configurar: function (textos) { Object.keys(textos || {}).forEach(function (k) { TEXTOS[k] = textos[k]; }); },
    campo: campoHTML
  };
})();
