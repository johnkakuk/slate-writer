// Electron main process. `.cjs` regardless of package.json's `"type":
// "module"` -- Electron's main process wants CommonJS, and a `.cjs`
// extension is always treated as CommonJS no matter what the nearest
// package.json says.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
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
