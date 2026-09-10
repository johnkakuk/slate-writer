import { Plugin } from 'prosemirror-state';

// Scene headings, character cues, and transitions are conventionally
// all-caps in a screenplay — uppercase as you type, the way Final Draft and
// Arc Studio do, instead of making the writer hold Caps Lock.
const CAPS_TYPES = new Set(['scene_heading', 'character', 'transition']);

export function autoCapsPlugin() {
  return new Plugin({
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
