import React from "react";
import "./workspace-switcher.css";

export type WorkspaceAction = { id: "platform" | "facility" | "coaching"; label: string; active: boolean; onSelect: () => void };

export default function WorkspaceSwitcher({ actions }: { actions: WorkspaceAction[] }) {
  if (!actions.length) return null;
  return <nav className="workspace-switcher" aria-label="Çalışma alanı">
    <div className="workspace-switcher-control">
      {actions.map(action => <button key={action.id} type="button" aria-pressed={action.active} onClick={action.onSelect}>{action.label}</button>)}
    </div>
  </nav>;
}
