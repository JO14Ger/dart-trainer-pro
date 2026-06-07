// DartTrainer Pro v2.1 – Tauri v2 Backend
// Native storage, backups, HTTP for drill imports

use std::fs;
use std::path::PathBuf;

#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::Manager;

const APP_DIR_NAME: &str = "DartTrainerPro";
const DATA_FILE: &str = "training_data.json";
const BACKUP_DIR: &str = "backups";

fn get_app_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Could not find app data directory".to_string())?;
    let app_dir = base.join(APP_DIR_NAME);
    if !app_dir.exists() {
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Could not create directory: {}", e))?;
    }
    Ok(app_dir)
}

#[tauri::command]
fn save_training_data(data: String) -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    let path = app_dir.join(DATA_FILE);
    serde_json::from_str::<serde_json::Value>(&data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    fs::write(&path, &data)
        .map_err(|e| format!("Save failed: {}", e))?;
    Ok(format!("Saved to {}", path.display()))
}

#[tauri::command]
fn load_training_data() -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    let path = app_dir.join(DATA_FILE);
    if !path.exists() { return Ok("null".to_string()); }
    fs::read_to_string(&path).map_err(|e| format!("Read failed: {}", e))
}

#[tauri::command]
fn create_backup() -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    let data_path = app_dir.join(DATA_FILE);
    let backup_dir = app_dir.join(BACKUP_DIR);
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Backup dir failed: {}", e))?;
    }
    if !data_path.exists() { return Err("No data to backup".to_string()); }
    let ts = chrono::Local::now().format("%Y%m%d_%H%M%S");
    let name = format!("backup_{}.json", ts);
    fs::copy(&data_path, backup_dir.join(&name))
        .map_err(|e| format!("Backup failed: {}", e))?;
    Ok(name)
}

#[tauri::command]
fn list_backups() -> Result<Vec<String>, String> {
    let dir = get_app_data_dir()?.join(BACKUP_DIR);
    if !dir.exists() { return Ok(vec![]); }
    let mut list: Vec<String> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().and_then(|e| {
            let n = e.file_name().to_string_lossy().to_string();
            if n.ends_with(".json") { Some(n) } else { None }
        })).collect();
    list.sort_by(|a, b| b.cmp(a));
    Ok(list)
}

#[tauri::command]
fn restore_backup(filename: String) -> Result<String, String> {
    let app_dir = get_app_data_dir()?;
    let bp = app_dir.join(BACKUP_DIR).join(&filename);
    if !bp.exists() { return Err(format!("Not found: {}", filename)); }
    let data = fs::read_to_string(&bp).map_err(|e| e.to_string())?;
    serde_json::from_str::<serde_json::Value>(&data)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    fs::write(app_dir.join(DATA_FILE), &data).map_err(|e| e.to_string())?;
    Ok(format!("Restored: {}", filename))
}

#[tauri::command]
fn get_data_path() -> Result<String, String> {
    Ok(get_app_data_dir()?.join(DATA_FILE).display().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init());

    // Single-instance only on desktop
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .invoke_handler(tauri::generate_handler![
            save_training_data,
            load_training_data,
            create_backup,
            list_backups,
            restore_backup,
            get_data_path,
        ])
        .setup(|_app| {
            if let Ok(dir) = get_app_data_dir() {
                println!("Data: {}", dir.display());
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("DartTrainer Pro failed to start");
}
