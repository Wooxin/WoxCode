use regex::Regex;
use serde::Serialize;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
pub struct SearchMatch {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

/// Search file contents with regex — async
#[tauri::command]
#[allow(non_snake_case)]
pub async fn search_content(
    directory: String,
    query: String,
    caseSensitive: bool,
    useRegex: bool,
) -> Result<Vec<SearchMatch>, String> {
    let q = query.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if q.trim().is_empty() { return Ok(Vec::new()); }

        let pattern = if useRegex {
            q.clone()
        } else {
            regex::escape(&q)
        };

        let re = Regex::new(&if caseSensitive {
            pattern
        } else {
            format!("(?i){}", pattern)
        })
        .map_err(|e| format!("Invalid regex: {}", e))?;

        let text_extensions = ["rs","ts","tsx","js","jsx","py","go","java","c","cpp","h","hpp",
            "html","css","scss","less","json","md","yml","yaml","toml","xml","svg","txt","sh","bash",
            "env","gitignore","lock"];

        let mut results: Vec<SearchMatch> = Vec::new();
        let root = std::path::Path::new(&directory).canonicalize().map_err(|e| e.to_string())?;
        let mut scanned = 0usize;

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
            if scanned >= 50_000 { break; }
            if entry.file_type().is_dir() { continue; }
            scanned += 1;

            let path = entry.path();
            let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default();
            if !text_extensions.contains(&ext.as_str()) { continue; }
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if metadata.len() > 1_000_000 { continue; } // Skip files > 1MB

            let content = match std::fs::read_to_string(path) {
                Ok(c) => c,
                Err(_) => continue,
            };
            let relative = path
                .strip_prefix(&root)
                .unwrap_or(path)
                .to_string_lossy()
                .replace('\\', "/");
            let file_name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();

            for (line_num, line) in content.lines().enumerate() {
                if let Some(m) = re.find(line) {
                    results.push(SearchMatch {
                        file_path: relative.clone(),
                        file_name: file_name.clone(),
                        line_number: line_num + 1,
                        line_content: line.to_string(),
                        match_start: m.start(),
                        match_end: m.end(),
                    });
                    if results.len() >= 200 { break; }
                }
            }
            if results.len() >= 200 { break; }
        }

        results.sort_by(|a, b| a.file_path.cmp(&b.file_path).then(a.line_number.cmp(&b.line_number)));
        Ok(results)
    }).await.map_err(|e| e.to_string())?
}
