import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { oneDarkHighlightStyle } from "@codemirror/theme-one-dark";

// ── Unified Dark Theme ──

export const woxDark = [
  EditorView.theme({
    "&": { backgroundColor: "#282c34", color: "#abb2bf" },
    ".cm-content": { caretColor: "#528bff" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#528bff" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#3e4451",
    },
    ".cm-activeLine": { backgroundColor: "#2c313c" },
    ".cm-activeLineGutter": { backgroundColor: "#282c34" },
    ".cm-gutters": { backgroundColor: "#282c34", color: "#636d83", borderRight: "1px solid #3e4451" },
    ".cm-foldPlaceholder": { backgroundColor: "#3e4451", color: "#5c6370", border: "none" },
    ".cm-matchingBracket": { backgroundColor: "#3e4451", outline: "1px solid #636d83" },
    ".cm-nonmatchingBracket": { color: "#e06c75" },
    ".cm-tooltip": { backgroundColor: "#21252b", color: "#abb2bf", border: "1px solid #3e4451" },
    ".cm-tooltip-autocomplete": {
      "& > ul > li[aria-selected]": { backgroundColor: "#3e4451", color: "#abb2bf" },
    },
  }, { dark: true }),
  syntaxHighlighting(oneDarkHighlightStyle),
];

// ── Unified Light Theme ──

export const woxLight = [
  EditorView.theme({
    "&": { backgroundColor: "#fafbfc", color: "#1a1f2e" },
    ".cm-content": { caretColor: "#5b7ea8" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#5b7ea8" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "#b4c6dd60",
    },
    ".cm-activeLine": { backgroundColor: "#e4e8ec40" },
    ".cm-activeLineGutter": { backgroundColor: "#f0f2f5" },
    ".cm-gutters": { backgroundColor: "#fafbfc", color: "#8c959f", borderRight: "1px solid #d0d7de" },
    ".cm-foldPlaceholder": { backgroundColor: "#e4e8ec", color: "#8c959f", border: "none" },
    ".cm-matchingBracket": { backgroundColor: "#d0d7de40", outline: "1px solid #c0c8d0" },
    ".cm-selectionBackground": { backgroundColor: "#b4c6dd40" },
  }, { dark: false }),
  syntaxHighlighting(HighlightStyle.define([
    { tag: tags.keyword, color: "#d73a49" },
    { tag: tags.comment, color: "#6a737d" },
    { tag: tags.string, color: "#032f62" },
    { tag: tags.number, color: "#005cc5" },
    { tag: tags.typeName, color: "#6f42c1" },
    { tag: tags.function(tags.variableName), color: "#6f42c1" },
    { tag: tags.labelName, color: "#e36209" },
    { tag: tags.operator, color: "#d73a49" },
    { tag: tags.regexp, color: "#032f62" },
    { tag: tags.escape, color: "#005cc5" },
    { tag: tags.url, color: "#032f62" },
    { tag: tags.meta, color: "#6a737d" },
    { tag: tags.strong, fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
  ])),
];
