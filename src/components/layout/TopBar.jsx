import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function TopBar() {
  const { toggleSidebar, view, navigate, project } = useProject();
  const showBack = view.name === 'editor' || view.name === 'doc';
  const backTarget = view.payload?.source === 'screenplay line' ? 'screenplay' : 'outline';

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button className="reopen-btn" onClick={toggleSidebar} title="Show menu">
          ›
        </button>
        {showBack && (
          <button className="back-btn" onClick={() => navigate(backTarget)}>
            ‹ Back
          </button>
        )}
      </div>
      <div className="topbar-title">{project.name}</div>
    </div>
  );
}
