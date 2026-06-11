use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

use crate::services::lsp::{self, LspState};

/// Start an LSP server for the given file type
#[tauri::command]
pub fn lsp_start(
    state: State<'_, Arc<Mutex<LspState>>>,
    app_handle: AppHandle,
    extension: String,
    root_path: String,
) -> Result<String, String> {
    lsp::start_lsp(state.inner().clone(), app_handle, &extension, &root_path)
}

/// Notify the LSP that a document was opened/changed
#[tauri::command]
pub fn lsp_did_open(
    state: State<'_, Arc<Mutex<LspState>>>,
    file_path: String,
    content: String,
    language_id: String,
) -> Result<(), String> {
    lsp::did_open(state.inner(), &file_path, &content, &language_id)
}

/// Notify the LSP that a document changed.
#[tauri::command]
pub fn lsp_did_change(
    state: State<'_, Arc<Mutex<LspState>>>,
    file_path: String,
    content: String,
    version: i32,
) -> Result<(), String> {
    lsp::did_change(state.inner(), &file_path, &content, version)
}

/// Request completions at a position
#[tauri::command]
pub fn lsp_completion(
    state: State<'_, Arc<Mutex<LspState>>>,
    file_path: String,
    line: u32,
    character: u32,
) -> Result<(), String> {
    lsp::request_completion(state.inner(), &file_path, line, character)
}

/// Kill the LSP server
#[tauri::command]
pub fn lsp_kill(
    state: State<'_, Arc<Mutex<LspState>>>,
) -> Result<(), String> {
    lsp::kill_lsp(state.inner())
}

/// Request semantic tokens
#[tauri::command]
pub fn lsp_semantic_tokens(
    state: State<'_, Arc<Mutex<LspState>>>,
    file_path: String,
) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if !s.active { return Err("LSP not active".into()); }
    let req = serde_json::json!({
        "jsonrpc": "2.0", "id": 3,
        "method": "textDocument/semanticTokens/full",
        "params": { "textDocument": { "uri": format!("file:///{}", file_path.replace('\\', "/")) } }
    });
    let writer = s
        .writer
        .as_mut()
        .ok_or_else(|| "LSP writer not available".to_string())?;
    crate::services::lsp::write_message(&mut **writer, &serde_json::to_string(&req).map_err(|e| e.to_string())?)
}
