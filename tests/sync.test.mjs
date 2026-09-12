import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createLibrary, enableSync, editLibrary, checkpoint, ingest, conflicts, resolveConflict, recoverRevision, keyFor, validateRecord } from '../src/sync/model.js';
globalThis.crypto ??= webcrypto;
const scene = text => ({ type: 'doc', content: [{ type: 'action', content: [{ type: 'text', text }] }] });
const project = { id: 'p', name: 'Script', acts: [{ id: 'a', title: 'Act', cards: [{ id: 'c', title: 'One', sceneDoc: scene('Start') }, { id: 'c2', title: 'Two', sceneDoc: scene('Other') }] }], docTypes: [{ id: 't', pluralLabel: 'Notes', docs: [{ id: 'd', content: '# Note' }] }] };
const initial = () => checkpoint(enableSync(createLibrary({ p: structuredClone(project) })), 'iPad', () => 'base', 1);
const fork = library => createLibrary(structuredClone(library.projects), { ...structuredClone(library.sync), deviceId: crypto.randomUUID() });
const edit = (l, text, card = 'c', id = crypto.randomUUID()) => {
  const p = structuredClone(l.projects); p.p.acts[0].cards.find(c => c.id === card).sceneDoc = scene(text);
  return checkpoint(editLibrary(l, p), l.sync.deviceId, () => id, 2);
};
const receive = (a, b) => ingest(a, Object.values(b.sync.records));
const textAt = (l, card = 'c') => l.projects.p.acts[0].cards.find(c => c.id === card).sceneDoc.content[0].content[0].text;

test('different documents edited offline combine without conflicts', () => {
  const a = initial(), b = fork(a);
  const merged = receive(edit(a, 'iPad'), edit(b, 'Mac', 'c2'));
  assert.equal(textAt(merged), 'iPad'); assert.equal(textAt(merged, 'c2'), 'Mac'); assert.equal(conflicts(merged).length, 0);
});
test('same document diverges; both devices retain displayed writing and converge after explicit resolution', () => {
  const base = initial(), a = edit(base, 'iPad', 'c', 'ipad'), b = edit(fork(base), 'Mac', 'c', 'mac');
  const am = receive(a, b), bm = receive(b, a);
  assert.equal(textAt(am), 'iPad'); assert.equal(textAt(bm), 'Mac'); assert.equal(conflicts(am).length, 1);
  const resolved = resolveConflict(am, keyFor('p', 'scene', 'c'), 'mac', 'iPad', () => 'resolved');
  assert.equal(textAt(resolved), 'Mac'); assert.equal(conflicts(resolved).length, 0);
  assert.equal(conflicts(receive(bm, resolved)).length, 0); assert.equal(textAt(receive(bm, resolved)), 'Mac');
});
test('unsent pending edits survive relaunch and form a branch against their original parents', () => {
  const a = initial(), p = structuredClone(a.projects); p.p.acts[0].cards[0].sceneDoc = scene('Pending');
  const saved = JSON.parse(JSON.stringify(editLibrary(a, p)));
  const reopened = createLibrary(saved.projects, saved.sync);
  assert.equal(textAt(receive(checkpoint(reopened, 'iPad'), edit(fork(a), 'Remote'))), 'Pending');
  assert.equal(conflicts(receive(checkpoint(reopened, 'iPad'), edit(fork(a), 'Remote'))).length, 1);
});
test('out-of-order delivery waits for missing parents and duplicate delivery is idempotent', () => {
  const a = initial(), b = edit(a, 'First', 'c', 'first'), c = edit(b, 'Second', 'c', 'second');
  const delayed = ingest(a, [c.sync.records.second]); assert.equal(textAt(delayed), 'Start');
  const complete = ingest(delayed, [b.sync.records.first]); assert.equal(textAt(complete), 'Second');
  assert.deepEqual(ingest(complete, Object.values(c.sync.records)), complete);
});
test('partial initial library delivery never exposes a structure missing its scene documents', () => {
  const full = initial(), base = full.sync.records.base;
  const structure = { ...base, id: 'structure', changes: { [keyFor('p')]: base.changes[keyFor('p')] } };
  const docs = { ...base, id: 'docs', changes: Object.fromEntries(Object.entries(base.changes).filter(([key]) => key !== keyFor('p'))) };
  const empty = enableSync(createLibrary({}));
  const partial = ingest(empty, [structure]); assert.deepEqual(partial.projects, {});
  assert.deepEqual(ingest(partial, [docs]).projects, full.projects);
});
test('tombstones prevent stale devices from resurrecting deleted projects', () => {
  const base = initial(); const deleted = checkpoint(editLibrary(base, {}), 'iPad', () => 'delete');
  assert.deepEqual(receive(deleted, base).projects, {}); assert.deepEqual(receive(base, deleted).projects, {});
  const concurrent = receive(deleted, edit(fork(base), 'Offline writing', 'c', 'offline'));
  assert.deepEqual(concurrent.projects, {});
  assert.equal(conflicts(concurrent).length, 1);
  const recovered = recoverRevision(concurrent, keyFor('p', 'scene', 'c'), 'offline', () => 'recovery');
  assert.equal(recovered.projects.recovery.acts[0].cards[0].sceneDoc.content[0].content[0].text, 'Offline writing');
});
test('recovery reattaches a deleted scene in a separate project without altering current writing', () => {
  const base = initial(), changed = edit(base, 'Recover me', 'c', 'writing');
  const p = structuredClone(changed.projects); p.p.acts[0].cards.shift();
  const deleted = checkpoint(editLibrary(changed, p), 'iPad', () => 'delete');
  const recovered = recoverRevision(deleted, keyFor('p', 'scene', 'c'), 'writing', () => 'copy');
  assert.equal(recovered.projects.p.acts[0].cards.length, 1); assert.equal(recovered.projects.copy.acts[0].cards.length, 2);
});
test('same-value independent roots do not create a user conflict', () => {
  const a = initial(), b = checkpoint(enableSync(createLibrary(structuredClone(a.projects))), 'Mac', () => 'other');
  assert.equal(conflicts(receive(a, b)).length, 0);
});
test('revision corruption, invalid documents, and ancestry cycles cannot replace writing', () => {
  const a = initial(); assert.throws(() => ingest(a, [{ ...a.sync.records.base, deviceName: 'tampered' }]));
  assert.throws(() => validateRecord({ ...a.sync.records.base, id: '../path' }));
  const invalid = structuredClone(a.sync.records.base); invalid.changes[keyFor('p')].value.acts = [{}]; assert.throws(() => validateRecord(invalid));
  const cycle = { ...a.sync.records.base, id: 'cycle', changes: { [keyFor('p', 'scene', 'c')]: { parents: ['cycle'], value: scene('Bad') } } };
  assert.equal(textAt(ingest(a, [cycle])), 'Start');
});
test('two concurrent resolutions remain a conflict until one explicitly includes both', () => {
  const base = initial(), a = edit(base, 'A', 'c', 'a'), b = edit(fork(base), 'B', 'c', 'b'), both = receive(a, b);
  const ra = resolveConflict(both, keyFor('p', 'scene', 'c'), 'a', 'iPad', () => 'ra');
  const rb = resolveConflict(both, keyFor('p', 'scene', 'c'), 'b', 'Mac', () => 'rb');
  assert.equal(conflicts(receive(ra, rb)).length, 1);
});

