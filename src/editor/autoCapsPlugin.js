import { Plugin, TextSelection } from 'prosemirror-state';

// Scene headings, character cues, and transitions are conventionally
// all-caps in a screenplay — uppercase as you type, the way Final Draft and
// Arc Studio do, instead of making the writer hold Caps Lock.
const CAPS_TYPES = new Set(['scene_heading', 'character', 'transition']);

export function autoCapsPlugin() {
  return new Plugin({
    // Normalize document edits too: paste, slash-menu conversions, and replace
    // bypass handleTextInput. Appended changes stay in the same undo event.
    appendTransaction(transactions, oldState, state) {
      if (!transactions.some(tr => tr.docChanged)) return null;
      const edits = [];
      state.doc.descendants((node, pos) => {
        if (!node.isTextblock || !CAPS_TYPES.has(node.type.name)) return;
        node.forEach((child, offset) => {
          if (child.isText && child.text !== child.text.toUpperCase())
            edits.push({ from: pos + 1 + offset, to: pos + 1 + offset + child.nodeSize, text: child.text.toUpperCase(), marks: child.marks });
        });
      });
      if (!edits.length) return null;
      const tr = state.tr;
      for (const edit of [...edits].reverse()) tr.replaceWith(edit.from, edit.to, state.schema.text(edit.text, edit.marks));
      if (state.selection instanceof TextSelection) {
        const mapPosition = position => {
          let shift = 0;
          for (const edit of edits) {
            if (position < edit.from) break;
            if (position <= edit.to) {
              const prefix = state.doc.textBetween(edit.from, position);
              return edit.from + shift + prefix.toUpperCase().length;
            }
            shift += edit.text.length - (edit.to - edit.from);
          }
          return position + shift;
        };
        tr.setSelection(TextSelection.create(tr.doc, mapPosition(state.selection.anchor), mapPosition(state.selection.head)));
      }
      return tr;
    },
    props: {
      handleTextInput(view, from, to, text) {
        const typeName = view.state.doc.resolve(from).parent.type.name;
        if (!CAPS_TYPES.has(typeName)) return false;
        const upper = text.toUpperCase();
        if (upper === text) return false;
        view.dispatch(view.state.tr.insertText(upper, from, to));
        return true;
      },
    },
  });
}
