import { Schema } from 'prosemirror-model';
import { ELEMENT_TYPES } from './elementTypes.js';

// Every block node shares the same shape (inline text, one stable `id`
// attribute) — the id is the anchor Outline beat cards and the read-only
// Screenplay view use to point at an exact line in this document.
function blockSpec(css) {
  return {
    content: 'inline*',
    group: 'block',
    attrs: { id: { default: null } },
    parseDOM: [{ tag: `div.${css}`, getAttrs: (dom) => ({ id: dom.getAttribute('data-id') }) }],
    toDOM(node) {
      return ['div', { class: css, 'data-id': node.attrs.id ?? '' }, 0];
    },
  };
}

const nodes = {
  doc: { content: 'block+' },
  text: { group: 'inline' },
};

for (const type of ELEMENT_TYPES) {
  nodes[type.name] = blockSpec(type.css);
}

export const schema = new Schema({ nodes });
