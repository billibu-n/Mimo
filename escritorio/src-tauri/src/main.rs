// Mimo para escritorio (Tauri 2).
//
// Carga `escritorio/app/index.html`, que `preparar-frontend.sh` copia desde la app universal
// (`<proyecto>/app/`) con lista blanca: index.html, css/, js/, img/ y vendor/.
//
// El unico extra nativo es `http_pedir`: un puente HTTP con reqwest que usa la app para WebDAV.
// El WebView de Tauri no exime a `fetch` de CORS; el puente si, porque la peticion sale de Rust.
// La pagina no recibe acceso al disco ni al shell: solo puede pedir HTTP(S) por este comando.
//
// La sonda (`MIMO_SONDA=1`) mide la ventana real y no se usa en el uso normal.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::time::Duration;

#[derive(serde::Deserialize)]
struct PeticionHttp {
    metodo: String,
    url: String,
    #[serde(default)]
    cabeceras: HashMap<String, String>,
    #[serde(default)]
    cuerpo: Option<String>,
}

#[derive(serde::Serialize)]
struct RespuestaHttp {
    estado: u16,
    cabeceras: HashMap<String, String>,
    cuerpo: String,
}

fn ruta_sonda() -> String {
    std::env::var("MIMO_SONDA_SALIDA").unwrap_or_else(|_| "/tmp/mimo-sonda.json".into())
}

/// Recibe el informe de la sonda de medida y lo deja en disco. No se usa en el uso normal.
#[tauri::command]
fn sonda_informe(payload: String) {
    let _ = fs::write(ruta_sonda(), &payload);
    println!("__MIMO_SONDA__{payload}");
    std::process::exit(0);
}

/// Puente HTTP nativo para WebDAV. Evita el CORS del WebView: la peticion la hace Rust.
/// Solo admite http/https y devuelve estado, cabeceras y cuerpo como texto.
#[tauri::command]
async fn http_pedir(peticion: PeticionHttp) -> Result<RespuestaHttp, String> {
    tauri::async_runtime::spawn_blocking(move || hacer_peticion(peticion))
        .await
        .map_err(|e| format!("hilo HTTP: {e}"))?
}

fn hacer_peticion(p: PeticionHttp) -> Result<RespuestaHttp, String> {
    let url = reqwest::Url::parse(&p.url).map_err(|e| format!("URL invalida: {e}"))?;
    match url.scheme() {
        "http" | "https" => {}
        _ => return Err("Solo se permite http o https.".into()),
    }
    let metodo = reqwest::Method::from_bytes(p.metodo.as_bytes())
        .map_err(|e| format!("metodo invalido: {e}"))?;

    let cliente = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|e| format!("cliente HTTP: {e}"))?;

    let mut armado = cliente.request(metodo, url);
    for (k, v) in &p.cabeceras {
        armado = armado.header(k.as_str(), v.as_str());
    }
    if let Some(cuerpo) = p.cuerpo {
        armado = armado.body(cuerpo);
    }

    let respuesta = armado.send().map_err(|e| format!("red: {e}"))?;
    let estado = respuesta.status().as_u16();
    let mut cabeceras = HashMap::new();
    for (k, v) in respuesta.headers() {
        if let Ok(texto) = v.to_str() {
            let clave = k.as_str().to_string();
            cabeceras
                .entry(clave)
                .and_modify(|previa: &mut String| {
                    previa.push_str(", ");
                    previa.push_str(texto);
                })
                .or_insert_with(|| texto.to_string());
        }
    }
    let cuerpo = respuesta.text().map_err(|e| format!("cuerpo: {e}"))?;
    Ok(RespuestaHttp { estado, cabeceras, cuerpo })
}

/// Sonda de medida: SOLO corre con `MIMO_SONDA=1`. Mide dentro de la ventana real la navegacion,
/// la persistencia y una sincronizacion WebDAV por el puente nativo.
fn lanzar_sonda(app: &tauri::AppHandle) {
    if std::env::var("MIMO_SONDA").as_deref() != Ok("1") {
        return;
    }
    use tauri::Manager;
    let app = app.clone();
    let salida = ruta_sonda();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(2500));
        let cfg = serde_json::json!({
            "url": std::env::var("MIMO_WEBDAV_URL").unwrap_or_default(),
            "user": std::env::var("MIMO_WEBDAV_USER").unwrap_or_default(),
            "pass": std::env::var("MIMO_WEBDAV_PASS").unwrap_or_default(),
            "folder": std::env::var("MIMO_WEBDAV_FOLDER").unwrap_or_else(|_| "Mimo".into()),
            "clave": std::env::var("MIMO_WEBDAV_CLAVE").unwrap_or_default(),
        });
        let guion = GUION_SONDA.replace("__MIMO_CONFIG__", &cfg.to_string());
        if let Some(w) = app.get_webview_window("main") {
            if let Err(e) = w.eval(&guion) {
                let _ = fs::write(&salida, format!("{{\"error\":\"eval: {e}\"}}"));
                std::process::exit(2);
            }
        } else {
            let _ = fs::write(&salida, "{\"error\":\"no hay ventana main\"}");
            std::process::exit(2);
        }
        std::thread::sleep(Duration::from_secs(45));
        let _ = fs::write(&salida, "{\"error\":\"la sonda no respondio en 45 s\"}");
        std::process::exit(3);
    });
}

