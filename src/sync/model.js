import { generateId } from '../utils/id.js';
import { Node } from 'prosemirror-model';
import { schema } from '../editor/schema.js';

// Immutable revision transactions. Parent ids, never clocks, decide ancestry.
// This module has no I/O: projects and their sync journal persist in one SQLite row.
export const keyFor = (project, kind = 'project', id) => JSON.stringify(id ? [project, kind, id] : [project, kind]);
export const stable = (value) => JSON.stringify(value, (_key, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v);
const equal = (a, b) => stable(a) === stable(b);
export const syncId = () => generateId('sync');
const uuid = syncId;
export function flatten(projects) {
  const entities = {};
  for (const p of Object.values(projects)) {
    entities[keyFor(p.id)] = { ...p,
      acts: p.acts.map(a => ({ ...a, cards: a.cards.map(({ sceneDoc, ...c }) => {
        entities[keyFor(p.id, 'scene', c.id)] = sceneDoc ?? { type: 'doc', content: [] };
        return c;
      }) })),
      docTypes: p.docTypes.map(t => ({ ...t, docs: t.docs.map(({ content, ...d }) => {
        entities[keyFor(p.id, 'doc', d.id)] = content ?? ''; return d;
      }) })),
    };
  }
  return entities;
}
export function createLibrary(projects, saved) {
  return { projects, sync: saved?.version === 1 ? saved : {
    version: 1, deviceId: uuid(), enabled: false, records: {}, applied: {}, pending: {},
  }, epochs: {} };
}
export function heads(sync, key) {
  const ids = Object.keys(sync.records).filter(id => sync.records[id].changes[key]);
  const superseded = new Set(ids.flatMap(id => sync.records[id].changes[key].parents));
  // Two devices can connect copies of the same legacy library independently.
  // Identical genesis states are interchangeable parents, not competing edits.
  const roots = ids.filter(id => !sync.records[id].changes[key].parents.length);
  for (const id of roots) if (superseded.has(id)) {
    for (const other of roots) if (equal(sync.records[id].changes[key].value, sync.records[other].changes[key].value)) superseded.add(other);
  }
  return ids.filter(id => !superseded.has(id)).sort();
}
function complete(sync, key) {
  const visiting = new Set(), checked = new Set();
  const stack = heads(sync, key).map(id => ({ id, exit: false }));
  while (stack.length) {
    const { id, exit } = stack.pop();
    if (exit) { visiting.delete(id); checked.add(id); continue; }
    if (checked.has(id)) continue;
    const change = sync.records[id]?.changes[key];
    if (visiting.has(id) || !change) return false;
    visiting.add(id); stack.push({ id, exit: true });
    for (const parent of change.parents) stack.push({ id: parent, exit: false });
  }
  return true;
}
export function editLibrary(library, projects) {
  if (!library.sync.enabled) return { ...library, projects };
  const before = flatten(library.projects), after = flatten(projects);
  // Preserve the most recent writing even if it is deleted before the next
  // checkpoint, or while the folder provider is offline.
  if (Object.keys(before).some(key => !(key in after) && library.sync.pending[key]?.value != null)) {
    library = checkpoint(library, library.sync.deviceName || 'This device');
  }
  const pending = { ...library.sync.pending };
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const value = after[key] ?? null;
    if (equal(before[key] ?? null, value)) continue;
    const tips = heads(library.sync, key);
    const parents = tips.length && tips.every(id => equal(library.sync.records[id].changes[key].value, before[key] ?? null))
      ? tips : library.sync.applied[key] ? [library.sync.applied[key]] : [];
    pending[key] = { parents: pending[key]?.parents ?? parents, value };
  }
  return { ...library, projects, sync: { ...library.sync, pending } };
}
export function enableSync(library) {
  if (library.sync.enabled) return library;
  const pending = Object.fromEntries(Object.entries(flatten(library.projects)).map(([key, value]) => [key, { parents: [], value }]));
  return { ...library, sync: { ...library.sync, enabled: true, pending } };
}
export function checkpoint(library, deviceName, newId = uuid, now = Date.now()) {
  if (!Object.keys(library.sync.pending).length) return library;
  const id = newId();
  const record = { format: 'slate-sync-1', id, device: library.sync.deviceId, deviceName, time: now, changes: library.sync.pending };
  return { ...library, sync: { ...library.sync,
    deviceName, records: { ...library.sync.records, [id]: record },
    applied: { ...library.sync.applied, ...Object.fromEntries(Object.keys(record.changes).map(key => [key, id])) }, pending: {},
  } };
}
export function validateRecord(record) {
  if (!record || record.format !== 'slate-sync-1' || (!/^[\w-]{1,100}$/.test(record.id) || ['__proto__', 'constructor', 'prototype'].includes(record.id)) ||
    typeof record.device !== 'string' || typeof record.deviceName !== 'string' || !Number.isFinite(record.time) ||
    !record.changes || Array.isArray(record.changes) || typeof record.changes !== 'object') throw new Error('Unrecognized sync revision');
  for (const [key, change] of Object.entries(record.changes)) {
    const parts = JSON.parse(key);
    if (!Array.isArray(parts) || ![2, 3].includes(parts.length) || !parts.every(p => typeof p === 'string' && p.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(p)) ||
      (!['project', 'scene', 'doc'].includes(parts[1]) || parts.length !== (parts[1] === 'project' ? 2 : 3)) || !Array.isArray(change.parents) ||
      !change.parents.every(p => typeof p === 'string' && /^[\w-]{1,100}$/.test(p)) || !Object.hasOwn(change, 'value')) throw new Error('Invalid sync revision');
    const v = change.value;
    if (v !== null && ((parts[1] === 'project' && (v.id !== parts[0] || !Array.isArray(v.acts) || !Array.isArray(v.docTypes) ||
      !v.acts.every(a => typeof a.id === 'string' && Array.isArray(a.cards) && a.cards.every(c => typeof c.id === 'string')) ||
      !v.docTypes.every(t => typeof t.id === 'string' && Array.isArray(t.docs) && t.docs.every(d => typeof d.id === 'string')))) ||
      (parts[1] === 'scene' && (v.type !== 'doc' || !Array.isArray(v.content))) || (parts[1] === 'doc' && typeof v !== 'string'))) throw new Error('Invalid document in sync revision');
    if (v !== null && parts[1] === 'scene') Node.fromJSON(schema, v).check();
  }
  return record;
}
function buildProject(id, entities) {
  const p = entities[keyFor(id)];
  if (!p) return p;
  let missing = false;
  const result = { ...p, acts: p.acts.map(a => ({ ...a, cards: a.cards.map(c => {
    const sceneDoc = entities[keyFor(id, 'scene', c.id)]; if (sceneDoc == null) missing = true;
    return { ...c, sceneDoc };
  }) })), docTypes: p.docTypes.map(t => ({ ...t, docs: t.docs.map(d => {
    const content = entities[keyFor(id, 'doc', d.id)]; if (content == null) missing = true;
    return { ...d, content };
  }) })) };
  return missing ? undefined : result;
}
export function ingest(library, records) {
  if (Object.keys(library.sync.pending).length) throw new Error('Checkpoint local changes before receiving revisions');
  const all = { ...library.sync.records };
  for (const record of records) {
    validateRecord(record);
    if (all[record.id] && !equal(all[record.id], record)) throw new Error('A sync revision was modified. Original retained locally.');
    all[record.id] = record;
  }
  const sync = { ...library.sync, records: all, applied: { ...library.sync.applied } };
  const before = flatten(library.projects), entities = { ...before }, candidates = {};
  const keys = new Set(Object.values(all).flatMap(r => Object.keys(r.changes)));
  for (const key of keys) {
    if (!complete(sync, key)) continue; // iCloud may deliver children before their parents.
    const tips = heads(sync, key);
    if (!tips.length) continue;
    const same = tips.every(id => equal(all[id].changes[key].value, all[tips[0]].changes[key].value));
    // A conflict keeps the currently displayed version; never choose by timestamp.
    const chosen = same || tips.length === 1 ? tips[0] : sync.applied[key] ?? tips[0];
    candidates[key] = chosen;
    entities[key] = all[chosen].changes[key].value;
  }
  const projects = { ...library.projects }, epochs = { ...library.epochs };
  for (const id of new Set([...Object.keys(projects), ...[...keys].map(k => JSON.parse(k)[0])])) {
    const built = buildProject(id, entities);
    if (built === undefined) continue; // Keep the complete local project until all its documents arrive.
    if (!equal(projects[id] ?? null, built)) {
      if (built === null) delete projects[id]; else projects[id] = built;
      for (const key of keys) if (JSON.parse(key)[0] === id && !equal(before[key] ?? null, entities[key] ?? null)) epochs[key] = (epochs[key] ?? 0) + 1;
    }
    for (const [key, chosen] of Object.entries(candidates)) if (JSON.parse(key)[0] === id) sync.applied[key] = chosen;
  }
  return { ...library, projects, sync, epochs };
}
export function conflicts(library) {
  const keys = new Set(Object.values(library.sync.records).flatMap(r => Object.keys(r.changes)));
  return [...keys].flatMap(key => {
    const tips = heads(library.sync, key);
    if (tips.length < 2 || !complete(library.sync, key)) return [];
    if (tips.every(id => equal(library.sync.records[id].changes[key].value, library.sync.records[tips[0]].changes[key].value))) return [];
    return [{ key, revisions: tips.map(id => library.sync.records[id]) }];
  });
}
export function resolveConflict(library, key, revisionId, deviceName, newId = uuid) {
  const value = library.sync.records[revisionId]?.changes[key]?.value;
  if (value === undefined) throw new Error('Revision unavailable');
  const pending = { ...library.sync.pending, [key]: { parents: heads(library.sync, key), value } };
  return ingest(checkpoint({ ...library, sync: { ...library.sync, pending } }, deviceName, newId), []);
}
// Recovery always creates a separate project. Even deleted/orphaned documents remain recoverable.
export function recoverRevision(library, key, revisionId, newId = uuid) {
  const originalId = JSON.parse(key)[0];
  const entities = {};
  const ordered = Object.values(library.sync.records).sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
  for (const r of ordered) for (const [k, change] of Object.entries(r.changes)) if (JSON.parse(k)[0] === originalId && change.value !== null) entities[k] = change.value;
  const chosen = library.sync.records[revisionId]?.changes[key]?.value;
  if (chosen === null || chosen === undefined) throw new Error('Choose a revision containing writing to recover');
  entities[key] = chosen;
  // Reattach a scene/note removed from the newest project structure.
  if (JSON.parse(key)[1] !== 'project') {
    const [, kind, docId] = JSON.parse(key);
    const meta = entities[keyFor(originalId)];
    const included = kind === 'scene' ? meta?.acts.some(a => a.cards.some(c => c.id === docId)) : meta?.docTypes.some(t => t.docs.some(d => d.id === docId));
    if (!included) {
      const containing = [...ordered].reverse().map(r => r.changes[keyFor(originalId)]?.value).find(p => p && (kind === 'scene' ? p.acts.some(a => a.cards.some(c => c.id === docId)) : p.docTypes.some(t => t.docs.some(d => d.id === docId))));
      if (containing) entities[keyFor(originalId)] = containing;
    }
  }
  const project = buildProject(originalId, entities);
  if (!project) throw new Error('Some project revisions have not downloaded yet');
  const id = newId();
  return editLibrary(library, { ...library.projects, [id]: { ...project, id, name: `${project.name} (Recovered)` } });
}
export function entityLabel(library, key) {
  const [id, kind, docId] = JSON.parse(key);
  const p = library.projects[id];
  if (kind === 'project') return `${p?.name ?? 'Deleted project'} — outline and project details`;
  const card = p?.acts.flatMap(a => a.cards).find(c => c.id === docId);
  const doc = p?.docTypes.flatMap(t => t.docs).find(d => d.id === docId);
  return `${p?.name ?? 'Deleted project'} — ${card?.title ?? doc?.content?.split('\n').find(Boolean)?.replace(/^#+\s*/, '') ?? (kind === 'scene' ? 'Scene' : 'Note')}`;
}

export function waitingForRevisions(library) {
  const sync = library.sync;
  const keys = new Set(Object.values(sync.records).flatMap(r => Object.keys(r.changes)));
  return [...keys].some(key => !complete(sync, key) || !sync.applied[key]);
}
