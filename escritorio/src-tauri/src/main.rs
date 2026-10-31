// Mimo para escritorio (Tauri 2).
//
// Carga `app/index.html` directamente: Tauri usa `../../app` como frontendDist.
// La app universal es la única fuente; no hay copia intermedia ni paso de preparación.
//
// Tres extras nativos, y nada mas:
//   - `http_pedir`: puente HTTP con reqwest; el WebView no exime a `fetch` de CORS y Rust si.
//   - la carpeta de sincronizacion: dialogo nativo y lectura/escritura de `mimo-sync.json`.
//   - `guardar_json`: dialogo de guardado para exportar un JSON elegido por la persona.
// La pagina no recibe acceso libre al disco: el Rust recuerda la carpeta elegida y solo escribe
// ese archivo dentro de ella. Tampoco hay shell.
//
// La sonda (`MIMO_SONDA=1`) mide la ventana real y no se usa en el uso normal.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

mod actualizaciones;
mod almacen;

#[cfg(target_os = "linux")]
use std::ffi::{c_char, c_void};

#[cfg(target_os = "linux")]
type WebkitGetFeatures = unsafe extern "C" fn() -> *mut c_void;
#[cfg(target_os = "linux")]
type WebkitFindFeature = unsafe extern "C" fn(*mut c_void, *const c_char) -> *mut c_void;
#[cfg(target_os = "linux")]
type WebkitSetFeature = unsafe extern "C" fn(*mut c_void, *mut c_void, i32);
#[cfg(target_os = "linux")]
type WebkitUnrefFeatures = unsafe extern "C" fn(*mut c_void);

/// WebKitGTK acerca las actualizaciones de pagina a 60 fps por defecto. Esta funcion apaga esa
/// preferencia para que la pagina siga la tasa real de la pantalla (60, 120, 144...). Si el
/// monitor es de 60 Hz no cambia nada. Solo Linux.
#[cfg(target_os = "linux")]
fn seguir_tasa_pantalla(app: &tauri::AppHandle) {
    use webkit2gtk::glib::translate::ToGlibPtr;
    use webkit2gtk::WebViewExt;
    let Some(ventana) = app.get_webview_window("main") else {
        return;
    };
    let _ = ventana.with_webview(|webview| {
        let Some(settings) = webview.inner().settings() else {
            return;
        };
        unsafe {
            // Carga dinamica: Fedora exporta estos simbolos privados y Ubuntu no. Si no
            // existen, Mimo conserva el limite de 60 fps de WebKit y no rompe el enlace.
            let Ok(lib) = libloading::Library::new("libwebkit2gtk-4.1.so.0") else {
                return;
            };
            let Ok(get) = lib.get::<WebkitGetFeatures>(b"webkit_settings_get_all_features\0") else {
                return;
            };
            let Ok(find) = lib.get::<WebkitFindFeature>(b"webkit_feature_list_find\0") else {
                return;
            };
            let Ok(set) = lib.get::<WebkitSetFeature>(b"webkit_settings_set_feature_enabled\0") else {
                return;
            };
            let Ok(unref) = lib.get::<WebkitUnrefFeatures>(b"webkit_feature_list_unref\0") else {
                return;
            };
            let lista = get();
            if lista.is_null() {
                return;
            }
            let id = b"PreferPageRenderingUpdatesNear60FPSEnabled\0";
            let feature = find(lista, id.as_ptr() as *const c_char);
            if !feature.is_null() {
                let crudo: *mut webkit2gtk::ffi::WebKitSettings = settings.to_glib_none().0;
                set(crudo as *mut c_void, feature, 0);
            }
            unref(lista);
        }
    });
}

#[cfg(not(target_os = "linux"))]
fn seguir_tasa_pantalla(_app: &tauri::AppHandle) {}

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

/// Carpeta de sincronizacion recordada por el proceso. El disco solo guarda la ruta elegida;
/// el contenido vive en `<carpeta>/mimo-sync.json`.
struct CarpetaSync(Mutex<Option<PathBuf>>);

#[derive(serde::Serialize)]
struct CarpetaInfo {
    ruta: String,
    nombre: String,
}

