/* sync.js — sincronización manual de Mimo.
   Modelo inspirado en Super Productivity 19.2.0 (MIT): un archivo remoto con
   versión, cliente y estado completo; se lee antes de escribir, se compara el
   hash y, si las dos copias cambiaron, se elige local o remoto. Mimo no tiene
   operation log ni vector clocks: usa snapshots y un diálogo de conflicto. */
(function () {
  "use strict";

  var CLAVE_META = "mimo.sync.v1";
  var CLAVE_BACKUP = "mimo.sync.backup";
  var ARCHIVO = "mimo-sync.json";
  var DB = "mimo-sync";
  var STORE = "handles";
  var VERSION = 1;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var meta = cargarMeta();
  var sincronizando = false, aplicando = false, conflicto = null;
  var carpetaHandle = null, handleLeido = false;
  var cambios = false, ultimoError = "";
  var timerAuto = null, timerEstado = null, timerAutoLargo = null;
  var proveedorPrueba = null;

  function ahora() { return new Date().toISOString(); }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function defecto() {
    return {
      version: 1, provider: "", manualOnly: true, clientId: uuid(),
      lastRemoteRev: "", lastRemoteVersion: 0, lastLocalHash: "",
      lastSyncAt: "", folderName: "", ultimoCambio: ""
    };
  }
  function cargarMeta() {
    var d = defecto();
    try {
      var x = JSON.parse(localStorage.getItem(CLAVE_META) || "null");
      if (x && typeof x === "object") Object.keys(d).forEach(function (k) { if (x[k] !== undefined) d[k] = x[k]; });
    } catch (e) {}
    if (!d.clientId) d.clientId = uuid();
    return d;
  }
  function guardarMeta() { try { localStorage.setItem(CLAVE_META, JSON.stringify(meta)); } catch (e) {} }
  function host() { return window.MimoHost || null; }
  function avisar(t) { if (host()) host().aviso(t); }
  function resumen(s) { return host() ? host().resumen(s) : { tareas: 0, notas: 0, eventos: 0, ramos: 0, sesiones: 0, periodos: 0 }; }
  function resumenTexto(r) {
    return r.tareas + " tareas · " + r.notas + " notas · " + r.eventos + " eventos · " +
      r.ramos + " ramos · " + r.sesiones + " sesiones";
  }
  function fecha(ms) {
    if (!ms) return "—";
    try { return new Date(ms).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }); }
    catch (e) { return new Date(ms).toLocaleString(); }
  }
  function hace(iso) {
    if (!iso) return "";
    var ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms) || ms < 0) return "";
    if (ms < 60000) return "hace unos segundos";
    if (ms < 3600000) return "hace " + Math.floor(ms / 60000) + " min";
    if (ms < 86400000) return "hace " + Math.floor(ms / 3600000) + " h";
    return "hace " + Math.floor(ms / 86400000) + " días";
  }

  /* ---- hash ---- */
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  async function hashTexto(txt) {
    txt = String(txt == null ? "" : txt);
    try {
      if (window.crypto && crypto.subtle && window.TextEncoder) {
        var buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(txt));
        return hex(buf);
      }
    } catch (e) {}
    return "fnv-" + fnv1a(txt) + "-" + txt.length;
  }
  async function hashEstado(e) { return hashTexto(JSON.stringify(e)); }

  /* ---- archivo de sincronización ---- */
  function envolver(estado, version) {
    return {
      formato: "mimo-sync", version: VERSION, syncVersion: version || 1, schemaVersion: 1,
      app: "Mimo", appVersion: "1.2.0", clientId: meta.clientId,
      lastModified: Date.now(), estado: estado
    };
  }
  function leerEnvelope(txt) {
    var x = JSON.parse(txt);
    if (!x || x.formato !== "mimo-sync" || !x.estado || typeof x.estado !== "object") {
      throw new Error("Ese archivo no es un archivo de sincronización de Mimo.");
    }
    if (Number(x.version) > VERSION) throw new Error("El archivo es de una versión más nueva de Mimo.");
    x.syncVersion = Math.max(1, Number(x.syncVersion) || 1);
    return x;
  }
  function descargarTexto(texto, nombre) {
    var blob = new Blob([texto], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nombre; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function leerArchivoSeleccionado() {
    return new Promise(function (resolve, reject) {
      var input = $("#sync-archivo-input"); if (!input) { resolve(null); return; }
      var resuelto = false;
      function terminar(v) { if (resuelto) return; resuelto = true; clearTimeout(t); resolve(v); }
      var t = setTimeout(function () { terminar(null); }, 120000);
      input.value = "";
      input.onchange = function () {
        var f = input.files && input.files[0];
        if (!f) { terminar(null); return; }
        var r = new FileReader();
        r.onload = function () { terminar(String(r.result)); };
        r.onerror = function () { reject(r.error); };
        r.readAsText(f);
      };
      input.addEventListener("cancel", function () { terminar(null); }, { once: true });
      input.click();
    });
  }

  /* ---- carpeta local (File System Access) ---- */
  function soportaCarpeta() { return typeof window.showDirectoryPicker === "function" && !proveedorPrueba; }
  function abrirDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB no disponible")); return; }
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  async function guardarHandle(h) {
    var db = await abrirDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(h, "carpeta");
      tx.oncomplete = function () { resolve(); };
      tx.onerror = function () { reject(tx.error); };
    });
  }
  async function leerHandle() {
    var db = await abrirDB();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(STORE, "readonly");
      var req = tx.objectStore(STORE).get("carpeta");
      req.onsuccess = function () { resolve(req.result || null); };
      req.onerror = function () { reject(req.error); };
    });
  }
  async function borrarHandle() {
    try {
      var db = await abrirDB();
      var tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("carpeta");
    } catch (e) {}
  }
  async function obtenerCarpeta(pedir) {
    if (proveedorPrueba) return proveedorPrueba;
    if (!soportaCarpeta()) throw new Error("Este navegador no permite elegir una carpeta persistente. Usa el modo Archivo manual.");
    if (!handleLeido) { try { carpetaHandle = await leerHandle(); } catch (e) { carpetaHandle = null; } handleLeido = true; }
    if (!carpetaHandle) {
      if (!pedir) return null;
      carpetaHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "mimo-sync" });
      await guardarHandle(carpetaHandle);
    }
    if (carpetaHandle.queryPermission) {
      var p = await carpetaHandle.queryPermission({ mode: "readwrite" });
      if (p !== "granted" && pedir) p = await carpetaHandle.requestPermission({ mode: "readwrite" });
      if (p !== "granted") throw new Error("Falta permiso para escribir en la carpeta elegida.");
    }
    return carpetaHandle;
  }
  async function leerCarpeta(pedir) {
    var dir = await obtenerCarpeta(pedir); if (!dir) return null;
    var fh;
    try { fh = await dir.getFileHandle(ARCHIVO, { create: false }); }
    catch (e) { if (e && e.name === "NotFoundError") return null; throw e; }
    var file = await fh.getFile();
    var texto = await file.text();
    return { texto: texto, nombre: dir.name || ARCHIVO, rev: await hashTexto(texto) };
  }
  async function escribirCarpeta(texto, revEsperada) {
    var dir = await obtenerCarpeta(true);
    if (revEsperada) {
      var actual = await leerCarpeta(true);
      if (!actual) throw new Error("El archivo remoto desapareció. Vuelve a sincronizar.");
      if (actual.rev !== revEsperada) throw new Error("El archivo cambió mientras sincronizabas. Vuelve a intentarlo.");
    }
    var fh = await dir.getFileHandle(ARCHIVO, { create: true });
    var w = await fh.createWritable();
    await w.write(texto); await w.close();
    var check = await fh.getFile(); var t = await check.text();
    if (t !== texto) throw new Error("No se pudo verificar la escritura del archivo.");
    return { rev: await hashTexto(texto) };
  }

  /* ---- test / fake provider ---- */
  function probarCon(p) {
    proveedorPrueba = p || null;
    handleLeido = true;
    if (p) { meta.provider = "carpeta"; meta.folderName = p.nombre || "prueba"; guardarMeta(); }
    pintarUI();
  }

  /* ---- leer / escribir remoto ---- */
  async function leerRemoto() {
    if (proveedorPrueba) {
      var t = await proveedorPrueba.leer();
      return t == null ? null : { texto: t, nombre: proveedorPrueba.nombre || "prueba", rev: await hashTexto(t) };
    }
    if (meta.provider === "carpeta") return leerCarpeta(true);
    if (meta.provider === "archivo") {
      var txt = await leerArchivoSeleccionado();
      if (txt == null) { var e = new Error("Selección cancelada"); e.name = "AbortError"; throw e; }
      return { texto: txt, nombre: ARCHIVO, rev: await hashTexto(txt) };
    }
    return null;
  }
  async function escribirRemoto(texto, revEsperada) {
    if (proveedorPrueba) {
      var r = await proveedorPrueba.escribir(texto, revEsperada);
      return r || { rev: await hashTexto(texto) };
    }
    if (meta.provider === "carpeta") return escribirCarpeta(texto, revEsperada);
    if (meta.provider === "archivo") {
      descargarTexto(texto, ARCHIVO);
      return { rev: await hashTexto(texto) };
    }
    throw new Error("No hay un modo de sincronización configurado.");
  }

  /* ---- respaldo ---- */
  function respaldarLocal() {
    try {
      localStorage.setItem(CLAVE_BACKUP, JSON.stringify({ fecha: ahora(), estado: host().snapshot() }));
    } catch (e) {}
  }

  /* ---- estado de la UI ---- */
  function icono(id) { return '<svg class="icono" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function pintarUI() {
    var est = $("#sync-estado");
    if (!est) return;
    var texto, clase = "muted";
    if (!meta.provider) texto = "Sin configurar. Elige un modo para llevar tus datos a otro equipo.";
    else if (sincronizando) texto = "Sincronizando…";
    else if (ultimoError) { texto = "Error: " + ultimoError; clase = "muted err"; }
    else if (conflicto) { texto = "Conflicto: las dos copias cambiaron. Elige una versión."; clase = "muted err"; }
    else if (cambios) texto = "Cambios locales sin sincronizar.";
    else if (meta.lastSyncAt) texto = "Sincronizado " + hace(meta.lastSyncAt) + ".";
    else texto = "Listo para sincronizar.";
    est.textContent = texto;
    est.className = clase;
    var sel = $("#sync-proveedor"); if (sel) sel.value = meta.provider || "";
    var c = $("#sync-carpeta"); if (c) c.hidden = meta.provider !== "carpeta";
    var a = $("#sync-archivo"); if (a) a.hidden = meta.provider !== "archivo";
    var m = $("#sync-manual"); if (m) { m.checked = !!meta.manualOnly; m.disabled = meta.provider === "archivo"; }
    var cn = $("#sync-carpeta-nombre");
    if (cn) cn.textContent = meta.folderName ? "Carpeta: " + meta.folderName : "Sin carpeta elegida.";
    var u = $("#sync-ultima");
    if (u) u.textContent = meta.lastSyncAt
      ? "Última sincronización: " + fecha(meta.lastSyncAt) + (meta.lastRemoteVersion ? " · archivo v" + meta.lastRemoteVersion : "") + "."
      : "Nunca sincronizado.";
    var b = $("#btn-sync");
    if (b) {
      b.classList.toggle("girando", sincronizando);
      b.title = !meta.provider ? "Configurar sincronización"
        : sincronizando ? "Sincronizando…"
        : ultimoError ? "Error de sincronización; clic para reintentar"
        : conflicto ? "Conflicto de sincronización"
        : cambios ? "Hay cambios locales; clic para sincronizar"
        : "Sincronizado; clic para sincronizar ahora";
      b.innerHTML = icono(sincronizando ? "i-sync" : (ultimoError || conflicto ? "i-alerta" : "i-check"));
    }
  }
  async function recalcularCambios() {
    if (!host()) return;
    if (!meta.provider) { cambios = false; pintarUI(); return; }
    if (!meta.lastLocalHash) { cambios = host().tieneDatos(); pintarUI(); return; }
    try {
      var h = await hashEstado(host().snapshot());
      cambios = h !== meta.lastLocalHash;
    } catch (e) { cambios = true; }
    pintarUI();
  }

  /* ---- conflicto ---- */
  function abrirConflicto() {
    if (!conflicto) return;
    var localR = host().resumen(conflicto.local);
    var remotoR = host().resumen(conflicto.env.estado);
    $("#sync-conf-local-fecha").textContent = fecha(conflicto.localFecha);
    $("#sync-conf-local-resumen").textContent = resumenTexto(localR);
    $("#sync-conf-remoto-fecha").textContent = fecha(conflicto.env.lastModified) +
      (conflicto.env.clientId ? " · " + String(conflicto.env.clientId).slice(0, 8) : "");
    $("#sync-conf-remoto-resumen").textContent = resumenTexto(remotoR);
    $("#modal-sync-conflict").classList.add("on");
  }
  function cerrarConflicto() { $("#modal-sync-conflict").classList.remove("on"); }
  async function usarLocal() {
    if (!conflicto) return;
    var c = conflicto;
    cerrarConflicto();
    try {
      await subir(c.local, c.localHash, c.remoteRev, c.env);
      conflicto = null; avisar("Se conservó la copia local y se subió.");
    } catch (e) {
      ultimoError = e.message || "No se pudo subir la copia local.";
      avisar(ultimoError);
    }
    pintarUI();
  }
  async function usarRemoto() {
    if (!conflicto) return;
    var c = conflicto;
    cerrarConflicto();
    try {
      respaldarLocal();
      aplicando = true;
      host().reemplazar(c.env.estado);
      var h = await hashEstado(host().snapshot());
      meta.lastRemoteRev = c.remoteRev; meta.lastRemoteVersion = c.remoteVersion;
      meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
      guardarMeta(); cambios = false; conflicto = null; aplicando = false;
      avisar("Se aplicó la copia remota. La copia local quedó como respaldo.");
    } catch (e) {
      aplicando = false;
      ultimoError = e.message || "No se pudo aplicar la copia remota.";
      avisar(ultimoError);
    }
    pintarUI();
  }

  /* ---- subir / aplicar ---- */
  async function subir(local, localHash, revEsperada, envRemoto) {
    var version = (envRemoto ? Number(envRemoto.syncVersion) || 0 : meta.lastRemoteVersion || 0) + 1;
    var env = envolver(local, version);
    var texto = JSON.stringify(env, null, 2);
    var res = await escribirRemoto(texto, revEsperada || null);
    meta.lastRemoteRev = res && res.rev ? res.rev : await hashTexto(texto);
    meta.lastRemoteVersion = version;
    meta.lastLocalHash = localHash;
    meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarMeta(); cambios = false; ultimoError = "";
    avisar(meta.provider === "archivo" ? "Archivo de sincronización guardado. Cópialo a tu nube." : "Sincronizado.");
  }
  async function aplicarRemoto(env, remoteRev) {
    respaldarLocal();
    aplicando = true;
    host().reemplazar(env.estado);
    var h = await hashEstado(host().snapshot());
    meta.lastRemoteRev = remoteRev;
    meta.lastRemoteVersion = Number(env.syncVersion) || 1;
    meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarMeta(); cambios = false; ultimoError = ""; aplicando = false;
    avisar("Datos remotos aplicados. La copia local quedó como respaldo.");
  }

  async function procesarRemoto(remoto, local, localHash, localTieneDatos) {
    if (!remoto || remoto.texto === null) {
      if (!localTieneDatos) { cambios = false; pintarUI(); return; }
      await subir(local, localHash, null, null);
      return;
    }
    var env = leerEnvelope(remoto.texto);
    var remoteRev = remoto.rev || await hashTexto(remoto.texto);
    var remoteVersion = Number(env.syncVersion) || 1;
    var remoteCambio = !meta.lastRemoteRev || remoteRev !== meta.lastRemoteRev;
    var localCambio = meta.lastLocalHash ? localHash !== meta.lastLocalHash : localTieneDatos;
    if (!localTieneDatos && !localCambio) { await aplicarRemoto(env, remoteRev); return; }
    if (remoteCambio && localCambio) {
      conflicto = { env: env, remoteRev: remoteRev, remoteVersion: remoteVersion, local: local, localHash: localHash, localFecha: Date.now() };
      pintarUI(); abrirConflicto(); return;
    }
    if (remoteCambio) { await aplicarRemoto(env, remoteRev); return; }
    if (localCambio) { await subir(local, localHash, remoteRev, env); return; }
    meta.lastRemoteRev = remoteRev; meta.lastRemoteVersion = remoteVersion;
    meta.lastLocalHash = localHash; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarMeta(); cambios = false; ultimoError = "";
    pintarUI();
  }

  async function sincronizar(auto, remotoPre) {
    if (sincronizando) return;
    if (conflicto) { abrirConflicto(); return; }
    if (!meta.provider) {
      avisar("Elige un modo de sincronización en Ajustes.");
      if (host()) host().ir("ajustes");
      return;
    }
    if (auto && (meta.manualOnly || meta.provider === "archivo")) return;
    sincronizando = true; ultimoError = ""; pintarUI();
    try {
      if (meta.provider === "carpeta" && !proveedorPrueba) await obtenerCarpeta(true);
      var local = host().snapshot();
      var localHash = await hashEstado(local);
      var localDatos = host().tieneDatos();
      var remoto = remotoPre || await leerRemoto();
      await procesarRemoto(remoto, local, localHash, localDatos);
    } catch (e) {
      if (e && e.name === "AbortError") { ultimoError = ""; avisar("Selección cancelada."); }
      else {
        ultimoError = e && e.message ? e.message : "No se pudo sincronizar.";
        if (e && e.name === "NotAllowedError") ultimoError = "Permiso de carpeta no concedido.";
        avisar(ultimoError);
      }
    } finally {
      sincronizando = false; pintarUI();
    }
  }

  /* ---- configuración ---- */
  async function elegirCarpeta() {
    try {
      var h = await window.showDirectoryPicker({ mode: "readwrite", id: "mimo-sync" });
      carpetaHandle = h; handleLeido = true; await guardarHandle(h);
      meta.provider = "carpeta"; meta.folderName = h.name || "carpeta"; meta.manualOnly = true;
      guardarMeta(); pintarUI(); avisar("Carpeta de sincronización elegida: " + meta.folderName + ".");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      ultimoError = e.message || "No se pudo elegir la carpeta."; pintarUI(); avisar(ultimoError);
    }
  }
  function cambiarProveedor() {
    var v = $("#sync-proveedor").value;
    meta.provider = v || "";
    if (v === "archivo") meta.manualOnly = true;
    if (!v) { meta.lastRemoteRev = ""; meta.lastRemoteVersion = 0; meta.lastLocalHash = ""; meta.lastSyncAt = ""; meta.folderName = ""; }
    guardarMeta(); pintarUI();
    if (v === "carpeta" && !proveedorPrueba && soportaCarpeta()) {
      avisar("Pulsa «Elegir carpeta» para autorizar la carpeta.");
    }
  }
  function desconectar() {
    if (!window.confirm("¿Desconectar la sincronización? No se borran tus datos ni el archivo remoto.")) return;
    meta.provider = ""; meta.folderName = ""; meta.lastRemoteRev = ""; meta.lastRemoteVersion = 0;
    meta.lastLocalHash = ""; meta.lastSyncAt = ""; meta.ultimoCambio = "";
    carpetaHandle = null; handleLeido = true; borrarHandle();
    guardarMeta(); conflicto = null; cambios = host().tieneDatos(); pintarUI();
    avisar("Sincronización desconectada.");
  }
  function cambiarManual() {
    meta.manualOnly = !!$("#sync-manual").checked; guardarMeta(); pintarUI();
    if (!meta.manualOnly && meta.provider && meta.provider !== "archivo") programarAuto(1500);
  }
  function programarAuto(ms) {
    clearTimeout(timerAuto);
    timerAuto = setTimeout(function () { sincronizar(true); }, ms || 15000);
  }
  function alCambiar() {
    if (aplicando) return;
    cambios = true;
    clearTimeout(timerEstado);
    timerEstado = setTimeout(function () { pintarUI(); }, 120);
    if (meta.provider && !meta.manualOnly && meta.provider !== "archivo" && !sincronizando && !conflicto) {
      programarAuto(15000);
    }
  }
  function guardarArchivoManual() {
    if (sincronizando) return;
    sincronizando = true; pintarUI();
    (async function () {
      try {
        var local = host().snapshot(); var h = await hashEstado(local);
        var env = envolver(local, (meta.lastRemoteVersion || 0) + 1);
        var texto = JSON.stringify(env, null, 2);
        descargarTexto(texto, ARCHIVO);
        meta.provider = "archivo"; meta.manualOnly = true;
        meta.lastRemoteRev = await hashTexto(texto); meta.lastRemoteVersion = env.syncVersion;
        meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
        guardarMeta(); cambios = false; ultimoError = "";
        avisar("Archivo de sincronización descargado.");
      } catch (e) { ultimoError = e.message || "No se pudo guardar el archivo."; avisar(ultimoError); }
      finally { sincronizando = false; pintarUI(); }
    })();
  }
  async function cargarArchivoManual() {
    if (sincronizando) return;
    try {
      var txt = await leerArchivoSeleccionado();
      if (txt == null) return;
      await sincronizar(false, { texto: txt, nombre: ARCHIVO, rev: await hashTexto(txt) });
    } catch (e) { ultimoError = e.message || "No se pudo leer el archivo."; avisar(ultimoError); pintarUI(); }
  }

  function init() {
    if (!host()) return;
    var sel = $("#sync-proveedor"); if (!sel) return;
    var opcionCarpeta = sel.querySelector('option[value="carpeta"]');
    if (opcionCarpeta && !soportaCarpeta()) {
      opcionCarpeta.disabled = true;
      opcionCarpeta.textContent = "Carpeta local (no disponible en este navegador)";
    }
    sel.addEventListener("change", cambiarProveedor);
    $("#sync-elegir-carpeta").addEventListener("click", elegirCarpeta);
    $("#sync-ahora").addEventListener("click", function () { sincronizar(false); });
    $("#sync-desconectar").addEventListener("click", desconectar);
    $("#sync-manual").addEventListener("change", cambiarManual);
    $("#sync-guardar-archivo").addEventListener("click", guardarArchivoManual);
    $("#sync-cargar-archivo").addEventListener("click", cargarArchivoManual);
    $("#sync-conf-x").addEventListener("click", function () { conflicto = null; cerrarConflicto(); pintarUI(); });
    $("#sync-conf-cancelar").addEventListener("click", function () { conflicto = null; cerrarConflicto(); pintarUI(); });
    $("#sync-conf-local").addEventListener("click", usarLocal);
    $("#sync-conf-remoto").addEventListener("click", usarRemoto);
    $("#modal-sync-conflict").addEventListener("click", function (e) {
      if (e.target === $("#modal-sync-conflict")) { conflicto = null; cerrarConflicto(); pintarUI(); }
    });
    $("#btn-sync").addEventListener("click", function () {
      if (!meta.provider) { host().ir("ajustes"); avisar("Elige un modo de sincronización."); return; }
      sincronizar(false);
    });
    pintarUI();
    setTimeout(recalcularCambios, 300);
    if (meta.provider && !meta.manualOnly && meta.provider !== "archivo") {
      setTimeout(function () { sincronizar(true); }, 1500);
      timerAutoLargo = setInterval(function () {
        if (!sincronizando && !conflicto && !meta.manualOnly) sincronizar(true);
      }, 5 * 60 * 1000);
    }
  }

  window.MimoSync = {
    alCambiar: alCambiar,
    sincronizar: function () { return sincronizar(false); },
    estado: function () { return { meta: JSON.parse(JSON.stringify(meta)), cambios: cambios, conflicto: !!conflicto, sincronizando: sincronizando }; },
    probarCon: probarCon,
    _hash: hashTexto
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
