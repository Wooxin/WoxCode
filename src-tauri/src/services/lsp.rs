use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    io::{BufRead, BufReader, Read, Write},
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter};

// ── JSON-RPC types ──

#[derive(Debug, Serialize)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: i32,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Serialize)]
struct JsonRpcNotification {
    jsonrpc: String,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(default)]
    id: Option<i32>,
    #[serde(default)]
    result: Option<serde_json::Value>,
    #[serde(default)]
    error: Option<serde_json::Value>,
    #[serde(default)]
    method: Option<String>,
    #[serde(default)]
    params: Option<serde_json::Value>,
}

// ── LSP State ──

pub struct LspState {
    pub process: Option<Child>,
    pub writer: Option<Box<dyn Write + Send>>,
    pub active: bool,
    pub language: String,
    pub root_path: String,
    pub opened_documents: HashMap<String, i32>,
}

impl LspState {
    pub fn new() -> Self {
        Self {
            process: None,
            writer: None,
            active: false,
            language: String::new(),
            root_path: String::new(),
            opened_documents: HashMap::new(),
        }
    }
}

// ── Detect LSP server ──

fn detect_lsp_server(extension: &str) -> Option<(String, Vec<String>)> {
    match extension {
        // TypeScript / JavaScript
        "ts" | "tsx" | "js" | "jsx" => Some((
            "typescript-language-server".into(), vec!["--stdio".into()],
        )),
        // Rust
        "rs" => Some(("rust-analyzer".into(), vec![])),
        // Python
        "py" => Some(("pylsp".into(), vec![])),
        // Go
        "go" => Some(("gopls".into(), vec![])),
        // C/C++
        "c" | "cpp" | "h" | "hpp" => Some(("clangd".into(), vec![])),
        // HTML / CSS / JSON (vscode-html/css/json-language-server or use node-based)
        "html" => Some(("vscode-html-language-server".into(), vec!["--stdio".into()])),
        "css" | "scss" | "less" => Some(("vscode-css-language-server".into(), vec!["--stdio".into()])),
        "json" => Some(("vscode-json-language-server".into(), vec!["--stdio".into()])),
        // Markdown
        "md" => Some(("marksman".into(), vec![])),
        // YAML
        "yml" | "yaml" => Some(("yaml-language-server".into(), vec!["--stdio".into()])),
        // Java
        "java" => Some(("jdtls".into(), vec![])),
        _ => None,
    }
}

// ── JSON-RPC framing ──

pub fn write_message(writer: &mut dyn Write, content: &str) -> Result<(), String> {
    let header = format!("Content-Length: {}\r\n\r\n", content.len());
    writer
        .write_all(header.as_bytes())
        .map_err(|e| format!("Write error: {}", e))?;
    writer
        .write_all(content.as_bytes())
        .map_err(|e| format!("Write error: {}", e))?;
    writer.flush().map_err(|e| format!("Flush error: {}", e))?;
    Ok(())
}

fn read_message(reader: &mut BufReader<Box<dyn Read + Send>>) -> Result<String, String> {
    let mut content_length: Option<usize> = None;

    loop {
        let mut header = String::new();
        reader
            .read_line(&mut header)
            .map_err(|e| format!("Read error: {}", e))?;

        let trimmed = header.trim();
        if trimmed.is_empty() {
            break;
        }

        if let Some(value) = trimmed.strip_prefix("Content-Length: ") {
            content_length = value.parse().ok();
        }
    }

    let content_length = content_length.ok_or_else(|| "Missing Content-Length header".to_string())?;

    // Read body
    let mut body = vec![0u8; content_length];
    reader
        .read_exact(&mut body)
        .map_err(|e| format!("Read error: {}", e))?;

    String::from_utf8(body).map_err(|e| format!("UTF-8 error: {}", e))
}

// ── Start LSP ──

