import { Plugin } from 'prosemirror-state';

// Typing "(" as the very first character of an empty Dialogue or Action
// block converts it to a Parenthetical -- the same instinct a screenwriter
// has typing "(beat)" or "(to Mara)" without breaking flow to reach for
// the slash menu first (which stays available as-is; this is just a
// second, optional way in). `enabledRef` is a ref rather than a plain
// boolean since this plugin, like the editor's other settings-driven
// plugins, is created once at mount and needs to see live Settings changes
// without the whole ProseMirror view being torn down and recreated.
const TRIGGER_TYPES = new Set(['dialogue', 'action']);

export function autoParentheticalPlugin(enabledRef) {
  return new Plugin({
    props: {
      handleTextInput(view, from, to, text) {
        if (!enabledRef.current || text !== '(') return false;
        const $from = view.state.doc.resolve(from);
        const node = $from.parent;
        if (!TRIGGER_TYPES.has(node.type.name) || node.content.size !== 0) return false;
        const parenType = view.state.schema.nodes.parenthetical;
        const pos = $from.before($from.depth);
        // setNodeMarkup doesn't change the node's size, so the original
        // from/to are still valid positions for the text insertion right
        // after it in the same transaction.
        const tr = view.state.tr.setNodeMarkup(pos, parenType, node.attrs).insertText(text, from, to);
        view.dispatch(tr);
        return true;
      },
    },
  });
}
