# WoxCode

高性能代码编辑器 — 用 Rust 优先、TypeScript 辅助构建，替代 VSCode。

## 技术栈

- **后端**: Tauri 2（Rust）— 文件系统、配置存储、单实例锁、系统托盘
- **前端**: React 19 + TypeScript + Vite
- **编辑器核心**: CodeMirror 6 — 130+ 语言语法高亮
- **UI 图标**: Lucide React
- **配置存储**: SQLite（rusqlite bundled，便携数据目录）

## 项目结构

```
WoxCode/
├── src-tauri/              # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       ├── main.rs         # 入口
│       ├── lib.rs          # 应用初始化、托盘、单实例锁
│       ├── models.rs       # 数据结构（FileEntry, UserConfig）
│       └── commands/
│           ├── mod.rs
│           ├── files.rs    # 文件操作（CRUD、目录列表）
│           └── config.rs   # 配置读写
├── src/                    # TypeScript 前端
│   ├── main.tsx            # React 入口
│   ├── App.tsx             # 主布局（CSS Grid）
│   ├── App.css             # VSCode 深色主题样式
│   ├── bridge.ts           # Rust 命令调用封装
│   ├── types.ts            # TypeScript 类型定义
│   ├── contexts/
│   │   └── AppContext.tsx  # 全局应用状态管理
│   └── components/
│       ├── ActivityBar.tsx  # 活动栏（左侧图标）
│       ├── FileExplorer.tsx # 文件浏览器（树形结构）
│       ├── EditorTabs.tsx   # 编辑器标签页
│       ├── EditorArea.tsx   # CodeMirror 6 编辑器
│       └── StatusBar.tsx    # 底部状态栏
├── .hermes/plans/          # 架构计划文档
├── package.json
└── vite.config.ts
```

## 构建

**前置条件:** Visual Studio 2026/2022 (含 C++ 构建工具) + Node.js 20.19+ 或 22.12+

```bash
# 1. 打开 "x64 Native Tools Command Prompt for VS"
# 2. 安装依赖
npm install

# 3. 开发模式（热更新）
npm run tauri dev

# 4. 生产构建
npm run tauri build
```

## 功能

- ✅ VSCode 风格布局（活动栏、侧边栏、编辑区、状态栏）
- ✅ 单实例锁（同时只能运行一个进程，第二次打开会调出已有窗口）
- ✅ 系统托盘（关闭→隐藏到托盘，点击托盘→恢复窗口）
- ✅ 文件浏览器（递归树形结构、新建文件/文件夹）
- ✅ 多语言语法高亮（TS/TSX, JS/JSX, Rust, Python, HTML/CSS, JSON, Markdown, C/C++, XML）
- ✅ 标签页管理（打开/关闭/切换）
- ✅ 未保存文件保护（保存 / 不保存 / 取消）
- ✅ Ctrl+S 保存、Ctrl+O 打开文件夹
- ✅ 命令面板 / 快速打开（Ctrl+P / Ctrl+Shift+P）
- ✅ 全文搜索（大小写、正则、结果跳转）
- ✅ Problems 面板（LSP 诊断事件展示与跳转）
- ✅ LSP 文档打开/编辑同步（didOpen/didChange 基础链路）
- ✅ 终端面板（PTY + xterm，默认进入工作区目录）
- ✅ Markdown 预览
- ✅ Git 分支与变更数量状态栏显示
- ✅ 文件树 Git 状态装饰
- ✅ 便携数据目录（exe 同级 WoxCodeData/）

## 路线图

- [ ] tree-sitter 语法高亮（Rust 端，更精确）
- [ ] LSP 客户端（智能补全、诊断）
- [ ] ripgrep 级全文搜索与替换预览
- [ ] 多终端与工作区目录启动
- [ ] 文件树 Git 状态装饰
- [ ] 插件系统（WASM 宿主）
- [ ] Git 集成
