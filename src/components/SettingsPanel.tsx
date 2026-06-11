import { useEffect, useState, useMemo } from "react";
import { X, Sun, Moon, AlignLeft, Keyboard, Info, Globe } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import * as bridge from "../bridge";

interface SettingsPanelProps { onClose: () => void; }

type SettingsTab = "appearance" | "editor" | "keyboard" | "about";

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const app = useAppContext();
  const { t, lang, setLang } = useI18n();
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");

  const [theme, setTheme] = useState(app.config?.theme ?? "dark");
  const [uiFont, setUiFont] = useState((app.config?.ui_font?.split(",")[0]?.trim()?.replace(/'/g, "")) ?? "HarmonyOS Sans");
  const [editorFont, setEditorFont] = useState((app.config?.editor_font?.split(",")[0]?.trim()?.replace(/'/g, "")) ?? "Consolas");
  const [uiFontSize, setUiFontSize] = useState(app.config?.ui_font_size ?? 13);
  const [editorFontSize, setEditorFontSize] = useState(app.config?.editor_font_size ?? 14);
  const [tabSize, setTabSize] = useState(app.config?.tab_size ?? 4);
  const [language, setLanguage] = useState(lang);

  const [systemFonts, setSystemFonts] = useState<string[]>([]);

  useEffect(() => { bridge.listSystemFonts().then(setSystemFonts).catch(() => {}); }, []);

  // Memoize combined font lists
  const uiFontOptions = useMemo(() => {
    const defaults = ["HarmonyOS Sans", "HarmonyOS Sans SC", "Microsoft YaHei", "Segoe UI", "PingFang SC", "Noto Sans SC"];
    const merged = [...new Set([...defaults, ...systemFonts])];
    return merged.sort();
  }, [systemFonts]);

  const editorFontOptions = useMemo(() => {
    const defaults = ["Consolas", "Cascadia Code", "Cascadia Mono", "Fira Code", "JetBrains Mono", "Source Code Pro", "Courier New", "monospace"];
    const merged = [...new Set([...defaults, ...systemFonts])];
    return merged.sort();
  }, [systemFonts]);

  const handleSave = () => {
    if (!app.config) return;
    setLang(language);
    const uiFontWithFallback = uiFont.includes(",") ? uiFont : `${uiFont}, 'Microsoft YaHei', 'Segoe UI', sans-serif`;
    const editorFontWithFallback = editorFont.includes(",") ? editorFont : `${editorFont}, 'Cascadia Code', 'Courier New', monospace`;
    app.updateConfig({
      theme: theme as "dark"|"light",
      ui_font: uiFontWithFallback, editor_font: editorFontWithFallback,
      font_size: editorFontSize, ui_font_size: uiFontSize, editor_font_size: editorFontSize,
      tab_size: tabSize, language,
    });
    onClose();
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "appearance", label: t.appearance, icon: <Sun size={16} /> },
    { id: "editor", label: t.editorBehavior, icon: <AlignLeft size={16} /> },
    { id: "keyboard", label: "快捷键", icon: <Keyboard size={16} /> },
    { id: "about", label: t.about, icon: <Info size={16} /> },
  ];

  return (
    <div className="settings-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="settings-panel">
        <div className="settings-header"><span>{t.settings}</span><button className="icon-btn" onClick={onClose}><X size={18}/></button></div>
        <div className="settings-body">
          <div className="settings-tabs">
            {tabs.map(tab => (
              <button key={tab.id} className={`settings-tab ${activeTab===tab.id?"active":""}`} onClick={()=>setActiveTab(tab.id)}>{tab.icon}<span>{tab.label}</span></button>
            ))}
          </div>
          <div className="settings-content">
            {activeTab==="appearance" && (
              <div className="settings-section">
                <h3>{t.colorTheme}</h3>
                <div className="settings-row">
                  <label>{t.colorTheme}</label>
                  <div className="theme-toggle">
                    <button className={`theme-btn ${theme==="dark"?"active":""}`} onClick={()=>setTheme("dark")}><Moon size={16}/>{t.dark}</button>
                    <button className={`theme-btn ${theme==="light"?"active":""}`} onClick={()=>setTheme("light")}><Sun size={16}/>{t.light}</button>
                  </div>
                </div>
                <h3 style={{marginTop:24}}>{t.fonts}</h3>
                <div className="settings-row"><label>{t.uiFont}</label>
                  <select className="settings-select" value={uiFont} onChange={e => setUiFont(e.target.value)}>
                    {uiFontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="settings-row"><label>{t.editorFont}</label>
                  <select className="settings-select" value={editorFont} onChange={e => setEditorFont(e.target.value)}>
                    {editorFontOptions.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="settings-row"><label>{t.fontSize}（界面）</label><input type="number" className="settings-input" value={uiFontSize} min={10} max={32} onChange={e=>setUiFontSize(+e.target.value)}/></div>
                <div className="settings-row"><label>{t.fontSize}（编辑器）</label><input type="number" className="settings-input" value={editorFontSize} min={10} max={32} onChange={e=>setEditorFontSize(+e.target.value)}/></div>
                <div className="settings-row"><label><Globe size={14} style={{marginRight:4,verticalAlign:"-2px"}}/>{t.language}</label>
                  <select className="settings-select" value={language} onChange={e=>setLanguage(e.target.value)}>
                    <option value="zh">中文</option><option value="en">English</option>
                  </select>
                </div>
                <div className="settings-row">
                  <label>LSP 语义高亮</label>
                  <label className="settings-switch"><input type="checkbox" checked={app.config?.semantic_highlighting ?? true} onChange={() => app.updateConfig({ semantic_highlighting: !(app.config?.semantic_highlighting ?? true) })} /><span className="switch-slider" /></label>
                </div>
              </div>
            )}
            {activeTab==="editor" && (
              <div className="settings-section">
                <h3>{t.editorBehavior}</h3>
                <div className="settings-row"><label>{t.tabSize}</label>
                  <select className="settings-select" value={tabSize} onChange={e=>setTabSize(+e.target.value)}>
                    <option value={2}>{t.spaces2}</option><option value={4}>{t.spaces4}</option><option value={8}>{t.spaces8}</option>
                  </select>
                </div>
                <div className="settings-row"><label>{t.fontSize}（界面）</label><input type="number" className="settings-input" value={uiFontSize} min={10} max={32} onChange={e=>setUiFontSize(+e.target.value)}/></div>
                <div className="settings-row"><label>{t.fontSize}（编辑器）</label><input type="number" className="settings-input" value={editorFontSize} min={10} max={32} onChange={e=>setEditorFontSize(+e.target.value)}/></div>
              </div>
            )}
            {activeTab==="keyboard" && (
              <div className="settings-section"><h3>快捷键</h3>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+P</span><span style={{fontSize:12}}>快速打开文件</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+Shift+P</span><span style={{fontSize:12}}>命令面板</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+S</span><span style={{fontSize:12}}>保存文件</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+F / H</span><span style={{fontSize:12}}>查找 / 替换</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+G</span><span style={{fontSize:12}}>跳转到行</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+O</span><span style={{fontSize:12}}>打开文件夹</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+N</span><span style={{fontSize:12}}>新建文件</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+W</span><span style={{fontSize:12}}>关闭标签页</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+B</span><span style={{fontSize:12}}>切换侧边栏</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Ctrl+`</span><span style={{fontSize:12}}>切换终端</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>F11</span><span style={{fontSize:12}}>全屏</span></div>
                <div className="settings-row"><span style={{fontSize:12,color:"var(--text-muted)"}}>Shift+Alt+F</span><span style={{fontSize:12}}>格式化文档</span></div>
              </div>
            )}
            {activeTab==="about" && (
              <div className="settings-section" style={{textAlign:"center",padding:"40px 20px"}}>
                <div style={{fontSize:32,fontWeight:200,marginBottom:8,background:"linear-gradient(135deg, var(--accent), #5eead4)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>WoxCode</div>
                <div style={{color:"var(--text-secondary)",marginBottom:4}}>高性能代码编辑器</div>
                <div style={{color:"var(--text-muted)",fontSize:12}}>v0.1.0 · Tauri 2 · React 19 · CodeMirror 6</div>
              </div>
            )}
          </div>
        </div>
        <div className="settings-footer"><button className="settings-save-btn" onClick={handleSave}>{t.saveSettings}</button></div>
      </div>
    </div>
  );
}
