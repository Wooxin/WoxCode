use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

use crate::services::terminal::{self, TerminalState};

/// Start a terminal session
#[tauri::command]
pub fn terminal_start(
    state: State<'_, Arc<Mutex<TerminalState>>>,
    app_handle: AppHandle,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<(), String> {
    terminal::spawn_pty(state.inner().clone(), app_handle, rows, cols, cwd)
}

/// Write input to the terminal
#[tauri::command]
pub fn terminal_write(
    state: State<'_, Arc<Mutex<TerminalState>>>,
    data: String,
) -> Result<(), String> {
    terminal::write_input(state.inner(), &data)
}

/// Resize the terminal
#[tauri::command]
pub fn terminal_resize(
    state: State<'_, Arc<Mutex<TerminalState>>>,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    terminal::resize_pty(state.inner(), rows, cols)
}

/// Kill the terminal session
#[tauri::command]
pub fn terminal_kill(
    state: State<'_, Arc<Mutex<TerminalState>>>,
) -> Result<(), String> {
    terminal::kill_pty(state.inner())
}
