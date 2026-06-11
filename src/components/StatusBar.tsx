import { Braces } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import * as bridge from "../bridge";

export function StatusBar() {
  const app = useAppContext();
  const { t } = useI18n();
  const [gitStatus, setGitStatus] = useState<bridge.GitStatus | null>(null);

  const activeTab = app.openTabs.find(t => t.path === app.activeTabPath);
  const filename = activeTab?.name ?? "";
  const ext = filename.split(".").pop()?.toUpperCase() ?? "";
  const langLabel = ({TS:"TypeScript",TSX:"TSX",JS:"JavaScript",RS:"Rust",PY:"Python",HTML:"HTML",CSS:"CSS",JSON:"JSON",MD:"Markdown"} as Record<string,string>)[ext] ?? ext;

  useEffect(() => {
    if (!app.projectPath) {
      setGitStatus(null);
      return;
    }
    bridge.gitStatus(app.projectPath).then(setGitStatus).catch(() => setGitStatus(null));
  }, [app.projectPath]);

  return (
    <div className="status-bar">
      <div className="status-left">
        {app.projectName && <><Braces size={14} /><span>{app.projectName}</span></>}
        {gitStatus?.branch && (
          <span className="status-item">
            Git: {gitStatus.branch}{gitStatus.changed > 0 ? ` (${gitStatus.changed})` : ""}
          </span>
        )}
      </div>
      <div className="status-right">
        {app.activeTabPath && (
          <span className="status-item">行 {app.cursorLine}, 列 {app.cursorCol}</span>
        )}
        {langLabel && <span className="status-item">{langLabel}</span>}
        {app.config && <><span className="status-item">UTF-8</span><span className="status-item">{t.spaces}: {app.config.tab_size}</span></>}
      </div>
    </div>
  );
}
