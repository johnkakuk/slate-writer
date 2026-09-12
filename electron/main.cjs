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

// iCloud sync: the user explicitly picks a plain folder (typically one
// they've created themselves inside their own iCloud Drive) to mirror
// project files into. Deliberately NOT the app's own iCloud "ubiquity
// container" -- that requires a paid Apple Developer Program membership
// neither this app nor its iOS counterpart has. A folder the user already
// has iCloud-syncing, plus one JSON file per project written here with a
// plain fs write, needs no entitlement at all and gets synced by iCloud's
// own daemon exactly like any other file dropped into that folder --
// this process never talks to iCloud directly. Reuses the same `kv` table
// as the main state blob above, just a different key, to remember which
// folder was chosen across launches.
function getIcloudFolder() {
  const row = getDb().prepare('SELECT value FROM kv WHERE key = ?').get('icloudFolder');
  return row?.value || null;
}

function setIcloudFolder(folderPath) {
  getDb()
    .prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('icloudFolder', folderPath ?? '');
}

const PROJECT_FILE_RE = /^([^.].+)\.slatewriter$/;
let icloudWatcher = null;
// Filenames this process itself just wrote, briefly ignored by the watcher
// below -- otherwise our own debounced write would round-trip back to the
// renderer as "the other device changed this," triggering a pointless
// (if harmless, since the content matches) re-import.
const recentlyWrittenFiles = new Map(); // filename -> timeoutId

function markRecentlyWritten(filename) {
  clearTimeout(recentlyWrittenFiles.get(filename));
  recentlyWrittenFiles.set(
    filename,
    setTimeout(() => recentlyWrittenFiles.delete(filename), 1500)
  );
}

function watchIcloudFolder(win, folderPath) {
  if (icloudWatcher) {
    icloudWatcher.close();
    icloudWatcher = null;
  }
  if (!folderPath) return;
  try {
    icloudWatcher = fs.watch(folderPath, { persistent: false }, (_eventType, filename) => {
      if (!filename) return;
      const match = filename.match(PROJECT_FILE_RE);
      if (!match || recentlyWrittenFiles.has(filename)) return;
      win.webContents.send('icloud:changed', { id: match[1] });
    });
  } catch (err) {
    console.error('Failed to watch iCloud sync folder', err);
  }
}

ipcMain.handle('icloud:pick-folder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose a folder to sync Slate Writer projects (e.g. one inside iCloud Drive)',
  });
  if (result.canceled || !result.filePaths[0]) return getIcloudFolder();
  const folderPath = result.filePaths[0];
  setIcloudFolder(folderPath);
  watchIcloudFolder(win, folderPath);
  return folderPath;
});

ipcMain.handle('icloud:get-folder', (event) => {
  const folderPath = getIcloudFolder();
  if (folderPath) watchIcloudFolder(BrowserWindow.fromWebContents(event.sender), folderPath);
  return folderPath;
});

ipcMain.handle('icloud:disconnect', () => {
  setIcloudFolder(null);
  if (icloudWatcher) {
    icloudWatcher.close();
    icloudWatcher = null;
  }
});

ipcMain.handle('icloud:write-project', async (_event, id, json) => {
  const folderPath = getIcloudFolder();
  if (!folderPath) return;
  const filename = `${id}.slatewriter`;
  const tmpFilename = `.${filename}.tmp`;
  markRecentlyWritten(filename);
  // Write to a temp file then rename -- an atomic swap on the same
  // filesystem, so a reader (including iCloud's own sync daemon picking
  // the file up mid-write) never sees a half-written file.
  await fs.promises.writeFile(path.join(folderPath, tmpFilename), json, 'utf8');
  await fs.promises.rename(path.join(folderPath, tmpFilename), path.join(folderPath, filename));
});

ipcMain.handle('icloud:read-project', async (_event, id) => {
  const folderPath = getIcloudFolder();
  if (!folderPath) return null;
  try {
    return await fs.promises.readFile(path.join(folderPath, `${id}.slatewriter`), 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('icloud:list-projects', async () => {
  const folderPath = getIcloudFolder();
  if (!folderPath) return [];
  let entries;
  try {
    entries = await fs.promises.readdir(folderPath);
  } catch {
    return [];
  }
  const results = [];
  for (const entry of entries) {
    const match = entry.match(PROJECT_FILE_RE);
    if (!match) continue;
    try {
      const stat = await fs.promises.stat(path.join(folderPath, entry));
      results.push({ id: match[1], mtimeMs: stat.mtimeMs });
    } catch {
      // Unreadable entry (permissions, mid-delete) -- skip it.
    }
  }
  return results;
});

ipcMain.handle('icloud:delete-project', async (_event, id) => {
  const folderPath = getIcloudFolder();
  if (!folderPath) return;
  try {
    await fs.promises.unlink(path.join(folderPath, `${id}.slatewriter`));
  } catch {
    // Already gone -- fine.
  }
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
