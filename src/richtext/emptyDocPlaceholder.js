import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// Ghost placeholder text shown only when the whole document is empty (a
// single empty paragraph, ProseMirror's default blank-doc shape) -- not
// per empty-line the way the screenplay editor's placeholderPlugin.js
// works, since a real document has plenty of legitimately blank lines
// that shouldn't all sprout hint text. Same `Decoration.node` + CSS
// `::before` technique either way, so it's a pseudo-element rather than a
// real DOM node the caret could get confused by.
export function emptyDocPlaceholder(text) {
  return new Plugin({
    props: {
      decorations(state) {
        const { doc } = state;
        if (doc.childCount !== 1 || doc.firstChild.content.size > 0) return null;

        const deco = Decoration.node(0, doc.firstChild.nodeSize, {
          class: 'is-empty-doc',
          'data-placeholder': text,
        });
        return DecorationSet.create(doc, [deco]);
      },
    },
  });
}
