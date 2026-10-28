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
  var meta = cargarMeta();
  var cola = cargarCola();
  var sincronizando = false, aplicando = false, conflicto = null;
  var carpetaHandle = null, handleLeido = false;
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
      lastSyncAt: "", folderName: "", ultimoCambio: "",
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
        if (x.webdav && typeof x.webdav === "object") d.webdav = Object.assign(d.webdav, x.webdav);
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
      throw new Error("Ese archivo está corrupto o no es un archivo de sincronización de Mimo.");
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

  /* ---- cifrado (WebCrypto) ---- */
  function necesitaClave() {
    var e = new Error("Falta la contraseña de cifrado. Escríbela en Ajustes → Sincronización.");
    e.necesitaClave = true;
    return e;
  }
  async function derivarClave(pass, salB64) {
    if (!(window.crypto && crypto.subtle && crypto.subtle.deriveKey)) {
      throw new Error("Este navegador no tiene WebCrypto; no se puede cifrar.");
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
    try { x = JSON.parse(txt); } catch (e) { throw new Error("El archivo remoto está corrupto o no es de Mimo."); }
    if (!x || x.formato !== FORMATO_CIFRADO || !x.sal || !x.iv || !x.datos) {
      throw new Error("El archivo remoto está corrupto o no es de Mimo.");
    }
    if (Number(x.version) > 1) throw new Error("El archivo remoto usa un cifrado más nuevo que esta versión.");
    var key = await claveDeSal(x.sal);
    try {
      var plano = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64Buf(x.iv) }, key, b64Buf(x.datos)
      );
      meta.cifrado.sal = x.sal; meta.cifrado.activo = true; guardarMeta(); pintarClave();
      return new TextDecoder().decode(plano);
    } catch (e) {
      throw new Error("Contraseña de cifrado incorrecta o archivo remoto corrupto.");
    }
  }
  function esCifrado(txt) {
    try { var x = JSON.parse(txt); return !!(x && x.formato === FORMATO_CIFRADO); }
    catch (e) { return false; }
  }

  /* ---- carpeta local (File System Access) ---- */
  function soportaCarpeta() { return typeof window.showDirectoryPicker === "function" && !proveedorPrueba; }
  function abrirDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error("IndexedDB no disponible")); return; }
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
  async function obtenerCarpeta(pedir) {
    if (proveedorPrueba) return proveedorPrueba;
    if (!soportaCarpeta()) throw new Error("Este navegador no permite elegir una carpeta persistente. Usa el modo Archivo manual.");
    if (!handleLeido) { carpetaHandle = await leerHandle(); handleLeido = true; }
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
      return "Basic " + btoa(unescape(encodeURIComponent(meta.webdav.usuario + ":" + (meta.webdav.clave || ""))));
    } catch (e) { return ""; }
  }
  function cabeceras(extra) {
    var h = Object.assign({ "Accept": "application/json, text/plain, */*" }, extra || {});
    var a = cabeceraAuth(); if (a) h.Authorization = a;
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
      var y = new Error("No se pudo conectar con el servidor: " + (e && e.message ? e.message : e));
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
      if (cortado) { var x = new Error("El servidor no respondió en 20 s."); x.red = true; throw x; }
      var y = new Error("No se pudo conectar con el servidor (red o CORS).");
      y.red = true; y.causa = e; throw y;
    } finally { clearTimeout(t); }
  }
  async function asegurarCarpeta() {
    var partes = trozosCarpeta(); if (!partes.length) return;
    var acum = urlBase();
    for (var i = 0; i < partes.length; i++) {
      acum += "/" + encodeURIComponent(partes[i]);
      var res = await pedir(acum, { method: "MKCOL" });
      if ([201, 200, 204, 301, 405, 409, 403].indexOf(res.status) === -1) {
        throw new Error("No se pudo crear la carpeta remota (HTTP " + res.status + ").");
      }
      if (res.status === 401) throw new Error("El servidor rechazó las credenciales (HTTP 401).");
    }
  }
  async function webdavLeer() {
    if (!urlBase()) throw new Error("Falta la URL del servidor WebDAV.");
    var res = await pedir(urlArchivo(), { method: "GET" });
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new Error("El servidor rechazó las credenciales (HTTP " + res.status + ").");
    if (!res.ok) throw new Error("WebDAV respondió HTTP " + res.status + " al leer.");
    var cuerpo = await res.text();
    var rev = await hashTexto(cuerpo);
    var etag = res.headers.get("ETag") || "";
    if (!esCifrado(cuerpo)) {
      throw new Error("El archivo remoto no está cifrado. Mimo no aplica texto claro desde WebDAV.");
    }
    var texto = await descifrar(cuerpo);
    return { texto: texto, rev: rev, etag: etag, cifrado: true };
  }
  async function webdavEscribir(texto, revEsperada, etagEsperado) {
    if (!urlBase()) throw new Error("Falta la URL del servidor WebDAV.");
    await asegurarCarpeta();
    var cuerpo = await cifrar(texto);
    var cab = { "Content-Type": "application/json" };
    if (etagEsperado) cab["If-Match"] = etagEsperado;
    else if (revEsperada) {
      var actual = await webdavLeer();
      if (!actual) throw new Error("El archivo remoto desapareció. Vuelve a sincronizar.");
      if (actual.rev !== revEsperada) {
        var e = new Error("El archivo remoto cambió mientras sincronizabas."); e.codigo = 412; throw e;
      }
    } else cab["If-None-Match"] = "*";
    var res = await pedir(urlArchivo(), { method: "PUT", headers: cab, body: cuerpo });
    if (res.status === 412) {
      var c = new Error("El archivo remoto cambió mientras sincronizabas."); c.codigo = 412; throw c;
    }
    if (!res.ok) throw new Error("WebDAV respondió HTTP " + res.status + " al escribir.");
    return { rev: await hashTexto(cuerpo), etag: res.headers.get("ETag") || "" };
  }
  async function probarWebDAV() {
    if (!urlBase()) { ultimoError = "Falta la URL del servidor WebDAV."; pintarUI(); return; }
    try {
      sincronizando = true; ultimoError = ""; pintarUI();
      var r = await webdavLeer();
      avisar(r ? "Conexión correcta: hay un archivo remoto de " + r.texto.length + " caracteres." :
        "Conexión correcta: todavía no hay archivo remoto; se creará al sincronizar.");
    } catch (e) {
      ultimoError = e.message || "No se pudo conectar."; avisar(ultimoError);
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
      if (txt == null) { var e = new Error("Selección cancelada"); e.name = "AbortError"; throw e; }
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
    throw new Error("No hay un modo de sincronización configurado.");
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
      ? "Cifrado activo en este equipo (AES-GCM). La contraseña no se guarda: solo la clave derivada."
      : "Sin clave en este equipo. Escríbela antes de sincronizar; sin ella no se sube nada.";
    p.className = "muted" + (tiene ? " ok" : "");
  }
  function pintarUI() {
    var est = $("#sync-estado");
    if (!est) return;
    var texto, clase = "muted";
    if (!meta.provider) texto = "Sin configurar. Elige un modo para llevar tus datos a otro equipo.";
    else if (sincronizando) texto = "Sincronizando…";
    else if (esNube() && !navigator.onLine) texto = "Sin conexión. Tus cambios están guardados aquí; se enviarán al volver la red.";
    else if (ultimoError) { texto = "Error: " + ultimoError; clase = "muted err"; }
    else if (conflicto) { texto = "Conflicto: las dos copias cambiaron. Elige una versión."; clase = "muted err"; }
    else if (esNube() && cola.pendiente) texto = "Cambios en espera de subir a la nube.";
    else if (cambios) texto = "Cambios locales sin sincronizar.";
    else if (meta.lastSyncAt) texto = "Sincronizado " + hace(meta.lastSyncAt) + ".";
    else texto = "Listo para sincronizar.";
    est.textContent = texto;
    est.className = clase;
    var sel = $("#sync-proveedor"); if (sel) sel.value = meta.provider || "";
    var w = $("#sync-webdav"); if (w) w.hidden = meta.provider !== "webdav";
    var c = $("#sync-carpeta"); if (c) c.hidden = meta.provider !== "carpeta";
    var a = $("#sync-archivo"); if (a) a.hidden = meta.provider !== "archivo";
    var m = $("#sync-manual");
    if (m) { m.checked = !!meta.manualOnly; m.disabled = meta.provider === "archivo"; }
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
        : (esNube() && cola.pendiente) ? "Cambios en espera; clic para reintentar"
        : cambios ? "Hay cambios locales; clic para sincronizar"
        : "Sincronizado; clic para sincronizar ahora";
      b.innerHTML = icono(sincronizando ? "i-sync" : (ultimoError || conflicto ? "i-alerta" : "i-check"));
    }
    pintarClave();
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
      conflicto = null; avisar("Se conservó la copia local y se subió.");
    } catch (e) {
      ultimoError = e.message || "No se pudo subir la copia local.";
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
      avisar("Se aplicó la copia remota. La copia local quedó como respaldo.");
    } catch (e) {
      aplicando = false;
      ultimoError = e.message || "No se pudo aplicar la copia remota.";
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
    guardarMeta(); cambios = false; ultimoError = ""; limpiarCola();
    limpiarCampoClave();
    avisar(meta.provider === "archivo" ? "Archivo de sincronización guardado. Cópialo a tu nube."
      : meta.provider === "webdav" ? "Sincronizado y cifrado en la nube."
      : "Sincronizado.");
  }
  async function aplicarRemoto(env, remoto) {
    respaldarLocal();
    aplicando = true;
    host().reemplazar(env.estado);
    var h = await hashEstado(host().snapshot());
    meta.lastRemoteRev = remoto.rev;
    meta.lastRemoteVersion = Number(env.syncVersion) || 1;
    meta.lastLocalHash = h; meta.lastSyncAt = ahora(); meta.ultimoCambio = "";
    guardarMeta(); cambios = false; ultimoError = ""; aplicando = false; limpiarCola();
    limpiarCampoClave();
    avisar("Datos remotos aplicados. La copia local quedó como respaldo.");
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
      avisar("Elige un modo de sincronización en Ajustes.");
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
      if (e && e.name === "AbortError") { ultimoError = ""; avisar("Selección cancelada."); }
      else {
        ultimoError = e && e.message ? e.message : "No se pudo sincronizar.";
        if (e && e.name === "NotAllowedError") ultimoError = "Permiso de carpeta no concedido.";
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
    guardarMeta(); cargarCamposWebDAV(); pintarUI();
    if (v === "carpeta" && !proveedorPrueba && soportaCarpeta()) {
      avisar("Pulsa «Elegir carpeta» para autorizar la carpeta.");
    }
    if (v === "webdav") {
      var campo = $("#sync-webdav-url"); if (campo) campo.focus();
    }
    if (v && v !== "webdav") limpiarCola();
  }
  function desconectar() {
    if (!window.confirm("¿Desconectar la sincronización? No se borran tus datos ni el archivo remoto.")) return;
    meta.provider = ""; meta.folderName = ""; meta.lastRemoteRev = ""; meta.lastRemoteVersion = 0;
    meta.lastLocalHash = ""; meta.lastSyncAt = ""; meta.ultimoCambio = "";
    meta.webdav.clave = "";
    carpetaHandle = null; handleLeido = true; borrarHandle();
    claveMemo = null; claveSal = "";
    guardarMeta(); conflicto = null; cambios = host().tieneDatos(); limpiarCola(); pintarUI();
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
  async function guardarClaveCifrado() {
    var campo = $("#sync-webdav-clave");
    var pass = campo ? campo.value : "";
    if (!pass || pass.length < 8) {
      ultimoError = "La contraseña de cifrado debe tener al menos 8 caracteres.";
      avisar(ultimoError); pintarUI(); if (campo) campo.focus(); return;
    }
    try {
      var sal = meta.cifrado.sal || bufB64(azar(16));
      var k = await derivarClave(pass, sal);
      await guardarClave(sal, k);
      claveMemo = k; claveSal = sal;
      meta.cifrado.sal = sal; meta.cifrado.activo = true;
      guardarMeta();
      ultimoError = "";
      avisar("Clave de cifrado guardada en este equipo. No se puede recuperar: anótala.");
      pintarUI();
    } catch (e) {
      ultimoError = e.message || "No se pudo preparar el cifrado."; avisar(ultimoError); pintarUI();
    }
  }
  function limpiarCampoClave() {
    var campo = $("#sync-webdav-clave");
    if (campo) campo.value = "";
  }
  async function olvidarClave() {
    await borrarClaves();
    claveMemo = null; claveSal = "";
    limpiarCampoClave();
    meta.cifrado.activo = false; guardarMeta();
    pintarUI(); avisar("Clave olvidada en este equipo. Se pedirá de nuevo para sincronizar.");
  }
  function cargarCamposWebDAV() {
    var u = $("#sync-webdav-url"); if (u) u.value = meta.webdav.url || "";
    var us = $("#sync-webdav-usuario"); if (us) us.value = meta.webdav.usuario || "";
    var c = $("#sync-webdav-clave-acceso"); if (c) c.value = meta.webdav.clave || "";
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
    unir("#sync-webdav-clave-acceso", "clave");
    unir("#sync-webdav-carpeta", "carpeta");
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
    enlazarCamposWebDAV();
    cargarCamposWebDAV();
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
    $("#btn-sync").addEventListener("click", function () {
      if (!meta.provider) { host().ir("ajustes"); avisar("Elige un modo de sincronización."); return; }
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