fn config_carpeta(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("config: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("config: {e}"))?;
    Ok(dir.join("sync-folder.txt"))
}

fn guardar_ruta(app: &tauri::AppHandle, ruta: &Path) -> Result<(), String> {
    let cfg = config_carpeta(app)?;
    fs::write(&cfg, ruta.to_string_lossy().as_bytes())
        .map_err(|e| format!("no se pudo recordar la carpeta: {e}"))
}

fn info_carpeta(ruta: &Path) -> CarpetaInfo {
    CarpetaInfo {
        ruta: ruta.to_string_lossy().to_string(),
        nombre: ruta
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "carpeta".into()),
    }
}

/// Ruta recordada. `MIMO_CARPETA_PRUEBA` permite a `gate-tauri` probar la ida y vuelta sin
/// abrir un dialogo; en uso normal solo cuenta el archivo de configuracion.
fn ruta_guardada(app: &tauri::AppHandle) -> Option<PathBuf> {
    if let Ok(prueba) = std::env::var("MIMO_CARPETA_PRUEBA") {
        let p = PathBuf::from(prueba);
        if p.is_dir() {
            return Some(p);
        }
    }
    let cfg = config_carpeta(app).ok()?;
    let texto = fs::read_to_string(cfg).ok()?;
    let p = PathBuf::from(texto.trim());
    if p.is_dir() {
        Some(p)
    } else {
        None
    }
}

fn ruta_activa(estado: &CarpetaSync) -> Result<PathBuf, String> {
    estado
        .0
        .lock()
        .map_err(|_| "carpeta bloqueada".to_string())?
        .clone()
        .ok_or_else(|| "Elige una carpeta de sincronización.".to_string())
}

/// Abre el dialogo nativo de carpetas. WebKitGTK no tiene File System Access; este es el sustituto.
#[tauri::command]
async fn elegir_carpeta(app: tauri::AppHandle) -> Result<Option<CarpetaInfo>, String> {
    let seleccion = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || {
            app.dialog()
                .file()
                .set_title("Elegir carpeta de sincronización")
                .blocking_pick_folder()
                .and_then(|f| f.into_path().ok())
        }
    })
    .await
    .map_err(|e| format!("diálogo: {e}"))?;
    let Some(ruta) = seleccion else {
        return Ok(None);
    };
    if !ruta.is_dir() {
        return Err("La carpeta elegida no existe.".into());
    }
    guardar_ruta(&app, &ruta)?;
    *app.state::<CarpetaSync>()
        .0
        .lock()
        .map_err(|_| "carpeta bloqueada".to_string())? = Some(ruta.clone());
    Ok(Some(info_carpeta(&ruta)))
}

/// Devuelve la carpeta recordada, si sigue existiendo. No abre dialogos.
#[tauri::command]
fn carpeta_guardada(app: tauri::AppHandle, estado: State<CarpetaSync>) -> Option<CarpetaInfo> {
    let ruta = {
        let actual = estado.0.lock().ok().and_then(|g| g.clone());
        actual.or_else(|| ruta_guardada(&app))?
    };
    if !ruta.is_dir() {
        return None;
    }
    if let Ok(mut g) = estado.0.lock() {
        *g = Some(ruta.clone());
    }
    Some(info_carpeta(&ruta))
}

/// Lee `mimo-sync.json` de la carpeta elegida. Si no existe todavia, devuelve None.
#[tauri::command]
fn leer_carpeta(estado: State<CarpetaSync>) -> Result<Option<String>, String> {
    let dir = ruta_activa(estado.inner())?;
    match fs::read_to_string(dir.join("mimo-sync.json")) {
        Ok(texto) => Ok(Some(texto)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("leer carpeta: {e}")),
    }
}

/// Escribe `mimo-sync.json` de forma atomica (temporal + rename) y verifica la lectura.
#[tauri::command]
fn escribir_carpeta(estado: State<CarpetaSync>, texto: String) -> Result<(), String> {
    let dir = ruta_activa(estado.inner())?;
    let destino = dir.join("mimo-sync.json");
    let temporal = dir.join(".mimo-sync.json.tmp");
    {
        let mut f = fs::File::create(&temporal).map_err(|e| format!("crear temporal: {e}"))?;
        f.write_all(texto.as_bytes())
            .map_err(|e| format!("escribir temporal: {e}"))?;
        f.sync_all()
            .map_err(|e| format!("sincronizar temporal: {e}"))?;
    }
    fs::rename(&temporal, &destino).map_err(|e| format!("reemplazar archivo: {e}"))?;
    let vuelta = fs::read_to_string(&destino).map_err(|e| format!("verificar: {e}"))?;
    if vuelta != texto {
        return Err("No se pudo verificar la escritura del archivo.".into());
    }
    Ok(())
}

