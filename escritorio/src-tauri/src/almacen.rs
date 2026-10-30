// Almacen nativo de Mimo: espejo del estado y respaldos verificables.
//
// El WebView sigue usando localStorage para leer rapido, pero cada cambio deja una copia
// atomica en el directorio de datos de la app. Si localStorage falla por cuota, la copia
// nativa sigue disponible y la UI puede avisar. Los respaldos llevan SHA-256 y se leen de
// vuelta antes de darlos por buenos.

use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use sha2::{Digest, Sha256};
use tauri::Manager;

const RETENCION: usize = 5;

#[derive(serde::Serialize)]
pub struct GuardadoInfo {
    pub ruta: String,
    pub bytes: usize,
    pub sha256: String,
}

#[derive(serde::Serialize)]
pub struct LeidoInfo {
    pub texto: String,
    pub sha256: String,
}

#[derive(serde::Serialize)]
pub struct RespaldoInfo {
    pub ruta: String,
    pub nombre: String,
    pub bytes: usize,
    pub sha256: String,
    pub fecha: u64,
    pub motivo: String,
}

fn hex(buf: &[u8]) -> String {
    let mut s = String::with_capacity(buf.len() * 2);
    for b in buf {
        s.push_str(&format!("{b:02x}"));
    }
    s
}

fn sha256(texto: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(texto);
    hex(&h.finalize())
}

fn ahora_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn datos(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| format!("datos: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("datos: {e}"))?;
    Ok(dir)
}

fn escribir_atomico(destino: &Path, texto: &str) -> Result<(), String> {
    let dir = destino.parent().ok_or_else(|| "ruta sin carpeta".to_string())?;
    fs::create_dir_all(dir).map_err(|e| format!("crear carpeta: {e}"))?;
    let temporal = dir.join(format!(
        ".{}.{}.tmp",
        destino.file_name().and_then(|n| n.to_str()).unwrap_or("mimo"),
        std::process::id()
    ));
    {
        let mut f = File::create(&temporal).map_err(|e| format!("crear temporal: {e}"))?;
        f.write_all(texto.as_bytes())
            .map_err(|e| format!("escribir temporal: {e}"))?;
        f.sync_all().map_err(|e| format!("sincronizar: {e}"))?;
    }
    fs::rename(&temporal, destino).map_err(|e| format!("reemplazar: {e}"))?;
    let vuelta = fs::read_to_string(destino).map_err(|e| format!("verificar: {e}"))?;
    if vuelta != texto {
        return Err("La copia no coincide después de escribir.".into());
    }
    Ok(())
}

fn motivo_limpio(motivo: &str) -> String {
    let limpio: String = motivo
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    let recortado = limpio.trim_matches('-').to_string();
    if recortado.is_empty() {
        "manual".into()
    } else {
        recortado.chars().take(40).collect()
    }
}

#[tauri::command]
pub fn estado_guardar(app: tauri::AppHandle, texto: String) -> Result<GuardadoInfo, String> {
    if texto.trim().is_empty() {
        return Err("El estado está vacío.".into());
    }
    let dir = datos(&app)?.join("estado");
    fs::create_dir_all(&dir).map_err(|e| format!("crear estado: {e}"))?;
    let destino = dir.join("mimo-estado.json");
    if destino.exists() {
        let _ = fs::copy(&destino, dir.join("mimo-estado.prev.json"));
    }
    escribir_atomico(&destino, &texto)?;
    Ok(GuardadoInfo {
        ruta: destino.to_string_lossy().to_string(),
        bytes: texto.as_bytes().len(),
        sha256: sha256(texto.as_bytes()),
    })
}

#[tauri::command]
pub fn estado_leer(app: tauri::AppHandle) -> Result<Option<LeidoInfo>, String> {
    let destino = datos(&app)?.join("estado").join("mimo-estado.json");
    if !destino.exists() {
        return Ok(None);
    }
    let texto = fs::read_to_string(&destino).map_err(|e| format!("leer estado: {e}"))?;
    Ok(Some(LeidoInfo {
        sha256: sha256(texto.as_bytes()),
        texto,
    }))
}

#[tauri::command]
pub fn respaldo_crear(
    app: tauri::AppHandle,
    motivo: String,
    texto: String,
) -> Result<RespaldoInfo, String> {
    let valor: serde_json::Value =
        serde_json::from_str(&texto).map_err(|_| "El respaldo no es JSON válido.".to_string())?;
    if !valor.is_object() {
        return Err("El respaldo debe ser un objeto JSON.".into());
    }
    let motivo = motivo_limpio(&motivo);
    let dir = datos(&app)?.join("backups");
    fs::create_dir_all(&dir).map_err(|e| format!("crear respaldos: {e}"))?;
    let sello = ahora_ms();
    let fecha = (sello / 1000) as u64;
    let nombre = format!("mimo-backup-{sello}-{motivo}.json");
    let destino = dir.join(&nombre);
    escribir_atomico(&destino, &texto)?;
    let hash = sha256(texto.as_bytes());
    let sidecar = dir.join(format!("{nombre}.sha256"));
    fs::write(&sidecar, format!("{hash}  {nombre}\n")).map_err(|e| format!("checksum: {e}"))?;

    let mut copias: Vec<PathBuf> = fs::read_dir(&dir)
        .map_err(|e| format!("listar respaldos: {e}"))?
        .filter_map(|e| e.ok().map(|x| x.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("mimo-backup-") && n.ends_with(".json"))
                .unwrap_or(false)
        })
        .collect();
    copias.sort_by_key(|p| fs::metadata(p).and_then(|m| m.modified()).ok());
    while copias.len() > RETENCION {
        let viejo = copias.remove(0);
        let _ = fs::remove_file(&viejo);
        let _ = fs::remove_file(viejo.with_extension("json.sha256"));
    }

    Ok(RespaldoInfo {
        ruta: destino.to_string_lossy().to_string(),
        nombre,
        bytes: texto.as_bytes().len(),
        sha256: hash,
        fecha,
        motivo,
    })
}

#[tauri::command]
pub fn respaldo_listar(app: tauri::AppHandle) -> Result<Vec<RespaldoInfo>, String> {
    let dir = datos(&app)?.join("backups");
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut salida = Vec::new();
    for entrada in fs::read_dir(&dir).map_err(|e| format!("listar respaldos: {e}"))? {
        let ruta = entrada.map_err(|e| format!("leer respaldo: {e}"))?.path();
        let nombre = match ruta.file_name().and_then(|n| n.to_str()) {
            Some(n) if n.starts_with("mimo-backup-") && n.ends_with(".json") => n.to_string(),
            _ => continue,
        };
        let texto = fs::read(&ruta).map_err(|e| format!("leer respaldo: {e}"))?;
        let meta = fs::metadata(&ruta).map_err(|e| format!("medir respaldo: {e}"))?;
        let fecha = meta
            .modified()
            .ok()
            .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let motivo = nombre
            .trim_start_matches("mimo-backup-")
            .splitn(2, '-')
            .nth(1)
            .unwrap_or("manual")
            .trim_end_matches(".json")
            .to_string();
        salida.push(RespaldoInfo {
            ruta: ruta.to_string_lossy().to_string(),
            nombre,
            bytes: texto.len(),
            sha256: sha256(&texto),
            fecha,
            motivo,
        });
    }
    salida.sort_by(|a, b| b.fecha.cmp(&a.fecha));
    Ok(salida)
}
