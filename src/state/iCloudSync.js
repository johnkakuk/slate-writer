// Orchestrates syncing individual projects to/from a user-chosen folder
// (typically one they've created themselves inside their own iCloud Drive)
// via `window.iCloudSync` (see electron/preload.cjs + electron/main.cjs).
// Electron-only for now -- iOS gets an equivalent native plugin later,
// exposing the same shape. Both platforms deliberately use a plain,
// user-picked folder rather than the app's own automatic iCloud
// "ubiquity container": that requires a paid Apple Developer Program
// membership this project doesn't have, where a standard folder-picker +
// security-scoped access needs no special entitlement at all. Once a file
// lands in that folder, iCloud's own daemon syncs it -- nothing here talks
// to iCloud directly.
//
// Deliberately does NOT touch ProjectContext.jsx's existing SQLite/
// localStorage save path -- that stays the fast, un-debounced, always-on
// local write, unchanged. This is a slower, debounced MIRROR layered on
// top of it, so an unconfigured or broken sync folder can never be the
// only copy of anything.

export function isICloudSyncAvailable() {
  return typeof window !== 'undefined' && !!window.iCloudSync;
}

export function getICloudFolder() {
  return isICloudSyncAvailable() ? window.iCloudSync.getFolder() : Promise.resolve(null);
}

export function pickICloudFolder() {
  return isICloudSyncAvailable() ? window.iCloudSync.pickFolder() : Promise.resolve(null);
}

export function disconnectICloudFolder() {
  return isICloudSyncAvailable() ? window.iCloudSync.disconnect() : Promise.resolve();
}

export function listSyncedProjects() {
  return isICloudSyncAvailable() ? window.iCloudSync.listProjects() : Promise.resolve([]);
}

export function readSyncedProject(id) {
  return isICloudSyncAvailable() ? window.iCloudSync.readProject(id) : Promise.resolve(null);
}

export function deleteSyncedProject(id) {
  return isICloudSyncAvailable() ? window.iCloudSync.deleteProject(id) : Promise.resolve();
}

export function subscribeToICloudChanges(callback) {
  return isICloudSyncAvailable() ? window.iCloudSync.onChanged(callback) : () => {};
}

// Per-project debounce -- the caller (ProjectContext.jsx's autosave effect)
// fires on every keystroke; a synced folder is not designed for that write
// rate. Each project's write waits until ~2s pass with no further change
// to that same project before actually touching disk.
const DEBOUNCE_MS = 2000;
const pendingTimers = new Map(); // projectId -> timeoutId

export function writeProjectDebounced(id, json) {
  if (!isICloudSyncAvailable()) return;
  clearTimeout(pendingTimers.get(id));
  pendingTimers.set(
    id,
    setTimeout(() => {
      pendingTimers.delete(id);
      window.iCloudSync.writeProject(id, json).catch((err) => console.error('iCloud project sync failed', err));
    }, DEBOUNCE_MS)
  );
}

// True while a project has a debounced write still pending -- checked
// before importing an externally-changed version of that same project, so
// an edit made seconds ago on *this* device doesn't get clobbered by an
// older version arriving from elsewhere before our own write has gone out.
export function hasPendingWrite(id) {
  return pendingTimers.has(id);
}
