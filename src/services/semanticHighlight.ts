import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import * as bridge from "../bridge";

// LSP semantic token types

// ── StateField for semantic highlights ──

export const setSemanticHighlights = StateEffect.define<DecorationSet>();

export const semanticHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) if (e.is(setSemanticHighlights)) return e.value;
    return deco.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

export const semanticHighlightExtension = semanticHighlightField;

// ── Semantic tokens → decorations ──

export function parseSemanticTokens(data: number[], doc: string): DecorationSet {
  const decorations: { from: number; to: number }[] = [];
  let line = 0;
  let col = 0;

  // Split doc into lines for offset calculation
  const lineStarts: number[] = [0];
  for (let i = 0; i < doc.length; i++) {
    if (doc[i] === "\n") lineStarts.push(i + 1);
  }

  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i];
    const deltaStart = data[i + 1];
    const length = data[i + 2];
    const _tkType = data[i + 3];
    // token modifiers at data[i+4] reserved for future use

    if (deltaLine > 0) { line += deltaLine; col = 0; }
    col += deltaStart;

    const lineStart = lineStarts[Math.min(line, lineStarts.length - 1)] ?? 0;
    const from = lineStart + col;
    const to = from + length;

    // Only highlight if it's a meaningful token type (skip comments, strings for perf)
    if (length > 0 && _tkType < 13) {
      decorations.push({ from, to });
    }
  }

  if (decorations.length === 0) return Decoration.none;

  const marks = decorations.map(d =>
    Decoration.mark({ class: "cm-semantic-token" }).range(d.from, d.to)
  );
  return Decoration.set(marks);
}

// ── Request semantic tokens ──

export async function requestAndApplySemanticTokens(
  view: EditorView,
  filePath: string,
  extension: string,
  projectPath: string,
) {
  try {
    // Start LSP
    await bridge.lspStart(extension, projectPath);

    // Open document
    const content = view.state.doc.toString();
    await bridge.lspDidOpen(filePath, content, getLanguageId(extension));

    // Request semantic tokens
    // LSP semantic tokens request: textDocument/semanticTokens/full
    // We need to add this to the Rust LSP commands
    // For now, we'll do a simplified version — just register the listener
    // The actual tokens will come from the Rust side via events
  } catch {
    // LSP not available for this language — fall back to CodeMirror highlighting
  }
}

function getLanguageId(ext: string): string {
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescriptreact", js: "javascript", jsx: "javascriptreact",
    rs: "rust", py: "python", go: "go", c: "c", cpp: "cpp", h: "c", hpp: "cpp",
    html: "html", css: "css", scss: "scss", less: "less", json: "json",
    md: "markdown", yml: "yaml", yaml: "yaml", java: "java",
  };
  return map[ext] || ext;
}

export function clearSemanticHighlights(view: EditorView) {
  view.dispatch({ effects: setSemanticHighlights.of(Decoration.none) });
}
