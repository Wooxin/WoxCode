import { invoke } from "@tauri-apps/api/core";

/**
 * Typed wrapper around Tauri invoke.
 * All Rust commands go through this to keep types centralized.
 */

import type { FileEntry, UserConfig } from "./types";

export async function appInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke<T>(cmd, args);
}

// ── Files ──

export function openFolder(): Promise<string | null> {
  return appInvoke<string | null>("open_folder");
}

export interface OpenFileResult {
  path: string;
  name: string;
  content: string;
}

export function openFile(): Promise<OpenFileResult | null> {
  return appInvoke<OpenFileResult | null>("open_file");
}

export function listDirectory(path: string): Promise<FileEntry[]> {
  return appInvoke<FileEntry[]>("list_directory", { path });
}

export function readTextFile(path: string): Promise<string> {
  return appInvoke<string>("read_text_file", { path });
}

export function writeTextFile(path: string, content: string): Promise<void> {
  return appInvoke<void>("write_text_file", { path, content });
}

export function createFile(path: string): Promise<void> {
  return appInvoke<void>("create_file", { path });
}

export function createFolder(path: string): Promise<void> {
  return appInvoke<void>("create_folder", { path });
}

export function deleteEntry(path: string): Promise<void> {
  return appInvoke<void>("delete_entry", { path });
}

export function renameEntry(path: string, newName: string): Promise<string> {
  return appInvoke<string>("rename_entry", { path, newName: newName });
}

// ── Config ──

export function getUserConfig(): Promise<UserConfig> {
  return appInvoke<UserConfig>("get_user_config");
}

export function saveUserConfig(config: UserConfig): Promise<void> {
  return appInvoke<void>("save_user_config", { config });
}

// ── Terminal ──

export function terminalStart(rows: number, cols: number, cwd?: string | null): Promise<void> {
  return appInvoke<void>("terminal_start", { rows, cols, cwd });
}

export function terminalWrite(data: string): Promise<void> {
  return appInvoke<void>("terminal_write", { data });
}

export function terminalResize(rows: number, cols: number): Promise<void> {
  return appInvoke<void>("terminal_resize", { rows, cols });
}

export function terminalKill(): Promise<void> {
  return appInvoke<void>("terminal_kill");
}

export function lspKill(): Promise<void> {
  return appInvoke<void>("lsp_kill");
}

export function lspSemanticTokens(filePath: string): Promise<void> {
  return appInvoke<void>("lsp_semantic_tokens", { filePath });
}

// ── Syntax ──

export interface SyntaxToken {
  start_line: number;
  start_col: number;
  end_line: number;
  end_col: number;
  token_type: string;
}

export interface SyntaxResult {
  tokens: SyntaxToken[];
  language: string;
}

export function parseSyntax(path: string, content: string): Promise<SyntaxResult> {
  return appInvoke<SyntaxResult>("parse_syntax", { path, content });
}

// ── LSP ──

export function lspStart(extension: string, rootPath: string): Promise<string> {
  return appInvoke<string>("lsp_start", { extension, rootPath });
}

export function lspDidOpen(filePath: string, content: string, languageId: string): Promise<void> {
  return appInvoke<void>("lsp_did_open", { filePath, content, languageId });
}

export function lspDidChange(filePath: string, content: string, version: number): Promise<void> {
  return appInvoke<void>("lsp_did_change", { filePath, content, version });
}

export function lspCompletion(filePath: string, line: number, character: number): Promise<void> {
  return appInvoke<void>("lsp_completion", { filePath, line, character });
}

export function loadSession(projectPath: string): Promise<SessionData> {
  return appInvoke<SessionData>("load_session", { projectPath });
}

export interface SessionTab {
  file_path: string;
  dirty_content: string | null;
  is_active: boolean;
}

export interface SessionData {
  project_path: string;
  tabs: SessionTab[];
}

export function saveSession(projectPath: string, tabs: SessionTab[]): Promise<void> {
  return appInvoke<void>("save_session", { projectPath, tabs });
}

// ── Fonts ──

export function listSystemFonts(): Promise<string[]> {
  return appInvoke<string[]>("list_system_fonts");
}

// ── Search (Rust) ──

export function searchFiles(directory: string, query: string): Promise<FileEntry[]> {
  return appInvoke<FileEntry[]>("search_files", { directory, query });
}

export interface SearchMatch {
  file_path: string; file_name: string;
  line_number: number; line_content: string;
  match_start: number; match_end: number;
}

export function searchContent(directory: string, query: string, caseSensitive: boolean, useRegex: boolean): Promise<SearchMatch[]> {
  return appInvoke<SearchMatch[]>("search_content", { directory, query, caseSensitive, useRegex });
}

// ── Git ──

export function gitBranch(directory: string): Promise<string | null> {
  return appInvoke<string | null>("git_branch", { directory });
}

export interface GitStatus {
  branch: string | null;
  changed: number;
}

export interface GitFileStatus {
  path: string;
  status: string;
}

export function gitStatus(directory: string): Promise<GitStatus | null> {
  return appInvoke<GitStatus | null>("git_status", { directory });
}

export function gitFileStatuses(directory: string): Promise<GitFileStatus[]> {
  return appInvoke<GitFileStatus[]>("git_file_statuses", { directory });
}
