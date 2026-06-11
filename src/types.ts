import { ReactNode } from "react";

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  extension: string;
  size: number;
  modified: number;
}

export interface OpenTab {
  path: string;
  name: string;
  dirty: boolean;
}

export interface UserConfig {
  theme: "dark" | "light";
  font_size: number;
  font_family: string;
  ui_font: string;
  editor_font: string;
  ui_font_size: number;
  editor_font_size: number;
  language: string;
  tab_size: number;
  activity_expanded: boolean;
  sidebar_visible: boolean;
  semantic_highlighting: boolean;
  fullscreen: boolean;
  workspaces: string[];
  recent_projects: string[];
}

export interface ActivityItem {
  id: string;
  icon: ReactNode;
  label: string;
}
