import { useEffect, useRef } from "react";
import { FilePlus, FolderPlus, Trash2, Pencil, Copy, ExternalLink } from "lucide-react";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("scroll", handler, true);
    return () => window.removeEventListener("scroll", handler, true);
  }, [onClose]);

  // Adjust position to stay within viewport
  const style: React.CSSProperties = { position: "fixed", left: x, top: y, zIndex: 2000 };
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) style.left = x - rect.width;
    if (rect.bottom > window.innerHeight) style.top = y - rect.height;
  }

  return (
    <div ref={menuRef} className="context-menu" style={style}>
      {items.map((item, i) => (
        item.separator ? (
          <div key={i} className="context-separator" />
        ) : (
          <button
            key={i}
            className={`context-item ${item.danger ? "danger" : ""}`}
            disabled={item.disabled}
            onClick={() => { item.action(); onClose(); }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        )
      ))}
    </div>
  );
}

// ── Pre-built menu items ──

export function fileMenuItems(
  onNewFile: () => void,
  onNewFolder: () => void,
  onRename: () => void,
  onDelete: () => void,
  onCopyPath: () => void,
  onOpenExternal?: () => void,
): MenuItem[] {
  const items: MenuItem[] = [
    { label: "新建文件", icon: <FilePlus size={14} />, action: onNewFile },
    { label: "新建文件夹", icon: <FolderPlus size={14} />, action: onNewFolder },
    { separator: true, label: "", action: () => {} },
    { label: "重命名", icon: <Pencil size={14} />, action: onRename },
    { label: "删除", icon: <Trash2 size={14} />, action: onDelete, danger: true },
    { separator: true, label: "", action: () => {} },
    { label: "复制路径", icon: <Copy size={14} />, action: onCopyPath },
  ];
  if (onOpenExternal) {
    items.push({ label: "在资源管理器中打开", icon: <ExternalLink size={14} />, action: onOpenExternal });
  }
  return items;
}

export function tabMenuItems(
  onClose: () => void,
  onCloseOthers: () => void,
  onCloseAll: () => void,
  onCopyPath: () => void,
): MenuItem[] {
  return [
    { label: "关闭", icon: <Trash2 size={14} />, action: onClose },
    { label: "关闭其他", action: onCloseOthers },
    { label: "关闭所有", action: onCloseAll },
    { separator: true, label: "", action: () => {} },
    { label: "复制路径", icon: <Copy size={14} />, action: onCopyPath },
  ];
}
