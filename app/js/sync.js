/* sync.js — sincronización local primero de Mimo.
   Modelo inspirado en Super Productivity 19.2.0 (MIT): un archivo remoto con
   versión, cliente y estado completo; se lee antes de escribir, se compara el
   hash y, si las dos copias cambiaron, se elige local o remoto. Mimo no tiene
   operation log ni vector clocks: usa snapshots y un diálogo de conflicto.

   Fase 2: WebDAV/Nextcloud con escritura condicional (ETag/If-Match), cifrado
   obligatorio PBKDF2-SHA-256 + AES-GCM y una cola local persistente. La copia
   local manda: si no hay red, se sigue guardando aquí y se reintenta al volver.
   El archivo manual y la carpeta local siguen disponibles y sin cifrar. */
(function () {
  "use strict";

  var CLAVE_META = "mimo.sync.v1";
  var CLAVE_ACCESO = "mimo.sync.acceso.v1";
  var CLAVE_BACKUP = "mimo.sync.backup";
  var CLAVE_COLA = "mimo.sync.cola.v1";
  var ARCHIVO = "mimo-sync.json";
  var ARCHIVO_CIFRADO = "mimo-sync.json.enc";
  var DB = "mimo-sync";
  var STORE = "handles";
  var STORE_CLAVES = "claves";
  var VERSION = 1;
  var ITERACIONES = 250000;
  var FORMATO_CIFRADO = "mimo-sync-cifrado";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  function L(es, en, zh) { return window.MimoI18n ? window.MimoI18n.L(es, en, zh) : es; }
  /* La contraseña de aplicación de WebDAV se guarda en este equipo, cifrada con la
     misma clave derivada que protege la copia (AES-GCM). No es un secreto frente a
     quien pueda leer el almacenamiento de la app, pero evita pedirla en cada arranque.
     «Desconectar» la borra. */
  var claveAcceso = "";
  try { claveAcceso = sessionStorage.getItem("mimo.sync.clave.sesion") || ""; } catch (e) {}
  var meta = cargarMeta();
  var cola = cargarCola();
  var sincronizando = false, aplicando = false, conflicto = null;
  var carpetaHandle = null, handleLeido = false;
  var carpetaTauri = null; /* { ruta, nombre } cuando la app corre en Tauri */
  var cambios = false, ultimoError = "";
  var timerAuto = null, timerEstado = null, timerAutoLargo = null, timerReintento = null, timerVigia = null;
  var proveedorPrueba = null;
  var claveMemo = null, claveSal = "";

  function ahora() { return new Date().toISOString(); }
  function uuid() {
    try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "dev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }
  function defecto() {
    return {
      version: 1, provider: "", manualOnly: true, clientId: uuid(),
      lastRemoteRev: "", lastRemoteVersion: 0, lastLocalHash: "",
      lastSyncAt: "", folderName: "", ultimoCambio: "", ultimaPrueba: null,
      nc: false, ncUrl: "",
      webdav: { url: "", usuario: "", clave: "", carpeta: "Mimo" },
      cifrado: { sal: "", activo: false }
    };
  }
  function cargarMeta() {
    var d = defecto();
    try {
      var x = JSON.parse(localStorage.getItem(CLAVE_META) || "null");
      if (x && typeof x === "object") {
        Object.keys(d).forEach(function (k) {
          if (k === "webdav" || k === "cifrado") return;
          if (x[k] !== undefined) d[k] = x[k];
        });
        if (x.webdav && typeof x.webdav === "object") {
      d.webdav = Object.assign(d.webdav, x.webdav);
      // Migración: estados viejos guardaban la contraseña en claro. Se pasa a memoria
      // para esta sesión y se borra del almacenamiento en el siguiente guardado.
      if (d.webdav.clave) {
        claveAcceso = String(d.webdav.clave);
        d.webdav.clave = "";
        try { sessionStorage.setItem("mimo.sync.clave.sesion", claveAcceso); } catch (e) {}
      }
    }
        if (x.cifrado && typeof x.cifrado === "object") d.cifrado = Object.assign(d.cifrado, x.cifrado);
      }
    } catch (e) {}
    if (!d.clientId) d.clientId = uuid();
    return d;
  }
  function guardarMeta() { try { localStorage.setItem(CLAVE_META, JSON.stringify(meta)); } catch (e) {} }
  function colaDefecto() {
    return { pendiente: false, desde: "", intentos: 0, proximo: 0, ultimoError: "", motivo: "", reintentar: false };
  }
  function cargarCola() {
    var d = colaDefecto();
    try {
      var x = JSON.parse(localStorage.getItem(CLAVE_COLA) || "null");
      if (x && typeof x === "object") Object.keys(d).forEach(function (k) { if (x[k] !== undefined) d[k] = x[k]; });
    } catch (e) {}
    return d;
  }
  function guardarCola() { try { localStorage.setItem(CLAVE_COLA, JSON.stringify(cola)); } catch (e) {} }
  function host() { return window.MimoHost || null; }
  function avisar(t) { if (host()) host().aviso(t); }
  function resumen(s) { return host() ? host().resumen(s) : { tareas: 0, notas: 0, eventos: 0, ramos: 0, sesiones: 0, periodos: 0 }; }
  function resumenTexto(r) {
    return r.tareas + " " + L("tareas", "tasks", "任务") + " · " + r.notas + " " + L("notas", "notes", "笔记") + " · " + r.eventos + " " + L("eventos", "events", "事件") + " · " +
      r.ramos + " " + L("ramos", "courses", "门课程") + " · " + r.sesiones + " " + L("sesiones", "sessions", "会话");
  }
  function fecha(ms) {
    if (!ms) return "—";
    try { var i = window.MimoI18n ? window.MimoI18n.idioma() : "es"; var loc = i === "zh" ? "zh-CN" : i === "en" ? "en-US" : "es-CL"; return new Date(ms).toLocaleString(loc, { dateStyle: "short", timeStyle: "short" }); }
    catch (e) { return new Date(ms).toLocaleString(); }
  }
  function hace(iso) {
    if (!iso) return "";
    var ms = Date.now() - new Date(iso).getTime();
    if (!isFinite(ms) || ms < 0) return "";
    if (ms < 60000) return L("hace unos segundos", "seconds ago", "几秒前");
    if (ms < 3600000) return L("hace ", "", "") + Math.floor(ms / 60000) + L(" min", " min ago", " 分钟前");
    if (ms < 86400000) return L("hace ", "", "") + Math.floor(ms / 3600000) + L(" h", " h ago", " 小时前");
    return L("hace ", "", "") + Math.floor(ms / 86400000) + L(" días", " days ago", " 天前");
  }
  function esWebDAV() { return meta.provider === "webdav"; }
  function esNube() { return esWebDAV(); }

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

  /* ---- codificación binaria ---- */
  function bufB64(buf) {
    var b = new Uint8Array(buf), s = "", i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
    return btoa(s);
  }
  function b64Buf(txt) {
    var bin = atob(String(txt || "")), u = new Uint8Array(bin.length), i;
    for (i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function azar(n) {
    var u = new Uint8Array(n);
    crypto.getRandomValues(u);
    return u;
  }

  /* ---- comprobante de la última sincronización ----
     Sirve para responder "¿esto se subió de verdad?" sin abrir la nube: qué se
     movió, cuándo, cuánto pesa y cuántas cosas lleva. */
  function tamano(texto) {
    var b = 0;
    try { b = new Blob([texto]).size; } catch (e) { b = String(texto || "").length; }
    return b < 1024 ? b + " B" : (b / 1024).toFixed(1) + " KB";
  }
  function cuentasDe(estado) {
    try { return resumen(estado); } catch (e) { return { tareas: 0, notas: 0, eventos: 0, ramos: 0, sesiones: 0 }; }
  }
  function anotarPrueba(p) {
    try { meta.ultimaPrueba = p; guardarMeta(); } catch (e) {}
  }

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
      throw new Error(L("Ese archivo está corrupto o no es un archivo de sincronización de Mimo.", "That file is corrupt or is not a Mimo sync file.", "该文件已损坏，或不是 Mimo 同步文件。"));
    }
    if (Number(x.version) > VERSION) throw new Error(L("El archivo es de una versión más nueva de Mimo.", "The file is from a newer version of Mimo.", "该文件来自更新版本的 Mimo。"));
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

  /* ---- cifrado (WebCrypto) ---- */
  function necesitaClave() {
    var e = new Error(L("Falta la contraseña de cifrado. Escríbela en Ajustes → Sincronización.", "The encryption password is missing. Enter it in Settings → Sync.", "缺少加密密码。请在设置 → 同步中输入。"));
    e.necesitaClave = true;
    return e;
  }
  async function derivarClave(pass, salB64) {
    if (!(window.crypto && crypto.subtle && crypto.subtle.deriveKey)) {
      throw new Error(L("Este navegador no tiene WebCrypto; no se puede cifrar.", "This browser lacks WebCrypto; encryption is not possible.", "此浏览器缺少 WebCrypto，无法加密。"));
    }
    var base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64Buf(salB64), iterations: ITERACIONES, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
    );
  }
  async function claveDeSal(salB64) {
    if (claveMemo && claveSal === salB64) return claveMemo;
    var guardada = await leerClave(salB64);
    if (guardada) { claveMemo = guardada; claveSal = salB64; return guardada; }
    var campo = $("#sync-webdav-clave");
    var pass = campo && campo.value ? campo.value : "";
    if (!pass) throw necesitaClave();
    var k = await derivarClave(pass, salB64);
    await guardarClave(salB64, k);
    claveMemo = k; claveSal = salB64;
    meta.cifrado.sal = salB64; meta.cifrado.activo = true; guardarMeta(); pintarClave();
    return k;
  }
  async function cifrar(texto) {
    var sal = meta.cifrado.sal || bufB64(azar(16));
    var key = await claveDeSal(sal);
    var iv = azar(12);
    var ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(texto));
    meta.cifrado.sal = sal;
    return JSON.stringify({
      formato: FORMATO_CIFRADO, version: 1, kdf: "PBKDF2-SHA256", iteraciones: ITERACIONES,
      sal: sal, iv: bufB64(iv), datos: bufB64(ct)
    });
  }
  async function descifrar(txt) {
    var x;
    try { x = JSON.parse(txt); } catch (e) { throw new Error(L("El archivo remoto está corrupto o no es de Mimo.", "The remote file is corrupt or is not from Mimo.", "远程文件已损坏，或不是来自 Mimo。")); }
    if (!x || x.formato !== FORMATO_CIFRADO || !x.sal || !x.iv || !x.datos) {
      throw new Error(L("El archivo remoto está corrupto o no es de Mimo.", "The remote file is corrupt or is not from Mimo.", "远程文件已损坏，或不是来自 Mimo。"));
    }
    if (Number(x.version) > 1) throw new Error(L("El archivo remoto usa un cifrado más nuevo que esta versión.", "The remote file uses encryption newer than this version.", "远程文件使用的加密版本比当前版本新。"));
    var key = await claveDeSal(x.sal);
    try {
      var plano = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64Buf(x.iv) }, key, b64Buf(x.datos)
      );
      meta.cifrado.sal = x.sal; meta.cifrado.activo = true; guardarMeta(); pintarClave();
      return new TextDecoder().decode(plano);
    } catch (e) {
      throw new Error(L("Contraseña de cifrado incorrecta o archivo remoto corrupto.", "Wrong encryption password or corrupt remote file.", "加密密码错误或远程文件损坏。"));
    }
  }
  function esCifrado(txt) {
    try { var x = JSON.parse(txt); return !!(x && x.formato === FORMATO_CIFRADO); }
    catch (e) { return false; }
  }

  /* ---- carpeta local (File System Access) ---- */
  function soportaCarpeta() {
    if (proveedorPrueba) return false;
    return esTauri() || typeof window.showDirectoryPicker === "function";
  }
  function abrirDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error(L("IndexedDB no disponible", "IndexedDB unavailable", "IndexedDB 不可用"))); return; }
      var r = indexedDB.open(DB, 2);
      r.onupgradeneeded = function () {
        var db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        if (!db.objectStoreNames.contains(STORE_CLAVES)) db.createObjectStore(STORE_CLAVES);
      };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  function idbPut(store, valor, clave) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(valor, clave);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  function idbGet(store, clave) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, "readonly");
        var req = tx.objectStore(store).get(clave);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }
  function idbDel(store, clave) {
    return abrirDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, "readwrite");
        tx.objectStore(store).delete(clave);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }
  async function guardarHandle(h) { try { await idbPut(STORE, h, "carpeta"); } catch (e) {} }
  async function leerHandle() { try { return await idbGet(STORE, "carpeta"); } catch (e) { return null; } }
  async function borrarHandle() { try { await idbDel(STORE, "carpeta"); } catch (e) {} }
  async function guardarClave(sal, key) { try { await idbPut(STORE_CLAVES, key, sal); } catch (e) {} }
  async function leerClave(sal) { try { return await idbGet(STORE_CLAVES, sal); } catch (e) { return null; } }
  async function borrarClaves() {
    try {
      var db = await abrirDB();
      await new Promise(function (resolve) {
        var tx = db.transaction(STORE_CLAVES, "readwrite");
        tx.objectStore(STORE_CLAVES).clear();
        tx.oncomplete = resolve; tx.onerror = resolve;
      });
    } catch (e) {}
  }
  async function guardarAcceso() {
    if (!claveAcceso) return false;
    try {
      if (!meta.cifrado.sal) return false; /* sin clave de cifrado no hay con qué envolverla */
      var envuelta = await cifrar(claveAcceso);
      localStorage.setItem(CLAVE_ACCESO, envuelta);
      return true;
    } catch (e) { return false; }
  }
  async function recuperarAcceso() {
    var guardada = "";
    try { guardada = localStorage.getItem(CLAVE_ACCESO) || ""; } catch (e) {}
    if (!guardada) return false;
    try {
      var plano = await descifrar(guardada);
      if (!plano) return false;
      claveAcceso = plano;
      try { sessionStorage.setItem("mimo.sync.clave.sesion", claveAcceso); } catch (e) {}
      var campo = $("#sync-webdav-clave-acceso");
      if (campo && !campo.value) campo.value = plano;
      return true;
    } catch (e) { return false; }
  }
  function borrarAcceso() {
    try { localStorage.removeItem(CLAVE_ACCESO); } catch (e) {}
  }

  async function obtenerCarpeta(pedir) {
    if (proveedorPrueba) return proveedorPrueba;
    if (esTauri()) {
      if (!carpetaTauri) {
        try {
          var guardada = await invocarTauri("carpeta_guardada", {});
          if (guardada) {
            carpetaTauri = guardada;
            if (meta.folderName !== guardada.nombre) { meta.folderName = guardada.nombre; guardarMeta(); }
          }
        } catch (e) {}
      }
      if (!carpetaTauri) throw new Error(L("Elige una carpeta de sincronización desde Ajustes.", "Choose a sync folder in Settings.", "请在设置中选择同步文件夹。"));
      return { tauri: true, nombre: carpetaTauri.nombre, ruta: carpetaTauri.ruta };
    }
    if (!soportaCarpeta()) throw new Error(L("Este navegador no permite elegir una carpeta persistente. Usa el modo Archivo manual.", "This browser cannot choose a persistent folder. Use Manual file.", "此浏览器无法选择持久文件夹。请使用手动文件。"));
    if (!handleLeido) { carpetaHandle = await leerHandle(); handleLeido = true; }
    if (!carpetaHandle) {
      if (!pedir) return null;
      carpetaHandle = await window.showDirectoryPicker({ mode: "readwrite", id: "mimo-sync" });
      await guardarHandle(carpetaHandle);
    }
    if (carpetaHandle.queryPermission) {
      var p = await carpetaHandle.queryPermission({ mode: "readwrite" });
      if (p !== "granted" && pedir) p = await carpetaHandle.requestPermission({ mode: "readwrite" });
      if (p !== "granted") throw new Error(L("Falta permiso para escribir en la carpeta elegida.", "Permission to write in the chosen folder is missing.", "缺少写入所选文件夹的权限。"));
    }
    return carpetaHandle;
  }
  async function leerCarpeta(pedir) {
    if (esTauri()) {
      var info = await obtenerCarpeta(true);
      var t = await invocarTauri("leer_carpeta", {});
      if (t == null) return null;
      return { texto: t, nombre: info.nombre || ARCHIVO, rev: await hashTexto(t) };
    }
    var dir = await obtenerCarpeta(pedir); if (!dir) return null;
    var fh;
    try { fh = await dir.getFileHandle(ARCHIVO, { create: false }); }
    catch (e) { if (e && e.name === "NotFoundError") return null; throw e; }
    var file = await fh.getFile();
    var texto = await file.text();
    return { texto: texto, nombre: dir.name || ARCHIVO, rev: await hashTexto(texto) };
  }
  async function escribirCarpeta(texto, revEsperada) {
    if (esTauri()) {
      await obtenerCarpeta(true);
      if (revEsperada) {
        var actual = await leerCarpeta(true);
        if (!actual) throw new Error(L("El archivo remoto desapareció. Vuelve a sincronizar.", "The remote file disappeared. Sync again.", "远程文件消失了。请重新同步。"));
        if (actual.rev !== revEsperada) throw new Error(L("El archivo cambió mientras sincronizabas. Vuelve a intentarlo.", "The file changed while you were syncing. Try again.", "同步时文件发生了变化。请重试。"));
      }
      await invocarTauri("escribir_carpeta", { texto: texto });
      var vuelta = await invocarTauri("leer_carpeta", {});
      if (vuelta !== texto) throw new Error(L("No se pudo verificar la escritura del archivo.", "The file write could not be verified.", "无法验证文件写入。"));
      return { rev: await hashTexto(texto) };
    }
    var dir = await obtenerCarpeta(true);
    if (revEsperada) {
      var actual = await leerCarpeta(true);
      if (!actual) throw new Error(L("El archivo remoto desapareció. Vuelve a sincronizar.", "The remote file disappeared. Sync again.", "远程文件消失了。请重新同步。"));
      if (actual.rev !== revEsperada) throw new Error(L("El archivo cambió mientras sincronizabas. Vuelve a intentarlo.", "The file changed while you were syncing. Try again.", "同步时文件发生了变化。请重试。"));
    }
    var fh = await dir.getFileHandle(ARCHIVO, { create: true });
    var w = await fh.createWritable();
    await w.write(texto); await w.close();
    var check = await fh.getFile(); var t = await check.text();
    if (t !== texto) throw new Error(L("No se pudo verificar la escritura del archivo.", "The file write could not be verified.", "无法验证文件写入。"));
    return { rev: await hashTexto(texto) };
  }

  /* ---- WebDAV / Nextcloud ---- */
  function urlBase() { return String(meta.webdav.url || "").trim().replace(/\/+$/, ""); }
  function rutaCarpeta() { return String(meta.webdav.carpeta || "").trim().replace(/^\/+|\/+$/g, ""); }
  function trozosCarpeta() { return rutaCarpeta() ? rutaCarpeta().split("/").filter(Boolean) : []; }
  function urlArchivo() {
    var nombre = ARCHIVO_CIFRADO;
    var partes = trozosCarpeta().map(encodeURIComponent);
    return urlBase() + (partes.length ? "/" + partes.join("/") : "") + "/" + nombre;
  }
  function cabeceraAuth() {
    if (!meta.webdav.usuario) return "";
    try {
      return "Basic " + btoa(unescape(encodeURIComponent(meta.webdav.usuario + ":" + (claveAcceso || meta.webdav.clave || ""))));
    } catch (e) { return ""; }
  }
  function cabeceras(extra) {
    var h = Object.assign({ "Accept": "application/json, text/plain, */*" }, extra || {});
    /* La credencial guardada rellena las peticiones de WebDAV, pero nunca pisa una
       cabecera explícita: el conector de Nextcloud comprueba las suyas. */
    var a = cabeceraAuth(); if (a && !h.Authorization) h.Authorization = a;
    return h;
  }
  function esTauri() {
    var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
    return !!(t && t.invoke);
  }
  function invocarTauri(cmd, args) {
    var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core);
    return t.invoke(cmd, args);
  }
  async function pedirNativo(url, opciones) {
    var cab = cabeceras(opciones && opciones.headers);
    var cuerpo = opciones && opciones.body != null ? String(opciones.body) : null;
    var metodo = (opciones && opciones.method) || "GET";
    var r;
    try {
      r = await invocarTauri("http_pedir", {
        peticion: { metodo: metodo, url: url, cabeceras: cab, cuerpo: cuerpo }
      });
    } catch (e) {
      var y = new Error(L("No se pudo conectar con el servidor: ", "Could not reach the server: ", "无法连接服务器：") + (e && e.message ? e.message : e));
      y.red = true; y.causa = e; throw y;
    }
    var mapa = r && r.cabeceras ? r.cabeceras : {};
    return {
      ok: r.estado >= 200 && r.estado < 300,
      status: r.estado,
      headers: {
        get: function (nombre) {
          var buscado = String(nombre).toLowerCase(), k;
          for (k in mapa) {
            if (Object.prototype.hasOwnProperty.call(mapa, k) && k.toLowerCase() === buscado) return mapa[k];
          }
          return null;
        }
      },
      text: async function () { return r.cuerpo == null ? "" : String(r.cuerpo); },
      json: async function () { return JSON.parse(String(r.cuerpo || "")); }
    };
  }
  async function pedir(url, opciones) {
    if (esTauri()) return pedirNativo(url, opciones);
    var ctrl = new AbortController(), cortado = false;
    var t = setTimeout(function () { cortado = true; ctrl.abort(); }, 20000);
    var o = Object.assign({ cache: "no-store", signal: ctrl.signal }, opciones || {});
    o.headers = cabeceras(opciones && opciones.headers);
    try {
      return await fetch(url, o);
    } catch (e) {
      if (cortado) { var x = new Error(L("El servidor no respondió en 20 s.", "The server did not respond within 20 s.", "服务器在 20 秒内没有响应。")); x.red = true; throw x; }
      var y = new Error(L("No se pudo conectar con el servidor (red o CORS).", "Could not reach the server (network or CORS).", "无法连接服务器（网络或跨域）。"));
      y.red = true; y.causa = e; throw y;
    } finally { clearTimeout(t); }
  }
  /* ---- conector de Nextcloud ----
     El usuario escribe la dirección como la escribe en el navegador. Mimo confirma
     que hay un Nextcloud, pide el perfil para saber el identificador y arma la ruta
     WebDAV: /remote.php/dav/files/<id>/. Es el campo donde más gente se equivoca. */
  function normalizarDireccion(v) {
    var s = String(v || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    return s.replace(/\/+$/, "");
  }
  function decirNc(texto, mal) {
    var e = $("#sync-nc-estado");
    if (!e) return;
    e.textContent = texto;
    e.className = "muted" + (mal ? " err" : "");
  }
  async function conectarNextcloud() {
    var dir = normalizarDireccion($("#sync-nc-url") ? $("#sync-nc-url").value : "");
    var usuario = $("#sync-nc-usuario") ? $("#sync-nc-usuario").value.trim() : "";
    var clave = $("#sync-nc-clave") ? $("#sync-nc-clave").value : "";
    if (!dir) { decirNc(L("Escribe la dirección de tu Nextcloud.", "Type your Nextcloud address.", "请输入你的 Nextcloud 地址。"), true); return; }
    if (!usuario || !clave) { decirNc(L("Faltan el usuario o la contraseña de aplicación.", "The user or the app password is missing.", "缺少用户名或应用密码。"), true); return; }
    decirNc(L("Comprobando…", "Checking…", "检查中…"));
    try {
      var st = await pedir(dir + "/status.php", { method: "GET" });
      if (!st.ok) throw new Error(explicarHttp(st.status, L("Esa dirección no responde como un Nextcloud", "That address does not answer as a Nextcloud", "该地址的响应不像 Nextcloud")));
      var info = {};
      try { info = JSON.parse(st.texto) || {}; } catch (e) {}
      if (info.installed === false) throw new Error(L("Ese Nextcloud todavía no está instalado.", "That Nextcloud is not installed yet.", "该 Nextcloud 尚未安装。"));
      var auth = "Basic " + btoa(unescape(encodeURIComponent(usuario + ":" + clave)));
      var ocs = await pedir(dir + "/ocs/v2.php/cloud/user?format=json", { method: "GET", headers: { Authorization: auth, "OCS-APIRequest": "true" } });
      if (ocs.status === 401 || ocs.status === 403) {
        throw new Error(L("El usuario o la contraseña de aplicación no son correctos. Créala en Ajustes personales → Seguridad.", "The user or the app password is wrong. Create one in Personal settings → Security.", "用户名或应用密码不正确。请在个人设置 → 安全中创建。"));
      }
      if (!ocs.ok) throw new Error(explicarHttp(ocs.status, L("No se pudo leer el perfil de Nextcloud", "Could not read the Nextcloud profile", "无法读取 Nextcloud 资料")));
      var datos = {};
      try { datos = ((JSON.parse(ocs.texto) || {}).ocs || {}).data || {}; } catch (e) {}
      var id = datos.id || datos.uid || usuario;
      meta.provider = "webdav"; meta.nc = true; meta.ncUrl = dir;
      meta.webdav = Object.assign({}, meta.webdav, {
        url: dir + "/remote.php/dav/files/" + encodeURIComponent(id),
        usuario: usuario,
        carpeta: meta.webdav.carpeta || "Mimo"
      });
      claveAcceso = clave;
      guardarMeta(); guardarAcceso();
      if ($("#sync-nc-clave")) $("#sync-nc-clave").value = "";
      decirNc(L("Conectado como ", "Connected as ", "已连接为 ") + id + ".");
      cargarCamposWebDAV(); pintarUI();
      avisar(L("Nextcloud conectado. Pulsa «Sincronizar ahora».", "Nextcloud connected. Press “Sync now”.", "Nextcloud 已连接。请按“立即同步”。"));
    } catch (e) {
      decirNc(e && e.message ? e.message : L("No se pudo conectar.", "Could not connect.", "无法连接。"), true);
    }
  }

  /* Un error HTTP no es un mensaje: es una pista. Se traduce a lo que el usuario
     puede hacer, sin perder el código para quien depure. */
  function explicarHttp(estado, donde) {
    var cola = " (HTTP " + estado + ")";
    if (estado === 401 || estado === 403) {
      return L("El servidor rechazó el usuario o la contraseña de aplicación" + cola + ". Revisa las credenciales; si es Nextcloud, crea una contraseña de aplicación en Ajustes personales → Seguridad.",
        "The server rejected the user or the app password" + cola + ". Check the credentials; for Nextcloud, create an app password in Personal settings → Security.",
        "服务器拒绝了用户名或应用密码" + cola + "。请检查凭据；Nextcloud 请在个人设置 → 安全中创建应用密码。");
    }
    if (estado === 404) {
      return L("Esa dirección no tiene la carpeta de Mimo" + cola + ". En Nextcloud la dirección termina en /remote.php/dav/files/TU-USUARIO/.",
        "That address has no Mimo folder" + cola + ". In Nextcloud the address ends with /remote.php/dav/files/YOUR-USER/.",
        "该地址没有 Mimo 文件夹" + cola + "。Nextcloud 的地址以 /remote.php/dav/files/你的用户名/ 结尾。");
    }
    if (estado === 405) {
      return L("El destino no admite escritura por WebDAV" + cola + ". Comprueba que la cuenta puede crear archivos en esa carpeta.",
        "The destination does not allow WebDAV writes" + cola + ". Check that the account can create files in that folder.",
        "目标不允许通过 WebDAV 写入" + cola + "。请检查该账户能否在该文件夹中创建文件。");
    }
    if (estado === 507) {
      return L("No queda espacio en el destino" + cola + ".", "The destination is out of space" + cola + ".", "目标空间不足" + cola + "。");
    }
    return donde + cola + ".";
  }
  async function asegurarCarpeta() {
    var partes = trozosCarpeta(); if (!partes.length) return;
    var acum = urlBase();
    for (var i = 0; i < partes.length; i++) {
      acum += "/" + encodeURIComponent(partes[i]);
      var res = await pedir(acum, { method: "MKCOL" });
      if (res.status === 401 || res.status === 403) throw new Error(explicarHttp(res.status, ""));
      if ([201, 200, 204, 301, 405, 409].indexOf(res.status) === -1) {
        throw new Error(explicarHttp(res.status, L("No se pudo crear la carpeta remota", "Could not create the remote folder", "无法创建远程文件夹")));
      }
    }
  }
  async function webdavLeer() {
    if (!urlBase()) throw new Error(L("Falta la URL del servidor WebDAV.", "The WebDAV server URL is missing.", "缺少 WebDAV 服务器 URL。"));
    var res = await pedir(urlArchivo(), { method: "GET" });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new Error(explicarHttp(res.status, ""));
    if (!res.ok) throw new Error(explicarHttp(res.status, L("No se pudo leer la copia remota", "Could not read the remote copy", "无法读取远程副本")));
    var cuerpo = await res.text();
    var rev = await hashTexto(cuerpo);
    var etag = res.headers.get("ETag") || "";
    if (!esCifrado(cuerpo)) {
      throw new Error(L("El archivo remoto no está cifrado. Mimo no aplica texto claro desde WebDAV.", "The remote file is not encrypted. Mimo does not apply plain text from WebDAV.", "远程文件未加密。Mimo 不会应用来自 WebDAV 的明文。"));
    }
    var texto = await descifrar(cuerpo);
    return { texto: texto, rev: rev, etag: etag, cifrado: true };
  }
  async function webdavEscribir(texto, revEsperada, etagEsperado) {
    if (!urlBase()) throw new Error(L("Falta la URL del servidor WebDAV.", "The WebDAV server URL is missing.", "缺少 WebDAV 服务器 URL。"));
    await asegurarCarpeta();
    var cuerpo = await cifrar(texto);
    var cab = { "Content-Type": "application/json" };
    if (etagEsperado) cab["If-Match"] = etagEsperado;
    else if (revEsperada) {
      var actual = await webdavLeer();
      if (!actual) throw new Error(L("El archivo remoto desapareció. Vuelve a sincronizar.", "The remote file disappeared. Sync again.", "远程文件消失了。请重新同步。"));
      if (actual.rev !== revEsperada) {
        var e = new Error(L("El archivo remoto cambió mientras sincronizabas.", "The remote file changed while you were syncing.", "同步时远程文件发生了变化。")); e.codigo = 412; throw e;
      }
    } else cab["If-None-Match"] = "*";
    var res = await pedir(urlArchivo(), { method: "PUT", headers: cab, body: cuerpo });
    if (res.status === 412) {
      var c = new Error(L("El archivo remoto cambió mientras sincronizabas.", "The remote file changed while you were syncing.", "同步时远程文件发生了变化。")); c.codigo = 412; throw c;
    }
    if (!res.ok) throw new Error(explicarHttp(res.status, L("No se pudo escribir la copia remota", "Could not write the remote copy", "无法写入远程副本")));
    return { rev: await hashTexto(cuerpo), etag: res.headers.get("ETag") || "" };
  }
  async function probarWebDAV() {
    if (!urlBase()) { ultimoError = L("Falta la URL del servidor WebDAV.", "The WebDAV server URL is missing.", "缺少 WebDAV 服务器 URL。"); pintarUI(); return; }
    try {
      sincronizando = true; ultimoError = ""; pintarUI();
      var r = await webdavLeer();
      avisar(r ? L("Conexión correcta: hay un archivo remoto de ", "Connection OK: there is a remote file of ", "连接成功：远程文件大小 ") + r.texto.length + L(" caracteres.", " characters.", " 个字符。") :
        L("Conexión correcta: todavía no hay archivo remoto; se creará al sincronizar.", "Connection OK: there is no remote file yet; it will be created when you sync.", "连接成功：还没有远程文件；同步时会创建。"));
    } catch (e) {
      ultimoError = e.message || L("No se pudo conectar.", "Could not connect.", "无法连接。"); avisar(ultimoError);
    } finally { sincronizando = false; pintarUI(); }
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
      if (txt == null) { var e = new Error(L("Selección cancelada", "Selection cancelled", "已取消选择")); e.name = "AbortError"; throw e; }
      return { texto: txt, nombre: ARCHIVO, rev: await hashTexto(txt) };
    }
    if (meta.provider === "webdav") return webdavLeer();
    return null;
  }
  async function escribirRemoto(texto, revEsperada, etagEsperado) {
    if (proveedorPrueba) {
      var r = await proveedorPrueba.escribir(texto, revEsperada);
      return r || { rev: await hashTexto(texto) };
    }
    if (meta.provider === "carpeta") return escribirCarpeta(texto, revEsperada);
    if (meta.provider === "archivo") {
      descargarTexto(texto, ARCHIVO);
      return { rev: await hashTexto(texto) };
    }
    if (meta.provider === "webdav") return webdavEscribir(texto, revEsperada, etagEsperado);
    throw new Error(L("No hay un modo de sincronización configurado.", "No sync mode is configured.", "未配置同步方式。"));
  }

  /* ---- cola local (offline first) ---- */
  function marcarPendiente(motivo, reintentar) {
    if (!esNube()) return;
    if (!cola.pendiente) { cola.desde = ahora(); cola.reintentar = false; }
    cola.pendiente = true;
    if (motivo) cola.motivo = motivo;
    if (reintentar) cola.reintentar = true;
    guardarCola();
  }
  function limpiarCola() {
    cola = colaDefecto(); guardarCola();
  }
  function esFalloRed(e) {
    if (e && e.red) return true;
    if (e && (e.name === "TypeError" || e.name === "NetworkError" || e.name === "TimeoutError")) return true;
    return /fetch|network|conexi|sin red|load failed|failed to fetch|no se pudo conectar|no respondió/i.test(String(e && e.message || ""));
  }
  function esperaReintento() {
    var tabla = [5000, 15000, 60000, 180000, 300000];
    return tabla[Math.min(cola.intentos, tabla.length - 1)];
  }
  function programarReintento(ms) {
    clearTimeout(timerReintento);
    timerReintento = setTimeout(function () {
      if (!cola.pendiente || !cola.reintentar || sincronizando || conflicto) return;
      if (!navigator.onLine) return;
      sincronizar(true, null, { reintento: true });
    }, Math.max(400, ms || 0));
  }

  /* ---- respaldo ---- */
  function respaldarLocal() {
    try {
      localStorage.setItem(CLAVE_BACKUP, JSON.stringify({ fecha: ahora(), estado: host().snapshot() }));
    } catch (e) {}
  }

  /* ---- estado de la UI ---- */
  function icono(id) { return '<svg class="icono" aria-hidden="true"><use href="#' + id + '"/></svg>'; }
  function pintarClave() {
    var p = $("#sync-webdav-clave-estado");
    if (!p) return;
    var tiene = !!meta.cifrado.activo;
    p.textContent = tiene
      ? L("Cifrado activo en este equipo (AES-GCM). La contraseña de cifrado no se guarda: solo la clave derivada, que también protege la contraseña de aplicación.", "Encryption active on this device (AES-GCM). The encryption password is not saved: only the derived key, which also protects the app password.", "此设备已启用加密（AES-GCM）。加密密码不保存，只保存派生密钥，它同时保护应用密码。")
      : L("Sin clave en este equipo. Escríbela antes de sincronizar; sin ella no se sube nada.", "No key on this device. Enter it before syncing; nothing is uploaded without it.", "此设备没有密钥。同步前请输入；没有它不会上传任何内容。");
    p.className = "muted" + (tiene ? " ok" : "");
  }
  function pintarUI() {
    var est = $("#sync-estado");
    if (!est) return;
    var texto, clase = "muted";
    if (!meta.provider) texto = L("Sin configurar. Elige un modo para llevar tus datos a otro equipo.", "Not configured. Choose a mode to carry your data to another device.", "未配置。选择一种方式把数据带到另一台设备。");
    else if (sincronizando) texto = L("Sincronizando…", "Syncing…", "同步中…");
    else if (esNube() && !navigator.onLine) texto = L("Sin conexión. Tus cambios están guardados aquí; se enviarán al volver la red.", "Offline. Your changes are saved here; they will be sent when the network returns.", "离线。更改已保存在此；网络恢复后会发送。");
    else if (ultimoError) { texto = L("Error: ", "Error: ", "错误：") + ultimoError; clase = "muted err"; }
    else if (conflicto) { texto = L("Conflicto: las dos copias cambiaron. Elige una versión.", "Conflict: both copies changed. Choose a version.", "冲突：两份副本都改了。请选择一个版本。"); clase = "muted err"; }
    else if (esNube() && cola.pendiente) texto = L("Cambios en espera de subir a la nube.", "Changes waiting to upload to the cloud.", "更改等待上传到云端。");
    else if (cambios) texto = L("Cambios locales sin sincronizar.", "Local changes not synced.", "本地更改未同步。");
    else if (meta.lastSyncAt) texto = L("Sincronizado ", "Synced ", "已同步 ") + hace(meta.lastSyncAt) + ".";
    else texto = L("Listo para sincronizar.", "Ready to sync.", "可以同步。");
    est.textContent = texto;
    est.className = clase;
    var sel = $("#sync-proveedor"); if (sel) sel.value = meta.provider === "webdav" && meta.nc ? "nextcloud" : (meta.provider || "");
    var w = $("#sync-webdav"); if (w) w.hidden = meta.provider !== "webdav";
    var cw = $("#sync-webdav-conexion"); if (cw) cw.hidden = !!meta.nc;
    var nc = $("#sync-nextcloud"); if (nc) nc.hidden = !(meta.provider === "webdav" && meta.nc);
    var c = $("#sync-carpeta"); if (c) c.hidden = meta.provider !== "carpeta";
    var a = $("#sync-archivo"); if (a) a.hidden = meta.provider !== "archivo";
    var m = $("#sync-manual");
    if (m) { m.checked = !!meta.manualOnly; m.disabled = meta.provider === "archivo"; }
    var cn = $("#sync-carpeta-nombre");
    if (cn) cn.textContent = meta.folderName ? L("Carpeta: ", "Folder: ", "文件夹：") + meta.folderName : L("Sin carpeta elegida.", "No folder chosen.", "未选择文件夹。");
    var u = $("#sync-ultima");
    if (u) u.textContent = meta.lastSyncAt
      ? L("Última sincronización: ", "Last sync: ", "上次同步：") + fecha(meta.lastSyncAt) + (meta.lastRemoteVersion ? " · " + L("archivo v", "file v", "文件 v") + meta.lastRemoteVersion : "") + "."
      : L("Nunca sincronizado.", "Never synced.", "从未同步。");
    var b = $("#btn-sync");
    if (b) {
      b.classList.toggle("girando", sincronizando);
      b.title = !meta.provider ? L("Configurar sincronización", "Set up sync", "设置同步")
        : sincronizando ? L("Sincronizando…", "Syncing…", "同步中…")
        : ultimoError ? L("Error de sincronización; clic para reintentar", "Sync error; click to retry", "同步错误；点击重试")
        : conflicto ? L("Conflicto de sincronización", "Sync conflict", "同步冲突")
        : (esNube() && cola.pendiente) ? L("Cambios en espera; clic para reintentar", "Changes waiting; click to retry", "更改等待中；点击重试")
        : cambios ? L("Hay cambios locales; clic para sincronizar", "Local changes; click to sync", "有本地更改；点击同步")
        : L("Sincronizado; clic para sincronizar ahora", "Synced; click to sync now", "已同步；点击立即同步");
      b.innerHTML = icono(sincronizando ? "i-sync" : (ultimoError || conflicto ? "i-alerta" : "i-check"));
    }
    var pr = $("#sync-prueba");
    if (pr) {
      var prueba = meta.ultimaPrueba;
      if (prueba && prueba.fecha) {
        pr.textContent = L("Comprobante: ", "Receipt: ", "凭据：") + fecha(new Date(prueba.fecha).getTime())
          + " · " + resumenTexto(prueba.cuentas || { tareas: 0, notas: 0, eventos: 0, ramos: 0, sesiones: 0 })
          + " · " + (prueba.peso || "")
          + " · " + (prueba.sentido === "bajada" ? L("recibida", "received", "已接收") : L("enviada", "sent", "已发送"))
          + (prueba.clientId ? " · " + L("equipo ", "device ", "设备 ") + prueba.clientId : "") + ".";
        pr.className = "muted ok";
      } else {
        pr.textContent = L("Sin comprobante todavía: la primera sincronización lo deja aquí.", "No receipt yet: the first sync will leave it here.", "还没有凭据：第一次同步会留在这里。");
        pr.className = "muted";
      }
    }
    var vc = $("#sync-ver-copia");
    if (vc) vc.hidden = !meta.provider;
    pintarClave();
    try { document.dispatchEvent(new CustomEvent("mimo:sync")); } catch (e) {}
  }

  /* ---- ver la copia remota: la prueba que el usuario puede leer ---- */
  async function verCopia() {
    if (!meta.provider) {
      avisar(L("Elige primero un destino de sincronización.", "Choose a sync destination first.", "请先选择同步目标。"));
      return;
    }
    try {
      sincronizando = true; ultimoError = ""; pintarUI();
      var r = await leerRemoto();
      if (!r || r.texto == null) {
        avisar(L("El destino todavía no tiene ninguna copia de Mimo.", "The destination has no Mimo copy yet.", "目标上还没有 Mimo 副本。"));
        return;
      }
      var env = leerEnvelope(r.texto);
      var cuando = env.lastModified ? fecha(env.lastModified) : L("fecha desconocida", "unknown date", "日期未知");
      avisar(L("En el destino: ", "In the destination: ", "目标中：") + cuando
        + " · " + resumenTexto(cuentasDe(env.estado))
        + " · " + tamano(r.texto)
        + " · " + L("equipo ", "device ", "设备 ") + String(env.clientId || "?").slice(0, 8) + ".");
    } catch (e) {
      ultimoError = e && e.message ? e.message : L("No se pudo leer el destino.", "Could not read the destination.", "无法读取目标。");
      avisar(ultimoError);
    } finally { sincronizando = false; pintarUI(); }
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
  function cancelarConflicto() {
    conflicto = null; cerrarConflicto();
    if (esNube() && cola.pendiente) { cola.proximo = Date.now() + 5 * 60 * 1000; guardarCola(); }
    pintarUI();
  }
  async function usarLocal() {
    if (!conflicto) return;
    var c = conflicto;
    cerrarConflicto();
    try {
      await subir(c.local, c.localHash, c.remoto);
      conflicto = null; avisar(L("Se conservó la copia local y se subió.", "The local copy was kept and uploaded.", "已保留本地副本并上传。"));
    } catch (e) {
      ultimoError = e.message || L("No se pudo subir la copia local.", "The local copy could not be uploaded.", "无法上传本地副本。");
      if (esNube()) { var red = esFalloRed(e); marcarPendiente("conflicto", red); if (red) programarReintento(esperaReintento()); }
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
      meta.lastRemoteRev = c.remoto.rev; meta.lastRemoteVersion = c.remoto.version;
      meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
      guardarMeta(); cambios = false; conflicto = null; aplicando = false; limpiarCola();
      avisar(L("Se aplicó la copia remota. La copia local quedó como respaldo.", "The remote copy was applied. The local copy was kept as a backup.", "已应用远程副本。本地副本保留为备份。"));
    } catch (e) {
      aplicando = false;
      ultimoError = e.message || L("No se pudo aplicar la copia remota.", "The remote copy could not be applied.", "无法应用远程副本。");
      avisar(ultimoError);
    }
    pintarUI();
  }

  /* ---- subir / aplicar ---- */
  async function subir(local, localHash, remoto) {
    var version = (remoto && remoto.env ? Number(remoto.env.syncVersion) || 0 : meta.lastRemoteVersion || 0) + 1;
    var env = envolver(local, version);
    var texto = JSON.stringify(env, null, 2);
    var res = await escribirRemoto(texto, remoto ? remoto.rev : null, remoto ? remoto.etag : null);
    meta.lastRemoteRev = res && res.rev ? res.rev : await hashTexto(texto);
    meta.lastRemoteVersion = version;
    meta.lastLocalHash = localHash;
    meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarAcceso();
    anotarPrueba({ fecha: meta.lastSyncAt, peso: tamano(texto), sentido: "subida", version: version, cuentas: cuentasDe(local), clientId: meta.clientId && meta.clientId.slice ? meta.clientId.slice(0, 8) : "" });
    guardarMeta(); cambios = false; ultimoError = ""; limpiarCola();
    limpiarCampoClave();
    avisar(meta.provider === "archivo" ? L("Archivo de sincronización guardado. Cópialo a tu nube.", "Sync file saved. Copy it to your cloud.", "同步文件已保存。请复制到你的云端。")
      : meta.provider === "webdav" ? L("Sincronizado y cifrado en la nube.", "Synced and encrypted in the cloud.", "已同步并加密到云端。")
      : L("Sincronizado.", "Synced.", "已同步。"));
  }
  async function aplicarRemoto(env, remoto) {
    respaldarLocal();
    aplicando = true;
    host().reemplazar(env.estado);
    var h = await hashEstado(host().snapshot());
    meta.lastRemoteRev = remoto.rev;
    meta.lastRemoteVersion = Number(env.syncVersion) || 1;
    meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    anotarPrueba({ fecha: meta.lastSyncAt, peso: tamano(remoto.texto), sentido: "bajada", version: Number(env.syncVersion) || 1, cuentas: cuentasDe(env.estado), clientId: env.clientId && env.clientId.slice ? env.clientId.slice(0, 8) : "" });
    guardarMeta(); cambios = false; ultimoError = ""; aplicando = false; limpiarCola();
    limpiarCampoClave();
    avisar(L("Datos remotos aplicados. La copia local quedó como respaldo.", "Remote data applied. The local copy was kept as a backup.", "已应用远程数据。本地副本保留为备份。"));
  }

  async function procesarRemoto(remoto, local, localHash, localTieneDatos) {
    if (!remoto || remoto.texto === null) {
      if (!localTieneDatos) { cambios = false; limpiarCola(); pintarUI(); return; }
      await subir(local, localHash, null);
      return;
    }
    var env = leerEnvelope(remoto.texto);
    var remoteRev = remoto.rev || await hashTexto(remoto.texto);
    var remoteVersion = Number(env.syncVersion) || 1;
    var remoteCambio = !meta.lastRemoteRev || remoteRev !== meta.lastRemoteRev;
    var localCambio = meta.lastLocalHash ? localHash !== meta.lastLocalHash : localTieneDatos;
    if (!localTieneDatos && !localCambio) { await aplicarRemoto(env, remoto); return; }
    if (remoteCambio && localCambio) {
      conflicto = {
        env: env, remoto: Object.assign({}, remoto, { env: env, rev: remoteRev, version: remoteVersion }),
        local: local, localHash: localHash, localFecha: Date.now()
      };
      if (esNube()) marcarPendiente("conflicto", false);
      pintarUI(); abrirConflicto(); return;
    }
    if (remoteCambio) { await aplicarRemoto(env, remoto); return; }
    if (localCambio) { await subir(local, localHash, remoto); return; }
    meta.lastRemoteRev = remoteRev; meta.lastRemoteVersion = remoteVersion;
    meta.lastLocalHash = localHash; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarMeta(); cambios = false; ultimoError = ""; limpiarCola();
    pintarUI();
  }

  async function sincronizar(auto, remotoPre, opciones) {
    opciones = opciones || {};
    if (sincronizando) return;
    if (conflicto) { abrirConflicto(); return; }
    if (!meta.provider) {
      avisar(L("Elige un modo de sincronización en Ajustes.", "Choose a sync mode in Settings.", "请在设置中选择同步方式。"));
      if (host()) host().ir("ajustes");
      return;
    }
    if (auto && (meta.manualOnly && !opciones.reintento) || (auto && meta.provider === "archivo")) return;
    if (opciones.reintento && (!cola.pendiente || !cola.reintentar)) return;
    sincronizando = true; ultimoError = ""; pintarUI();
    try {
      if (meta.provider === "carpeta" && !proveedorPrueba) await obtenerCarpeta(true);
      var local = host().snapshot();
      var localHash = await hashEstado(local);
      var localDatos = host().tieneDatos();
      var remoto = remotoPre || await leerRemoto();
      try {
        await procesarRemoto(remoto, local, localHash, localDatos);
      } catch (e) {
        if (e && e.codigo === 412 && !opciones.reintentado) {
          opciones.reintentado = true;
          var fresco = await leerRemoto();
          await procesarRemoto(fresco, local, localHash, localDatos);
        } else { throw e; }
      }
    } catch (e) {
      if (e && e.name === "AbortError") { ultimoError = ""; avisar(L("Selección cancelada.", "Selection cancelled.", "已取消选择。")); }
      else {
        ultimoError = e && e.message ? e.message : L("No se pudo sincronizar.", "Could not sync.", "无法同步。");
        if (e && e.name === "NotAllowedError") ultimoError = L("Permiso de carpeta no concedido.", "Folder permission not granted.", "未授予文件夹权限。");
        if (e && e.necesitaClave && host()) { host().ir("ajustes"); var campo = $("#sync-webdav-clave"); if (campo) campo.focus(); }
        if (esNube()) {
          var red = esFalloRed(e);
          marcarPendiente(e && e.necesitaClave ? "falta la clave" : "error de sincronización", red);
          if (red) {
            cola.intentos = (cola.intentos || 0) + 1;
            cola.proximo = Date.now() + esperaReintento();
            cola.ultimoError = ultimoError;
            guardarCola();
            if (navigator.onLine) programarReintento(esperaReintento());
          }
        }
        avisar(ultimoError);
      }
    } finally {
      sincronizando = false; pintarUI();
      recalcularCambios().then(function () {
        if (esNube() && cambios && !conflicto) marcarPendiente("cambio durante la sincronización", !navigator.onLine);
      });
    }
  }

  /* ---- configuración ---- */
  async function elegirCarpeta() {
    try {
      if (esTauri()) {
        var info = await invocarTauri("elegir_carpeta", {});
        if (!info) return;
        carpetaTauri = info;
        meta.provider = "carpeta"; meta.folderName = info.nombre || "carpeta"; meta.manualOnly = true;
        guardarMeta(); pintarUI(); avisar(L("Carpeta de sincronización elegida: ", "Sync folder chosen: ", "已选择同步文件夹：") + meta.folderName + ".");
        return;
      }
      var h = await window.showDirectoryPicker({ mode: "readwrite", id: "mimo-sync" });
      carpetaHandle = h; handleLeido = true; await guardarHandle(h);
      meta.provider = "carpeta"; meta.folderName = h.name || "carpeta"; meta.manualOnly = true;
      guardarMeta(); pintarUI(); avisar(L("Carpeta de sincronización elegida: ", "Sync folder chosen: ", "已选择同步文件夹：") + meta.folderName + ".");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      ultimoError = e.message || L("No se pudo elegir la carpeta.", "Could not choose the folder.", "无法选择文件夹。"); pintarUI(); avisar(ultimoError);
    }
  }
  function cambiarProveedor() {
    var v = $("#sync-proveedor").value;
    if (v === "nextcloud") { meta.provider = "webdav"; meta.nc = true; }
    else { meta.provider = v || ""; if (v === "webdav") meta.nc = false; }
    if (v === "archivo") meta.manualOnly = true;
    if (!v) { meta.lastRemoteRev = ""; meta.lastRemoteVersion = 0; meta.lastLocalHash = ""; meta.lastSyncAt = ""; meta.folderName = ""; }
    guardarMeta(); cargarCamposWebDAV(); pintarUI();
    if (v === "carpeta" && !proveedorPrueba && soportaCarpeta()) {
      avisar(L("Pulsa «Elegir carpeta» para autorizar la carpeta.", "Press “Choose folder” to authorize the folder.", "按“选择文件夹”以授权该文件夹。"));
    }
    if (v === "webdav") {
      var campo = $("#sync-webdav-url"); if (campo) campo.focus();
    }
    if (v && v !== "webdav") limpiarCola();
  }
  function desconectar() {
    if (!window.confirm(L("¿Desconectar la sincronización? No se borran tus datos ni el archivo remoto.", "Disconnect sync? Your data and the remote file are not deleted.", "断开同步？你的数据和远程文件不会被删除。"))) return;
    meta.provider = ""; meta.folderName = ""; meta.nc = false; meta.ncUrl = "";
    meta.lastRemoteRev = ""; meta.lastRemoteVersion = 0;
    meta.lastLocalHash = ""; meta.lastSyncAt = ""; meta.ultimoCambio = "";
    meta.webdav.clave = "";
    claveAcceso = "";
    borrarAcceso();
    try { sessionStorage.removeItem("mimo.sync.clave.sesion"); } catch (e) {}
    carpetaHandle = null; handleLeido = true; borrarHandle();
    carpetaTauri = null;
    if (esTauri()) { try { invocarTauri("olvidar_carpeta", {}).catch(function () {}); } catch (e) {} }
    claveMemo = null; claveSal = "";
    guardarMeta(); conflicto = null; cambios = host().tieneDatos(); limpiarCola(); pintarUI();
    avisar(L("Sincronización desconectada.", "Sync disconnected.", "同步已断开。"));
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
    timerEstado = setTimeout(function () {
      recalcularCambios().then(function () {
        if (esNube() && cambios && !conflicto) marcarPendiente("cambio local", !navigator.onLine);
      });
    }, 350);
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
        guardarMeta(); cambios = false; ultimoError = ""; limpiarCola();
        avisar(L("Archivo de sincronización descargado.", "Sync file downloaded.", "同步文件已下载。"));
      } catch (e) { ultimoError = e.message || L("No se pudo guardar el archivo.", "Could not save the file.", "无法保存文件。"); avisar(ultimoError); }
      finally { sincronizando = false; pintarUI(); }
    })();
  }
  async function cargarArchivoManual() {
    if (sincronizando) return;
    try {
      var txt = await leerArchivoSeleccionado();
      if (txt == null) return;
      await sincronizar(false, { texto: txt, nombre: ARCHIVO, rev: await hashTexto(txt) });
    } catch (e) { ultimoError = e.message || L("No se pudo leer el archivo.", "Could not read the file.", "无法读取文件。"); avisar(ultimoError); pintarUI(); }
  }
  async function guardarClaveCifrado() {
    var campo = $("#sync-webdav-clave");
    var pass = campo ? campo.value : "";
    if (!pass || pass.length < 8) {
      ultimoError = L("La contraseña de cifrado debe tener al menos 8 caracteres.", "The encryption password must be at least 8 characters.", "加密密码至少需要 8 个字符。");
      avisar(ultimoError); pintarUI(); if (campo) campo.focus(); return;
    }
    try {
      var sal = meta.cifrado.sal || bufB64(azar(16));
      var k = await derivarClave(pass, sal);
      await guardarClave(sal, k);
      claveMemo = k; claveSal = sal;
      meta.cifrado.sal = sal; meta.cifrado.activo = true;
      guardarMeta();
      guardarAcceso();
      ultimoError = "";
      avisar(L("Clave de cifrado guardada en este equipo. No se puede recuperar: anótala.", "Encryption key saved on this device. It cannot be recovered: write it down.", "加密密钥已保存在此设备。无法恢复：请记下它。"));
      pintarUI();
    } catch (e) {
      ultimoError = e.message || L("No se pudo preparar el cifrado.", "Could not prepare encryption.", "无法准备加密。"); avisar(ultimoError); pintarUI();
    }
  }
  function limpiarCampoClave() {
    var campo = $("#sync-webdav-clave");
    if (campo) campo.value = "";
  }
  async function olvidarClave() {
    await borrarClaves();
    borrarAcceso(); claveAcceso = "";
    claveMemo = null; claveSal = "";
    limpiarCampoClave();
    meta.cifrado.activo = false; guardarMeta();
    pintarUI(); avisar(L("Clave olvidada en este equipo. Se pedirá de nuevo para sincronizar.", "Key forgotten on this device. It will be requested again to sync.", "已忘记此设备上的密钥。同步时会再次请求。"));
  }
  function cargarCamposWebDAV() {
    var ncu = $("#sync-nc-url"); if (ncu) ncu.value = meta.ncUrl || "";
    var ncu2 = $("#sync-nc-usuario"); if (ncu2) ncu2.value = meta.webdav.usuario || "";
    var u = $("#sync-webdav-url"); if (u) u.value = meta.webdav.url || "";
    var us = $("#sync-webdav-usuario"); if (us) us.value = meta.webdav.usuario || "";
    var c = $("#sync-webdav-clave-acceso"); if (c) c.value = "";
    var ca = $("#sync-webdav-carpeta"); if (ca) ca.value = meta.webdav.carpeta || "Mimo";
  }
  function enlazarCamposWebDAV() {
    function unir(id, clave) {
      var el = $(id); if (!el) return;
      el.addEventListener("input", function () {
        meta.webdav[clave] = el.value;
        guardarMeta();
      });
    }
    unir("#sync-webdav-url", "url");
    unir("#sync-webdav-usuario", "usuario");
    var acceso = $("#sync-webdav-clave-acceso");
    if (acceso) acceso.addEventListener("input", function () {
      claveAcceso = acceso.value;
      try { sessionStorage.setItem("mimo.sync.clave.sesion", claveAcceso); } catch (e) {}
      guardarAcceso();
    });
    unir("#sync-webdav-carpeta", "carpeta");
  }

  function init() {
    if (!host()) return;
    var sel = $("#sync-proveedor"); if (!sel) return;
    var opcionCarpeta = sel.querySelector('option[value="carpeta"]');
    if (opcionCarpeta && !soportaCarpeta()) {
      opcionCarpeta.disabled = true;
      opcionCarpeta.textContent = L("Carpeta local (no disponible en este navegador)", "Local folder (not available in this browser)", "本地文件夹（此浏览器不可用）");
    }
    sel.addEventListener("change", cambiarProveedor);
    enlazarCamposWebDAV();
    cargarCamposWebDAV();
    var ncc = $("#sync-nc-conectar"); if (ncc) ncc.addEventListener("click", conectarNextcloud);
    $("#sync-elegir-carpeta").addEventListener("click", elegirCarpeta);
    $("#sync-ahora").addEventListener("click", function () { sincronizar(false); });
    $("#sync-desconectar").addEventListener("click", desconectar);
    $("#sync-manual").addEventListener("change", cambiarManual);
    $("#sync-guardar-archivo").addEventListener("click", guardarArchivoManual);
    $("#sync-cargar-archivo").addEventListener("click", cargarArchivoManual);
    $("#sync-webdav-probar").addEventListener("click", probarWebDAV);
    $("#sync-webdav-guardar-clave").addEventListener("click", guardarClaveCifrado);
    $("#sync-webdav-olvidar-clave").addEventListener("click", olvidarClave);
    var campoClave = $("#sync-webdav-clave");
    if (campoClave) campoClave.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); guardarClaveCifrado(); }
    });
    $("#sync-conf-x").addEventListener("click", cancelarConflicto);
    $("#sync-conf-cancelar").addEventListener("click", cancelarConflicto);
    $("#sync-conf-local").addEventListener("click", usarLocal);
    $("#sync-conf-remoto").addEventListener("click", usarRemoto);
    $("#modal-sync-conflict").addEventListener("click", function (e) {
      if (e.target === $("#modal-sync-conflict")) { conflicto = null; cerrarConflicto(); pintarUI(); }
    });
    var vc = $("#sync-ver-copia");
    if (vc) vc.addEventListener("click", verCopia);
    $("#btn-sync").addEventListener("click", function () {
      if (!meta.provider) { host().ir("ajustes"); avisar(L("Elige un modo de sincronización.", "Choose a sync mode.", "请选择同步方式。")); return; }
      sincronizar(false);
    });

    window.addEventListener("online", function () {
      pintarUI();
      if (esNube() && cola.pendiente && cola.reintentar) programarReintento(800);
      else if (meta.provider && !meta.manualOnly && meta.provider !== "archivo") programarAuto(1500);
    });
    window.addEventListener("offline", function () { pintarUI(); });

    pintarUI();
    setTimeout(function () {
      recalcularCambios().then(function () {
        if (esNube() && cambios && !conflicto) marcarPendiente("cambios locales al abrir", !navigator.onLine);
      });
    }, 300);
    setTimeout(function () {
      if (esNube()) leerClave(meta.cifrado.sal).then(function (k) {
        if (!k && meta.cifrado.activo) { meta.cifrado.activo = false; guardarMeta(); pintarUI(); }
        if (esWebDAV()) recuperarAcceso();
      });
    }, 200);
    if (esNube() && cola.pendiente && cola.reintentar && navigator.onLine) programarReintento(2500);
    if (meta.provider && !meta.manualOnly && meta.provider !== "archivo") {
      setTimeout(function () { sincronizar(true); }, 1500);
      timerAutoLargo = setInterval(function () {
        if (!sincronizando && !conflicto && !meta.manualOnly) sincronizar(true);
      }, 5 * 60 * 1000);
    }
    timerVigia = setInterval(function () {
      if (esNube() && cola.pendiente && cola.reintentar && navigator.onLine && !sincronizando && !conflicto) {
        if (!cola.proximo || Date.now() >= cola.proximo) {
          sincronizar(true, null, { reintento: true });
        }
      }
    }, 30000);
  }

  window.MimoSync = {
    alCambiar: alCambiar,
    sincronizar: function () { return sincronizar(false); },
    estado: function () {
      return {
        meta: JSON.parse(JSON.stringify(meta)), cambios: cambios, conflicto: !!conflicto,
        sincronizando: sincronizando, cola: JSON.parse(JSON.stringify(cola)), online: navigator.onLine
      };
    },
    probarCon: probarCon,
    _hash: hashTexto
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
