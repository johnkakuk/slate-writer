// Finds the position of the block whose `id` attr matches `targetId`.
// Returns null if the document doesn't contain it (e.g. stale reference).
export function findBlockById(doc, targetId) {
  if (!targetId) return null;
  let found = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (node.isBlock && node.attrs.id === targetId) {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}
