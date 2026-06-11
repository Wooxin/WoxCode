import { CircleAlert, Search, Settings, FolderTree } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useI18n } from "../i18n";

export function ActivityBar() {
  const app = useAppContext();
  const { t } = useI18n();

  const items = [
    { id: "explorer", icon: <FolderTree size={22} />, label: t.workspace },
    { id: "search", icon: <Search size={22} />, label: t.search },
    { id: "problems", icon: <CircleAlert size={22} />, label: "问题" },
  ] as const;

  return (
    <div className="activity-bar">
      <div className="activity-top">
        {items.map(item => (
          <button key={item.id} className={`activity-btn ${app.activeSidebar === item.id ? "active" : ""}`}
            onClick={() => app.setActiveSidebar(item.id)} title={item.label}>
            {item.icon}
          </button>
        ))}
      </div>
      <div className="activity-bottom">
        <button className={`activity-btn ${app.isSettingsOpen ? "active" : ""}`}
          onClick={() => app.setSettingsOpen(!app.isSettingsOpen)} title={t.settings}>
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}
