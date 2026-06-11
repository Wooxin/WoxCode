use std::{path::Path, time::UNIX_EPOCH};

use crate::FileEntry;
use walkdir::WalkDir;

/// Fuzzy score for a query against a target string
fn fuzzy_score(query: &str, target: &str) -> i32 {
    let q = query.to_lowercase();
    let t = target.to_lowercase();

    if t == q { return 100; }
    if t.starts_with(&q) { return 80; }
    if t.contains(&q) { return 60; }

    let q_chars: Vec<char> = q.chars().collect();
    let t_chars: Vec<char> = t.chars().collect();
    let mut qi = 0;
    let mut score = 0;

    for (i, &tc) in t_chars.iter().enumerate() {
        if qi < q_chars.len() && tc == q_chars[qi] {
            score += 10;
            // Bonus for matching at word boundaries
            if i == 0 || t_chars[i - 1] == '/' || t_chars[i - 1] == '_' || t_chars[i - 1] == '-' || t_chars[i - 1] == '.' {
                score += 5;
            }
            qi += 1;
        }
    }

    if qi == q_chars.len() { score } else { 0 }
}

/// Search files by name (fuzzy) — async
#[tauri::command]
pub async fn search_files(directory: String, query: String) -> Result<Vec<FileEntry>, String> {
    let q = query.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if q.trim().is_empty() { return Ok(Vec::new()); }
        let root = Path::new(&directory).canonicalize().map_err(|e| e.to_string())?;
        let mut entries = Vec::new();

        for entry in WalkDir::new(&root)
            .max_depth(16)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                if e.depth() > 0 && name.starts_with('.') {
                    return false;
                }
                if e.file_type().is_dir() {
                    let lower = name.to_lowercase();
                    if lower == "node_modules" || lower == "target" || lower == "dist" || lower == ".git" {
                        return false;
                    }
                }
                true
            })
            .filter_map(|e| e.ok())
        {
            if entries.len() >= 50_000 {
                break;
            }
            if entry.file_type().is_dir() {
                continue;
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();
            let relative = path
                .strip_prefix(&root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/");
            let metadata = entry.metadata().ok();
            let modified = metadata
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or_default();
            entries.push(FileEntry {
                name,
                path: relative,
                is_dir: false,
                extension: path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default(),
                size: metadata.map(|m| m.len()).unwrap_or_default(),
                modified,
            });
        }

        let mut scored: Vec<(FileEntry, i32)> = entries.into_iter()
            .filter(|e| !e.is_dir)
            .map(|e| { let ns = fuzzy_score(&q, &e.name); let ps = fuzzy_score(&q, &e.path); (e, ns + ps) })
            .filter(|(_, s)| *s > 0).collect();
        scored.sort_by(|a, b| b.1.cmp(&a.1));
        Ok(scored.into_iter().take(50).map(|(e, _)| e).collect())
    }).await.map_err(|e| e.to_string())?
}
