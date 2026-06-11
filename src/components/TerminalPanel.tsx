import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { listen } from "@tauri-apps/api/event";
import { X, Maximize2 } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";
import * as bridge from "../bridge";
import "@xterm/xterm/css/xterm.css";

interface TerminalPanelProps {
  onClose: () => void;
}

export function TerminalPanel({ onClose }: TerminalPanelProps) {
  const app = useAppContext();
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const startedRef = useRef(false);
  const unlistenRef = useRef<(() => void) | null>(null);

  const startTerminal = useCallback(async () => {
    if (startedRef.current || !containerRef.current) return;
    startedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: app.config?.editor_font ?? "Consolas, 'Cascadia Code', 'Courier New', monospace",
      theme: {
        background: "#1e1e1e",
        foreground: "#cccccc",
        cursor: "#ffffff",
        selectionBackground: "#264f78",
        black: "#000000",
        red: "#cd3131",
        green: "#0dbc79",
        yellow: "#e5e510",
        blue: "#2472c8",
        magenta: "#bc3fbc",
        cyan: "#11a8cd",
        white: "#e5e5e5",
        brightBlack: "#666666",
        brightRed: "#f14c4c",
        brightGreen: "#23d18b",
        brightYellow: "#f5f543",
        brightBlue: "#3b8eea",
        brightMagenta: "#d670d6",
        brightCyan: "#29b8db",
        brightWhite: "#ffffff",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.open(containerRef.current);
    fitAddon.fit();

    // Listen for terminal output from Rust
    const unlisten = await listen<string>("terminal-output", (event) => {
      if (termRef.current) {
        termRef.current.write(event.payload);
      }
    });
    unlistenRef.current = unlisten;

    // Send keystrokes to Rust
    term.onData((data) => {
      bridge.terminalWrite(data).catch(() => {});
    });

    termRef.current = term;

    // Start PTY
    const rows = term.rows;
    const cols = term.cols;
    bridge.terminalStart(rows, cols, app.projectPath).catch((e) => {
      term.write(`\r\n\x1b[31mFailed to start terminal: ${e}\x1b[0m\r\n`);
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (termRef.current) {
        bridge
          .terminalResize(termRef.current.rows, termRef.current.cols)
          .catch(() => {});
      }
    };

    window.addEventListener("resize", handleResize);

    // Observe container resize
    const observer = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
    };
  }, [app.config?.editor_font, app.projectPath]);

  useEffect(() => {
    const cleanup = startTerminal();

    return () => {
      cleanup?.then((fn) => fn?.());
      if (unlistenRef.current) unlistenRef.current();
      bridge.terminalKill().catch(() => {});
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
      startedRef.current = false;
    };
  }, [startTerminal]);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span>{t.terminal}</span>
        <div className="terminal-actions">
          <button className="icon-btn" title={t.maximize} onClick={() => fitAddonRef.current?.fit()}><Maximize2 size={14} /></button>
          <button className="icon-btn" title={t.close} onClick={onClose}><X size={14} /></button>
        </div>
      </div>
      <div className="terminal-container" ref={containerRef} />
    </div>
  );
}
