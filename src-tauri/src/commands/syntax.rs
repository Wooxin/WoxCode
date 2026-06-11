use crate::services::syntax;

/// Parse a file with tree-sitter and return syntax tokens
#[tauri::command]
pub fn parse_syntax(path: String, content: String) -> Result<syntax::SyntaxResult, String> {
    let ext = path
        .split('.')
        .last()
        .unwrap_or("")
        .to_lowercase();

    syntax::parse_source(&content, &ext)
}
