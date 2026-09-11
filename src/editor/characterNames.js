// Scans the whole script (every act, every card's sceneDoc) for Character
// blocks in outline order, returning up to `limit` unique names, most
// recently introduced first. "Recently used" means most recently
// *appearing* in the script's own outline order, not edit-recency -- no
// separate usage log to maintain, and it stays automatically in sync with
// the actual script (delete a scene, its character drops out of the list
// on its own). Re-mentioning a name later in the script bumps it back to
// the front, same as a real "recently used" list would.
//
// Shared by keymap.js (Tab-cycles-names on an empty Character block) and
// the (CONT'D) autocomplete -- both need the same "who's actually in this
// script lately" list.
export function getRecentCharacterNames(project, limit = 5) {
  const lastSeenAt = new Map(); // name -> position index of its last occurrence
  let index = 0;
  for (const act of project.acts) {
    for (const card of act.cards) {
      for (const node of card.sceneDoc?.content ?? []) {
        if (node.type !== 'character') continue;
        const text = (node.content ?? [])
          .map((c) => c.text ?? '')
          .join('')
          .trim()
          .toUpperCase();
        index += 1;
        if (!text) continue;
        lastSeenAt.set(text, index);
      }
    }
  }
  return [...lastSeenAt.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name]) => name);
}
