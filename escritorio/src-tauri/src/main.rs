// Mimo para escritorio (Tauri 2).
//
// Este caparazon NO reescribe el prototipo: carga `escritorio/app/index.html`, que prepara
// `preparar-frontend.sh` copiando `prototipo/` con lista blanca. La aplicacion sigue siendo la
// misma pagina que se publica en GitHub Pages.
//
// En el uso normal aqui no hay logica propia: ni comandos nativos ni plugins. Por eso
// `capabilities/default.json` solo concede `core:default` y el disco no queda abierto a la pagina.
//
// Las tres peticiones del prototipo (`i18n/<lang>.json`, `datos/bloques.json`,
// `bloques/malla/manifiesto.json`) son relativas: bajo Tauri las sirve el protocolo de recursos
// desde `frontendDist`, sin servidor web. Si alguna no resolviera, es un hallazgo HUECO que se
// declara con su error literal; no se arregla tocando el prototipo.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

/// Recibe el informe de la sonda de medida y lo deja en disco. No se usa en el uso normal.
#[tauri::command]
fn sonda_informe(payload: String) {
    let _ = fs::write("/tmp/mimo-sonda.json", &payload);
    println!("__MIMO_SONDA__{payload}");
    std::process::exit(0);
}

/// Sonda de medida: SOLO corre con `MIMO_SONDA=1`. Sirve para comprobar DENTRO de la ventana real
/// que las tres rutas que el prototipo pide por `fetch` se resuelven por el protocolo de Tauri
/// (es lo unico que no se puede medir mirando los ficheros del paquete). Copia el patron del molde
/// del viejo (`referencia/mimo-app-53cc22d/escritorio/src-tauri/src/main.rs`).
fn lanzar_sonda(app: &tauri::AppHandle) {
    if std::env::var("MIMO_SONDA").as_deref() != Ok("1") {
        return;
    }
    use tauri::Manager;
    let app = app.clone();
    std::thread::spawn(move || {
        // Se le da tiempo a la ventana a cargar la pagina (la sonda mide despues del `load`).
        std::thread::sleep(std::time::Duration::from_millis(6000));
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.eval(GUION_SONDA);
        } else {
            let _ = fs::write(
                "/tmp/mimo-sonda.json",
                "{\"error\":\"no hay ventana con etiqueta main\"}",
            );
            std::process::exit(2);
        }
        // Si en 40 s no llego el informe, se deja constancia y se sale con error.
        std::thread::sleep(std::time::Duration::from_millis(40000));
        let _ = fs::write(
            "/tmp/mimo-sonda.json",
            "{\"error\":\"la sonda no respondio en 40 s\"}",
        );
        std::process::exit(3);
    });
}

/// El guion que se evalua DENTRO de la ventana: repite las tres peticiones del prototipo y manda
/// el resultado por el comando `sonda_informe`. Mide estado HTTP, tipo, tamano y si es JSON.
const GUION_SONDA: &str = r#"
(function () {
  var rutas = ['i18n/es.json', 'datos/bloques.json', 'bloques/malla/manifiesto.json'];
  var r = {
    origen: location.origin,
    protocolo: location.protocol,
    titulo: document.title,
    hojas: document.styleSheets.length,
    nodos: document.querySelectorAll('*').length,
    navs: document.querySelectorAll('[data-seccion]').length,
    ejemplo_i18n: (function () {
      var e = document.querySelector('[data-i18n]');
      return e ? e.getAttribute('data-i18n') + ' -> ' + (e.textContent || '').slice(0, 60) : 'sin [data-i18n]';
    })()
  };
  function una(u) {
    return fetch(u).then(function (resp) {
      return resp.text().then(function (t) {
        var esJson = true;
        var error = null;
        try { JSON.parse(t); } catch (e) { esJson = false; error = String(e); }
        return { ruta: u, ok: resp.ok, estado: resp.status,
                 tipo: resp.headers.get('content-type'), bytes: t.length,
                 es_json: esJson, error_json: error };
      });
    }).catch(function (e) { return { ruta: u, error: String(e) }; });
  }
  function enviar() {
    Promise.all(rutas.map(una)).then(function (res) {
      r.peticiones = res;
      var t = window.__TAURI_INTERNALS__ ||
              (window.__TAURI__ && window.__TAURI__.core) || {};
      var inv = t.invoke;
      if (!inv) { document.title = 'SONDA SIN INVOKE'; return; }
      inv('sonda_informe', { payload: JSON.stringify(r) });
    }).catch(function (e) {
      r.error = String(e);
      var t = window.__TAURI_INTERNALS__ || {};
      if (t.invoke) { t.invoke('sonda_informe', { payload: JSON.stringify(r) }); }
    });
  }
  enviar();
})();
"#;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![sonda_informe])
        .setup(|app| {
            lanzar_sonda(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error arrancando Mimo");
}
