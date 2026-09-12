import { Plugin } from 'prosemirror-state';

// Typing "(" as the very first character of an empty Dialogue or Action
// block converts it to a Parenthetical. This also covers the empty Character
// cue that Enter creates after Dialogue, so a trailing direction stays with
// the speech instead of becoming an uppercase character name. Typing "(beat)"
// or "(to Mara)" works without reaching for the slash menu (which remains
// available as another way in). `enabledRef` is a ref rather than a plain
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
        if (node.content.size !== 0) return false;
        const pos = $from.before($from.depth);
        const followsDialogue = node.type.name === 'character' &&
          view.state.doc.resolve(pos).nodeBefore?.type.name === 'dialogue';
        if (!TRIGGER_TYPES.has(node.type.name) && !followsDialogue) return false;
        const parenType = view.state.schema.nodes.parenthetical;
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
