import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
if (process.platform === 'darwin') {
  mkdirSync('electron/bin', { recursive: true });
  const cache = mkdtempSync(join(tmpdir(), 'slate-swift-cache-'));
  try {
    execFileSync('xcrun', ['swiftc', '-O', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx12.0`,
      '-module-cache-path', cache, 'native/FolderSyncStore.swift', 'native/FolderSyncHelper.swift', '-o', 'electron/bin/slate-folder-sync'], { stdio: 'inherit' });
  } finally { rmSync(cache, { recursive: true, force: true }); }
}
