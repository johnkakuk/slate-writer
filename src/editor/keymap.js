import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { nextElementType, ENTER_CONTINUATION } from './elementTypes.js';
import { generateId } from '../utils/id.js';

// Tab / Shift-Tab: cycle the current block through the element types, the
// same manual-override mechanic real screenwriting software uses. The
// block's id is preserved so anchors (Outline cards, Screenplay-view lines)
// keep pointing at the same line even after its type changes.
function cycleType(direction) {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const node = $from.parent;
    if (!node.type.isBlock) return false;
    const nextType = state.schema.nodes[nextElementType(node.type.name, direction)];
    if (!nextType) return false;
    if (dispatch) {
      const pos = $from.before($from.depth);
      dispatch(state.tr.setNodeMarkup(pos, nextType, node.attrs).scrollIntoView());
    }
    return true;
  };
}

// Enter: split the block, continuing into whichever element type usually
// follows (see ENTER_CONTINUATION) rather than always repeating the current
// type.
function smartEnter(state, dispatch) {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const node = $from.parent;
  if (!node.type.isBlock) return false;
  const nextTypeName = ENTER_CONTINUATION[node.type.name] || node.type.name;
  const nextType = state.schema.nodes[nextTypeName];
  if (!nextType) return false;
  if (dispatch) {
    const tr = state.tr.split($from.pos, 1, [{ type: nextType, attrs: { id: generateId('block') } }]);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

export function editorKeymap() {
  return keymap({
    ...baseKeymap,
    Enter: smartEnter,
    Tab: cycleType(1),
    'Shift-Tab': cycleType(-1),
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
  });
}
