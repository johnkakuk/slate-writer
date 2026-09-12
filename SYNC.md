# Shared-folder sync

## Setup and switching devices

1. Install the updated iOS app and macOS Electron app. Older builds still use the old whole-project mirror; stop using that mirror when moving to this version.
2. Create a **Slate Writer** folder in iCloud Drive. In Slate’s **Settings → iCloud Sync → Choose Folder**, select that same folder on both devices. On iPad, use the Files picker’s iCloud Drive location.
3. Leave both apps open for the first exchange. Connecting combines existing local projects with the folder’s library. Existing `.slatewriter` files are imported without modifying them. Different versions of a document require a choice in Settings.
4. Before switching devices, allow the source to finish writing to its folder. On the destination, open Slate and use **Check for Changes** if needed. Apple controls delivery; Slate cannot force an upload or promise instant arrival.

Local SQLite autosave remains active regardless of folder availability. The sidebar footer combines autosave with a compact sync status. “Folder up to date” confirms local folder writes only, not receipt by the other device; tap it to open full details in Settings. Only errors, conflicts, and editing guards show a notice above the editor. The ordinary web/PWA build remains local; it does not get iCloud folder access.

When another device reports that a document is open, editing is paused. **Continue Here** takes over explicitly. These warnings are advisory: delayed iCloud delivery, offline use, and clock differences prevent a guaranteed distributed lock. Close the document or leave Slate on the source device when handing off. Presence expires after 20 seconds without a heartbeat.

## Conflicts and recovery

Scenes and Markdown documents sync separately; outline order, card metadata, document folders, and title-page fields share a project-details revision. Changes to separate scenes can combine automatically. Competing edits to one entity retain the currently displayed version and show a conflict notice. Settings offers previews and **Use This Version**, or **Use This and Keep Both**, which also makes recovered project copies of the other branches.

**Settings → Recovery history** includes deleted writing. Recovering creates a separate project and leaves current writing in place. History begins when folder sync is first enabled. Deletions are recorded as tombstones, so a stale device cannot silently resurrect them. An offline edit racing a deletion remains available in history/conflict recovery.

Local revision history is kept in the SQLite state; copies also live in the chosen folder. There is no automatic pruning in this first version. Do not edit or remove the revision files by hand. For an independent backup, copy the sync folder or the app’s SQLite database while the app is closed. Disconnecting retains writing and history locally and leaves the chosen folder untouched.

## Implementation

- `src/sync/model.js`: pure causal revision model. A transaction contains independent entity changes, each with parent revision ids and either a payload or a tombstone. Timestamps label history and presence; they never decide which writing wins.
- `src/sync/useFolderSync.js`: serialized exchange loop, polling every two seconds and on foreground/view changes. Typing is coalesced until a short pause, with a ten-second maximum checkpoint interval. Local pending changes retain their original parents across relaunches. Checkpoints must reach local storage before publication.
- `ProjectContext.jsx`: projects and sync journal share one persisted snapshot. Local writes are serialized and errors surface in the UI. Incoming revisions checkpoint any concurrent local edits before reconciliation. Active editors remount only when incoming content changes their document.
- `native/FolderSyncStore.swift`: common coordinated file operations for both platforms. Unique immutable JSON transactions live in `Slate Revisions/`; per-device advisory presence files live in `Slate Devices/`. Missing parents and incomplete projects wait for later delivery. Provider conflict versions are read as additional input; malformed or modified revisions stop the exchange with an error while local writing stays intact.
- `ios/App/App/FolderSyncPlugin.swift`: Capacitor plugin, directory picker, persisted security-scoped bookmark, balanced access, and a serial worker queue. No app-specific iCloud container is required.
- `electron/folder-sync.cjs`: serial bridge to the small Swift helper. `npm run sync:helper` compiles it for the build machine. Electron packaging keeps it outside ASAR so it can run as a child process.

Apple documents [directory access and security-scoped bookmarks](https://developer.apple.com/documentation/uikit/providing-access-to-directories) and [file coordination](https://developer.apple.com/documentation/foundation/nsfilecoordinator). Electron documents the [ASAR executable restrictions](https://www.electronjs.org/docs/latest/tutorial/asar-archives).

The first release targets iPad/iPhone and macOS. The desktop helper is compiled for the host architecture; build on the matching architecture when packaging an Intel Mac version. Revision history can grow substantially during long writing sessions; compaction needs a separate design that preserves offline-device ancestry.

## Validation

```sh
node --test tests/*.test.mjs
npm run build
npm run sync:helper
node tests/sync-native.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/sync.electron.mjs
```

The Electron integration test requires macOS, Python 3, and Playwright. It creates fresh profiles and separate scratch folders under `/private/tmp`, verifies the running user-data paths, edits through the UI, simulates delayed replication, resolves a conflict with Keep Both, reconnects to a common folder, and checks advisory takeover and live editor refresh. It never opens the real writing profile. To test a packaged build, additionally set `SLATE_ELECTRON_EXECUTABLE` to its `Contents/MacOS/Slate Writer` executable.

Validation on September 12, 2026: 46 unit/regression tests passed; the real Swift helper passed coordinated file-operation checks; two isolated Electron instances, including the signed packaged build, passed conflict recovery and takeover; the iOS simulator passed native plugin registration, folder selection, exchange, and bookmark restoration after termination/relaunch. The signed physical-device iOS build also compiled successfully.

The pure tests cover concurrent edits, unsent changes surviving relaunch, duplicate and out-of-order delivery, incomplete project arrival, tombstones, deleted-scene recovery, matching independent roots, invalid revisions, and racing conflict resolutions.

A successful local folder test does not measure Apple’s real iCloud delivery time. Complete the first real iPad-to-Mac handoff with a small identifiable edit after selecting the same folder on both devices.
