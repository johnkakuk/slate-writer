// Electron main process. `.cjs` regardless of package.json's `"type":
// "module"` -- Electron's main process wants CommonJS, and a `.cjs`
// extension is always treated as CommonJS no matter what the nearest
// package.json says.
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

// Named explicitly so the persisted-data directory (and therefore the
// SQLite database below) is stable across dev runs and packaged builds
// alike, rather than falling back to a generic "Electron" userData folder
// when run unpackaged.
app.setName('Slate Writer');

// State lives in a real SQLite file in the userData directory rather than
// the renderer's localStorage -- a plain file on disk survives app updates
// and is easy to back up, where a browser-engine storage backend (Chromium's
// LevelDB-based localStorage) is opaque and has occasionally been known to
// get reset by engine upgrades. `node:sqlite` is a Node built-in (bundled
// with Electron's Node runtime, Electron 41 -> Node 24), so this needs no
// native module / no rebuild-for-Electron step, unlike e.g. better-sqlite3.
// Single key-value row for now: the renderer already serializes its entire
// persisted state to one JSON blob (see ProjectContext.jsx's STORAGE_KEY) --
// storing that blob under one SQLite row keeps this a drop-in swap for
// localStorage rather than a full relational rewrite.
let db;
function getDb() {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'slate-writer.db');
    db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
  }
  return db;
}

ipcMain.on('storage:load', (event) => {
  const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get('state');
  event.returnValue = row ? row.value : null;
});

ipcMain.on('storage:save', (event, json) => {
  getDb()
    .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('state', json);
});

// User-selected folder access. The Swift helper coordinates reads/writes with
// Apple's file providers; causal revisions (in the shared JS model) handle races.
const folderSync = require('./folder-sync.cjs');
const os = require('node:os');
function getIcloudFolder() {
  return getDb().prepare('SELECT value FROM kv WHERE key = ?').get('icloudFolder')?.value || null;
}
function setIcloudFolder(folder) {
  getDb().prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('icloudFolder', folder ?? '');
}
const folderInfo = () => ({ folder: getIcloudFolder(), deviceName: os.hostname().replace(/\.local$/, '') });
ipcMain.handle('icloud:get-folder', folderInfo);
ipcMain.handle('icloud:pick-folder', async event => {
  const result = await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender), {
    properties: ['openDirectory', 'createDirectory'], title: 'Choose your Slate Writer folder in iCloud Drive',
  });
  if (result.canceled || !result.filePaths[0]) return { cancelled: true };
  setIcloudFolder(result.filePaths[0]);
  return folderInfo();
});
ipcMain.handle('icloud:disconnect', () => setIcloudFolder(null));
ipcMain.handle('icloud:exchange', (_event, request) => {
  const folder = getIcloudFolder();
  if (!folder) throw new Error('No sync folder selected');
  return folderSync.exchange({ ...request, folder });
});
ipcMain.handle('storage:save-ack', (_event, json) => {
  getDb().prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('state', json);
});
app.on('will-quit', () => folderSync.close());

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Slate Writer',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Dev: point at the running Vite dev server (hot reload). Packaged /
  // built: load the built index.html straight off disk.
  const devServerUrl = process.env.ELECTRON_START_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
