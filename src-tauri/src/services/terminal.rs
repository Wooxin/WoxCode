use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Emitter};

pub struct TerminalState {
    pub master: Option<Box<dyn portable_pty::MasterPty + Send>>,
    pub writer: Option<Box<dyn Write + Send>>,
    pub child: Option<Box<dyn portable_pty::Child + Send + Sync>>,
    pub active: bool,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            master: None,
            writer: None,
            child: None,
            active: false,
        }
    }
}

pub fn spawn_pty(
    state: Arc<Mutex<TerminalState>>,
    app_handle: AppHandle,
    rows: u16,
    cols: u16,
    cwd: Option<String>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pty_pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Use cmd.exe on Windows, bash on Unix
    #[cfg(target_os = "windows")]
    let mut cmd = CommandBuilder::new("cmd.exe");
    #[cfg(not(target_os = "windows"))]
    let mut cmd = CommandBuilder::new(
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into()),
    );

    #[cfg(target_os = "windows")]
    cmd.env("TERM", "xterm-256color");

    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let master = pty_pair.master;
    let mut writer = master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    let reader = master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    if let Some(cwd) = cwd.filter(|p| !p.trim().is_empty()) {
        #[cfg(target_os = "windows")]
        let cd_command = format!("cd /d \"{}\"\r\n", cwd.replace('"', "\"\""));
        #[cfg(not(target_os = "windows"))]
        let cd_command = format!("cd '{}'\n", cwd.replace('\'', "'\\''"));
        let _ = writer.write_all(cd_command.as_bytes());
        let _ = writer.flush();
    }

    // Store state
    {
        let mut s = state.lock().unwrap();
        s.master = Some(master);
        s.writer = Some(writer);
        s.child = Some(child);
        s.active = true;
    }

    // Read thread — stream PTY output to frontend via events
    let state_clone = state.clone();
    thread::spawn(move || {
        let mut reader = reader;
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    // Convert to String, emit event
                    let text = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit("terminal-output", text);
                }
                Err(_) => break,
            }
            // Check if terminal is still active
            if !state_clone.lock().unwrap().active {
                break;
            }
        }
    });

    Ok(())
}

pub fn write_input(state: &Arc<Mutex<TerminalState>>, data: &str) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if let Some(ref mut writer) = s.writer {
        writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Write error: {}", e))?;
        writer.flush().map_err(|e| format!("Flush error: {}", e))?;
    }
    Ok(())
}

pub fn resize_pty(state: &Arc<Mutex<TerminalState>>, rows: u16, cols: u16) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    if let Some(ref mut master) = s.master {
        master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Resize error: {}", e))?;
    }
    Ok(())
}

pub fn kill_pty(state: &Arc<Mutex<TerminalState>>) -> Result<(), String> {
    let mut s = state.lock().unwrap();
    s.active = false;
    if let Some(ref mut child) = s.child {
        let _ = child.kill();
    }
    s.master = None;
    s.writer = None;
    s.child = None;
    Ok(())
}
