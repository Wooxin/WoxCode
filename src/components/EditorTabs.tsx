import { X } from "lucide-react";
import { useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import { FileIcon } from "../utils/icons";
import { ContextMenu, tabMenuItems } from "./ContextMenu";

export function EditorTabs() {
  const app = useAppContext();
  const { t } = useI18n();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  const closeTabsInOrder = (paths: string[]) => {
    for (const path of paths) {
      app.closeTab(path);
      if (app.openTabs.find(tab => tab.path === path)?.dirty) return;
    }
  };

  if (app.openTabs.length === 0) {
    return <div className="editor-tabs empty"><span className="empty-hint">{t.openFileToEdit}</span></div>;
  }

  return (
    <div className="editor-tabs">
      {app.openTabs.map(tab => (
        <div
          key={tab.path}
          className={`editor-tab ${app.activeTabPath===tab.path?"active":""}`}
          onClick={()=>app.setActiveTab(tab.path)}
          onContextMenu={e => {
            e.preventDefault();
            app.setActiveTab(tab.path);
            setCtxMenu({ x: e.clientX, y: e.clientY, path: tab.path });
          }}
        >
          <FileIcon ext={tab.name.split(".").pop() ?? ""} size={14} />
          <span className="tab-name">{tab.dirty && <span className="tab-dirty">●</span>}{tab.name}</span>
          <button className="tab-close" onClick={e=>{e.stopPropagation();app.closeTab(tab.path);}} title={t.closeTab}><X size={14}/></button>
        </div>
      ))}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={tabMenuItems(
            () => app.closeTab(ctxMenu.path),
            () => closeTabsInOrder(app.openTabs.filter(tab => tab.path !== ctxMenu.path).map(tab => tab.path)),
            () => closeTabsInOrder(app.openTabs.map(tab => tab.path)),
            () => navigator.clipboard.writeText(ctxMenu.path).catch(() => {}),
          )}
        />
      )}
    </div>
  );
}
