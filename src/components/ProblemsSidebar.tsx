import { useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { CircleAlert, CircleX } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

interface LspPosition { line: number; character: number; }
interface LspDiagnostic {
  range: { start: LspPosition; end: LspPosition };
  severity?: number;
  message: string;
  source?: string;
}
interface LspDiagnosticEvent {
  uri: string;
  diagnostics: LspDiagnostic[];
}

function uriToPath(uri: string): string {
  if (!uri.startsWith("file://")) return uri;
  const decoded = decodeURIComponent(uri.slice("file://".length));
  return decoded.replace(/^\/([A-Za-z]:\/)/, "$1").replace(/\//g, "\\");
}

function fileName(path: string): string {
  return path.split(/[/\\]/).pop() || path;
}

export function ProblemsSidebar() {
  const app = useAppContext();
  const [diagnosticsByPath, setDiagnosticsByPath] = useState<Map<string, LspDiagnostic[]>>(new Map());

  useEffect(() => {
    let disposed = false;
    const unlisten = listen<LspDiagnosticEvent>("lsp-diagnostics", event => {
      if (disposed) return;
      const path = uriToPath(event.payload.uri);
      setDiagnosticsByPath(prev => {
        const next = new Map(prev);
        if (event.payload.diagnostics.length === 0) next.delete(path);
        else next.set(path, event.payload.diagnostics);
        return next;
      });
    });
    return () => {
      disposed = true;
      unlisten.then(fn => fn()).catch(() => {});
    };
  }, []);

  const groups = useMemo(() => [...diagnosticsByPath.entries()], [diagnosticsByPath]);
  const total = groups.reduce((sum, [, items]) => sum + items.length, 0);

  const openDiagnostic = (path: string, diagnostic: LspDiagnostic) => {
    app.openSingleFile(path, fileName(path));
    window.dispatchEvent(new CustomEvent("woxcode-reveal-position", {
      detail: {
        path,
        line: diagnostic.range.start.line + 1,
        column: diagnostic.range.start.character + 1,
      },
    }));
  };

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header"><span>问题</span></div>
      {total === 0 && <div className="empty-hint">暂无诊断</div>}
      {total > 0 && (
        <div className="empty-hint" style={{ textAlign: "left", padding: "4px 12px" }}>
          {total} 个问题，{groups.length} 个文件
        </div>
      )}
      <div className="file-tree">
        {groups.map(([path, items]) => (
          <div key={path}>
            <div className="tree-node" style={{ fontWeight: 600, fontSize: 12, color: "var(--text-secondary)", padding: "4px 12px" }}>
              <CircleAlert size={12} />
              <span style={{ marginLeft: 6 }}>{fileName(path)}</span>
              <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>{items.length}</span>
            </div>
            {items.map((diagnostic, index) => (
              <button
                key={`${path}:${index}`}
                className="tree-node problem-item"
                onClick={() => openDiagnostic(path, diagnostic)}
                style={{ paddingLeft: 28, width: "100%", border: "none" }}
              >
                <CircleX size={12} style={{ color: "var(--danger)", flexShrink: 0 }} />
                <span className="problem-message">{diagnostic.message}</span>
                <span className="problem-location">{diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
