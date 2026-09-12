import { Capacitor } from '@capacitor/core';
import React, { useState } from 'react';
import { useProject } from '../state/ProjectContext.jsx';
import { entityLabel } from './model.js';

function preview(value) {
  if (value === null) return 'Deleted';
  if (typeof value === 'string') return value;
  if (value.type === 'doc') return value.content.map(n => (n.content ?? []).map(c => c.text ?? '').join('')).join('\n');
  return [value.name, ...value.acts.flatMap(a => [a.title, ...a.cards.map(c => `  ${c.title}`)]),
    ...value.docTypes.map(t => t.pluralLabel)].join('\n');
}
function Revision({ revision, entityKey, children }) {
  return <div className="sync-revision">
    <div><strong>{revision.deviceName}</strong> · {revision.time ? new Date(revision.time).toLocaleString() : 'Imported file'}</div>
    <details><summary>Preview {revision.changes[entityKey].value === null ? 'deletion' : 'writing'}</summary>
      <pre>{preview(revision.changes[entityKey].value)}</pre></details>
    <div className="settings-icloud-row">{children}</div>
  </div>;
}
export default function SyncSettings() {
  const { sync, iCloudSyncSupported } = useProject();
  const [selectedKey, setSelectedKey] = useState('');
  const [limit, setLimit] = useState(20);
  const records = Object.values(sync.library.sync.records).sort((a, b) => b.time - a.time || a.id.localeCompare(b.id));
  const keys = [...new Set(records.flatMap(r => Object.keys(r.changes)))];
  const history = records.filter(r => r.changes[selectedKey]?.value != null);
  const exportArchive = () => {
    const blob = new Blob([JSON.stringify({ format: 'slate-recovery-1', projects: sync.library.projects, sync: sync.library.sync }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `Slate-recovery-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  if (!iCloudSyncSupported && !records.length) return null;
  return <div className="settings-section sync-settings">
    <div className="settings-section-label">iCloud Sync</div>
    <p className="settings-field-hint">Choose the same Slate Writer folder in iCloud Drive on your iPad and Mac. Connecting combines this device’s projects with the folder’s library. Existing writing and older project files are retained.</p>
    {iCloudSyncSupported && <div className="settings-icloud-row">
      <button className="settings-btn" onClick={sync.chooseFolder}>{sync.folder ? 'Change Folder…' : 'Choose Folder…'}</button>
      {sync.folder && <><button className="settings-btn" onClick={sync.refresh} disabled={sync.checking}>Check for Changes</button>
        <button className="settings-btn settings-btn-quiet" onClick={sync.disconnect}>Disconnect</button></>}
    </div>}
    <p className="settings-field-hint" role="status">{sync.status}</p>
    {sync.folder && <p className="settings-field-hint sync-folder">Folder: {sync.folder}</p>}
    {sync.error && <p className="sync-error" role="alert">{sync.error}</p>}
    <p className="settings-field-hint">iCloud controls delivery to your other device. “Folder up to date” confirms this device’s folder only. Before switching devices, let this one finish saving, then check for changes on the other. Editing warnings are advisory and may arrive late; offline edits are preserved as separate versions.</p>
    {sync.conflicts.map(conflict => <section className="sync-conflict" key={conflict.key}>
      <h3>Choose a version</h3><p>{entityLabel(sync.library, conflict.key)}</p>
      <p className="settings-field-hint">Both devices changed this document. Choosing a version retains the others in recovery history. Keep Both also creates recovered project copies for the other versions.</p>
      {conflict.revisions.map(r => <Revision key={r.id} revision={r} entityKey={conflict.key}>
        <button className="settings-btn" onClick={() => sync.resolve(conflict.key, r.id, false, conflict.revisions.map(v => v.id))}>Use This Version</button>
        <button className="settings-btn" onClick={() => sync.resolve(conflict.key, r.id, true, conflict.revisions.map(v => v.id))}>Use This and Keep Both</button>
      </Revision>)}
    </section>)}
    {records.length > 0 && <details className="sync-history"><summary>Recovery history (including deleted writing)</summary>
      <p className="settings-field-hint">Recover creates a separate project; your current writing stays in place. History is kept locally and in the chosen folder, with no automatic pruning.</p>
      <label>Document <select value={selectedKey} onChange={e => { setSelectedKey(e.target.value); setLimit(20); }}>
        <option value="">Choose a document…</option>{keys.map(key => <option key={key} value={key}>{entityLabel(sync.library, key)}</option>)}
      </select></label>
      {history.slice(0, limit).map(r => <Revision key={r.id} revision={r} entityKey={selectedKey}>
        <button className="settings-btn" onClick={() => sync.recover(selectedKey, r.id)}>Recover as Separate Project</button>
      </Revision>)}
      {history.length > limit && <button className="settings-btn" onClick={() => setLimit(v => v + 20)}>Show More</button>}
      {!Capacitor.isNativePlatform() && <button className="settings-btn" onClick={exportArchive}>Export Recovery Archive</button>}
    </details>}
  </div>;
}
