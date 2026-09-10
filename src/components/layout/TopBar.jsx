import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function TopBar() {
  const { toggleSidebar, showToast, view, navigate } = useProject();
  const showBack = view.name === 'editor';
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
      <button className="export-btn" onClick={() => showToast('Export PDF isn’t wired up yet')}>
        Export PDF
      </button>
    </div>
  );
}
