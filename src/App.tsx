import React, { useEffect, Suspense, lazy, useState } from "react";
import { FolderOpen, FileText, Trash2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LangContext, translations, useI18n, zh } from "./i18n";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { ActivityBar } from "./components/ActivityBar";
import { FileExplorer } from "./components/FileExplorer";
import { SearchSidebar } from "./components/SearchSidebar";
import { ProblemsSidebar } from "./components/ProblemsSidebar";
import { EditorArea } from "./components/EditorArea";
import { StatusBar } from "./components/StatusBar";
import * as bridge from "./bridge";
import "./App.css";

const CommandPalette = lazy(() => import("./components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const TerminalPanel = lazy(() => import("./components/TerminalPanel").then(m => ({ default: m.TerminalPanel })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

function AppInner() {
  const app = useAppContext();
  const { t } = useI18n();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && e.key === "p") { e.preventDefault(); app.setPaletteOpen(true); return; }
      if (mod && !e.shiftKey && e.key === "p") { e.preventDefault(); app.setPaletteOpen(true); return; }
      if (mod && e.key === "o") { e.preventDefault(); app.openProject(); return; }
      if (mod && e.key === "n") { e.preventDefault(); if (app.projectPath) { const name = prompt(t.newFileName); if (name) bridge.createFile(`${app.projectPath.replace(/\\/g, "/")}/${name}`).then(() => app.refreshEntries()).catch(alert); } return; }
      if (mod && e.key === "w" && app.activeTabPath) { e.preventDefault(); app.closeTab(app.activeTabPath); return; }
      if (mod && e.key === "b") { e.preventDefault(); app.setActiveSidebar(app.activeSidebar ? null : "explorer"); return; }
      if (mod && e.key === "Tab") { e.preventDefault(); const idx = app.openTabs.findIndex(t => t.path === app.activeTabPath); if (idx >= 0 && app.openTabs.length > 1) app.setActiveTab(app.openTabs[(idx + 1) % app.openTabs.length].path); return; }
      if (mod && e.shiftKey && e.key === "Tab") { e.preventDefault(); const idx = app.openTabs.findIndex(t => t.path === app.activeTabPath); if (idx >= 0 && app.openTabs.length > 1) app.setActiveTab(app.openTabs[(idx - 1 + app.openTabs.length) % app.openTabs.length].path); return; }
      if (mod && e.key === "`") { e.preventDefault(); app.toggleTerminal(); return; }
      if (mod && e.key === "j") { e.preventDefault(); app.toggleTerminal(); return; }
      if (mod && e.key === ",") { e.preventDefault(); app.setSettingsOpen(!app.isSettingsOpen); return; }
      // F11 → Fullscreen
      if (e.key === "F11") {
        e.preventDefault();
        const win = getCurrentWindow();
        win.isFullscreen().then(fs => win.setFullscreen(!fs));
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [app, t]);

  useEffect(() => {
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        for (const path of event.payload.paths) {
          void (async () => {
            try {
              const isDir = await bridge.appInvoke<boolean>("check_is_dir", { path });
              if (isDir) { app.openProjectPath(path); }
              else { const name = path.split(/[/\\]/).pop() || path; const content = await bridge.readTextFile(path); app.openSingleFile(path, name, content); }
            } catch { }
          })();
          break;
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [app]);

  if (!app.configLoaded) {
    return <main className="woxcode-shell theme-noir"><div className="loading-screen">{t.loading}</div></main>;
  }

  if (!app.projectPath) {
    return (
      <main className={`woxcode-shell theme-${app.theme === "light" ? "dawn" : "noir"}`}>
        <div className="welcome-screen">
          <div className="welcome-logo">{t.appName}</div>
          <div className="welcome-subtitle">{t.appSubtitle}</div>
          <div className="welcome-actions">
            <button className="open-folder-btn" onClick={app.openProject}><FolderOpen size={20} />{t.openFolder}</button>
            <button className="open-folder-btn secondary" onClick={app.openSingleFileDialog}><FileText size={20} />{t.openFile}</button>
          </div>
          <div className="welcome-shortcuts">
            <span>{t.shortcutOpenFolder}</span>
            <span>{t.dragHint}</span>
          </div>
          {app.config && app.config.workspaces.length > 0 && (
            <div className="recent-projects">
              <div className="recent-title">工作区</div>
              {app.config.workspaces.map(p => (
                <div key={p} className="recent-item" style={{ display: "flex", alignItems: "center" }}>
                  <button style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: 13, fontFamily: "inherit", textAlign: "left" }}
                    onClick={() => app.openProjectPath(p)}>
                    <FolderOpen size={14} /><span>{p.split(/[/\\]/).pop()}</span><span className="recent-path">{p}</span>
                  </button>
                  <button className="icon-btn" title="删除工作区" onClick={e => { e.stopPropagation(); app.removeWorkspace(p); }}
                    style={{ color: "var(--danger)", flexShrink: 0 }}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
          {app.config && app.config.recent_projects.length > 1 && (
            <div className="recent-projects">
              <div className="recent-title">最近项目</div>
              {app.config.recent_projects.slice(1, 6).map(p => (
                <button key={p} className="recent-item" onClick={() => app.openProjectPath(p)}>
                  <FolderOpen size={14} />
                  <span>{p.split(/[/\\]/).pop()}</span>
                  <span className="recent-path">{p}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className={`woxcode-shell theme-${app.theme === "light" ? "dawn" : "noir"}`}
      style={{ "--sidebar-width": `${app.sidebarWidth}px`,
        "--ui-font": app.config?.ui_font || "HarmonyOS Sans, 'Microsoft YaHei', sans-serif",
        "--editor-font": app.config?.editor_font || "Consolas, 'Cascadia Code', monospace",
        "--ui-font-size": `${app.config?.ui_font_size ?? 13}px`,
        "--editor-font-size": `${app.config?.editor_font_size ?? 14}px`,
      } as React.CSSProperties}>
      <ActivityBar />
      {app.activeSidebar && (
        <div className="sidebar">
          {app.activeSidebar === "explorer" && <FileExplorer />}
          {app.activeSidebar === "search" && <SearchSidebar />}
          {app.activeSidebar === "problems" && <ProblemsSidebar />}
        </div>
      )}
      <EditorArea />
      <StatusBar />
      {app.isTerminalOpen && <Suspense fallback={null}><TerminalPanel onClose={() => app.setTerminalOpen(false)} /></Suspense>}
      {app.isPaletteOpen && <Suspense fallback={null}><CommandPalette /></Suspense>}
      {app.isSettingsOpen && <Suspense fallback={null}><SettingsPanel onClose={() => app.setSettingsOpen(false)} /></Suspense>}
    </main>
  );
}

function App() {
  const [lang, setLang] = useState("zh");
  const t = translations[lang] ?? zh;

  // Initialize language from saved config
  useEffect(() => {
    bridge.getUserConfig().then(cfg => {
      if (cfg.language) setLang(cfg.language);
    }).catch(() => {});
  }, []);

  return (
    <AppProvider>
      <LangContext.Provider value={{ lang, setLang, t }}>
        <AppInner />
      </LangContext.Provider>
    </AppProvider>
  );
}

export default App;
