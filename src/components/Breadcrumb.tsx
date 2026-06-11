import { ChevronRight } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

export function Breadcrumb() {
  const app = useAppContext();
  const activePath = app.activeTabPath;
  if (!activePath) return null;

  const parts = activePath.replace(/\\/g, "/").split("/");
  // Show last 4 parts max
  const display = parts.length > 4 ? ["...", ...parts.slice(-3)] : parts;

  return (
    <div className="breadcrumb-bar">
      {display.map((part, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <ChevronRight size={12} className="breadcrumb-sep" />}
          <span className={i === display.length - 1 ? "breadcrumb-last" : ""}>{part}</span>
        </span>
      ))}
    </div>
  );
}
