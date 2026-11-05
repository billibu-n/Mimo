/* sync-enlace.js — lee el enlace de sincronización que entrega Nextcloud.
   La página de Nextcloud no entrega una URL limpia: entrega un texto largo (y su QR)
   con este formato comprobado:

     nc://onetime-login/user:<usuario>&password:<contraseña-de-aplicación>&server:<servidor>

   Este módulo lo convierte a los campos que ya usa el motor de sync
   (servidor, usuario, contraseña de aplicación, ruta WebDAV) y sabe volver a
   componer el enlace para mostrarlo y copiarlo. No toca el DOM ni el almacén de la app. */
(function () {
  "use strict";

  var MAX_TEXTO = 16384;
  var MAX_USUARIO = 190;
  var MAX_CLAVE = 512;
  var MAX_SERVIDOR = 2048;
  var ARCHIVO = "mimo-sync.json.enc";

  function recortar(v, max) { return String(v == null ? "" : v).trim().slice(0, max); }
  function sinControl(v) { return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, "").trim(); }
  function sanearTexto(v) { return recortar(v, MAX_TEXTO).replace(/\r\n?/g, "\n"); }

  function decodificar(v) {
    var s = String(v == null ? "" : v).trim();
    try { return decodeURIComponent(s); } catch (e) { return s; }
  }

  /* Servidor válido: http(s), con host, sin credenciales en la URL y sin el
     sufijo /remote.php/dav/files/<usuario> (si venía, se aprovecha el usuario). */
  function normalizarServidor(valor) {
    var s = sinControl(valor);
    if (!s) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = "https://" + s;
    var u;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    if (!u.hostname) return null;
    var usuario = "";
    var clave = "";
    try {
      usuario = u.username ? decodificar(u.username) : "";
      clave = u.password ? decodificar(u.password) : "";
    } catch (e) {}
    var ruta = u.pathname.replace(/\/+$/, "");
    var m = /\/remote\.php\/dav\/files\/([^/]+)(?:\/.*)?$/i.exec(ruta);
    if (m) {
      if (!usuario) usuario = decodificar(m[1]);
      ruta = ruta.slice(0, m.index);
    }
    ruta = ruta.replace(/\/remote\.php(?:\/dav)?$/i, "").replace(/\/+$/, "");
    ruta = ruta.replace(/\/index\.php(?:\/.*)?$/i, "").replace(/\/login(?:\/.*)?$/i, "").replace(/\/+$/, "");
    var servidor = u.origin + (ruta && ruta !== "/" ? ruta : "");
    return {
      servidor: servidor,
      usuario: recortar(usuario, MAX_USUARIO),
      clave: recortar(clave, MAX_CLAVE),
      protocolo: u.protocol.replace(":", ""),
      http: u.protocol === "http:"
    };
  }

  function urlWebDAV(servidor, usuario) {
    if (!servidor || !usuario) return "";
    return String(servidor).replace(/\/+$/, "") + "/remote.php/dav/files/" + encodeURIComponent(usuario);
  }

  function carpetaLimpia(v) {
    return String(v == null ? "Mimo" : v).trim().replace(/^\/+|\/+$/g, "") || "Mimo";
  }
  function urlArchivo(servidor, usuario, carpeta) {
    var base = urlWebDAV(servidor, usuario);
    if (!base) return "";
    var trozos = carpetaLimpia(carpeta).split("/").filter(Boolean).map(encodeURIComponent);
    return base + "/" + trozos.join("/") + "/" + ARCHIVO;
  }

  /* El enlace canónico conserva el formato de la página: user, password y server
     separados por & y con el prefijo nc://onetime-login/. No se guarda en claro. */
  function componer(p) {
    if (!p || !p.servidor) return "";
    var partes = [];
    if (p.usuario) partes.push("user:" + p.usuario);
    if (p.clave) partes.push("password:" + p.clave);
    partes.push("server:" + p.servidor);
    return "nc://onetime-login/" + partes.join("&");
  }

  function pares(cuerpo) {
    var out = {};
    String(cuerpo || "").split("&").forEach(function (trozo) {
      var i = trozo.indexOf(":");
      if (i < 1) return;
      var k = trozo.slice(0, i).trim().toLowerCase();
      var v = trozo.slice(i + 1).trim();
      if (k && !Object.prototype.hasOwnProperty.call(out, k)) out[k] = v;
    });
    return out;
  }

  function buscarNc(texto) {
    var m = /nc:\/\/(onetime-login|login)\/([^\s"'<>]+)/i.exec(texto);
    if (!m) return null;
    return { esquema: m[1].toLowerCase(), cuerpo: m[2].replace(/[)\].,;]+$/, "") };
  }

  function buscarEtiqueta(texto, nombres) {
    var re = new RegExp("(?:^|[\\n\\r;&])\\s*(?:" + nombres + ")\\s*[:=]\\s*([^\\s\\n\\r;&]+)", "i");
    var m = re.exec(texto);
    return m ? m[1].replace(/[)\].,;]+$/, "") : "";
  }

  function buscarUrl(texto) {
    var m = /https?:\/\/[^\s"'<>]+/i.exec(texto);
    return m ? m[0].replace(/[)\].,;]+$/, "") : "";
  }

  function etiquetas(texto) {
    return {
      server: buscarEtiqueta(texto, "servidor|server|direcci[oó]n"),
      user: buscarEtiqueta(texto, "usuario|user|login|correo|email"),
      password: buscarEtiqueta(texto, "contrase[nñ]a|password|app password|clave")
    };
  }

  /* analizar(texto) -> {ok, completo, servidor, usuario, clave, urlWebDAV,
       carpeta, enlace, esquema, partes, faltan, avisos, texto}
     Acepta el texto completo de la página, el enlace nc://, una URL de servidor
     o una URL WebDAV completa. */
  function analizar(entrada) {
    var texto = sanearTexto(entrada);
    var res = {
      ok: false, completo: false, tipo: "", esquema: "",
      servidor: "", usuario: "", clave: "", urlWebDAV: "", carpeta: "Mimo",
      enlace: "", partes: [], faltan: [], avisos: [], texto: texto
    };
    if (!texto) { res.avisos.push("vacio"); return res; }

    var nc = buscarNc(texto);
    var kv = {};
    var url = "";
    if (nc) {
      res.esquema = nc.esquema;
      kv = pares(nc.cuerpo);
      if (kv.usuario && !kv.user) kv.user = kv.usuario;
      if (kv.servidor && !kv.server) kv.server = kv.servidor;
      if (kv["contraseña"] && !kv.password) kv.password = kv["contraseña"];
      url = kv.server || "";
      if (nc.esquema === "login") res.avisos.push("esquema_login");
    } else {
      kv = etiquetas(texto);
      url = kv.server || buscarUrl(texto);
    }

    var norm = normalizarServidor(url);
    if (norm) {
      res.servidor = recortar(norm.servidor, MAX_SERVIDOR);
      res.usuario = recortar(decodificar(kv.user || norm.usuario || ""), MAX_USUARIO);
      res.clave = recortar(kv.password || norm.clave || "", MAX_CLAVE);
      if (norm.http) res.avisos.push("http");
    } else if (url || buscarUrl(texto)) {
      res.avisos.push("servidor_invalido");
    }

    if (!res.usuario) {
      var m = /\/remote\.php\/dav\/files\/([^/\s"'<>]+)/i.exec(texto);
      if (m) res.usuario = recortar(decodificar(m[1]), MAX_USUARIO);
    }
    if (res.servidor && res.usuario) res.urlWebDAV = urlWebDAV(res.servidor, res.usuario);
    if (!res.servidor) res.faltan.push("servidor");
    if (!res.usuario) res.faltan.push("usuario");
    if (!res.clave) res.faltan.push("clave");
    res.ok = !!(res.servidor && res.usuario);
    res.completo = !!(res.servidor && res.usuario && res.clave);
    res.tipo = res.servidor ? "nextcloud" : "";
    if (res.servidor && res.usuario) res.enlace = componer(res);
    if (res.ok && !res.clave) res.avisos.push("sin_clave");
    if (res.ok && res.clave && !res.esquema) res.avisos.push("sin_esquema");
    res.partes = descomponer(res);
    return res;
  }

  /* Descompone un análisis, un objeto de configuración o un texto. */
  function descomponer(entrada) {
    var p = {};
    if (typeof entrada === "string") {
      p = analizar(entrada);
    } else if (entrada && typeof entrada === "object") {
      var servidor = entrada.servidor || entrada.ncUrl || (entrada.webdav && entrada.webdav.url) || "";
      var norm = normalizarServidor(servidor) || { servidor: "", usuario: "", clave: "", http: false };
      p = {
        servidor: recortar(entrada.servidor || norm.servidor, MAX_SERVIDOR),
        usuario: recortar(entrada.usuario || (entrada.webdav && entrada.webdav.usuario) || norm.usuario, MAX_USUARIO),
        clave: recortar(entrada.clave || entrada.password || norm.clave, MAX_CLAVE),
        carpeta: carpetaLimpia(entrada.carpeta || (entrada.webdav && entrada.webdav.carpeta))
      };
      p.urlWebDAV = urlWebDAV(p.servidor, p.usuario);
      p.enlace = p.servidor ? componer(p) : "";
    }
    var partes = [
      { clave: "esquema", valor: "nc" },
      { clave: "servidor", valor: p.servidor || "" },
      { clave: "usuario", valor: p.usuario || "" },
      { clave: "clave", valor: p.clave || "", secreto: true },
      { clave: "webdav", valor: p.urlWebDAV || "" },
      { clave: "carpeta", valor: p.carpeta || "Mimo" },
      { clave: "archivo", valor: urlArchivo(p.servidor, p.usuario, p.carpeta) },
      { clave: "enlace", valor: p.enlace || "", secreto: true }
    ];
    return partes;
  }

  function enmascarar(v, visible) {
    var s = String(v == null ? "" : v);
    if (!s) return "";
    if (visible) return s;
    if (s.length <= 4) return "••••";
    return s.slice(0, 2) + "•".repeat(Math.min(12, s.length - 4)) + s.slice(-2);
  }

  window.MimoSyncEntrada = {
    version: 1,
    formato: "nc://onetime-login/user:<usuario>&password:<clave>&server:<servidor>",
    archivo: ARCHIVO,
    analizar: analizar,
    descomponer: descomponer,
    normalizarServidor: normalizarServidor,
    urlWebDAV: urlWebDAV,
    urlArchivo: urlArchivo,
    componer: componer,
    enmascarar: enmascarar,
    pares: pares
  };
})();
