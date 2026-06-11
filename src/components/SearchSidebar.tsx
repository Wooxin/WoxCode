import { useState, useEffect, useCallback } from "react";
import { Search, X, Regex, CaseSensitive } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { FileIcon } from "../utils/icons";
import * as bridge from "../bridge";
import type { SearchMatch } from "../bridge";

export function SearchSidebar() {
  const app = useAppContext();
  const [query, setQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [grouped, setGrouped] = useState<Map<string, SearchMatch[]>>(new Map());
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!query.trim() || !app.projectPath) { setResults([]); setGrouped(new Map()); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      bridge.searchContent(app.projectPath!, query, caseSensitive, useRegex)
        .then(matches => {
          setResults(matches);
          const g = new Map<string, SearchMatch[]>();
          for (const m of matches) {
            const list = g.get(m.file_path) || [];
            list.push(m);
            g.set(m.file_path, list);
          }
          setGrouped(g);
          setExpandedFiles(new Set());
        })
        .catch(() => { setResults([]); setGrouped(new Map()); setExpandedFiles(new Set()); })
        .finally(() => setSearching(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, caseSensitive, useRegex, app.projectPath]);

  const handleSelect = useCallback((match: SearchMatch) => {
    if (!app.projectPath) return;
    const fullPath = `${app.projectPath.replace(/\\/g, "/")}/${match.file_path}`;
    app.openSingleFile(fullPath, match.file_name);
    window.dispatchEvent(new CustomEvent("woxcode-reveal-position", {
      detail: { path: fullPath, line: match.line_number, column: match.match_start + 1 },
    }));
  }, [app]);

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header"><span>搜索</span></div>
      <div className="search-input-wrap">
        <Search size={14} />
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
          placeholder={useRegex ? "正则表达式..." : "搜索文件内容..."} className="search-input" />
        {query && <button className="palette-clear" onClick={() => setQuery("")}><X size={14} /></button>}
      </div>
      <div className="search-options">
        <button className={`fr-toggle ${caseSensitive ? "active" : ""}`} onClick={() => setCaseSensitive(!caseSensitive)} title="大小写敏感">
          <CaseSensitive size={13} /></button>
        <button className={`fr-toggle ${useRegex ? "active" : ""}`} onClick={() => setUseRegex(!useRegex)} title="正则表达式">
          <Regex size={13} /></button>
      </div>
      <div className="file-tree">
        {searching && <div className="empty-hint">搜索中...</div>}
        {!searching && query && results.length === 0 && <div className="empty-hint">无匹配结果</div>}
        {!searching && results.length > 0 && (
          <div className="empty-hint" style={{ textAlign: "left", padding: "4px 12px" }}>
            {results.length} 个匹配，{grouped.size} 个文件
          </div>
        )}
        {[...grouped.entries()].map(([filePath, matches]) => (
          <div key={filePath}>
            <div className="tree-node" style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)", padding: "4px 12px" }}>
              <FileIcon ext={filePath.split(".").pop() ?? ""} size={12} />
              <span style={{ marginLeft: 6 }}>{filePath}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>{matches.length}</span>
            </div>
            {(expandedFiles.has(filePath) ? matches : matches.slice(0, 5)).map((m, i) => (
              <div key={i} className="tree-node" style={{ paddingLeft: 32, cursor: "pointer" }}
                onClick={() => handleSelect(m)}>
                <span style={{ color: "var(--text-muted)", fontSize: 11, minWidth: 28 }}>{m.line_number}</span>
                <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.line_content.slice(0, Math.max(0, m.match_start)).trimStart()}
                  <mark style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: 2 }}>
                    {m.line_content.slice(m.match_start, m.match_end)}
                  </mark>
                  {m.line_content.slice(m.match_end).slice(0, 60)}
                </span>
              </div>
            ))}
            {matches.length > 5 && (
              <button
                className="tree-node search-more-btn"
                style={{ paddingLeft: 32, color: "var(--text-muted)", fontSize: 11, width: "100%", border: "none" }}
                onClick={() => setExpandedFiles(prev => {
                  const next = new Set(prev);
                  next.has(filePath) ? next.delete(filePath) : next.add(filePath);
                  return next;
                })}
              >
                {expandedFiles.has(filePath) ? "收起" : `... 还有 ${matches.length - 5} 个匹配`}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
