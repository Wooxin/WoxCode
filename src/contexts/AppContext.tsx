import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FileEntry, OpenTab, UserConfig } from "../types";
import * as bridge from "../bridge";

interface AppState {
  projectPath: string | null; projectName: string | null; entries: FileEntry[];
  openTabs: OpenTab[]; activeTabPath: string | null;
  activeSidebar: "explorer" | "search" | "problems" | null; sidebarWidth: number;
  theme: "dark" | "light"; config: UserConfig | null; configLoaded: boolean;
  isPaletteOpen: boolean; isTerminalOpen: boolean; isSettingsOpen: boolean;
  openProject: () => Promise<void>; openProjectPath: (path: string) => Promise<void>;
  openSingleFile: (path: string, name: string, content?: string) => void;
  openSingleFileDialog: () => Promise<void>;
  setActiveSidebar: (id: "explorer" | "search" | "problems" | null) => void;
  openFile: (entry: FileEntry) => Promise<void>;
  closeTab: (path: string) => void; setActiveTab: (path: string) => void;
  refreshEntries: () => Promise<void>; saveCurrentFile: () => Promise<void>;
  setPaletteOpen: (open: boolean) => void; toggleTerminal: () => void;
  setTerminalOpen: (open: boolean) => void; setSettingsOpen: (open: boolean) => void;
  reloadConfig: () => Promise<void>; updateConfig: (partial: Partial<UserConfig>) => void;
  addWorkspace: (path: string) => void; removeWorkspace: (path: string) => void;
  setSidebarWidth: (w: number) => void;
  setEditorContent: (path: string, content: string) => void;
  getEditorContent: (path: string) => string | undefined;
  markTabDirty: (path: string, dirty: boolean) => void;
  cursorLine: number; cursorCol: number;
  setCursorPosition: (line: number, col: number) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [activeSidebar, setActiveSidebarState] = useState<"explorer"|"search"|"problems"|null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isPaletteOpen, setPaletteOpen] = useState(false);
  const [isTerminalOpen, setTerminalOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [pendingCloseTab, setPendingCloseTab] = useState<OpenTab | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const theme = (config?.theme ?? "dark") as "dark" | "light";

  useEffect(() => {
    bridge.getUserConfig().then(cfg => {
      setConfig(cfg);
      if (!cfg.sidebar_visible) setActiveSidebarState(null);
      setConfigLoaded(true);
    }).catch(() => setConfigLoaded(true));
  }, []);

  useEffect(() => {
    if (!configLoaded || !config) return;
    const recent = config.recent_projects;
    if (recent.length > 0) {
      setProjectPath(recent[0]); setProjectName(recent[0].split(/[/\\]/).pop()||recent[0]);
      bridge.listDirectory(recent[0]).then(setEntries).catch(()=>{});
      restoreSession(recent[0]);
    }
  }, [configLoaded]);

  const editorContentsRef = useRef<Map<string, string>>(new Map());
  const setEditorContent = useCallback((path: string, content: string) => { editorContentsRef.current.set(path, content); }, []);
  const getEditorContent = useCallback((path: string) => editorContentsRef.current.get(path), []);
  const markTabDirty = useCallback((path: string, dirty: boolean) => { setOpenTabs(prev => prev.map(t => t.path === path ? { ...t, dirty } : t)); }, []);

  useEffect(() => {
    if (!projectPath || openTabs.length === 0) return;
    const timer = setTimeout(() => {
      const tabs: bridge.SessionTab[] = openTabs.map(t => ({ file_path: t.path, dirty_content: t.dirty ? (editorContentsRef.current.get(t.path) ?? null) : null, is_active: t.path === activeTabPath }));
      bridge.saveSession(projectPath, tabs).catch(() => {});
    }, 2000);
    return () => clearTimeout(timer);
  }, [openTabs, activeTabPath, projectPath]);

  useEffect(() => {
    const handler = () => {
      if (projectPath && openTabs.length > 0) {
        const tabs: bridge.SessionTab[] = openTabs.map(t => ({ file_path: t.path, dirty_content: t.dirty ? (editorContentsRef.current.get(t.path) ?? null) : null, is_active: t.path === activeTabPath }));
        bridge.saveSession(projectPath, tabs).catch(() => {});
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [openTabs, activeTabPath, projectPath]);

  const restoreSession = useCallback(async (path: string) => {
    try {
      const session = await bridge.loadSession(path);
      if (session.tabs.length > 0) {
        const restored: OpenTab[] = [];
        let active: string | null = null;
        for (const st of session.tabs) {
          if (st.dirty_content) editorContentsRef.current.set(st.file_path, st.dirty_content);
          const name = st.file_path.split(/[/\\]/).pop() || st.file_path;
          restored.push({ path: st.file_path, name, dirty: !!st.dirty_content });
          if (st.is_active) active = st.file_path;
        }
        setOpenTabs(restored); setActiveTabPath(active || restored[0]?.path || null);
      }
    } catch {}
  }, []);

  const updateConfig = useCallback((partial: Partial<UserConfig>) => { setConfig(prev => { if (!prev) return prev; const next = { ...prev, ...partial }; bridge.saveUserConfig(next).catch(()=>{}); return next; }); }, []);
  const reloadConfig = useCallback(async () => { try { const cfg = await bridge.getUserConfig(); setConfig(cfg); setActiveSidebarState(cfg.sidebar_visible ? "explorer" : null); } catch {} }, []);

  const openProjectPath = useCallback(async (path: string) => {
    setProjectPath(path); setProjectName(path.split(/[/\\]/).pop()||path); setOpenTabs([]); setActiveTabPath(null);
    updateConfig({ recent_projects: [path, ...(config?.recent_projects||[]).filter(p=>p!==path)].slice(0,10),
      workspaces: [...(config?.workspaces||[]).filter(p=>p!==path), path] });
    try { setEntries(await bridge.listDirectory(path)); } catch {}
    restoreSession(path);
  }, [config, updateConfig, restoreSession]);

  const openSingleFile = useCallback((path: string, name: string, content?: string) => {
    if (!projectPath) openProjectPath(path.replace(/[/\\][^/\\]*$/, ""));
    if (openTabs.find(t=>t.path===path)) { setActiveTabPath(path); return; }
    if (content !== undefined) editorContentsRef.current.set(path, content);
    setOpenTabs(p=>[...p,{path,name,dirty:false}]); setActiveTabPath(path);
  }, [projectPath, openTabs, openProjectPath]);

  const openSingleFileDialog = useCallback(async () => {
    try {
      const r = await bridge.openFile();
      if (r) openSingleFile(r.path, r.name, r.content);
    } catch (e) {
      alert(String(e));
    }
  }, [openSingleFile]);
  const openProject = useCallback(async () => { const p = await bridge.openFolder(); if (p) await openProjectPath(p); }, [openProjectPath]);

  const openFile = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) return;
    const fp = projectPath?`${projectPath.replace(/\\/g,"/")}/${entry.path}`:entry.path;
    if (openTabs.find(t=>t.path===fp)) { setActiveTabPath(fp); return; }
    setOpenTabs(p=>[...p,{path:fp,name:entry.name,dirty:false}]); setActiveTabPath(fp);
  }, [openTabs, projectPath]);

  const closeTabByPath = useCallback((path: string) => {
    setOpenTabs(prev=>{const idx=prev.findIndex(t=>t.path===path);const next=prev.filter(t=>t.path!==path); if(activeTabPath===path) setActiveTabPath(next[Math.min(idx,next.length-1)]?.path??null); return next;});
    editorContentsRef.current.delete(path);
  }, [activeTabPath]);

  const closeTab = useCallback((path: string) => {
    const tab = openTabs.find(t => t.path === path);
    if (tab?.dirty) {
      setPendingCloseTab(tab);
      return;
    }
    if (tab?.dirty && !window.confirm(`"${tab.name}" 有未保存的更改。确定要关闭吗？`)) return;
    closeTabByPath(path);
  }, [closeTabByPath, openTabs]);

  const saveAndClosePendingTab = useCallback(async () => {
    if (!pendingCloseTab) return;
    const text = editorContentsRef.current.get(pendingCloseTab.path) ?? "";
    try {
      await bridge.writeTextFile(pendingCloseTab.path, text);
      setPendingCloseTab(null);
      closeTabByPath(pendingCloseTab.path);
    } catch (e) {
      alert(String(e));
    }
  }, [closeTabByPath, pendingCloseTab]);

  const discardAndClosePendingTab = useCallback(() => {
    if (!pendingCloseTab) return;
    const path = pendingCloseTab.path;
    setPendingCloseTab(null);
    closeTabByPath(path);
  }, [closeTabByPath, pendingCloseTab]);

  const setActiveTab = useCallback((p: string) => setActiveTabPath(p), []);
  const refreshEntries = useCallback(async () => { if(projectPath) try{setEntries(await bridge.listDirectory(projectPath));}catch{} }, [projectPath]);
  const saveCurrentFile = useCallback(async () => {
    window.dispatchEvent(new CustomEvent("woxcode-save-current-file"));
  }, []);

  const setSidebar = useCallback((id: "explorer"|"search"|"problems"|null) => { setActiveSidebarState(prev=>{const next=prev===id?null:id; updateConfig({sidebar_visible:next!==null}); return next;}); }, [updateConfig]);

  const addWorkspace = useCallback((path: string) => {
    updateConfig({ workspaces: [...(config?.workspaces || []).filter(p => p !== path), path] });
    openProjectPath(path);
  }, [config, updateConfig, openProjectPath]);

  const removeWorkspace = useCallback((path: string) => {
    updateConfig({ workspaces: (config?.workspaces || []).filter(p => p !== path) });
    if (projectPath === path) { setProjectPath(null); setProjectName(null); setEntries([]); setOpenTabs([]); setActiveTabPath(null); }
  }, [config, updateConfig, projectPath]);

  return (
    <AppContext.Provider value={{
      projectPath, projectName, entries, openTabs, activeTabPath, activeSidebar, sidebarWidth, theme, config, configLoaded,
      isPaletteOpen, isTerminalOpen, isSettingsOpen,
      openProject, openProjectPath, openSingleFile, openSingleFileDialog,
      setActiveSidebar: setSidebar, openFile, closeTab, setActiveTab, refreshEntries, saveCurrentFile,
      setPaletteOpen, toggleTerminal: () => setTerminalOpen(p=>!p), setTerminalOpen, setSettingsOpen,
      reloadConfig, updateConfig, addWorkspace, removeWorkspace, setSidebarWidth, setEditorContent, getEditorContent, markTabDirty,
      cursorLine, cursorCol, setCursorPosition: (l, c) => { setCursorLine(l); setCursorCol(c); },
    }}>
      {children}
      {pendingCloseTab && (
        <div className="dirty-dialog-backdrop" onMouseDown={() => setPendingCloseTab(null)}>
          <div className="dirty-dialog" onMouseDown={e => e.stopPropagation()}>
            <div className="dirty-dialog-title">保存更改</div>
            <div className="dirty-dialog-body">
              <strong>{pendingCloseTab.name}</strong> 有未保存的更改。
            </div>
            <div className="dirty-dialog-actions">
              <button className="dirty-dialog-btn secondary" onClick={discardAndClosePendingTab}>不保存</button>
              <button className="dirty-dialog-btn secondary" onClick={() => setPendingCloseTab(null)}>取消</button>
              <button className="dirty-dialog-btn primary" onClick={saveAndClosePendingTab}>保存</button>
            </div>
          </div>
        </div>
      )}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
