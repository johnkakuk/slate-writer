// Bridges the renderer to the main process's SQLite-backed storage (see
// main.cjs) without handing the renderer raw Node/IPC access -- contextBridge
// exposes just the two calls it needs under `window.slateStorage`. `loadSync`
// is a blocking IPC round-trip (SQLite reads are fast enough that this is
// fine) so ProjectContext.jsx can keep reading persisted state synchronously
// in its initial useState initializer, same as it did with localStorage.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('slateStorage', {
  loadSync: () => ipcRenderer.sendSync('storage:load'),
  save: (json) => ipcRenderer.invoke('storage:save-ack', json),
});

if (process.platform === 'darwin') contextBridge.exposeInMainWorld('iCloudSync', {
  pickFolder: () => ipcRenderer.invoke('icloud:pick-folder'),
  getFolder: () => ipcRenderer.invoke('icloud:get-folder'),
  disconnect: () => ipcRenderer.invoke('icloud:disconnect'),
  exchange: (request) => ipcRenderer.invoke('icloud:exchange', request),
});
