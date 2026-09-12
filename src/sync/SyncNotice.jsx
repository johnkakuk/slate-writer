import React from 'react';
import { useProject } from '../state/ProjectContext.jsx';

// Routine save/sync status lives in the sidebar. Keep actionable notices near
// the editor so they remain visible when the sidebar is collapsed.
export default function SyncNotice() {
  const { sync, storageError, navigate } = useProject();
  if (!storageError && !sync.error && !sync.conflicts.length && !sync.blocker) return null;
  return <div className="sync-notice" role="status">
    {storageError && <span className="sync-error">{storageError}</span>}
    {!!sync.conflicts.length && <button onClick={() => navigate('settings')}>{sync.conflicts.length} conflicting document{sync.conflicts.length === 1 ? '' : 's'} — review</button>}
    {sync.blocker && <><span>Open on {sync.blocker.deviceName}. Editing is paused here.</span><button onClick={sync.takeOver}>Continue Here</button></>}
    {sync.activeConflict && <span>Editing is paused until you choose a version in Settings.</span>}
    {sync.error && <><span>Sync needs attention.</span><button onClick={() => navigate('settings')}>Details</button></>}
  </div>;
}
