import React, { useEffect, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { formatRelativeTime } from '../../utils/time.js';

export default function SidebarFooter() {
  const { view, navigate, lastSavedAt } = useProject();
  const [, forceTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="nav-settings">
        <button
          className={`nav-item${view.name === 'settings' ? ' active' : ''}`}
          onClick={() => navigate('settings')}
        >
          <span className="dot" />
          Settings
        </button>
      </div>
      <div className="sidebar-foot">Autosaved {formatRelativeTime(lastSavedAt)}</div>
    </>
  );
}
