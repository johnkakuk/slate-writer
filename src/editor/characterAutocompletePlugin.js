import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const characterAutocompleteKey = new PluginKey('characterAutocomplete');

const CONTD_SUGGESTION = "CONT'D)";
// Matches "<NAME> (<partial>" at the end of the block -- e.g. "MARA (",
// "MARA (C", "MARA (CONT" -- so a name that's already followed by an open
// paren can suggest completing it to "(CONT'D)".
const CONTD_PATTERN = /^([A-Z0-9 .'-]+?)\s*\(([A-Z']*)$/;

// What to ghost-suggest for a Character block's current text, or null.
// Scoped deliberately narrow: a name-in-progress that's an unambiguous
// prefix of exactly one recently-used name, or the "(CONT'D)" convention
// for a name that already has "(" open after it -- not a general-purpose
// autocomplete engine.
function computeSuggestion(node, recentNames) {
  const text = node.textContent;
  if (!text) return null;
  const upper = text.toUpperCase();

  const contdMatch = upper.match(CONTD_PATTERN);
  if (contdMatch) {
    const parenPrefix = contdMatch[2];
    if (!CONTD_SUGGESTION.startsWith(parenPrefix)) return null;
    const remainder = CONTD_SUGGESTION.slice(parenPrefix.length);
    return remainder || null;
  }

  if (/[()]/.test(upper)) return null; // mid-parenthetical already, not a plain name
  const matches = recentNames.filter((name) => name.startsWith(upper) && name !== upper);
  if (matches.length !== 1) return null; // none, or ambiguous between two -- don't guess
  return matches[0].slice(upper.length);
}

function suggestionAt(state, getRecentNames) {
  const { $from, empty } = state.selection;
  if (!empty) return null;
  const node = $from.parent;
  if (node.type.name !== 'character') return null;
  if ($from.parentOffset !== node.content.size) return null; // only at the trailing edge
  const suggestion = computeSuggestion(node, getRecentNames());
  return suggestion ? { pos: $from.pos, text: suggestion } : null;
}

// Ghost-text suggestion on a Character block, accepted with Tab (see
// acceptCharacterSuggestion in keymap.js). Rendered the same way
// placeholderPlugin.js's ghost text is -- a real (non-editable) DOM node
// this time rather than a ::before pseudo-element, since Tab needs to
// insert its exact text rather than just hint at it.
export function characterAutocompletePlugin(getRecentNames) {
  return new Plugin({
    key: characterAutocompleteKey,
    props: {
      decorations(state) {
        const suggestion = suggestionAt(state, getRecentNames);
        if (!suggestion) return null;
        const deco = Decoration.widget(
          suggestion.pos,
          () => {
            const el = document.createElement('span');
            el.className = 'autocomplete-ghost';
            el.textContent = suggestion.text;
            el.contentEditable = 'false';
            return el;
          },
          { side: 1, key: `autocomplete-${suggestion.text}` }
        );
        return DecorationSet.create(state.doc, [deco]);
      },
    },
  });
}

// Tab command: inserts the currently-showing suggestion as real text, or
// no-ops (returns false) if there isn't one, falling through to whatever
// Tab does next (cycling a recently-used name, then cycling element type).
export function acceptCharacterSuggestion(getRecentNames) {
  return (state, dispatch) => {
    const suggestion = suggestionAt(state, getRecentNames);
    if (!suggestion) return false;
    if (dispatch) {
      dispatch(state.tr.insertText(suggestion.text, suggestion.pos).scrollIntoView());
    }
    return true;
  };
}