/// Olvida la carpeta (al desconectar). No borra archivos del usuario.
#[tauri::command]
fn olvidar_carpeta(app: tauri::AppHandle, estado: State<CarpetaSync>) -> Result<(), String> {
    if let Ok(mut g) = estado.0.lock() {
        *g = None;
    }
    let cfg = config_carpeta(&app)?;
    match fs::remove_file(cfg) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("no se pudo olvidar la carpeta: {e}")),
    }
}

/// Pide una ruta y guarda un JSON elegido por la persona. Devuelve la ruta o None si cancela.
#[tauri::command]
async fn guardar_json(
    app: tauri::AppHandle,
    nombre: String,
    contenido: String,
) -> Result<Option<String>, String> {
    let seleccion = tauri::async_runtime::spawn_blocking({
        let app = app.clone();
        move || {
            app.dialog()
                .file()
                .set_title("Guardar JSON")
                .set_file_name(nombre)
                .blocking_save_file()
                .and_then(|f| f.into_path().ok())
        }
    })
    .await
    .map_err(|e| format!("diálogo: {e}"))?;
    let Some(ruta) = seleccion else {
        return Ok(None);
    };
    fs::write(&ruta, contenido.as_bytes()).map_err(|e| format!("guardar JSON: {e}"))?;
    let vuelta = fs::read_to_string(&ruta).map_err(|e| format!("verificar JSON: {e}"))?;
    if vuelta != contenido {
        return Err("No se pudo verificar el JSON guardado.".into());
    }
    Ok(Some(ruta.to_string_lossy().to_string()))
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

/// Abre una URL en el navegador del sistema. Sin plugin y sin shell: se lanza el
/// abridor del escritorio. Solo http y https.
#[tauri::command]
fn abrir_navegador(url: String) -> Result<(), String> {
    if !(url.starts_with("http://") || url.starts_with("https://")) {
        return Err("Solo se permite http o https.".into());
    }
    #[cfg(target_os = "linux")]
    let (programa, args) = ("xdg-open", vec![url.clone()]);
    #[cfg(target_os = "macos")]
    let (programa, args) = ("open", vec![url.clone()]);
    #[cfg(target_os = "windows")]
    let (programa, args) = ("cmd", vec!["/C".to_string(), "start".to_string(), String::new(), url.clone()]);
    std::process::Command::new(programa)
        .args(args)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("no se pudo abrir el navegador: {e}"))
}

/// Llavero del sistema. La contraseña de aplicación de WebDAV se guarda aquí cuando
/// el sistema lo ofrece; si no, la pagina usa el respaldo cifrado.
const LLAVERO_SERVICIO: &str = "cl.mimo.escritorio";
const LLAVERO_CUENTA: &str = "webdav";

#[tauri::command]
fn llavero_guardar(clave: String) -> Result<(), String> {
    let entrada = keyring::Entry::new(LLAVERO_SERVICIO, LLAVERO_CUENTA)
        .map_err(|e| format!("llavero: {e}"))?;
    entrada
        .set_password(&clave)
        .map_err(|e| format!("llavero: {e}"))
}

#[tauri::command]
fn llavero_leer() -> Result<Option<String>, String> {
    let entrada = keyring::Entry::new(LLAVERO_SERVICIO, LLAVERO_CUENTA)
        .map_err(|e| format!("llavero: {e}"))?;
    match entrada.get_password() {
        Ok(clave) => Ok(Some(clave)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("llavero: {e}")),
    }
}

