import { checkpoint, createLibrary, enableSync, stable } from './model.js';

// Old migrations generated ids for newly introduced folders/empty blocks. Make
// those ids deterministic so two devices importing the same file agree exactly.
export async function legacyRecord(raw, migrate) {
  const original = JSON.parse(raw);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(original)));
  const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  const originalIds = new Set();
  function collect(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.id === 'string') originalIds.add(value.id);
    Object.values(value).forEach(collect);
  }
  collect(original);
  let sequence = 0;
  function normalize(value) {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).sort().map(key => [key,
      key === 'id' && typeof value[key] === 'string' && !originalIds.has(value[key])
        ? `legacy-${hash.slice(0, 20)}-${sequence++}` : normalize(value[key])]));
  }
  const project = normalize(migrate(original));
  if (!project?.id || !Array.isArray(project.acts) || !Array.isArray(project.docTypes)) throw new Error('An older project file could not be imported. Original retained.');
  const id = 'legacy-' + hash;
  const library = checkpoint(enableSync(createLibrary({ [project.id]: project })), 'Older Slate file', () => id, 0);
  return { ...library.sync.records[id], device: 'legacy-import' };
}
