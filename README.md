# WoxCode

高性能、低内存占用的代码编辑器，基于 Rust 优先架构构建，替代 VSCode。

## 技术栈

- **后端**: Tauri 2（Rust）— 文件系统、SQLite 配置、单实例锁、系统托盘、LSP 客户端、tree-sitter、PTY 终端
- **前端**: React 19 + TypeScript + Vite
- **编辑器**: CodeMirror 6 — 语法高亮、多语言支持
- **UI**: Lucide React 图标

## 功能

- 🎨 深色/浅色主题（Noir & Dawn）
- 📝 CodeMirror 6 编辑器（130+ 语言语法高亮）
- 🔍 命令面板（Ctrl+Shift+P）+ 快速打开文件（Ctrl+P）
- 🔎 全局搜索 + 内容搜索（正则表达式支持）
- 📎 查找与替换（Ctrl+F / Ctrl+H，含高亮）
- 🖥️ 终端面板（Ctrl+`，PTY + xterm.js）
- 📋 LSP 客户端（13 种语言：TS/JS、Rust、Python、Go、C/C++、HTML、CSS、JSON、Markdown、YAML、Java）
- 🌳 tree-sitter 语法解析（Rust 端）
- 📖 Markdown 预览（分屏 + 可拖拽分割线）
- 👁️ 文件图标（彩色扩展名标签）+ 未保存标记
- 🏗️ 工作区管理（导入、删除、切换）
- 🖱️ 右键菜单（新建、重命名、删除、格式化）
- ⌨️ 完整快捷键（保存、跳转行、格式化等）
- 🔒 单实例锁 + 系统托盘图标
- 📦 便携数据目录（exe 同级）
- 🌍 中英文切换
- 🎯 界面字体 / 编辑器字体独立设置

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+P` | 快速打开文件 |
| `Ctrl+Shift+P` | 命令面板 |
| `Ctrl+S` | 保存 |
| `Ctrl+F` | 查找 |
| `Ctrl+H` | 查找替换 |
| `Ctrl+G` | 跳转到行 |
| `Ctrl+O` | 打开文件夹 |
| `Ctrl+N` | 新建文件 |
| `Ctrl+W` | 关闭标签页 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+,` | 设置 |
| `Ctrl+\`` | 终端 |
| `Shift+Alt+F` | 格式化文档 |
| `F11` | 全屏 |

## 构建

```bash
cd D:\Works\MyProject\WoxCode
npm install
npm run tauri dev
```

## 许可证
MIT