#[tauri::command]
fn llavero_borrar() -> Result<(), String> {
    let entrada = keyring::Entry::new(LLAVERO_SERVICIO, LLAVERO_CUENTA)
        .map_err(|e| format!("llavero: {e}"))?;
    match entrada.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("llavero: {e}")),
    }
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

    r.fps = await new Promise(function (ok) {
      var n = 0, t0 = performance.now();
      function paso(t) {
        n++;
        if (t - t0 >= 1000) ok(Math.round(n * 1000 / (t - t0)));
        else requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    });

    document.querySelector('#tabs [data-ir="tareas"]').click();
    await esperar(180);
    r.tareas_visible = visible('#p-tareas');

    document.querySelector('#tabs [data-ir="notas"]').click();
    await esperar(180);
    var inicial = JSON.parse(localStorage.getItem('mimo.shell.v1') || '{}');
    r.tutorial_tareas = (inicial.tareas || []).length;
    r.tutorial_nota = (inicial.notas || []).some(function (n) { return n.id === 'bienvenida'; });
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
    r.actualizaciones = {
      card: !!document.querySelector('#actualizaciones-card'),
      version: window.MIMO_VERSION || '',
      estado: (document.querySelector('#act-estado') || {}).textContent || '',
      channel: !!(window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.Channel)
    };
    try {
      var invUpd = (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke) || null;
      if (invUpd) {
        await invUpd('actualizacion_comprobar', { canal: 'otro' });
        r.actualizaciones.canal_invalido = false;
      }
    } catch (e) {
      r.actualizaciones.canal_invalido = String(e).indexOf('Canal') >= 0;
    }

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
  try {
    var info = await inv('carpeta_guardada');
    r.carpeta_nativa = info ? { nombre: info.nombre, ruta: info.ruta } : null;
    if (info) {
      var cuerpo = '{"prueba":"carpeta-nativa","n":1}';
      await inv('escribir_carpeta', { texto: cuerpo });
      r.carpeta_texto = await inv('leer_carpeta');
      r.carpeta_archivo = info.ruta + '/mimo-sync.json';
    }
  } catch (e) {
    r.carpeta_error = String(e);
  }
  try {
    var g = await inv('estado_guardar', { texto: JSON.stringify({ prueba: 'almacen', n: 1 }) });
    var l = await inv('estado_leer');
    var b = await inv('respaldo_crear', {
      motivo: 'prueba-sonda',
      texto: JSON.stringify({ schema: 'mimo.backup', version: 1, entorno: {}, malla: {} })
    });
    var lista = await inv('respaldo_listar');
    r.almacen = {
      guardado: !!(g && g.sha256 && g.bytes > 0),
      leido: !!(l && l.texto && l.texto.indexOf('almacen') >= 0),
      respaldo: !!(b && b.sha256 && b.bytes > 0),
      respaldos: (lista || []).length
    };
  } catch (e) {
    r.almacen_error = String(e);
  }
  inv('sonda_informe', { payload: JSON.stringify(r) });
})();
"#;

fn main() {
    // En Linux, el modo headless corre sobre XWayland para poder colocar la ventana fuera de
    // la pantalla. Sin esto, Wayland ignora la posicion y la ventana aparece encima.
    #[cfg(target_os = "linux")]
    if std::env::var("MIMO_HEADLESS").as_deref() == Ok("1")
        && std::env::var_os("DISPLAY").is_some()
    {
        std::env::set_var("GDK_BACKEND", "x11");
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(CarpetaSync(Mutex::new(None)))
        .manage(actualizaciones::ActualizacionPendiente(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            sonda_informe,
            http_pedir,
            elegir_carpeta,
            carpeta_guardada,
            leer_carpeta,
            escribir_carpeta,
            olvidar_carpeta,
            abrir_navegador,
            llavero_guardar,
            llavero_leer,
            llavero_borrar,
            guardar_json,
            almacen::estado_guardar,
            almacen::estado_leer,
            almacen::respaldo_crear,
            almacen::respaldo_listar,
            actualizaciones::actualizacion_comprobar,
            actualizaciones::actualizacion_instalar,
            actualizaciones::actualizacion_abrir_release
        ])
        .setup(|app| {
            // La ventana nace oculta (`visible: false`) para que los verificadores puedan
            // correr sin que la app aparezca encima. En uso normal se muestra aqui.
            let headless = std::env::var("MIMO_HEADLESS").as_deref() == Ok("1");
            if let Some(ventana) = app.get_webview_window("main") {
                if headless {
                    let _ = ventana.set_skip_taskbar(true);
                    let _ = ventana.set_position(tauri::PhysicalPosition::new(-10000, -10000));
                    let _ = ventana.show();
                } else {
                    let _ = ventana.show();
                    let _ = ventana.set_focus();
                }
            }
            // Tauri pone el icono del bundle en la ventana y en `_NET_WM_ICON` al crearla.
            // No se pisa desde GTK: al fijar `enableGTKAppId` o un icono a mano, GNOME Shell
            // busca un .desktop con ese app id y la ventana termina con el icono genérico.
            seguir_tasa_pantalla(app.handle());
            lanzar_sonda(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error arrancando Mimo");
}
