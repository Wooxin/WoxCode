use std::process::Command;

use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct GitStatus {
    pub branch: Option<String>,
    pub changed: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[tauri::command]
pub async fn git_branch(directory: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .args(["-C", &directory, "branch", "--show-current"])
            .output();

        let output = match output {
            Ok(output) => output,
            Err(_) => return Ok(None),
        };

        if !output.status.success() {
            return Ok(None);
        }

        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if branch.is_empty() {
            Ok(None)
        } else {
            Ok(Some(branch))
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_status(directory: String) -> Result<Option<GitStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let branch = git_current_branch(&directory);
        let output = Command::new("git")
            .args(["-C", &directory, "status", "--porcelain"])
            .output();

        let output = match output {
            Ok(output) => output,
            Err(_) => return Ok(None),
        };

        if !output.status.success() {
            return Ok(None);
        }

        let changed = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter(|line| !line.trim().is_empty())
            .count();

        Ok(Some(GitStatus { branch, changed }))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_file_statuses(directory: String) -> Result<Vec<GitFileStatus>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("git")
            .args(["-C", &directory, "status", "--porcelain=v1"])
            .output();

        let output = match output {
            Ok(output) => output,
            Err(_) => return Ok(Vec::new()),
        };

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let statuses = String::from_utf8_lossy(&output.stdout)
            .lines()
            .filter_map(parse_porcelain_line)
            .collect();

        Ok(statuses)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn parse_porcelain_line(line: &str) -> Option<GitFileStatus> {
    if line.len() < 4 {
        return None;
    }
    let status = line[..2].trim().to_string();
    let raw_path = line[3..].trim();
    let path = raw_path
        .split(" -> ")
        .last()
        .unwrap_or(raw_path)
        .replace('\\', "/");

    Some(GitFileStatus { path, status })
}

fn git_current_branch(directory: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["-C", directory, "branch", "--show-current"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if branch.is_empty() {
        None
    } else {
        Some(branch)
    }
}
