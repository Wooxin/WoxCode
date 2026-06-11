// ── File icon mapping with colors ──

const iconMap: Record<string, { label: string; color: string }> = {
  ts: { label: "TS", color: "#3178c6" },
  tsx: { label: "TSX", color: "#3178c6" },
  js: { label: "JS", color: "#f7df1e" },
  jsx: { label: "JSX", color: "#61dafb" },
  rs: { label: "RS", color: "#dea584" },
  py: { label: "PY", color: "#3776ab" },
  go: { label: "GO", color: "#00add8" },
  java: { label: "JV", color: "#b07219" },
  html: { label: "H", color: "#e34c26" },
  css: { label: "C", color: "#563d7c" },
  scss: { label: "SC", color: "#c6538c" },
  json: { label: "{}", color: "#f0b000" },
  md: { label: "M", color: "#6c8ebf" },
  yml: { label: "Y", color: "#cb171e" },
  yaml: { label: "Y", color: "#cb171e" },
  toml: { label: "T", color: "#9c4221" },
  svg: { label: "SV", color: "#ffb13b" },
  xml: { label: "X", color: "#e34c26" },
  lock: { label: "🔒", color: "#8b949e" },
  gitignore: { label: "G", color: "#f05033" },
  c: { label: "C", color: "#555" },
  cpp: { label: "C++", color: "#f34b7d" },
  h: { label: "H", color: "#555" },
  hpp: { label: "H", color: "#f34b7d" },
};

export function getFileIcon(ext: string): { label: string; color: string } {
  return iconMap[ext] ?? { label: ext.slice(0, 2).toUpperCase() || "?", color: "#8b949e" };
}

export function FileIcon({ ext, size = 16 }: { ext: string; size?: number }) {
  const { label, color } = getFileIcon(ext);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: size + 4, height: size + 4, flexShrink: 0,
      fontSize: size < 14 ? 8 : size < 18 ? 10 : 11,
      fontWeight: 700, fontFamily: "monospace",
      color: "#fff", backgroundColor: color,
      borderRadius: 3, letterSpacing: -0.5,
    }}>
      {label}
    </span>
  );
}
