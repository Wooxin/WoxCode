use serde::Serialize;
use tree_sitter::{Parser, Tree};

// ── Token types ──

#[derive(Debug, Clone, Serialize)]
pub struct SyntaxToken {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub end_col: usize,
    pub token_type: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SyntaxResult {
    pub tokens: Vec<SyntaxToken>,
    pub language: String,
}

// ── Language detection ──

pub fn detect_lang(extension: &str) -> Option<tree_sitter::Language> {
    match extension {
        "rs" => Some(tree_sitter_rust::LANGUAGE.into()),
        "ts" | "tsx" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "js" | "jsx" => Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into()),
        "py" => Some(tree_sitter_python::LANGUAGE.into()),
        _ => None,
    }
}

pub fn lang_name(extension: &str) -> &str {
    match extension {
        "rs" => "Rust",
        "ts" | "tsx" => "TypeScript",
        "js" | "jsx" => "JavaScript",
        "py" => "Python",
        _ => "Plain Text",
    }
}

// ── Parse and extract tokens ──

pub fn parse_source(source: &str, extension: &str) -> Result<SyntaxResult, String> {
    let language = detect_lang(extension)
        .ok_or_else(|| format!("No tree-sitter grammar for .{}", extension))?;

    let mut parser = Parser::new();
    parser
        .set_language(&language)
        .map_err(|e| format!("Failed to set language: {}", e))?;

    let tree = parser
        .parse(source, None)
        .ok_or_else(|| "Failed to parse source".to_string())?;

    let tokens = extract_tokens(&tree, source);
    let lang = lang_name(extension).to_string();

    Ok(SyntaxResult {
        tokens,
        language: lang,
    })
}

fn extract_tokens(tree: &Tree, source: &str) -> Vec<SyntaxToken> {
    let mut tokens = Vec::new();
    let mut cursor = tree.walk();

    // Helper to get line/col from byte offset
    let to_line_col = |offset: usize| -> (usize, usize) {
        let prefix = &source[..offset.min(source.len())];
        let line = prefix.bytes().filter(|&b| b == b'\n').count();
        let last_newline = prefix.rfind('\n').map(|i| i + 1).unwrap_or(0);
        let col = offset - last_newline;
        (line, col)
    };

    // Walk the tree and collect named nodes
    let mut visited = false;
    loop {
        let node = cursor.node();

        // Only collect named nodes (skip anonymous/punctuation)
        if node.is_named() && node.child_count() == 0 {
            let (start_line, start_col) = to_line_col(node.start_byte());
            let (end_line, end_col) = to_line_col(node.end_byte());

            tokens.push(SyntaxToken {
                start_line,
                start_col,
                end_line,
                end_col,
                token_type: node.kind().to_string(),
            });
        }

        if cursor.goto_first_child() {
            continue;
        }
        while !cursor.goto_next_sibling() {
            if !cursor.goto_parent() {
                visited = true;
                break;
            }
        }
        if visited {
            break;
        }
    }

    tokens
}
