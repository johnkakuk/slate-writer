import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const activeLineKey = new PluginKey('activeLine');

// Highlights the top-level block (scene heading, action, character, etc.)
// that the selection is currently in. Only draws anything while Typewriter
// Mode is on -- Editor.jsx flips that with `tr.setMeta(activeLineKey, bool)`
// whenever the mode is toggled. Unlike src/editor/pageBreakPlugin.js, the
// decoration itself needs no external data feed beyond that one flag: which
// block to highlight is derived straight from `state.selection` on every
// update, so it always tracks the caret with no extra wiring.
export function activeLinePlugin() {
  return new Plugin({
    key: activeLineKey,
    state: {
      init: () => false,
      apply(tr, value) {
        const meta = tr.getMeta(activeLineKey);
        return meta !== undefined ? meta : value;
      },
    },
    props: {
      decorations(state) {
        if (!activeLineKey.getState(state)) return null;
        const { $from } = state.selection;
        const blockStart = $from.before(1);
        const blockNode = state.doc.nodeAt(blockStart);
        if (!blockNode) return null;
        return DecorationSet.create(state.doc, [
          Decoration.node(blockStart, blockStart + blockNode.nodeSize, { class: 'active-line' }),
        ]);
      },
    },
  });
}
