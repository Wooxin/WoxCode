use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::{open_db, set_setting};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTab {
    pub file_path: String,
    pub dirty_content: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub project_path: String,
    pub tabs: Vec<SessionTab>,
}

/// Save session (open tabs + dirty content)
#[tauri::command]
pub fn save_session(project_path: String, tabs: Vec<SessionTab>) -> Result<(), String> {
    let conn = open_db()?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS session (
            project_path TEXT NOT NULL,
            file_path TEXT NOT NULL,
            dirty_content TEXT,
            is_active INTEGER DEFAULT 0,
            PRIMARY KEY (project_path, file_path)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // Clear old session for this project
    conn.execute(
        "DELETE FROM session WHERE project_path = ?1",
        params![project_path],
    )
    .map_err(|e| e.to_string())?;

    // Insert current tabs
    for tab in &tabs {
        conn.execute(
            "INSERT INTO session (project_path, file_path, dirty_content, is_active) VALUES (?1, ?2, ?3, ?4)",
            params![
                project_path,
                tab.file_path,
                tab.dirty_content,
                tab.is_active as i32,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // Also remember last project
    set_setting(&conn, "lastProject", &project_path)?;

    Ok(())
}

/// Load session for a project
#[tauri::command]
pub fn load_session(project_path: String) -> Result<SessionData, String> {
    let conn = open_db()?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS session (
            project_path TEXT NOT NULL,
            file_path TEXT NOT NULL,
            dirty_content TEXT,
            is_active INTEGER DEFAULT 0,
            PRIMARY KEY (project_path, file_path)
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT file_path, dirty_content, is_active FROM session WHERE project_path = ?1")
        .map_err(|e| e.to_string())?;

    let tabs: Vec<SessionTab> = stmt
        .query_map(params![project_path], |row| {
            Ok(SessionTab {
                file_path: row.get(0)?,
                dirty_content: row.get(1)?,
                is_active: row.get::<_, i32>(2)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(SessionData {
        project_path,
        tabs,
    })
}
