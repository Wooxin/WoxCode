import { useEffect, useRef, useState, useCallback } from "react";
import { Compartment } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching, indentOnInput,
} from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { woxDark, woxLight } from "../editorTheme";
import { EditorTabs } from "./EditorTabs";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import { FindReplaceBar } from "./FindReplaceBar";
import { Breadcrumb } from "./Breadcrumb";
import { MarkdownPreview } from "./MarkdownPreview";
import { ContextMenu, MenuItem } from "./ContextMenu";
import * as bridge from "../bridge";
import { requestAndApplySemanticTokens, semanticHighlightExtension } from "../services/semanticHighlight";
import type { Extension } from "@codemirror/state";
import { Copy, Scissors, ClipboardPaste, AlignLeft, X } from "lucide-react";

// ── Language extensions (loaded dynamically) ──

const langCompartment = new Compartment();
const themeCompartment = new Compartment();

function baseExtensions(onChange: () => void): Extension[] {
  return [
    lineNumbers(), highlightActiveLine(), bracketMatching(), closeBrackets(),
    indentOnInput(),
    keymap.of([...defaultKeymap, indentWithTab]),
    EditorView.lineWrapping,
    themeCompartment.of(woxDark),
    langCompartment.of([]),
    semanticHighlightExtension,
    EditorView.updateListener.of((update) => {
      if (update.docChanged) onChange();
    }),
  ];
}

// ── Language detection ──

async function detectLanguage(filename: string): Promise<Extension> {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  try {
    switch (ext) {
      case "ts": case "tsx": return (await import("@codemirror/lang-javascript")).javascript({ jsx: ext === "tsx", typescript: true });
      case "js": case "jsx": return (await import("@codemirror/lang-javascript")).javascript({ jsx: ext === "jsx" });
      case "rs": return (await import("@codemirror/lang-rust")).rust();
      case "py": return (await import("@codemirror/lang-python")).python();
      case "html": return (await import("@codemirror/lang-html")).html();
      case "css": return (await import("@codemirror/lang-css")).css();
      case "json": return (await import("@codemirror/lang-json")).json();
      case "md": return (await import("@codemirror/lang-markdown")).markdown();
      case "xml": case "svg": return (await import("@codemirror/lang-xml")).xml();
      case "cpp": case "c": case "h": case "hpp": return (await import("@codemirror/lang-cpp")).cpp();
      default: return [];
    }
  } catch { return []; }
}

// ── Component ──

