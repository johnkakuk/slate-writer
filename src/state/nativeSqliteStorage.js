// SQLite-backed persistence for the Capacitor iOS build, mirroring the
// Electron build's approach (see electron/main.cjs) so both native builds
// get the same durability: a real on-disk SQLite file instead of the
// WebView's localStorage, which iOS can clear under storage pressure and
// which isn't as easy to back up or inspect. Same single-row key-value
// shape as the Electron store, so ProjectContext.jsx's migration chain and
// persisted-blob format stay identical across every platform -- only where
// the blob is physically stored differs.
//
// Unlike Electron's synchronous `sendSync` IPC bridge, Capacitor's plugin
// bridge is inherently async (message-passing over the WebView bridge, no
// blocking equivalent) -- see ProjectContext.jsx's native bootstrap effect
// for how the provider accommodates that instead of reading this
// synchronously in a useState initializer the way the web/Electron paths do.
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';

const DB_NAME = 'slate_writer';

let dbPromise = null;

async function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      // A connection can already exist across hot reloads / re-entrant
      // calls during the same app session -- creating a second one for the
      // same database name throws, so check first and reuse it.
      const { result: alreadyOpen } = await sqlite.isConnection(DB_NAME, false);
      const db = alreadyOpen
        ? await sqlite.retrieveConnection(DB_NAME, false)
        : await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
      await db.open();
      await db.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)');
      return db;
    })();
  }
  return dbPromise;
}

export async function loadNativeState() {
  const db = await getDb();
  const result = await db.query('SELECT value FROM kv WHERE key = ?', ['state']);
  const row = result.values?.[0];
  return row ? row.value : null;
}

export async function saveNativeState(json) {
  const db = await getDb();
  await db.run(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    ['state', json]
  );
}
