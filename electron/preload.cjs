// Bridges the renderer to the main process's SQLite-backed storage (see
// main.cjs) without handing the renderer raw Node/IPC access -- contextBridge
// exposes just the two calls it needs under `window.slateStorage`. `loadSync`
// is a blocking IPC round-trip (SQLite reads are fast enough that this is
// fine) so ProjectContext.jsx can keep reading persisted state synchronously
// in its initial useState initializer, same as it did with localStorage.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slateStorage', {
  loadSync: () => ipcRenderer.sendSync('storage:load'),
  save: (json) => ipcRenderer.send('storage:save', json),
});

// See main.cjs for the actual iCloud-folder-sync implementation -- this is
// just the renderer-facing bridge, one call per IPC handler registered
// there. `onChanged` returns an unsubscribe function since, unlike the two
// bridges above, this one is a persistent listener rather than a one-shot
// call.
contextBridge.exposeInMainWorld('iCloudSync', {
  pickFolder: () => ipcRenderer.invoke('icloud:pick-folder'),
  getFolder: () => ipcRenderer.invoke('icloud:get-folder'),
  disconnect: () => ipcRenderer.invoke('icloud:disconnect'),
  writeProject: (id, json) => ipcRenderer.invoke('icloud:write-project', id, json),
  readProject: (id) => ipcRenderer.invoke('icloud:read-project', id),
  listProjects: () => ipcRenderer.invoke('icloud:list-projects'),
  deleteProject: (id) => ipcRenderer.invoke('icloud:delete-project', id),
  onChanged: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('icloud:changed', listener);
    return () => ipcRenderer.removeListener('icloud:changed', listener);
  },
});