export function EditorArea() {
  const app = useAppContext();
  const { t } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findReplace, setFindReplace] = useState(false);
  const currentPathRef = useRef<string | null>(null);
  const lastSavedContentRef = useRef<string>("");
  const lspVersionRef = useRef(1);

  // Markdown preview
  const [showMdPreview, setShowMdPreview] = useState(false);
  const [mdSplitPos, setMdSplitPos] = useState(50); // percentage
  const mdResizing = useRef(false);

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const pendingRevealRef = useRef<{ path: string; line: number; column: number } | null>(null);

  const revealPosition = useCallback((lineNumber: number, column: number) => {
    if (!viewRef.current) return;
    const view = viewRef.current;
    const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
    const pos = Math.min(line.to, line.from + Math.max(0, column - 1));
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
    view.focus();
  }, []);

  // ── Editor creation ──

  useEffect(() => {
    if (!app.activeTabPath || !containerRef.current) return;
    const tp = app.activeTabPath;

    if (currentPathRef.current !== tp) {
      setLoading(true);
      currentPathRef.current = tp;
      const restoredContent = app.getEditorContent(tp);
      const restoredTab = app.openTabs.find(tab => tab.path === tp);
      if (restoredTab?.dirty && restoredContent !== undefined) {
        setContent(restoredContent);
        bridge.readTextFile(tp)
          .then(text => { lastSavedContentRef.current = text; })
          .catch(() => { lastSavedContentRef.current = restoredContent; })
          .finally(() => setLoading(false));
        return;
      }
      bridge.readTextFile(tp).then(text => {
        setContent(text); lastSavedContentRef.current = text; setLoading(false);
      }).catch(err => { setContent(`// ${err}`); setLoading(false); });
    }
  }, [app.activeTabPath]);

  useEffect(() => {
    if (!containerRef.current || !app.activeTabPath || loading) return;
    const activePath = app.activeTabPath;

    if (viewRef.current) viewRef.current.destroy();
    containerRef.current.innerHTML = "";

    const onChange = () => {
      if (viewRef.current) {
        const text = viewRef.current.state.doc.toString();
        setContent(text);
        if (app.activeTabPath) {
          app.setEditorContent(app.activeTabPath, text);
          app.markTabDirty(app.activeTabPath, text !== lastSavedContentRef.current);
        }
      }
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const notifyLspChange = () => {
      if (!viewRef.current || !app.activeTabPath) return;
      lspVersionRef.current += 1;
      bridge.lspDidChange(app.activeTabPath, viewRef.current.state.doc.toString(), lspVersionRef.current).catch(() => {});
    };

    const cursorListener = EditorView.updateListener.of((update) => {
      if (update.selectionSet && app.activeTabPath) {
        requestAnimationFrame(() => {
          if (!viewRef.current) return;
          const pos = viewRef.current.state.selection.main.head;
          const line = viewRef.current.state.doc.lineAt(pos);
          app.setCursorPosition(line.number, pos - line.from + 1);
        });
      }
    });

    const view = new EditorView({
      doc: content,
      extensions: [
        baseExtensions(() => { onChange(); if (debounceTimer) clearTimeout(debounceTimer); debounceTimer = setTimeout(notifyLspChange, 600); }),
        cursorListener,
      ],
      parent: containerRef.current,
    });
    viewRef.current = view;

    const filename = activePath.split(/[/\\]/).pop() || "";
    detectLanguage(filename).then(langExt => {
      if (viewRef.current) viewRef.current.dispatch({ effects: langCompartment.reconfigure(langExt) });
    });

    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (app.config?.semantic_highlighting && app.projectPath) {
      lspVersionRef.current = 1;
      requestAndApplySemanticTokens(view, activePath, ext, app.projectPath).catch(() => {});
    }

    const pendingReveal = pendingRevealRef.current;
    if (pendingReveal?.path === activePath) {
      requestAnimationFrame(() => {
        revealPosition(pendingReveal.line, pendingReveal.column);
        pendingRevealRef.current = null;
      });
    }

    return () => { view.destroy(); viewRef.current = null; };
  }, [app.activeTabPath, loading, revealPosition]);

  // ── Theme ──

  useEffect(() => {
    if (!viewRef.current) return;
    const isDark = app.theme === "dark";
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure(isDark ? woxDark : woxLight),
    });
  }, [app.theme]);

  // ── Font ──

  useEffect(() => {
    if (!viewRef.current) return;
    const ef = app.config?.editor_font ?? "Consolas, 'Cascadia Code', monospace";
    const efs = `${app.config?.editor_font_size ?? 14}px`;
    // Force font update via re-theming
    const isDark = app.theme === "dark";
    const base = isDark ? woxDark : woxLight;
    const fontExt = EditorView.theme({
      "&": { fontFamily: ef, fontSize: efs },
      ".cm-content": { fontFamily: ef, fontSize: efs },
    });
    viewRef.current.dispatch({
      effects: themeCompartment.reconfigure([...base, fontExt]),
    });
  }, [app.config?.editor_font, app.config?.editor_font_size]);

  // ── Save ──

  const handleSave = useCallback(async () => {
    if (!app.activeTabPath || !viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    try {
      await bridge.writeTextFile(app.activeTabPath, text);
      lastSavedContentRef.current = text;
      app.markTabDirty(app.activeTabPath, false);
      window.dispatchEvent(new CustomEvent("woxcode-file-saved", { detail: { path: app.activeTabPath } }));
    } catch (e) { console.error("Save failed:", e); }
  }, [app]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "s") { e.preventDefault(); handleSave(); }
      if (mod && e.key === "f") { e.preventDefault(); setFindOpen(true); }
      if (mod && e.key === "h") { e.preventDefault(); setFindOpen(true); setFindReplace(true); }
      if (mod && e.key === "g") { e.preventDefault(); const line = prompt("跳转到行:"); if (line && viewRef.current) { const doc = viewRef.current.state.doc; const ln = Math.max(0, Math.min(+line - 1, doc.lines - 1)); viewRef.current.dispatch({ selection: { anchor: doc.line(ln + 1).from, head: doc.line(ln + 1).from } }); } }
      // Format: Shift+Alt+F
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); formatDocument(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  useEffect(() => {
    window.addEventListener("woxcode-save-current-file", handleSave);
    return () => window.removeEventListener("woxcode-save-current-file", handleSave);
  }, [handleSave]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ path: string; line: number; column: number }>).detail;
      if (!detail) return;
      pendingRevealRef.current = detail;
      if (detail.path === app.activeTabPath && viewRef.current) {
        revealPosition(detail.line, detail.column);
        pendingRevealRef.current = null;
      }
    };
    window.addEventListener("woxcode-reveal-position", handler);
    return () => window.removeEventListener("woxcode-reveal-position", handler);
  }, [app.activeTabPath, revealPosition]);

  // ── Format document ──

  const formatDocument = useCallback(() => {
    if (!viewRef.current) return;
    const text = viewRef.current.state.doc.toString();
    try {
      // Basic formatting: trim trailing whitespace, ensure final newline
      const lines = text.split("\n");
      const formatted = lines.map(l => l.trimEnd()).join("\n").trimEnd() + "\n";
      viewRef.current.dispatch({
        changes: { from: 0, to: text.length, insert: formatted },
      });
    } catch {}
  }, []);

  // ── Context menu ──

  const handleEditorContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const ctxMenuItems: MenuItem[] = [
    { label: "剪切", icon: <Scissors size={14} />, action: () => { if (viewRef.current) document.execCommand("cut"); } },
    { label: "复制", icon: <Copy size={14} />, action: () => { if (viewRef.current) document.execCommand("copy"); } },
    { label: "粘贴", icon: <ClipboardPaste size={14} />, action: () => { if (viewRef.current) document.execCommand("paste"); } },
    { separator: true, label: "", action: () => {} },
    { label: "格式化文档", icon: <AlignLeft size={14} />, action: formatDocument },
  ];

  // ── MD split drag ──

  const handleMdSplitMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    mdResizing.current = true;
    const startX = e.clientX;
    const container = (e.target as HTMLElement).parentElement;
    const startWidth = container?.offsetWidth ?? window.innerWidth;

    const onMove = (ev: MouseEvent) => {
      if (!mdResizing.current) return;
      const dx = ev.clientX - startX;
      const pct = Math.max(20, Math.min(80, ((startX + dx) / startWidth) * 100));
      setMdSplitPos(pct);
    };
    const onUp = () => { mdResizing.current = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  // ── Render ──

  if (!app.activeTabPath) {
    return (
      <div className="editor-area">
        <div className="welcome-logo" style={{ fontSize: 24, padding: 40 }}>{t.appName}</div>
        <div className="welcome-hint" style={{ padding: "0 40px" }}>{t.openFileToEdit}</div>
      </div>
    );
  }

  const isMd = app.activeTabPath.endsWith(".md");

  return (
    <div className="editor-area" onContextMenu={handleEditorContextMenu}>
      <EditorTabs />
      <Breadcrumb />
      {isMd && !showMdPreview && (
        <div className="breadcrumb-bar" style={{ justifyContent: "flex-end" }}>
          <button className="fr-toggle" onClick={() => setShowMdPreview(true)} title="预览 Markdown">
            <AlignLeft size={13} /> 预览
          </button>
        </div>
      )}
      {findOpen && <FindReplaceBar view={viewRef.current} onClose={() => { setFindOpen(false); setFindReplace(false); }} initialShowReplace={findReplace} />}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div className="editor-surface" ref={containerRef} style={isMd && showMdPreview ? { width: `${mdSplitPos}%`, flexShrink: 0 } : { flex: 1 }}>
          {loading && <div className="editor-loading">{t.loadingEditor}</div>}
        </div>
        {isMd && showMdPreview && (
          <>
            <div className="md-split-handle" onMouseDown={handleMdSplitMouseDown} />
            <div className="md-preview-container" style={{ width: `${100 - mdSplitPos}%`, flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>预览</span>
                <button className="icon-btn" onClick={() => setShowMdPreview(false)} title="关闭预览"><X size={14} /></button>
              </div>
              <MarkdownPreview content={content} />
            </div>
          </>
        )}
      </div>
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} items={ctxMenuItems} />
      )}
    </div>
  );
}