/// Guion dentro de la ventana. No devuelve credenciales: el informe solo lleva estado y conteos.
const GUION_SONDA: &str = r#"
(async function () {
  var cfg = __MIMO_CONFIG__ || {};
  var r = {
    origen: location.origin,
    protocolo: location.protocol,
    titulo: document.title,
    errores: [],
    tabs: [],
    secciones: [],
    css: document.styleSheets.length,
    katex: typeof window.katex
  };
  window.addEventListener('error', function (e) { r.errores.push(String(e.message || e)); });
  var errOriginal = console.error;
  console.error = function () {
    r.errores.push(Array.prototype.map.call(arguments, String).join(' '));
    errOriginal.apply(console, arguments);
  };
  function esperar(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }
  function visible(sel) { var e = document.querySelector(sel); return !!e && !e.hidden; }
  function set(sel, valor) {
    var e = document.querySelector(sel);
    if (!e) return false;
    e.value = valor;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
  try {
    r.tabs = Array.prototype.map.call(document.querySelectorAll('#tabs .tab'), function (t) {
      return t.getAttribute('data-ir') || t.getAttribute('title') || t.textContent.trim();
    });
    r.secciones = Array.prototype.map.call(document.querySelectorAll('.seccion'), function (s) { return s.id; });

    document.querySelector('#tabs [data-ir="tareas"]').click();
    await esperar(180);
    r.tareas_visible = visible('#p-tareas');

    document.querySelector('#tabs [data-ir="notas"]').click();
    await esperar(180);
    document.querySelector('#btn-nueva-nota').click();
    await esperar(180);
    set('#nota-titulo', 'Nota Tauri');
    await esperar(350);
    var estado = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
    r.nota_guardada = (estado.notas || []).some(function (n) { return n.titulo === 'Nota Tauri'; });
    r.notas = (estado.notas || []).length;

    document.querySelector('#tabs [data-ir="ajustes"]').click();
    await esperar(200);
    r.grupos = document.querySelectorAll('.ajustes-grupo').length;
    r.sync_card = !!document.querySelector('#sync-card');

    if (cfg.url) {
      var sel = document.querySelector('#sync-proveedor');
      sel.value = 'webdav';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      await esperar(120);
      set('#sync-webdav-url', cfg.url);
      set('#sync-webdav-usuario', cfg.user);
      set('#sync-webdav-clave-acceso', cfg.pass);
      set('#sync-webdav-carpeta', cfg.folder);
      set('#sync-webdav-clave', cfg.clave);
      document.querySelector('#sync-webdav-guardar-clave').click();
      await esperar(350);
      document.querySelector('#btn-sync').click();
      for (var i = 0; i < 50; i++) {
        await esperar(200);
        r.sync_estado = document.querySelector('#sync-estado').textContent;
        if (/Sincronizado|Error|Conflicto/.test(r.sync_estado)) break;
      }
      var e = window.MimoSync ? window.MimoSync.estado() : null;
      r.sync = e ? {
        online: e.online,
        pendiente: e.cola && e.cola.pendiente,
        intentos: e.cola && e.cola.intentos,
        provider: e.meta && e.meta.provider,
        version: e.meta && e.meta.lastRemoteVersion,
        lastSyncAt: e.meta && e.meta.lastSyncAt,
        conflicto: e.conflicto
      } : null;
    }
  } catch (e) {
    r.error = String(e);
  }
  var t = window.__TAURI_INTERNALS__ || (window.__TAURI__ && window.__TAURI__.core) || {};
  var inv = t.invoke;
  if (!inv) {
    document.title = 'SONDA SIN INVOKE';
    return;
  }
  inv('sonda_informe', { payload: JSON.stringify(r) });
})();
"#;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sonda_informe, http_pedir])
        .setup(|app| {
            lanzar_sonda(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error arrancando Mimo");
}
