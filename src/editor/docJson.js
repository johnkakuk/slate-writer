// Plain-JSON helpers for the screenplay document, deliberately free of any
// ProseMirror runtime import — the app-state layer (ProjectContext) only
// ever needs to read/append serialized doc JSON, never construct real
// ProseMirror Node instances.
import { generateId } from '../utils/id.js';

export function emptyDoc() {
  return { type: 'doc', content: [{ type: 'scene_heading', attrs: { id: generateId('block') } }] };
}

export function textNode(type, id, text) {
  return {
    type,
    attrs: { id },
    content: text ? [{ type: 'text', text }] : undefined,
  };
}

// Appends a bare scene heading (and one empty action line beneath it) to the
// end of the document, tagged with `sceneId` — used when a new beat card is
// added on the Outline so its sceneId always resolves to a real spot in the
// document.
export function appendEmptyScene(docJson, sceneId) {
  const content = [...(docJson?.content ?? [])];
  content.push({ type: 'scene_heading', attrs: { id: sceneId } });
  content.push({ type: 'action', attrs: { id: generateId('block') } });
  return { ...docJson, content };
}

// Removes the scene_heading tagged `sceneId` and every node after it up to
// (not including) the next scene_heading — i.e. the whole scene, not just
// its heading line. Used when a beat card is deleted, so the outline stays
// the single source of truth for what scenes exist (per the care package —
// no scene should linger in the document once its card is gone).
export function removeScene(docJson, sceneId) {
  const content = docJson?.content ?? [];
  const startIdx = content.findIndex((n) => n.type === 'scene_heading' && n.attrs?.id === sceneId);
  if (startIdx === -1) return docJson;

  let endIdx = content.length;
  for (let i = startIdx + 1; i < content.length; i++) {
    if (content[i].type === 'scene_heading') {
      endIdx = i;
      break;
    }
  }

  const newContent = [...content.slice(0, startIdx), ...content.slice(endIdx)];
  return newContent.length ? { ...docJson, content: newContent } : emptyDoc();
}
