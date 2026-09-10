import { Plugin } from 'prosemirror-state';
import { Fragment, Slice } from 'prosemirror-model';
import { parseFountainText } from './fountainParse.js';
import { generateId } from '../utils/id.js';

// Matches autoCapsPlugin's rule for normal typing -- scene headings,
// character cues, and transitions are always uppercase, so pasted
// lowercase Fountain source (valid Fountain; the format doesn't require
// caps) still ends up consistent with everything typed by hand.
const CAPS_TYPES = new Set(['scene_heading', 'character', 'transition']);

// Pasting a single line (no newline) is just normal inline text entry --
// pasting a name into the middle of a sentence shouldn't blow the sentence
// away and replace it with a freshly-typed block. Only a genuinely
// multi-line paste (the AI-script-into-Slate-Writer use case this exists
// for) goes through Fountain-line classification.
export function fountainPastePlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (!text || !/\r\n|\r|\n/.test(text.trim())) return false;

        const blocks = parseFountainText(text);
        if (blocks.length < 2) return false;

        const { state } = view;
        const nodes = blocks.map(({ type, text: blockText }) => {
          const nodeType = state.schema.nodes[type];
          const finalText = CAPS_TYPES.has(type) ? blockText.toUpperCase() : blockText;
          const content = finalText ? state.schema.text(finalText) : undefined;
          return nodeType.create({ id: generateId('block') }, content);
        });

        const slice = Slice.maxOpen(Fragment.from(nodes));
        view.dispatch(state.tr.replaceSelection(slice).scrollIntoView());
        return true;
      },
    },
  });
}
