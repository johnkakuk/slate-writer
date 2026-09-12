import { getSyncStatus } from './status.js';
import { legacyRecord } from './legacy.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { syncTransport } from '../state/iCloudSync.js';
import { checkpoint, conflicts, enableSync, heads, ingest, recoverRevision, resolveConflict, stable, syncId, waitingForRevisions } from './model.js';

export default function useFolderSync({ library, libraryRef, publish, persist, ready, activeKey, migrateProject }) {
  const [folder, setFolder] = useState(null);
  const [phase, setPhase] = useState('disconnected');
  const [error, setError] = useState(null);
  const [leases, setLeases] = useState([]);
  const [checking, setChecking] = useState(false);
  const config = useRef({ folder: null, generation: 0, known: new Set(), present: new Set(), legacy: false, deviceName: 'This device' });
  const current = useRef({}); current.current = { publish, persist, activeKey, migrateProject };
  const busy = useRef(false), rerun = useRef(false);
  const editing = useRef({ pending: null, first: 0, last: 0 });
  if (editing.current.pending !== library.sync.pending) {
    const now = Date.now(), hasPending = Object.keys(library.sync.pending).length > 0;
    editing.current = { pending: library.sync.pending, first: hasPending ? editing.current.first || now : 0, last: now };
  }
  const claim = useRef(null);
  const [claimVersion, setClaimVersion] = useState(0);
  if (claim.current?.key !== activeKey) claim.current = { key: activeKey, session: syncId(), startedAt: Date.now(), supersedes: [] };

  const run = useCallback(async () => {
    const transport = syncTransport(), cfg = config.current;
    if (!transport) return;
    // Coalesce continuous typing; still checkpoint at least every ten seconds.
    if (document.visibilityState !== 'hidden' && editing.current.first &&
      Date.now() - editing.current.last < 750 && Date.now() - editing.current.first < 10000) return;
    if (!cfg.folder || busy.current) {
      // Recovery checkpoints continue even while disconnected or waiting on I/O.
      const local = libraryRef.current;
      if (local.sync.enabled) {
        const next = checkpoint(local, local.sync.deviceName || cfg.deviceName);
        if (next !== local) { current.current.publish(next); current.current.persist(next).catch(() => {}); }
      }
      if (busy.current) rerun.current = true;
      return;
    }
    busy.current = true; setChecking(true);
    try {
      let next = checkpoint(enableSync(libraryRef.current), cfg.deviceName);
      if (next !== libraryRef.current) current.current.publish(next);
      // Never send writing that hasn't reached the local durable store.
      await current.current.persist(next);
      if (config.current !== cfg) return;
      const visible = document.visibilityState !== 'hidden';
      const marker = { ...claim.current, device: next.sync.deviceId, deviceName: cfg.deviceName,
        key: visible ? claim.current.key : null, heartbeat: Date.now(), expiresAt: Date.now() + (visible ? 20000 : 0) };
      const records = Object.values(next.sync.records).filter(r => !cfg.present.has(r.id)).map(r => ({ id: r.id, json: stable(r) }));
      const result = await transport.exchange({ known: [...cfg.known], records, presence: marker, includeLegacy: !cfg.legacy });
      if (config.current !== cfg) return;
      const incoming = result.records.map(raw => JSON.parse(raw));
      // Capture edits made while the file provider was busy, against their original parents.
      next = checkpoint(libraryRef.current, cfg.deviceName);
      if (next !== libraryRef.current) current.current.publish(next);
      next = ingest(next, incoming);
      if (!cfg.legacy) {
        for (const raw of result.legacy ?? []) {
          const record = await legacyRecord(raw, current.current.migrateProject);
          if (!next.sync.records[record.id]) next = ingest(next, [record]);
        }
      }
      // The digest await above allows typing: reconcile any newer local checkpoint as well.
      const latest = checkpoint(libraryRef.current, cfg.deviceName);
      if (config.current !== cfg) return;
      next = ingest(latest, Object.values(next.sync.records));
      if (stable(next) !== stable(libraryRef.current)) current.current.publish(next);
      await current.current.persist(next);
      cfg.known = new Set([...cfg.known, ...incoming.map(r => r.id)]);
      cfg.present = new Set(result.present);
      cfg.legacy = true;
      setLeases((result.leases ?? []).flatMap(raw => {
        try { const lease = JSON.parse(raw); return typeof lease.device === 'string' && typeof lease.session === 'string' && Number.isFinite(lease.expiresAt) ? [lease] : []; }
        catch { return []; }
      }));
      setError(null);
      setPhase(waitingForRevisions(next) ? 'waiting' : Object.keys(next.sync.records).some(id => !cfg.present.has(id)) ? 'pending' : 'ready');
    } catch (err) {
      setError(err.message ?? String(err)); setPhase('error');
    } finally {
      busy.current = false; setChecking(false);
      if (rerun.current) { rerun.current = false; queueMicrotask(() => run()); }
    }
  }, [libraryRef]);

  const configure = useCallback(info => {
    config.current = { folder: info.folder, generation: config.current.generation + 1, known: new Set(), present: new Set(), legacy: false, deviceName: info.deviceName || 'This device' };
    setFolder(info.folder); setLeases([]); setError(null);
    setPhase(info.folder ? 'checking' : 'disconnected');
    if (info.folder) run();
  }, [run]);
  useEffect(() => {
    if (!ready || !syncTransport()) return;
    let cancelled = false;
    syncTransport().getFolder().then(info => { if (!cancelled) configure(info); }).catch(err => { if (!cancelled) setError(err.message); });
    const timer = setInterval(run, 2000);
    const wake = () => run();
    window.addEventListener('focus', wake); document.addEventListener('visibilitychange', wake);
    return () => { cancelled = true; clearInterval(timer); window.removeEventListener('focus', wake); document.removeEventListener('visibilitychange', wake); };
  }, [ready, configure, run]);
  useEffect(() => { if (ready) run(); }, [activeKey, ready, claimVersion, run]);

  const chooseFolder = useCallback(async () => {
    try { const info = await syncTransport().pickFolder(); if (!info.cancelled) configure(info); }
    catch (err) { setError(err.message); }
  }, [configure]);
  const disconnect = useCallback(async () => {
    // Invalidate any in-flight import before changing the native bookmark.
    configure({ folder: null });
    try { await syncTransport().disconnect(); } catch (err) { setError(err.message); }
  }, [configure]);
  const resolve = useCallback((key, revision, keepBoth = false, expectedHeads) => {
    try {
      let next = checkpoint(libraryRef.current, config.current.deviceName);
      if (expectedHeads && stable(heads(next.sync, key)) !== stable([...expectedHeads].sort())) throw new Error('Versions changed while you were reviewing. Review the latest versions and try again.');
      if (keepBoth) {
        const choices = conflicts(next).find(c => c.key === key)?.revisions ?? [];
        // Preserve every non-selected branch in its own recovered project.
        for (const r of choices) if (r.id !== revision && r.changes[key].value !== null) next = recoverRevision(next, key, r.id);
      }
      next = resolveConflict(next, key, revision, config.current.deviceName);
      current.current.publish(next); run();
    } catch (err) { setError(err.message); }
  }, [libraryRef, run]);
  const recover = useCallback((key, revision) => {
    try { current.current.publish(recoverRevision(libraryRef.current, key, revision)); run(); }
    catch (err) { setError(err.message); }
  }, [libraryRef, run]);
  const takeOver = useCallback(() => {
    claim.current = { ...claim.current, session: syncId(), startedAt: Date.now(),
      supersedes: leases.filter(l => l.key === activeKey).map(l => l.session) };
    setClaimVersion(v => v + 1);
  }, [leases, activeKey]);
  const now = Date.now();
  const candidates = folder && activeKey ? [...leases.filter(l => l.key === activeKey && l.device !== library.sync.deviceId && l.expiresAt > now && l.heartbeat <= now + 30000),
    { ...claim.current, device: library.sync.deviceId, deviceName: config.current.deviceName }] : [];
  const suppressed = new Set(candidates.flatMap(l => l.supersedes ?? []));
  const owner = candidates.filter(l => !suppressed.has(l.session)).sort((a, b) => a.startedAt - b.startedAt || a.device.localeCompare(b.device))[0];
  const blocker = owner && owner.device !== library.sync.deviceId ? owner : null;
  const conflictList = conflicts(library);
  const pending = !!Object.keys(library.sync.pending).length;
  const status = getSyncStatus({ phase, folder, pending, error, conflicts: conflictList });
  return { folder, status: status.message, statusLabel: status.label, error, checking, chooseFolder, disconnect, refresh: run, resolve, recover, takeOver, blocker,
    blockedKeys: leases.filter(l => l.device !== library.sync.deviceId && l.key && l.expiresAt > now &&
      !(claim.current.supersedes ?? []).includes(l.session) && (l.key !== activeKey || blocker)).map(l => l.key),
    conflicts: conflictList, activeConflict: conflictList.find(c => c.key === activeKey), library,
    remoteEpoch: library.epochs[activeKey] ?? 0,
    pending,
  };
}
