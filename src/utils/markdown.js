// A doc's display title is always derived from its first `# heading` line
// rather than stored separately — one less thing that can drift out of sync
// when the user edits the content directly.
export function titleFromMarkdown(content, fallback = 'Untitled') {
  const match = /^#\s+(.+)$/m.exec(content ?? '');
  return match ? match[1].trim() : fallback;
}

// Used for "Duplicate": keeps the body intact, tags the first heading (if
// any) so the copy is distinguishable in the sidebar.
export function duplicateMarkdown(content) {
  const lines = (content ?? '').split('\n');
  const idx = lines.findIndex((l) => /^#\s+/.test(l));
  if (idx !== -1) lines[idx] = `${lines[idx]} (Copy)`;
  return lines.join('\n');
}
