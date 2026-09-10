import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function SidebarHeader() {
  const { toggleSidebar } = useProject();
  return (
    <div className="sidebar-h">
      <span className="brand-accent">Slate Writer</span>
      <button className="collapse-btn" onClick={toggleSidebar} title="Collapse menu">
        ‹
      </button>
    </div>
  );
}
