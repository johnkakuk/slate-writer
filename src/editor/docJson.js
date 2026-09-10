// Plain-JSON helpers for a scene document, deliberately free of any
// ProseMirror runtime import — the app-state layer (ProjectContext) only
// ever needs to read/build serialized doc JSON, never construct real
// ProseMirror Node instances. Each beat card owns one of these directly
// (`card.sceneDoc`) — there is no shared, whole-script document anymore.
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

// One-time migration helper only: pulls the node range belonging to
// `sceneId` (its scene_heading and everything up to, not including, the
// next scene_heading) out of what used to be one shared whole-script
// document, back when scenes lived at positions within it instead of each
// having their own doc. See ProjectContext's `migrateToPerCardDocs`.
export function extractSceneRange(sharedDocJson, sceneId) {
  const content = sharedDocJson?.content ?? [];
  const startIdx = content.findIndex((n) => n.type === 'scene_heading' && n.attrs?.id === sceneId);
  if (startIdx === -1) return null;

  let endIdx = content.length;
  for (let i = startIdx + 1; i < content.length; i++) {
    if (content[i].type === 'scene_heading') {
      endIdx = i;
      break;
    }
  }

  return content.slice(startIdx, endIdx);
}
