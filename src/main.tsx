import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Disable native context menu in production
document.addEventListener("contextmenu", (e) => {
  const target = e.target as HTMLElement;
  const hasCustomMenu = target.closest(
    "[data-custom-contextmenu], .file-tree, .editor-area"
  );
  if (!hasCustomMenu) {
    e.preventDefault();
  }
});
