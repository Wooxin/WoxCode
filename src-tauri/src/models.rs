use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub extension: String,
    pub size: u64,
    pub modified: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenTab {
    pub path: String,
    pub name: String,
    pub dirty: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UserConfig {
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default = "default_font_size")]
    pub font_size: u32,
    #[serde(default)]
    pub font_family: String,
    pub ui_font: String,
    pub editor_font: String,
    pub ui_font_size: u32,
    pub editor_font_size: u32,
    #[serde(default)]
    pub language: String,
    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
    #[serde(default)]
    pub activity_expanded: bool,
    #[serde(default)]
    pub fullscreen: bool,
    #[serde(default)]
    pub sidebar_visible: bool,
    pub semantic_highlighting: bool,
    pub workspaces: Vec<String>,
    #[serde(default)]
    pub recent_projects: Vec<String>,
}

fn default_theme() -> String { "dark".into() }
fn default_font_size() -> u32 { 14 }
fn default_tab_size() -> u32 { 4 }

impl Default for UserConfig {
    fn default() -> Self {
        Self {
            theme: default_theme(),
            font_size: default_font_size(),
            font_family: String::new(),
            ui_font: String::new(),
            editor_font: String::new(),
            ui_font_size: 13,
            editor_font_size: 14,
            language: "zh".into(),
            tab_size: default_tab_size(),
            activity_expanded: true,
            fullscreen: false,
            sidebar_visible: false,
            semantic_highlighting: true,
            workspaces: vec![],
            recent_projects: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenFileResult {
    pub path: String,
    pub name: String,
    pub content: String,
}
