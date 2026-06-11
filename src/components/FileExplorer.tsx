import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import { FileIcon } from "../utils/icons";
import { ContextMenu, fileMenuItems } from "./ContextMenu";
import type { FileEntry } from "../types";
import * as bridge from "../bridge";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();
  for (const entry of entries) {
    const parts = entry.path.split("/"); parts.pop();
    const parentPath = parts.join("/");
    const node: TreeNode = { ...entry, children: entry.is_dir ? [] : undefined };
    if (parentPath === "") { root.push(node); }
    else { const p = dirMap.get(parentPath); if (p?.children) p.children.push(node); }
    if (entry.is_dir) dirMap.set(entry.path, node);
  }
  return root;
}

type TreeNode = FileEntry & { children?: TreeNode[] };

function gitBadgeClass(status: string): string {
  const code = status[0] === "?" ? "untracked" : status[0] || "modified";
  return `git-${code}`;
}

function TreeNodeItem({ node, depth, expanded, onToggle, onSelect, onContextMenu, gitStatuses }: {
  node: TreeNode; depth: number; expanded: Set<string>;
  onToggle: (p: string) => void; onSelect: (n: TreeNode) => void;
  onContextMenu: (e: React.MouseEvent, n: TreeNode) => void;
  gitStatuses: Map<string, string>;
}) {
  const isExpanded = expanded.has(node.path);
  const gitStatus = gitStatuses.get(node.path);
  return (<>
    <div className="tree-node" style={{ paddingLeft: 8 + depth * 16 }}
      onClick={() => node.is_dir ? onToggle(node.path) : onSelect(node)}
      onContextMenu={e => onContextMenu(e, node)}>
      <span className="tree-icon">
        {node.is_dir ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span style={{ width: 14, display: "inline-block" }} />}
        {node.is_dir ? (isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />) : <FileIcon ext={node.extension} size={14} />}
      </span>
      <span className="tree-name">{node.name}</span>
      {gitStatus && <span className={`git-file-badge ${gitBadgeClass(gitStatus)}`}>{gitStatus}</span>}
    </div>
    {node.is_dir && isExpanded && node.children?.map(c =>
      <TreeNodeItem key={c.path} node={c} depth={depth + 1} expanded={expanded} onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu} gitStatuses={gitStatuses} />
    )}
  </>);
}

export function FileExplorer() {
  const app = useAppContext();
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; target: TreeNode } | null>(null);
  const [gitStatuses, setGitStatuses] = useState<Map<string, string>>(new Map());

  const tree = buildTree(app.entries);

  useEffect(() => {
    if (!app.projectPath) {
      setGitStatuses(new Map());
      return;
    }
    const refreshGitStatuses = () => bridge.gitFileStatuses(app.projectPath!)
      .then(statuses => setGitStatuses(new Map(statuses.map(item => [item.path, item.status || "?"]))))
      .catch(() => setGitStatuses(new Map()));
    refreshGitStatuses();
    window.addEventListener("woxcode-file-saved", refreshGitStatuses);
    return () => window.removeEventListener("woxcode-file-saved", refreshGitStatuses);
  }, [app.projectPath, app.entries]);
  const toggleDir = useCallback((p: string) => setExpanded(prev => { const n = new Set(prev); n.has(p) ? n.delete(p) : n.add(p); return n; }), []);
  const handleSelect = useCallback((n: TreeNode) => app.openFile(n), [app]);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, target: node });
  }, []);

  const getFullPath = (p: string) => app.projectPath ? `${app.projectPath.replace(/\\/g, "/")}/${p}` : p;

  const handleDelete = useCallback(async () => {
    if (!ctxMenu) return;
    if (!ctxMenu.target.path) {
      alert("不能从这里删除工作区根目录。");
      setCtxMenu(null);
      return;
    }
    const label = ctxMenu.target.name || app.projectName || "当前项目";
    if (!window.confirm(`确定要删除 "${label}" 吗？此操作无法撤销。`)) {
      setCtxMenu(null);
      return;
    }
    try { await bridge.deleteEntry(getFullPath(ctxMenu.target.path)); app.refreshEntries(); } catch (e) { alert(String(e)); }
    setCtxMenu(null);
  }, [ctxMenu, app]);

  const handleRename = useCallback(() => {
    if (!ctxMenu) return;
    if (!ctxMenu.target.path) {
      alert("不能从这里重命名工作区根目录。");
      setCtxMenu(null);
      return;
    }
    const newName = prompt("新名称:", ctxMenu.target.name);
    if (newName) {
      bridge.renameEntry(getFullPath(ctxMenu.target.path), newName).then(() => app.refreshEntries()).catch(alert);
    }
    setCtxMenu(null);
  }, [ctxMenu, app]);

  const handleNewFile = useCallback(() => {
    const name = prompt(t.newFileName);
    if (name && app.projectPath) {
      const base = ctxMenu?.target.is_dir ? ctxMenu.target.path : "";
      const p = base ? `${getFullPath(base)}/${name}` : `${app.projectPath.replace(/\\/g, "/")}/${name}`;
      bridge.createFile(p).then(() => app.refreshEntries()).catch(alert);
    }
    setCtxMenu(null);
  }, [ctxMenu, app, t]);

  const handleNewFolder = useCallback(() => {
    const name = prompt("文件夹名:");
    if (name && app.projectPath) {
      const base = ctxMenu?.target.is_dir ? ctxMenu.target.path : "";
      const p = base ? `${getFullPath(base)}/${name}` : `${app.projectPath.replace(/\\/g, "/")}/${name}`;
      bridge.createFolder(p).then(() => app.refreshEntries()).catch(alert);
    }
    setCtxMenu(null);
  }, [ctxMenu, app]);

  const handleCopyPath = useCallback(() => {
    if (!ctxMenu) return;
    navigator.clipboard.writeText(getFullPath(ctxMenu.target.path)).catch(() => {});
    setCtxMenu(null);
  }, [ctxMenu, app]);

  const handleOpenExternal = useCallback(() => {
    if (!ctxMenu) return;
    revealItemInDir(getFullPath(ctxMenu.target.path)).catch(e => alert(String(e)));
    setCtxMenu(null);
  }, [ctxMenu]);

  return (
    <div className="sidebar-panel">
      <div className="sidebar-header">
        <span>{t.fileExplorer}</span>
        {app.projectPath && <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{app.projectPath}</span>}
        <div className="sidebar-actions">
          <button className="icon-btn" title={t.newFile} onClick={() => {
            const n = prompt(t.newFileName);
            if (n && app.projectPath) bridge.createFile(`${app.projectPath.replace(/\\/g, "/")}/${n}`).then(() => app.refreshEntries()).catch(alert);
          }}><Plus size={16} /></button>
          <button className="icon-btn" title={t.refresh} onClick={app.refreshEntries}><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="file-tree" onContextMenu={e => { e.preventDefault(); handleContextMenu(e, { name: "", path: "", is_dir: true, extension: "", size: 0, modified: 0 }); }}>
        {tree.map(n => <TreeNodeItem key={n.path} node={n} depth={0} expanded={expanded} onToggle={toggleDir} onSelect={handleSelect} onContextMenu={handleContextMenu} gitStatuses={gitStatuses} />)}
        {tree.length === 0 && <div className="empty-hint">{t.emptyHint}</div>}
      </div>
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)}
          items={fileMenuItems(handleNewFile, handleNewFolder, handleRename, handleDelete, handleCopyPath, handleOpenExternal)} />
      )}
    </div>
  );
}
