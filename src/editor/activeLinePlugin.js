import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const activeLineKey = new PluginKey('activeLine');

// Splits text on sentence-ending punctuation followed by whitespace (or the
// end of the string) -- good enough for picking out "the sentence the
// caret is in," not meant to be a linguistically rigorous sentence
// splitter (doesn't special-case "Mr." or "3.5", for instance).
const SENTENCE_BOUNDARY_RE = /[.!?]+(?:\s+|$)/g;

function sentenceRangeAround(text, offset) {
  let start = 0;
  SENTENCE_BOUNDARY_RE.lastIndex = 0;
  let match;
  while ((match = SENTENCE_BOUNDARY_RE.exec(text))) {
    const end = match.index + match[0].length;
    if (offset < end || end >= text.length) return [start, end];
    start = end;
  }
  return [start, text.length];
}

// Highlights the active line while Typewriter Mode is on, in whichever
// style the user picked in Settings (see SettingsView.jsx): the whole
// block, just the current sentence, an underline instead of a background,
// or nothing. Editor.jsx pushes both the on/off flag and the style
// together via `tr.setMeta(activeLineKey, { enabled, style })` whenever
// either changes. Which text to decorate is otherwise derived straight
// from `state.selection` on every update, so it always tracks the caret
// with no extra wiring.
export function activeLinePlugin() {
  return new Plugin({
    key: activeLineKey,
    state: {
      init: () => ({ enabled: false, style: 'paragraph' }),
      apply(tr, value) {
        const meta = tr.getMeta(activeLineKey);
        return meta !== undefined ? meta : value;
      },
    },
    props: {
      decorations(state) {
        const pluginState = activeLineKey.getState(state);
        if (!pluginState?.enabled || pluginState.style === 'none') return null;
        const { $from } = state.selection;
        const blockStart = $from.before(1);
        const blockNode = state.doc.nodeAt(blockStart);
        if (!blockNode) return null;

        if (pluginState.style === 'sentence') {
          const text = blockNode.textContent;
          const offsetInBlock = $from.pos - (blockStart + 1);
          const [start, end] = sentenceRangeAround(text, offsetInBlock);
          if (start >= end) return null;
          const from = blockStart + 1 + start;
          const to = blockStart + 1 + end;
          return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: 'active-sentence' })]);
        }

        const blockEnd = blockStart + blockNode.nodeSize;
        const className = pluginState.style === 'underline' ? 'active-line-underline' : 'active-line';
        return DecorationSet.create(state.doc, [Decoration.node(blockStart, blockEnd, { class: className })]);
      },
    },
  });
}
