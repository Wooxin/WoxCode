use rusqlite::{params, Connection};
use std::{
    fs,
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

mod models;
pub use models::*;
mod commands;
mod services;
use services::terminal::TerminalState;
use services::lsp::LspState;

// ── Data directory (portable: next to exe) ──────────────────

pub fn app_data_dir() -> Result<PathBuf, String> {
    let path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("WoxCodeData"))
        .unwrap_or_else(|| PathBuf::from("WoxCodeData"));
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn open_db() -> Result<Connection, String> {
    let db_path = app_data_dir()?.join("woxcode.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ── Icon helper ─────────────────────────────────────────────

#[cfg(target_os = "windows")]
fn app_icon() -> Option<Image<'static>> {
    let icon_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("icons")
        .join("icon.png");
    if icon_path.exists() {
        let bytes = std::fs::read(icon_path).ok()?;
        Image::from_bytes(&bytes).ok()
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn app_icon() -> Option<Image<'static>> {
    None
}

// ── App entry ──────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Single-instance lock via TCP port binding
    let _lock = std::net::TcpListener::bind("127.0.0.1:19877");
    if _lock.is_err() {
        std::process::exit(0);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Register terminal state
            app.manage(Arc::new(Mutex::new(TerminalState::new())));
            // Register LSP state
            app.manage(Arc::new(Mutex::new(LspState::new())));

            let window = app.get_webview_window("main").unwrap();

            // Set window icon from icon.png
            if let Some(icon) = app_icon() {
                let _ = window.set_icon(icon);
            }

            // Disable default webview right-click context menu
            let js =
                "document.addEventListener('contextmenu', function(e) { e.preventDefault(); });";
            let _ = window.eval(js);

            // Restore maximized state
            let conn = open_db()?;
            if let Some(val) = get_setting(&conn, "windowMaximized")? {
                if val == "true" {
                    let _ = window.maximize();
                }
            }

            // Tray icon + menu
            let show = MenuItem::with_id(app, "show", "显示 WoxCode", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let icon = app_icon().unwrap_or_else(|| {
                app.default_window_icon()
                    .expect("missing WoxCode icon")
                    .clone()
            });

            TrayIconBuilder::new()
                .tooltip("WoxCode")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Resized(_) => {
                if let Ok(conn) = open_db() {
                    let is_max = window.is_maximized().unwrap_or(false);
                    let _ = set_setting(
                        &conn,
                        "windowMaximized",
                        if is_max { "true" } else { "false" },
                    );
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::files::open_folder,
            commands::files::open_file,
            commands::files::list_directory,
            commands::files::read_text_file,
            commands::files::write_text_file,
            commands::files::create_file,
            commands::files::create_folder,
            commands::files::delete_entry,
            commands::files::check_is_dir,
            commands::files::rename_entry,
            commands::config::get_user_config,
            commands::config::save_user_config,
            commands::fonts::list_system_fonts,
            commands::git::git_branch,
            commands::git::git_file_statuses,
            commands::git::git_status,
            commands::syntax::parse_syntax,
            commands::terminal::terminal_start,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::lsp::lsp_start,
            commands::lsp::lsp_did_open,
            commands::lsp::lsp_did_change,
            commands::lsp::lsp_completion,
            commands::lsp::lsp_kill,
            commands::lsp::lsp_semantic_tokens,
            commands::session::save_session,
            commands::session::load_session,
            commands::search_files::search_files,
            commands::search_content::search_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
