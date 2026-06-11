import { useState, useCallback, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown, Regex, CaseSensitive, WholeWord, Replace } from "lucide-react";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

interface FindReplaceProps {
  view: EditorView | null;
  onClose: () => void;
  initialShowReplace?: boolean;
}

// ── Highlight effect ──

const setSearchHighlights = StateEffect.define<DecorationSet>();

const searchHighlightField = StateField.define<DecorationSet>({
  create() { return Decoration.none; },
  update(deco, tr) {
    for (const e of tr.effects) {
      if (e.is(setSearchHighlights)) return e.value;
    }
    return deco.map(tr.changes);
  },
  provide: f => EditorView.decorations.from(f),
});

const highlightMark = Decoration.mark({ class: "cm-search-match" });
const currentMark = Decoration.mark({ class: "cm-search-match cm-search-current" });

// ── Component ──

export function FindReplaceBar({ view, onClose, initialShowReplace = false }: FindReplaceProps) {
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [showReplace, setShowReplace] = useState(initialShowReplace);

  // Sync showReplace when prop changes (e.g. Ctrl+H while bar is open)
  useEffect(() => { setShowReplace(initialShowReplace); }, [initialShowReplace]);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const findRef = useRef<HTMLInputElement>(null);
  const decorationsRef = useRef<{ from: number; to: number }[]>([]);
  const currentMatchIdxRef = useRef(-1);

  // Register highlight field (safe to call multiple times in CM6)
  useEffect(() => {
    if (!view) return;
    try { view.dispatch({ effects: StateEffect.appendConfig.of([searchHighlightField]) }); } catch {}
  }, [view]);

  // Clear highlights on close
  const clearHighlights = useCallback(() => {
    if (view) {
      view.dispatch({ effects: setSearchHighlights.of(Decoration.none) });
      decorationsRef.current = [];
      setMatchCount(0); setCurrentMatch(0);
    }
  }, [view]);

  const handleClose = useCallback(() => {
    clearHighlights();
    onClose();
  }, [clearHighlights, onClose]);

  const buildRegex = useCallback(() => {
    if (!findText) return null;
    try {
      let pattern = useRegex ? findText : findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (wholeWord) pattern = `\\b${pattern}\\b`;
      return new RegExp(pattern, caseSensitive ? "g" : "gi");
    } catch { return null; }
  }, [findText, caseSensitive, useRegex, wholeWord]);

  const doSearch = useCallback(() => {
    if (!view) return;
    const re = buildRegex();
    if (!re || !findText) {
      decorationsRef.current = [];
      setMatchCount(0); setCurrentMatch(0);
      view.dispatch({ effects: setSearchHighlights.of(Decoration.none) });
      return;
    }

    const doc = view.state.doc.toString();
    const matches: { from: number; to: number }[] = [];
    let match;
    while ((match = re.exec(doc)) !== null) {
      matches.push({ from: match.index, to: match.index + match[0].length });
      if (!re.global) break;
    }
    decorationsRef.current = matches;
    setMatchCount(matches.length);

    // Build highlight decorations
    if (matches.length > 0) {
      const decos = matches.map((m, i) => {
        const isCurrent = i === currentMatchIdxRef.current;
        return (isCurrent ? currentMark : highlightMark).range(m.from, m.to);
      });
      view.dispatch({ effects: setSearchHighlights.of(Decoration.set(decos)) });

      if (currentMatchIdxRef.current < 0 || currentMatchIdxRef.current >= matches.length) {
        currentMatchIdxRef.current = 0;
      }
      setCurrentMatch(currentMatchIdxRef.current + 1);
      const pos = matches[currentMatchIdxRef.current].from;
      view.dispatch({ selection: { anchor: pos, head: pos } });
      view.dispatch({ effects: EditorView.scrollIntoView(pos) });
    } else {
      setCurrentMatch(0);
      view.dispatch({ effects: setSearchHighlights.of(Decoration.none) });
    }
  }, [view, buildRegex, findText]);

  const updateHighlights = useCallback(() => {
    if (!view || decorationsRef.current.length === 0) return;
    const decos = decorationsRef.current.map((m, i) => {
      const isCurrent = i === currentMatchIdxRef.current;
      return (isCurrent ? currentMark : highlightMark).range(m.from, m.to);
    });
    view.dispatch({ effects: setSearchHighlights.of(Decoration.set(decos)) });
  }, [view]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (!view || decorationsRef.current.length === 0) return;
    currentMatchIdxRef.current += dir;
    if (currentMatchIdxRef.current >= decorationsRef.current.length) currentMatchIdxRef.current = 0;
    if (currentMatchIdxRef.current < 0) currentMatchIdxRef.current = decorationsRef.current.length - 1;
    const m = decorationsRef.current[currentMatchIdxRef.current];
    setCurrentMatch(currentMatchIdxRef.current + 1);
    updateHighlights();
    view.dispatch({ selection: { anchor: m.from, head: m.from } });
    view.dispatch({ effects: EditorView.scrollIntoView(m.from) });
  }, [view, updateHighlights]);

  const replaceOne = useCallback(() => {
    if (!view || decorationsRef.current.length === 0) return;
    const idx = currentMatchIdxRef.current;
    if (idx < 0 || idx >= decorationsRef.current.length) return;
    const m = decorationsRef.current[idx];
    view.dispatch({ changes: { from: m.from, to: m.to, insert: replaceText } });
    doSearch();
  }, [view, replaceText, doSearch]);

  const replaceAll = useCallback(() => {
    if (!view || decorationsRef.current.length === 0) return;
    const changes = [...decorationsRef.current].reverse().map(m => ({ from: m.from, to: m.to, insert: replaceText }));
    view.dispatch({ changes });
    decorationsRef.current = [];
    setMatchCount(0); setCurrentMatch(0);
    view.dispatch({ effects: setSearchHighlights.of(Decoration.none) });
  }, [view, replaceText]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); if (e.shiftKey) navigate(-1); else navigate(1); }
    if (e.key === "Escape") { handleClose(); }
  }, [navigate, handleClose]);

  useEffect(() => { findRef.current?.focus(); }, []);
  useEffect(() => { currentMatchIdxRef.current = -1; doSearch(); }, [findText, caseSensitive, useRegex, wholeWord]);

  return (
    <div className="find-replace-bar" onKeyDown={handleKeyDown}>
      <div className="fr-row">
        <input ref={findRef} className="fr-input" value={findText} onChange={e => setFindText(e.target.value)}
          placeholder={useRegex ? "正则表达式..." : "查找..."} />
        <span className="fr-count">{findText ? `${currentMatch}/${matchCount}` : ""}</span>
        <button className={`fr-toggle ${caseSensitive ? "active" : ""}`} onClick={() => setCaseSensitive(!caseSensitive)} title="大小写敏感">
          <CaseSensitive size={14} /></button>
        <button className={`fr-toggle ${wholeWord ? "active" : ""}`} onClick={() => setWholeWord(!wholeWord)} title="全词匹配">
          <WholeWord size={14} /></button>
        <button className={`fr-toggle ${useRegex ? "active" : ""}`} onClick={() => setUseRegex(!useRegex)} title="正则表达式">
          <Regex size={14} /></button>
        <button className="fr-btn" onClick={() => navigate(-1)} title="上一个"><ChevronUp size={16} /></button>
        <button className="fr-btn" onClick={() => navigate(1)} title="下一个"><ChevronDown size={16} /></button>
        <button className="fr-btn" onClick={() => setShowReplace(!showReplace)} title="替换"><Replace size={14} /></button>
        <button className="fr-btn" onClick={handleClose} title="关闭"><X size={16} /></button>
      </div>
      {showReplace && (
        <div className="fr-row">
          <input className="fr-input" value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="替换为..." />
          <button className="fr-action-btn" onClick={replaceOne}>替换</button>
          <button className="fr-action-btn" onClick={replaceAll}>全部替换</button>
        </div>
      )}
    </div>
  );
}
