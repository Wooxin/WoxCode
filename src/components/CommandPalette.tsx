import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Search, File, X, ChevronRight } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import type { FileEntry } from "../types";
import * as bridge from "../bridge";

interface Command { id: string; label: string; category: string; shortcut?: string; action: () => void; }

function useCommands(): Command[] {
  const app = useAppContext();
  const { t } = useI18n();
  return useMemo(() => [
    { id:"file.open-folder", label:t.cmdOpenFolder, category:t.catFile, shortcut:"Ctrl+O", action:()=>app.openProject() },
    { id:"file.new-file", label:t.cmdNewFile, category:t.catFile, action:()=>{const n=prompt(t.newFileName);if(n&&app.projectPath){const p=`${app.projectPath.replace(/\\/g,"/")}/${n}`;import("../bridge").then(b=>b.createFile(p).then(()=>app.refreshEntries()).catch(alert));}}},
    { id:"file.save", label:t.cmdSave, category:t.catFile, shortcut:"Ctrl+S", action:()=>app.saveCurrentFile() },
    { id:"file.close-tab", label:t.cmdCloseTab, category:t.catFile, shortcut:"Ctrl+W", action:()=>{if(app.activeTabPath)app.closeTab(app.activeTabPath);} },
    { id:"edit.undo", label:t.cmdUndo, category:t.catEdit, shortcut:"Ctrl+Z", action:()=>{} },
    { id:"edit.redo", label:t.cmdRedo, category:t.catEdit, shortcut:"Ctrl+Y", action:()=>{} },
    { id:"view.explorer", label:t.cmdShowExplorer, category:t.catView, shortcut:"Ctrl+B", action:()=>app.setActiveSidebar("explorer") },
    { id:"view.search", label:t.cmdShowSearch, category:t.catView, action:()=>app.setActiveSidebar("search") },
    { id:"view.toggle-sidebar", label:t.cmdToggleSidebar, category:t.catView, shortcut:"Ctrl+B", action:()=>app.setActiveSidebar(app.activeSidebar?null:"explorer") },
    { id:"view.toggle-terminal", label:t.cmdToggleTerminal, category:t.catView, shortcut:"Ctrl+`", action:()=>app.toggleTerminal() },
    { id:"help.about", label:t.cmdAbout, category:t.catHelp, action:()=>alert("WoxCode v0.1.0") },
  ], [app, t]);
}

function fuzzyScore(query: string, target: string): number {
  const q=query.toLowerCase(), t=target.toLowerCase();
  if(t===q)return 100; if(t.startsWith(q))return 80; if(t.includes(q))return 60;
  let qi=0, score=0;
  for(let i=0;i<t.length&&qi<q.length;i++){if(t[i]===q[qi]){score+=10;if(i===0||t[i-1]===" "||t[i-1]==="-"||t[i-1]==="_")score+=5;qi++;}}
  return qi===q.length?score:0;
}

export function CommandPalette() {
  const app = useAppContext();
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<"commands"|"files">("commands");
  const inputRef = useRef<HTMLInputElement>(null);
  const commands = useCommands();
  const [fileResults, setFileResults] = useState<FileEntry[]>([]);
  const [fileSearching, setFileSearching] = useState(false);
  const searchSeqRef = useRef(0);

  useEffect(()=>{setMode(query.startsWith(">")?"commands":"files");},[query]);

  useEffect(() => {
    if (mode !== "files" || !query.trim() || !app.projectPath) {
      searchSeqRef.current += 1;
      setFileResults([]);
      setFileSearching(false);
      return;
    }
    const seq = searchSeqRef.current + 1;
    searchSeqRef.current = seq;
    setFileSearching(true);
    const timer = setTimeout(() => {
      bridge.searchFiles(app.projectPath!, query)
        .then(results => { if (searchSeqRef.current === seq) setFileResults(results); })
        .catch(() => { if (searchSeqRef.current === seq) setFileResults([]); })
        .finally(() => { if (searchSeqRef.current === seq) setFileSearching(false); });
    }, 120);
    return () => clearTimeout(timer);
  }, [app.projectPath, mode, query]);

  const results = useMemo(()=>{
    if(mode==="commands"){
      const sq=(query.startsWith(">")?query.slice(1):query).trim();
      if(!sq)return commands.map(c=>({...c,score:0}));
      return commands.map(c=>({...c,score:fuzzyScore(sq,c.label)+fuzzyScore(sq,c.category)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,20);
    }
    return fileResults.map(e => ({...e, score: 0}));
  },[query,mode,commands,fileResults]);

  useEffect(()=>{setSelectedIdx(0);},[query]);

  const execute = useCallback((idx:number)=>{
    if(idx<0||idx>=results.length)return;
    const item=results[idx];
    if(mode==="commands"&&"action"in item){item.action();app.setPaletteOpen(false);}
    else if(mode==="files"&&"path"in item){app.openFile({name:item.name,path:item.path,is_dir:false,extension:item.extension,size:0,modified:0});app.setPaletteOpen(false);}
  },[results,mode,app]);

  const handleKeyDown = useCallback((e:React.KeyboardEvent)=>{
    switch(e.key){
      case"ArrowDown":e.preventDefault();setSelectedIdx(i=>Math.min(i+1,results.length-1));break;
      case"ArrowUp":e.preventDefault();setSelectedIdx(i=>Math.max(i-1,0));break;
      case"Enter":e.preventDefault();execute(selectedIdx);break;
      case"Escape":app.setPaletteOpen(false);break;
    }
  },[results.length,selectedIdx,execute,app]);

  useEffect(()=>{inputRef.current?.focus();},[]);

  return (
    <div className="palette-backdrop" onMouseDown={()=>app.setPaletteOpen(false)}>
      <div className="command-palette" onMouseDown={e=>e.stopPropagation()}>
        <div className="palette-input">
          <Search size={16}/>
          <input ref={inputRef} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={handleKeyDown} placeholder={mode==="commands"?t.commandMode:t.commandPlaceholder}/>
          {query&&<button className="palette-clear" onClick={()=>setQuery("")}><X size={14}/></button>}
        </div>
        <div className="palette-results">
          {mode==="files"&&fileSearching&&<div className="palette-empty">搜索中...</div>}
          {!fileSearching&&results.length===0&&query&&<div className="palette-empty">{t.noResults}</div>}
          {mode==="commands"&&results.map((item,idx)=>{const cmd=item as Command&{score:number};return(<button key={cmd.id} className={`palette-item ${idx===selectedIdx?"selected":""}`} onMouseEnter={()=>setSelectedIdx(idx)} onClick={()=>execute(idx)}><span className="palette-item-icon"><ChevronRight size={14}/></span><span className="palette-item-label">{cmd.label}</span><span className="palette-item-category">{cmd.category}</span>{cmd.shortcut&&<span className="palette-item-shortcut">{cmd.shortcut}</span>}</button>);})}
          {mode==="files"&&results.map((item,idx)=>{const f=item as FileEntry&{score:number};return(<button key={f.path} className={`palette-item ${idx===selectedIdx?"selected":""}`} onMouseEnter={()=>setSelectedIdx(idx)} onClick={()=>execute(idx)}><span className="palette-item-icon"><File size={14}/></span><span className="palette-item-label">{f.name}</span><span className="palette-item-category">{f.path}</span></button>);})}
        </div>
        <div className="palette-footer"><span>{t.navigate}</span><span>{t.execute}</span><span>{t.escClose}</span><span>{t.cmdMode}</span></div>
      </div>
    </div>
  );
}