pub fn start_lsp(
    state: Arc<Mutex<LspState>>,
    app_handle: AppHandle,
    extension: &str,
    root_path: &str,
) -> Result<String, String> {
    {
        let mut s = state.lock().unwrap();
        if s.active && s.language == extension && s.root_path == root_path && s.writer.is_some() {
            return Ok(format!("LSP already active for .{} files", extension));
        }
        if let Some(ref mut child) = s.process {
            let _ = child.kill();
        }
        s.process = None;
        s.writer = None;
        s.active = false;
        s.opened_documents.clear();
    }

    let (cmd, args) = detect_lsp_server(extension)
        .ok_or_else(|| format!("No LSP server available for .{} files", extension))?;

    let mut child = Command::new(&cmd)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}. Is it installed?", cmd, e))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to get stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to get stdout".to_string())?;
    let _stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to get stderr".to_string())?;

    // Send initialize request
    let init_params = serde_json::json!({
        "processId": std::process::id(),
        "rootUri": format!("file:///{}", root_path.replace('\\', "/")),
        "capabilities": {
            "textDocument": {
                "completion": { "completionItem": { "snippetSupport": false } },
                "diagnostic": { "dynamicRegistration": true }
            }
        },
        "workspaceFolders": [{
            "uri": format!("file:///{}", root_path.replace('\\', "/")),
            "name": root_path.split(['/', '\\']).last().unwrap_or("project")
        }]
    });

    let init_req = JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id: 1,
        method: "initialize".into(),
        params: init_params,
    };

    let mut writer = stdin;
    write_message(
        &mut writer,
        &serde_json::to_string(&init_req).map_err(|e| e.to_string())?,
    )?;

    // Send initialized notification
    let initialized_notif = JsonRpcNotification {
        jsonrpc: "2.0".into(),
        method: "initialized".into(),
        params: serde_json::json!({}),
    };
    write_message(
        &mut writer,
        &serde_json::to_string(&initialized_notif).map_err(|e| e.to_string())?,
    )?;

    // Store state
    {
        let mut s = state.lock().unwrap();
        s.process = Some(child);
        s.writer = Some(Box::new(writer));
        s.active = true;
        s.language = extension.to_string();
        s.root_path = root_path.to_string();
        s.opened_documents.clear();
    }

    // Reader thread — forward diagnostics and completions to frontend
    let state_clone = state.clone();
    let app_clone = app_handle.clone();
    let _reader_thread = thread::spawn(move || {
        let reader: Box<dyn Read + Send> = Box::new(stdout);
        let mut reader = BufReader::new(reader);

        loop {
            match read_message(&mut reader) {
                Ok(msg) => {
                    if let Ok(response) = serde_json::from_str::<JsonRpcResponse>(&msg) {
                        // Handle notifications and responses
                        if let Some(method) = &response.method {
                            match method.as_str() {
                                "textDocument/publishDiagnostics" => {
                                    if let Some(params) = &response.params {
                                        let _ = app_clone.emit(
                                            "lsp-diagnostics",
                                            params.clone(),
                                        );
                                    }
                                }
                                "window/logMessage" => {
                                    if let Some(params) = &response.params {
                                        let _ = app_clone.emit("lsp-log", params.clone());
                                    }
                                }
                                _ => {}
                            }
                        }
                        // Handle completion responses
                        if let Some(id) = response.id {
                            if let Some(result) = &response.result {
                                let _ = app_clone.emit(
                                    "lsp-response",
                                    serde_json::json!({"id": id, "result": result}),
                                );
                            }
                        }
                    }
                }
                Err(_) => break,
            }

            if !state_clone.lock().unwrap().active {
                break;
            }
        }
    });

    Ok(format!("LSP started: {}", cmd))
}

/// Send a textDocument/didOpen notification
pub fn did_open(
    state: &Arc<Mutex<LspState>>,
    file_path: &str,
    content: &str,
    language_id: &str,
) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if !s.active {
        return Err("LSP not active".into());
    }

    if let Some(version) = s.opened_documents.get_mut(file_path) {
        *version += 1;
        let params = serde_json::json!({
            "textDocument": {
                "uri": format!("file:///{}", file_path.replace('\\', "/")),
                "version": *version
            },
            "contentChanges": [{ "text": content }]
        });
        let notif = JsonRpcNotification {
            jsonrpc: "2.0".into(),
            method: "textDocument/didChange".into(),
            params,
        };
        let writer = s
            .writer
            .as_mut()
            .ok_or_else(|| "LSP writer not available".to_string())?;
        return write_message(&mut **writer, &serde_json::to_string(&notif).map_err(|e| e.to_string())?);
    }

    let params = serde_json::json!({
        "textDocument": {
            "uri": format!("file:///{}", file_path.replace('\\', "/")),
            "languageId": language_id,
            "version": 1,
            "text": content
        }
    });

    let notif = JsonRpcNotification {
        jsonrpc: "2.0".into(),
        method: "textDocument/didOpen".into(),
        params,
    };

    let writer = s
        .writer
        .as_mut()
        .ok_or_else(|| "LSP writer not available".to_string())?;

    write_message(&mut **writer, &serde_json::to_string(&notif).map_err(|e| e.to_string())?)?;
    s.opened_documents.insert(file_path.to_string(), 1);
    Ok(())
}

/// Send a textDocument/didChange notification with full document sync.
pub fn did_change(
    state: &Arc<Mutex<LspState>>,
    file_path: &str,
    content: &str,
    version: i32,
) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if !s.active {
        return Err("LSP not active".into());
    }
    s.opened_documents.insert(file_path.to_string(), version);

    let params = serde_json::json!({
        "textDocument": {
            "uri": format!("file:///{}", file_path.replace('\\', "/")),
            "version": version
        },
        "contentChanges": [{ "text": content }]
    });

    let notif = JsonRpcNotification {
        jsonrpc: "2.0".into(),
        method: "textDocument/didChange".into(),
        params,
    };

    let writer = s
        .writer
        .as_mut()
        .ok_or_else(|| "LSP writer not available".to_string())?;

    write_message(&mut **writer, &serde_json::to_string(&notif).map_err(|e| e.to_string())?)
}

/// Request completions at a position
pub fn request_completion(
    state: &Arc<Mutex<LspState>>,
    file_path: &str,
    line: u32,
    character: u32,
) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if !s.active {
        return Err("LSP not active".into());
    }

    let req = JsonRpcRequest {
        jsonrpc: "2.0".into(),
        id: 2,
        method: "textDocument/completion".into(),
        params: serde_json::json!({
            "textDocument": {
                "uri": format!("file:///{}", file_path.replace('\\', "/"))
            },
            "position": { "line": line, "character": character }
        }),
    };

    let writer = s
        .writer
        .as_mut()
        .ok_or_else(|| "LSP writer not available".to_string())?;

    write_message(
        &mut **writer,
        &serde_json::to_string(&req).map_err(|e| e.to_string())?,
    )
}

/// Kill the LSP server
pub fn kill_lsp(state: &Arc<Mutex<LspState>>) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    s.active = false;
    if let Some(ref mut child) = s.process {
        let _ = child.kill();
    }
    s.process = None;
    s.writer = None;
    s.root_path.clear();
    s.opened_documents.clear();
    Ok(())
}
