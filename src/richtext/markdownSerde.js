// Bidirectional markdown <-> ProseMirror doc conversion for the Character
// Bible / Notes & Research editor. `prosemirror-markdown`'s bundled schema
// already covers everything this needs (headings, lists, blockquote, code,
// bold/italic/code marks) — no custom schema required, unlike the
// screenplay editor which needs its own element types.
import { schema, MarkdownSerializer, defaultMarkdownParser, defaultMarkdownSerializer } from 'prosemirror-markdown';

export { schema };

// Markdown has no way to represent a genuinely empty paragraph — a blank
// line is just a block separator, not content, so it never survives
// parsing. A lone U+00A0 (non-breaking space) does survive, and renders
// indistinguishably from blank, which is what lets an intentional blank
// paragraph (for click-to-type whitespace, or just spacing) actually
// persist across save/reload instead of silently vanishing.
const NBSP = ' ';

const preservingBlankLines = new MarkdownSerializer(
  {
    ...defaultMarkdownSerializer.nodes,
    paragraph(state, node) {
      if (node.content.size === 0) {
        state.write(NBSP);
        state.closeBlock(node);
        return;
      }
      state.renderInline(node);
      state.closeBlock(node);
    },
  },
  defaultMarkdownSerializer.marks
);

export function parseMarkdown(text) {
  return defaultMarkdownParser.parse(text ?? '');
}

export function serializeToMarkdown(doc) {
  return preservingBlankLines.serialize(doc);
}