test('edits after importing identical roots consume both roots without a phantom conflict', () => {
  const a = initial(), b = checkpoint(enableSync(createLibrary(structuredClone(a.projects))), 'Mac', () => 'other');
  const combined = receive(a, b);
  assert.equal(conflicts(edit(combined, 'Next')).length, 0);
  // Also covers an edit made before the equivalent genesis reached this device.
  assert.equal(conflicts(receive(edit(a, 'Next'), b)).length, 0);
});

test('long revision chains reconcile without recursive stack overflow', () => {
  const base = initial(), key = keyFor('p', 'scene', 'c');
  const records = Array.from({length:10000}, (_, i) => ({format:'slate-sync-1',id:`long-${i}`,device:'device',deviceName:'Mac',time:i,
    changes:{[key]:{parents:[i ? `long-${i-1}` : 'base'],value:scene(`Revision ${i}`)}}}));
  assert.equal(textAt(ingest(base, records)), 'Revision 9999');
});

test('legacy migration assigns identical ids on separate devices and preserves original ids', async () => {
  const {legacyRecord} = await import('../src/sync/legacy.js');
  const raw=JSON.stringify({id:'old-project',name:'Older',acts:[],characterBible:[{id:'original-doc',content:'Writing'}]});
  const migrate=p=>({...p,docTypes:[{id:crypto.randomUUID(),pluralLabel:'Notes',docs:p.characterBible}]});
  const a=await legacyRecord(raw,migrate), b=await legacyRecord(raw,migrate);
  assert.deepEqual(a,b);assert.equal(a.changes[keyFor('old-project')].value.docTypes[0].docs[0].id,'original-doc');
});

test('deleting writing before the next checkpoint retains the unsent version in history', () => {
  const base=initial(), p=structuredClone(base.projects);p.p.acts[0].cards[0].sceneDoc=scene('Just typed, then deleted');
  const pending=editLibrary(base,p), deleted=editLibrary(pending,{}), key=keyFor('p','scene','c');
  const revision=Object.values(deleted.sync.records).find(r=>r.changes[key]?.value?.content?.[0]?.content?.[0]?.text==='Just typed, then deleted');
  assert.ok(revision);
  assert.equal(recoverRevision(deleted,key,revision.id,()=> 'copy').projects.copy.acts[0].cards[0].sceneDoc.content[0].content[0].text,'Just typed, then deleted');
});

test('local web state initializes without secure-context UUID APIs', () => {
  const previous=globalThis.crypto;
  try {globalThis.crypto=undefined;assert.ok(createLibrary({}).sync.deviceId);}
  finally {globalThis.crypto=previous;}
});
