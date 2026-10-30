// Actualizador de Mimo.
//
// La politica vive en Rust, no en el WebView: el frontend solo pide el canal `beta` o
// `stable` y recibe metadatos. El endpoint se resuelve con una URL fija de la rama
// `updates`; la firma minisign y `requireSignedVersion` las valida el plugin.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};
use tauri_plugin_updater::{Update, UpdaterExt};
use url::Url;

pub struct ActualizacionPendiente(pub Mutex<Option<Update>>);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InfoActualizacion {
    pub version: String,
    pub actual: String,
    pub notas: String,
    pub fecha: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "evento", content = "datos")]
pub enum EventoActualizacion {
    Respaldo { ruta: String, sha256: String },
    Empezando { total: Option<u64> },
    Progreso { bytes: u64 },
    Descargado,
    Instalado,
}

fn endpoint(canal: &str) -> Result<String, String> {
    let canal = match canal {
        "beta" | "stable" => canal,
        _ => return Err("Canal de actualización no válido.".into()),
    };
    Ok(format!(
        "https://raw.githubusercontent.com/billibu-n/Mimo/updates/{canal}.json"
    ))
}

#[tauri::command]
pub async fn actualizacion_comprobar(
    app: AppHandle,
    canal: String,
    pendiente: State<'_, ActualizacionPendiente>,
) -> Result<Option<InfoActualizacion>, String> {
    let url = Url::parse(&endpoint(&canal)?).map_err(|e| format!("URL de actualización: {e}"))?;
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("Endpoint de actualización: {e}"))?
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Preparar actualizador: {e}"))?;
    match updater.check().await {
        Ok(Some(update)) => {
            let info = InfoActualizacion {
                version: update.version.clone(),
                actual: update.current_version.clone(),
                notas: update.body.clone().unwrap_or_default(),
                fecha: update.date.map(|d| d.to_string()).unwrap_or_default(),
            };
            if let Ok(mut slot) = pendiente.0.lock() {
                *slot = Some(update);
            }
            Ok(Some(info))
        }
        Ok(None) => {
            if let Ok(mut slot) = pendiente.0.lock() {
                *slot = None;
            }
            Ok(None)
        }
        Err(e) => {
            if let Ok(mut slot) = pendiente.0.lock() {
                *slot = None;
            }
            Err(format!("No se pudo comprobar la actualización: {e}"))
        }
    }
}

#[tauri::command]
pub async fn actualizacion_instalar(
    app: AppHandle,
    estado: String,
    pendiente: State<'_, ActualizacionPendiente>,
    al_evento: Channel<EventoActualizacion>,
) -> Result<(), String> {
    let update = {
        let mut slot = pendiente.0.lock().map_err(|_| "Actualizador bloqueado.".to_string())?;
        slot.take().ok_or_else(|| "No hay una actualización preparada.".to_string())?
    };
    let evento = |e: EventoActualizacion| {
        let _ = al_evento.send(e);
    };
    let respaldo = crate::almacen::respaldo_crear(app.clone(), "antes-de-actualizar".into(), estado)?;
    evento(EventoActualizacion::Respaldo {
        ruta: respaldo.ruta.clone(),
        sha256: respaldo.sha256.clone(),
    });
    let mut bytes = 0u64;
    let mut empezado = false;
    update
        .download_and_install(
            |chunk, total| {
                if !empezado {
                    empezado = true;
                    evento(EventoActualizacion::Empezando { total });
                }
                bytes += chunk as u64;
                evento(EventoActualizacion::Progreso { bytes });
            },
            || {
                evento(EventoActualizacion::Descargado);
            },
        )
        .await
        .map_err(|e| format!("No se pudo instalar la actualización: {e}"))?;
    evento(EventoActualizacion::Instalado);
    app.restart();
}

#[tauri::command]
pub fn actualizacion_abrir_release() -> Result<(), String> {
    let url = "https://github.com/billibu-n/Mimo/releases";
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("No se pudo abrir el navegador: {e}"))?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()
            .map_err(|e| format!("No se pudo abrir el navegador: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| format!("No se pudo abrir el navegador: {e}"))?;
    }
    Ok(())
}
