/* actualizaciones.js — comprobación y aviso de versiones de Mimo.
   La política y la red viven en Rust (`actualizaciones.rs`). Aquí solo hay UI, canal,
   preferencias y el respaldo obligatorio antes de instalar. */
(function () {
  "use strict";

  var info = null;
  var ocupado = false;
  var ultimaComprobacion = 0;
  var timer = null;
  var HORAS = 6 * 60 * 60 * 1000;
  var FOCO = 30 * 60 * 1000;

  function $(s) { return document.querySelector(s); }
  function idioma() { return (window.MimoI18n && MimoI18n.idioma && MimoI18n.idioma()) || "es"; }
  function L(es, en, zh) {
    var i = idioma();
    return i === "zh" ? zh : i === "en" ? en : es;
  }
  function host() { return window.MimoHost || null; }
  function tauri() { return window.MimoAlmacen && MimoAlmacen.esTauri(); }
  function invoke(cmd, args) {
    var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
    return t.invoke(cmd, args);
  }
  function prefs() {
    var h = host();
    return (h && h.snapshot().prefs) || {};
  }
  function guardarPrefs(cambio) {
    var h = host(); if (!h) return;
    var e = h.snapshot();
    e.prefs = e.prefs || {};
    e.prefs.actualizaciones = Object.assign({}, e.prefs.actualizaciones || {}, cambio || {});
    h.reemplazar(e);
  }
  function canal() {
    var p = prefs().actualizaciones || {};
    return p.canal === "stable" ? "stable" : "beta";
  }
  function automatico() {
    var p = prefs().actualizaciones || {};
    return p.auto !== false;
  }
  function omitida() {
    return (prefs().actualizaciones || {}).omitida || "";
  }
  function pospuestaHasta() {
    return Number((prefs().actualizaciones || {}).pospuestaHasta) || 0;
  }
  function texto(sel, t) { var el = $(sel); if (el) el.textContent = t; }
  function mostrar(el, on) { if (el) el.hidden = !on; }

  function pintarEstado(t, error) {
    var el = $("#act-estado");
    if (!el) return;
    el.textContent = t;
    el.className = "muted" + (error ? " err" : "");
  }

  function pintarOferta() {
    var caja = $("#act-oferta");
    if (!caja) return;
    if (!info) { caja.hidden = true; return; }
    caja.hidden = false;
    texto("#act-version", info.version || "");
    texto("#act-fecha", info.fecha || "");
    texto("#act-notas", info.notas || L("Sin novedades escritas.", "No release notes.", "没有发布说明。"));
    var banner = $("#banner-actualizacion");
    if (banner) {
      banner.hidden = false;
      texto("#banner-act-texto", L("Mimo ", "Mimo ", "Mimo ") + info.version + L(" está disponible.", " is available.", " 已可用。"));
    }
  }

  function limpiarOferta() {
    info = null;
    mostrar($("#act-oferta"), false);
    mostrar($("#banner-actualizacion"), false);
  }

  async function comprobar(manual) {
    if (!tauri() || ocupado) return;
    ocupado = true;
    pintarEstado(L("Buscando actualizaciones…", "Checking for updates…", "正在检查更新…"), false);
    try {
      var r = await invoke("actualizacion_comprobar", { canal: canal() });
      ultimaComprobacion = Date.now();
      if (!r) {
        limpiarOferta();
        pintarEstado(L("Estás al día.", "You are up to date.", "已是最新版本。"), false);
        if (manual && host()) host().aviso(L("Mimo está al día.", "Mimo is up to date.", "Mimo 已是最新版本。"));
        return;
      }
      info = r;
      if (info.version === omitida() || Date.now() < pospuestaHasta()) {
        mostrar($("#banner-actualizacion"), false);
        pintarEstado(L("Hay una versión nueva, pero la omitiste o la pospusiste.", "A new version exists, but you skipped or postponed it.", "有新版本，但你已跳过或推迟。"), false);
        return;
      }
      pintarOferta();
      pintarEstado(L("Disponible: ", "Available: ", "可用：") + info.version, false);
      if (manual && host()) host().aviso(L("Hay una versión nueva: ", "A new version is available: ", "新版本可用：") + info.version);
    } catch (e) {
      pintarEstado(L("No se pudo comprobar: ", "Could not check: ", "无法检查：") + (e && e.message ? e.message : e), true);
      if (manual && host()) host().aviso(L("No se pudo comprobar la actualización.", "Could not check for updates.", "无法检查更新。"));
    } finally {
      ocupado = false;
    }
  }

  function programar() {
    clearTimeout(timer);
    if (!tauri() || !automatico()) return;
    timer = setTimeout(function () { comprobar(false); }, HORAS);
  }

  async function instalar() {
    if (!tauri() || !info || ocupado) return;
    if (!window.confirm(L("Se creará un respaldo y se instalará Mimo " + info.version + ". La app se reiniciará. ¿Continuar?",
      "A backup will be created and Mimo " + info.version + " will be installed. The app will restart. Continue?",
      "将创建备份并安装 Mimo " + info.version + "。应用将重新启动。继续？"))) return;
    ocupado = true;
    pintarEstado(L("Creando respaldo…", "Creating backup…", "正在创建备份…"), false);
    try {
      var h = host(); if (!h) throw new Error("sin host");
      var estado = JSON.stringify(h.snapshot());
      var t = window.__TAURI__ && window.__TAURI__.core;
      var ch = t && t.Channel ? new t.Channel() : null;
      if (ch) {
        ch.onmessage = function (m) {
          if (!m || !m.evento) return;
          if (m.evento === "respaldo") pintarEstado(L("Respaldo listo. Descargando…", "Backup ready. Downloading…", "备份就绪。正在下载…"), false);
          else if (m.evento === "progreso") pintarEstado(L("Descargando… ", "Downloading… ", "正在下载… ") + Math.round((m.datos.bytes || 0) / 1048576) + " MB", false);
          else if (m.evento === "descargado") pintarEstado(L("Instalando…", "Installing…", "正在安装…"), false);
        };
      }
      await invoke("actualizacion_instalar", { estado: estado, alEvento: ch });
      pintarEstado(L("Actualización instalada. Reiniciando…", "Update installed. Restarting…", "更新已安装。正在重启…"), false);
    } catch (e) {
      pintarEstado(L("No se pudo instalar: ", "Could not install: ", "无法安装：") + (e && e.message ? e.message : e), true);
      if (host()) host().aviso(L("No se pudo instalar la actualización.", "Could not install the update.", "无法安装更新。"));
    } finally {
      ocupado = false;
    }
  }

  function omitir() {
    if (!info) return;
    guardarPrefs({ omitida: info.version, pospuestaHasta: 0 });
    limpiarOferta();
    pintarEstado(L("Esta versión no volverá a avisarse.", "This version will not be announced again.", "此版本不再提示。"), false);
  }
  function posponer() {
    guardarPrefs({ pospuestaHasta: Date.now() + 24 * 60 * 60 * 1000 });
    mostrar($("#banner-actualizacion"), false);
    pintarEstado(L("Te avisaré mañana.", "I will remind you tomorrow.", "明天再提醒你。"), false);
  }
  function abrirRelease() {
    if (tauri()) invoke("actualizacion_abrir_release").catch(function () {});
  }

  function init() {
    var boton = $("#act-buscar");
    if (!boton) return;
    var sel = $("#act-canal");
    var auto = $("#act-auto");
    var p = prefs().actualizaciones || {};
    if (sel) { sel.value = p.canal === "stable" ? "stable" : "beta"; sel.disabled = !tauri(); sel.addEventListener("change", function () { guardarPrefs({ canal: sel.value }); limpiarOferta(); if (tauri()) comprobar(false); }); }
    if (auto) { auto.checked = p.auto !== false; auto.disabled = !tauri(); auto.addEventListener("change", function () { guardarPrefs({ auto: auto.checked }); if (auto.checked) programar(); else clearTimeout(timer); }); }
    boton.addEventListener("click", function () { comprobar(true); });
    var b = $("#act-instalar"); if (b) b.addEventListener("click", instalar);
    var o = $("#act-omitir"); if (o) o.addEventListener("click", omitir);
    var r = $("#act-posponer"); if (r) r.addEventListener("click", posponer);
    var rel = $("#act-release"); if (rel) rel.addEventListener("click", abrirRelease);
    var bx = $("#banner-act-x"); if (bx) bx.addEventListener("click", function () { mostrar($("#banner-actualizacion"), false); });
    var bm = $("#banner-act-instalar"); if (bm) bm.addEventListener("click", instalar);
    if (!tauri()) {
      pintarEstado(L("Las actualizaciones automáticas están disponibles en la app de escritorio.", "Automatic updates are available in the desktop app.", "自动更新在桌面应用中可用。"), false);
      boton.disabled = true;
      return;
    }
    pintarEstado(L("Listo para comprobar.", "Ready to check.", "可以检查。"), false);
    if (automatico()) setTimeout(function () { comprobar(false); }, 8000);
    window.addEventListener("focus", function () {
      if (!automatico() || Date.now() - ultimaComprobacion < FOCO) return;
      comprobar(false);
    });
    programar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
