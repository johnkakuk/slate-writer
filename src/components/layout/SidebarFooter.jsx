import React, { useEffect, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { formatRelativeTime } from '../../utils/time.js';

export default function SidebarFooter() {
  const { view, navigate, lastSavedAt, storageError, sync } = useProject();
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
      <div className="sidebar-foot" role="status" aria-label="Save status">
        <div className={storageError ? 'sync-error' : undefined} title={storageError || undefined}>
          {storageError ? 'Save failed' : lastSavedAt ? `Autosaved ${formatRelativeTime(lastSavedAt)}` : 'Not yet saved'}
        </div>
        {(sync.folder || sync.error || sync.conflicts.length > 0) && (
          <button
            className={`sidebar-sync-status${sync.error || sync.conflicts.length ? ' sync-error' : ''}`}
            onClick={() => navigate('settings')}
            title={`${sync.status}. iCloud controls delivery to your other device.`}
            aria-label={`${sync.statusLabel}. Open sync settings.`}
          >
            {sync.statusLabel}
          </button>
        )}
      </div>
    </>
  );
}
