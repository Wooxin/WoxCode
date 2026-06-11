use std::{
    fs,
    path::Path,
    time::UNIX_EPOCH,
};
use walkdir::WalkDir;

use crate::FileEntry;
use crate::OpenFileResult;

const MAX_TEXT_FILE_SIZE: u64 = 10 * 1024 * 1024;

fn read_text_file_internal(path: &str) -> Result<String, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("File not found: {}", path));
    }
    let metadata = fs::metadata(p).map_err(|e| format!("Failed to inspect {}: {}", path, e))?;
    if metadata.len() > MAX_TEXT_FILE_SIZE {
        return Err(format!(
            "File is too large to open safely: {} ({:.1} MB)",
            path,
            metadata.len() as f64 / 1024.0 / 1024.0
        ));
    }
    let bytes = fs::read(p).map_err(|e| format!("Failed to read {}: {}", path, e))?;
    if bytes.contains(&0) {
        return Err(format!("File appears to be binary: {}", path));
    }
    String::from_utf8(bytes).map_err(|_| format!("File is not valid UTF-8: {}", path))
}

/// Pick a folder via native dialog, return its path
#[tauri::command]
pub async fn open_folder() -> Result<Option<String>, String> {
    let folder = rfd::AsyncFileDialog::new().pick_folder().await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

/// Pick a file via native dialog, return its path and content
#[tauri::command]
pub async fn open_file() -> Result<Option<OpenFileResult>, String> {
    let file = rfd::AsyncFileDialog::new().pick_file().await;
    match file {
        Some(f) => {
            let path = f.path().to_string_lossy().to_string();
            let content = read_text_file_internal(&path)?;
            let name = f.file_name();
            Ok(Some(OpenFileResult {
                path,
                name,
                content,
            }))
        }
        None => Ok(None),
    }
}

/// Recursively list directory contents (skipping .git, node_modules, target)
pub fn list_directory_internal(path: &str) -> Result<Vec<FileEntry>, String> {
    let root = Path::new(path);
    if !root.exists() {
        return Err(format!("Directory not found: {}", path));
    }
    let root = root.canonicalize().map_err(|e| e.to_string())?;

    let mut entries = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // Skip hidden and common large dirs
            if e.depth() > 0 && name.starts_with('.') {
                return false;
            }
            if e.file_type().is_dir() {
                let lower = name.to_lowercase();
                if lower == "node_modules" || lower == "target" || lower == ".git" {
                    return false;
                }
            }
            true
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path == root {
            continue;
        }
        if entries.len() >= 5000 {
            break;
        }

        let file_name = entry.file_name().to_string_lossy();
        if file_name.starts_with('.') {
            continue;
        }

        let relative = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or_default();

        entries.push(FileEntry {
            name: file_name.to_string(),
            path: relative,
            is_dir: entry.file_type().is_dir(),
            extension,
            size: metadata.len(),
            modified,
        });
    }

    entries.sort_by(|a, b| {
        a.is_dir
            .cmp(&b.is_dir)
            .reverse()
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Tauri command wrapper for list_directory_internal (async for large dirs)
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let p = path.clone();
    tauri::async_runtime::spawn_blocking(move || list_directory_internal(&p))
        .await
        .map_err(|e| e.to_string())?
}

/// Read text file contents (UTF-8) — async for large files
#[tauri::command]
pub async fn read_text_file(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_text_file_internal(&path)
    }).await.map_err(|e| e.to_string())?
}

/// Write text file contents (UTF-8) — async
#[tauri::command]
pub async fn write_text_file(path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let p = Path::new(&path);
        if let Some(parent) = p.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        fs::write(p, &content).map_err(|e| format!("Failed to write {}: {}", path, e))
    }).await.map_err(|e| e.to_string())?
}

/// Create a new empty file
#[tauri::command]
pub fn create_file(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(format!("File already exists: {}", path));
    }
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(p, "").map_err(|e| format!("Failed to create {}: {}", path, e))
}

/// Create a new directory
#[tauri::command]
pub fn create_folder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err(format!("Folder already exists: {}", path));
    }
    fs::create_dir_all(p).map_err(|e| format!("Failed to create {}: {}", path, e))
}

/// Delete a file or empty directory
#[tauri::command]
pub fn delete_entry(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Not found: {}", path));
    }
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete {}: {}", path, e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete {}: {}", path, e))
    }
}

/// Check if a path is a directory
#[tauri::command]
pub fn check_is_dir(path: String) -> Result<bool, String> {
    Ok(Path::new(&path).is_dir())
}

/// Rename a file or directory
#[tauri::command]
pub fn rename_entry(path: String, new_name: String) -> Result<String, String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Not found: {}", path));
    }
    let parent = p.parent().unwrap_or(Path::new("."));
    let new_path = parent.join(&new_name);
    fs::rename(p, &new_path).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(new_path.to_string_lossy().to_string())
}
