# WoxCode 架构与实现计划

> **For Hermes:** 逐任务实现，每完成一个 task 提交一次。

**目标:** 构建一个 Rust 优先的高性能代码编辑器，替代 VSCode，内存占用低，启动快。

**架构:** Tauri 2（Rust 后端）+ React 19 + TypeScript（Webview 前端）+ CodeMirror 6（编辑器核心）。
Rust 负责：文件系统、tree-sitter 语法解析、LSP 客户端、搜索、配置存储、插件宿主。
TypeScript 负责：UI 布局（活动栏/侧边栏/编辑区/面板/状态栏）、设置界面、命令面板。

**技术栈:** Tauri 2, React 19, TypeScript 5.8, CodeMirror 6, tree-sitter, rusqlite, Vite 6

---

## 项目结构（目标）

```
WoxCode/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   │   ├── icon.png          ← 已有
│   │   ├── icon.ico
│   │   └── ...
│   └── src/
│       ├── main.rs            # 入口：单实例锁 + Tauri Builder
│       ├── lib.rs             # app_data_dir, open_db, helper 函数
│       ├── models.rs          # 数据结构 (OpenTab, EditorSettings, FileEntry...)
│       ├── commands/
│       │   ├── mod.rs         # 命令注册
│       │   ├── files.rs       # 文件操作（读/写/列表/创建/删除/重命名/监听）
│       │   ├── config.rs      # 配置读写（SQLite settings 表）
│       │   └── search.rs      # 全文搜索（ripgrep 式）
│       └── services/
│           ├── mod.rs
│           ├── buffer.rs      # 文本缓冲（Rope 数据结构，后续）
│           ├── syntax.rs      # tree-sitter 语法高亮（后续）
│           └── lsp.rs         # LSP 客户端（后续）
├── src/
│   ├── main.tsx               # React 入口
│   ├── App.tsx                # 顶层布局
│   ├── App.css                # 全局样式 + VSCode 布局 CSS Grid
│   ├── bridge.ts              # Rust 命令调用封装 (appInvoke)
│   ├── types.ts               # TypeScript 类型定义
│   ├── constants.ts           # 常量
│   ├── vite-env.d.ts
│   ├── contexts/
│   │   └── AppContext.tsx      # 全局应用状态
│   ├── components/
│   │   ├── ActivityBar.tsx     # 最左侧活动栏（图标按钮组）
│   │   ├── Sidebar.tsx         # 侧边栏容器（文件浏览器/搜索/扩展）
│   │   ├── FileExplorer.tsx    # 文件浏览器（树形结构）
│   │   ├── EditorTabs.tsx      # 编辑器标签页栏
│   │   ├── EditorArea.tsx      # 编辑区域（CodeMirror 6 容器）
│   │   ├── Panel.tsx           # 底部面板（终端/输出/问题）
│   │   ├── StatusBar.tsx       # 底部状态栏
│   │   ├── CommandPalette.tsx  # 命令面板 (Ctrl+Shift+P)
│   │   └── Toast.tsx           # 通知提示
│   └── hooks/
│       ├── useKeyboardShortcuts.ts
│       └── useEditor.ts       # 编辑器状态管理
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## Phase 1：MVP 文本编辑器（本次实现）

### Task 1: 清理并初始化 Tauri 2 + React 19 项目

**目标:** 从干净的 Tauri 2 脚手架开始

**步骤:**

1. 删除当前 node_modules（残留的不完整初始化）
2. 创建 `package.json` — React 19 + Vite 6 + Tauri 2 + CodeMirror 6
3. 创建 `tsconfig.json`
4. 创建 `vite.config.ts`
5. 创建 `index.html`
6. 创建 `src-tauri/Cargo.toml` — tauri 2 + tray-icon + image-ico + rusqlite
7. 创建 `src-tauri/tauri.conf.json` — 窗口配置 + 单实例
8. 创建 `src-tauri/build.rs`
9. `npm install`

**验证:** `npm run tauri dev` 能启动空白窗口

---

### Task 2: Rust 后端基础骨架

**目标:** main.rs + lib.rs + models.rs，单实例锁 + 系统托盘

**文件:**
- 创建: `src-tauri/src/main.rs`
- 创建: `src-tauri/src/lib.rs`
- 创建: `src-tauri/src/models.rs`

**lib.rs 要点:**
- `app_data_dir()` — 便携数据目录（exe 同级 `WoxCodeData/`）
- `open_db()` — SQLite 连接 + settings 表
- `app_icon()` — 加载 icon.ico

**main.rs 要点:**
- 单实例锁 (`TcpListener::bind("127.0.0.1:19877")`，端口 19877 避免与 WoxNote 的 19876 冲突)
- 窗口关闭 → 隐藏到托盘
- 托盘菜单（显示/退出）
- 点击托盘图标 → 显示窗口
- 注册空 command handler

**验证:** `npm run tauri dev` 启动 → 关闭窗口 → 窗口隐藏到托盘 → 点击托盘图标 → 窗口恢复

---

### Task 3: TypeScript 前端 VSCode 布局

**目标:** CSS Grid 实现 5 区布局：活动栏 | 侧边栏 | 编辑区 | 面板 | 状态栏

**文件:**
- 创建: `src/main.tsx`
- 创建: `src/App.tsx`
- 创建: `src/App.css`
- 创建: `src/bridge.ts`
- 创建: `src/types.ts`
- 创建: `src/contexts/AppContext.tsx`
- 创建: `src/components/ActivityBar.tsx`
- 创建: `src/components/Sidebar.tsx`
- 创建: `src/components/EditorTabs.tsx`
- 创建: `src/components/EditorArea.tsx`
- 创建: `src/components/StatusBar.tsx`

**布局结构（CSS Grid）:**
```
┌──────┬───────────┬────────────────────┐
│ Act. │  Primary  │                    │
│ Bar  │  Sidebar  │     EditorArea     │
│ 40px │  240px    │       flex-grow    │
│      │           │  ┌──────────────┐  │
│      │           │  │ EditorTabs   │  │
│      │           │  │ Editor (CM6) │  │
│      │           │  │ Panel (底)   │  │
│      │           │  └──────────────┘  │
├──────┴───────────┴────────────────────┤
│             StatusBar (24px)          │
└───────────────────────────────────────┘
```

**AppContext 状态:**
- `activeSidebar`: 'explorer' | 'search' | 'extensions' | null
- `openTabs`: OpenTab[]
- `activeTabPath`: string | null
- `projectPath`: string | null
- `theme`: 'dark' | 'light'

**验证:** 打开窗口看到完整的 VSCode 风格布局（深色主题，暂无可交互内容）

---

### Task 4: 文件系统命令 + 文件浏览器

**目标:** Rust 文件操作 + 前端树形文件浏览器

**文件:**
- 创建: `src-tauri/src/commands/mod.rs`
- 创建: `src-tauri/src/commands/files.rs`
- 创建: `src/components/FileExplorer.tsx`

**Rust 命令:**
- `open_folder` → 弹出文件夹选择对话框，返回路径
- `list_directory(path)` → 递归列出目录（排除 node_modules, .git, target），返回 FileEntry[]（name, path, is_dir, extension, size, modified）
- `read_text_file(path)` → 读取文本文件内容
- `write_text_file(path, content)` → 写入文本文件

**前端 FileExplorer:**
- 单击文件夹 → 展开/折叠（箭头旋转动画）
- 单击文件 → 打开到编辑器
- 右键菜单（新建文件/文件夹、重命名、删除）

**验证:** 打开文件夹 → 文件树显示 → 点击 .ts 文件 → 编辑器标签页出现

---

### Task 5: CodeMirror 6 多语言编辑器

**目标:** 集成 CodeMirror 6，支持语法高亮、行号、折叠

**文件:**
- 修改: `src/components/EditorArea.tsx`
- 创建: `src/hooks/useEditor.ts`

**CodeMirror 6 配置:**
- 语言支持：JavaScript/TypeScript, Rust, Python, JSON, HTML/CSS, Markdown（通过 `@codemirror/lang-*` 包）
- 自动检测文件扩展名 → 对应语言模式
- 功能：行号、语法高亮、代码折叠、括号匹配、缩进辅助
- 深色主题（`@codemirror/theme-one-dark`）

**验证:** 打开不同类型的文件 → 正确的语法高亮

---

### Task 6: 标签页管理 + 右键菜单

**目标:** 完整的标签页系统 + 上下文菜单

**文件:**
- 创建: `src/components/EditorTabs.tsx`（完善）
- 创建: `src/components/ContextMenu.tsx`

**功能:**
- 点击文件 → 新标签页打开（不重复）
- 标签页关闭按钮
- 未保存提示（圆点标记）
- 右键关闭/关闭其他/关闭所有
- Ctrl+S 保存，Ctrl+W 关闭标签

**验证:** 打开多个文件 → 标签页切换 → 关闭标签 → 正确的文件内容

---

### Task 7: 状态栏 + 快捷键 + 收尾

**目标:** 底部状态栏 + 键盘快捷键 + 单实例锁完善 + 项目版本信息

**文件:**
- 修改: `src/components/StatusBar.tsx`
- 创建: `src/hooks/useKeyboardShortcuts.ts`
- 创建: `src-tauri/src/commands/config.rs`

**状态栏显示:**
- 当前语言模式
- 行号:列号
- 缩进设置
- 文件编码
- 项目路径

**快捷键:**
- Ctrl+S → 保存
- Ctrl+W → 关闭标签
- Ctrl+Shift+P → 命令面板
- Ctrl+B → 切换侧边栏
- Ctrl+P → 快速打开文件（后续）

**验证:** 完整的 VSCode 风格工作流可用

---

## 后续阶段（不在本次范围）

- **Phase 2:** tree-sitter 语法高亮（Rust 端），LSP 客户端
- **Phase 3:** 搜索（ripgrep 集成），全局查找替换
- **Phase 4:** 终端面板（PTY 集成）
- **Phase 5:** 插件系统（WASM / 动态库）
- **Phase 6:** Git 集成，调试器

---

## 技术决策记录

| 决策 | 选择 | 原因 |
|------|------|------|
| UI 框架 | React 19 + CSS Grid | 与现有 WoxNote/WoxMail 一致，不需新学习 |
| 编辑器核心 | CodeMirror 6 | 模块化、130+ 语言支持、轻量、已有使用经验 |
| 语法高亮（Rust侧） | tree-sitter | 异步、增量解析、与 LSP 联动 |
| 文本缓冲 | Rope (后续) | 大文件高效编辑 |
| 配置存储 | SQLite (rusqlite bundled) | 与 WoxNote 一致，便携 |
| 包管理 | Vite 6 | 与 WoxNote 一致，HMR 开发体验好 |
| 单实例锁 | TcpListener 端口绑定 | 简单可靠，无需额外依赖 |
| 数据目录 | exe 同级 WoxCodeData/ | 便携设计，与 WoxNote/WoxMail 一致 |
