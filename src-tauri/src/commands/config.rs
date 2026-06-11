use crate::{get_setting, open_db, set_setting, UserConfig};

fn get_bool(conn: &rusqlite::Connection, key: &str, default: bool) -> bool {
    get_setting(conn, key)
        .ok()
        .flatten()
        .map(|s| s == "true")
        .unwrap_or(default)
}

#[tauri::command]
pub fn get_user_config() -> Result<UserConfig, String> {
    let conn = open_db()?;
    Ok(UserConfig {
        theme: get_setting(&conn, "theme")?.unwrap_or_else(|| "dark".into()),
        font_size: get_setting(&conn, "fontSize")?
            .unwrap_or_else(|| "14".into()).parse().unwrap_or(14),
        font_family: get_setting(&conn, "fontFamily")?
            .unwrap_or_else(|| "Consolas, 'Courier New', monospace".into()),
        ui_font: get_setting(&conn, "uiFont")?
            .unwrap_or_else(|| "HarmonyOS Sans, 'Microsoft YaHei', 'Segoe UI', sans-serif".into()),
        editor_font: get_setting(&conn, "editorFont")?
            .unwrap_or_else(|| "Consolas, 'Cascadia Code', 'Courier New', monospace".into()),
        ui_font_size: get_setting(&conn, "uiFontSize")?.unwrap_or_else(|| "13".into()).parse().unwrap_or(13),
        editor_font_size: get_setting(&conn, "editorFontSize")?.unwrap_or_else(|| "14".into()).parse().unwrap_or(14),
        language: get_setting(&conn, "language")?.unwrap_or_else(|| "zh".into()),
        tab_size: get_setting(&conn, "tabSize")?
            .unwrap_or_else(|| "4".into()).parse().unwrap_or(4),
        activity_expanded: get_bool(&conn, "activityExpanded", true),
        fullscreen: get_bool(&conn, "fullscreen", false),
        sidebar_visible: get_bool(&conn, "sidebarVisible", false),
        semantic_highlighting: get_bool(&conn, "semanticHighlighting", true),
        workspaces: get_setting(&conn, "workspaces")?
            .map(|s| serde_json::from_str(&s).unwrap_or_default())
            .unwrap_or_default(),
        recent_projects: get_setting(&conn, "recentProjects")?
            .map(|s| serde_json::from_str(&s).unwrap_or_default())
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub fn save_user_config(config: UserConfig) -> Result<(), String> {
    let conn = open_db()?;
    set_setting(&conn, "theme", &config.theme)?;
    set_setting(&conn, "fontSize", &config.font_size.to_string())?;
    set_setting(&conn, "fontFamily", &config.font_family)?;
    set_setting(&conn, "uiFont", &config.ui_font)?;
    set_setting(&conn, "editorFont", &config.editor_font)?;
    set_setting(&conn, "uiFontSize", &config.ui_font_size.to_string())?;
    set_setting(&conn, "editorFontSize", &config.editor_font_size.to_string())?;
    set_setting(&conn, "language", &config.language)?;
    set_setting(&conn, "tabSize", &config.tab_size.to_string())?;
    set_setting(&conn, "activityExpanded", if config.activity_expanded { "true" } else { "false" })?;
    set_setting(&conn, "fullscreen", if config.fullscreen { "true" } else { "false" })?;
    set_setting(&conn, "sidebarVisible", if config.sidebar_visible { "true" } else { "false" })?;
    set_setting(&conn, "semanticHighlighting", if config.semantic_highlighting { "true" } else { "false" })?;
    set_setting(&conn, "workspaces", &serde_json::to_string(&config.workspaces).map_err(|e| e.to_string())?)?;
    set_setting(&conn, "recentProjects", &serde_json::to_string(&config.recent_projects).map_err(|e| e.to_string())?)?;
    Ok(())
}
