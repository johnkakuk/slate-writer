// Electron main process. `.cjs` regardless of package.json's `"type":
// "module"` -- Electron's main process wants CommonJS, and a `.cjs`
// extension is always treated as CommonJS no matter what the nearest
// package.json says.
const { app, BrowserWindow } = require('electron');
const path = require('path');

// Named explicitly so the persisted-data directory (and therefore
// localStorage/IndexedDB) is stable across dev runs and packaged builds
// alike, rather than falling back to a generic "Electron" userData folder
// when run unpackaged.
app.setName('Slate Writer');

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
