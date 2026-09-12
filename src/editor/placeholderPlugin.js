import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { ELEMENT_TYPE_BY_NAME } from './elementTypes.js';

// Ghost text in the current empty block, Notion-style: names the element
// type and reminds you how to change it. Only shown for the block the
// cursor is actually in, so it doesn't clutter every empty line.
//
// Rendered as a `Decoration.node` (a class + data attribute on the empty
// node's own element, picked up by CSS pseudo-elements) rather than a widget with
// real DOM text — a widget sitting exactly at the cursor position is a real
// node the browser can plant its native caret against, which desyncs it
// from ProseMirror's model position: the caret visually stalls and typed
// text lands wherever the browser guessed, not where the model thinks the
// selection is. A `::before` pseudo-element isn't part of the editable
// content, so it can't intercept the caret at all.
export function placeholderPlugin() {
  return new Plugin({
    props: {
      decorations(state) {
        const { $from, empty } = state.selection;
        if (!empty) return null;
        const node = $from.parent;
        if (node.content.size > 0) return null;
        const meta = ELEMENT_TYPE_BY_NAME[node.type.name];
        if (!meta) return null;

        // Tab on an empty Character block cycles recently-used names now
        // (see keymap.js's cycleCharacterName), not element type -- "Tab
        // or" is no longer an accurate hint there specifically.
        const hint = node.type.name === 'character' ? `${meta.label} — "/" for options` : `${meta.label} — Tab or "/" for options`;
        const nodePos = $from.before($from.depth);
        const deco = Decoration.node(nodePos, nodePos + node.nodeSize, {
          class: 'is-empty',
          'data-placeholder': hint,
        });
        return DecorationSet.create(state.doc, [deco]);
      },
    },
  });
}
