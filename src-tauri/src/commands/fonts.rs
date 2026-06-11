use std::{fs, path::Path};

/// Extract font family name from TTF/OTF bytes
fn get_font_name(data: &[u8]) -> Option<String> {
    let face = ttf_parser::Face::parse(data, 0).ok()?;
    // Get name ID 1 (Font Family) or ID 16 (Typographic Family)
    for name in face.names() {
        if name.name_id == ttf_parser::name_id::FULL_NAME
            || name.name_id == ttf_parser::name_id::FAMILY
        {
            if let Some(s) = name.to_string() {
                // Prefer FULL_NAME for display
                if name.name_id == ttf_parser::name_id::FULL_NAME {
                    return Some(s);
                }
                // Fallback to FAMILY
            }
        }
    }
    // Try FAMILY as fallback
    for name in face.names() {
        if name.name_id == ttf_parser::name_id::FAMILY {
            if let Some(s) = name.to_string() {
                return Some(s);
            }
        }
    }
    None
}

/// Scan system fonts directory and return font family names
#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<String>, String> {
    let mut fonts: Vec<String> = Vec::new();

    // Primary: C:\Windows\Fonts
    let system_fonts = Path::new("C:\\Windows\\Fonts");
    if system_fonts.exists() {
        scan_dir(system_fonts, &mut fonts);
    }

    // User fonts
    if let Ok(home) = std::env::var("LOCALAPPDATA") {
        let user_fonts = Path::new(&home)
            .join("Microsoft")
            .join("Windows")
            .join("Fonts");
        if user_fonts.exists() {
            scan_dir(&user_fonts, &mut fonts);
        }
    }

    fonts.sort();
    fonts.dedup();

    // Always provide fallback list
    if fonts.is_empty() {
        fonts = vec![
            "Consolas".into(),
            "Cascadia Code".into(),
            "Microsoft YaHei".into(),
            "Segoe UI".into(),
            "Courier New".into(),
            "SimSun".into(),
        ];
    }

    Ok(fonts)
}

fn scan_dir(dir: &Path, fonts: &mut Vec<String>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                let ext_lower = ext.to_lowercase();
                if ext_lower == "ttf" || ext_lower == "otf" || ext_lower == "ttc" {
                    // Try to read and extract name
                    if let Ok(data) = fs::read(&path) {
                        if let Some(name) = get_font_name(&data) {
                            fonts.push(name);
                        }
                    }
                }
            }
        }
    }
}
