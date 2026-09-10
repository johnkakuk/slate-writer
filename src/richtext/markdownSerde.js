// Bidirectional markdown <-> ProseMirror doc conversion for the Character
// Bible / Notes & Research editor. `prosemirror-markdown`'s bundled schema
// already covers everything this needs (headings, lists, blockquote, code,
// bold/italic/code marks) — no custom schema required, unlike the
// screenplay editor which needs its own element types.
import { schema, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';

export { schema };

export function parseMarkdown(text) {
  return defaultMarkdownParser.parse(text ?? '');
}

export function serializeToMarkdown(doc) {
  return defaultMarkdownSerializer.serialize(doc);
}
