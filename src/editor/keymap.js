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

// Tab on an empty (or already-cycling) Character block walks through
// recently-used character names instead of changing the block's element
// type -- reaching for a name you've already used shouldn't require typing
// it out again. Only kicks in when there's nothing real to clobber: an
// empty block, or one that already holds a name from this same list (so
// repeated Tabs advance through it), never a name the writer is actually
// typing that just isn't recent enough to be in the list. Falls through to
// the normal type-cycle otherwise -- the slash menu's own Parenthetical/
// etc. entries are untouched either way.
function cycleCharacterName(getRecentNames, direction = 1) {
  return (state, dispatch) => {
    const { $from } = state.selection;
    const node = $from.parent;
    if (node.type.name !== 'character') return false;
    const names = getRecentNames?.() ?? [];
    if (!names.length) return false;
    const currentText = node.textContent.trim().toUpperCase();
    if (currentText && !names.includes(currentText)) return false;
    const currentIdx = names.indexOf(currentText);
    // Starts at the *second* most recent name, not the most recent one --
    // that person just finished talking, so re-suggesting them first for a
    // fresh line isn't useful (the (CONT'D) convention covers the "same
    // character resumes" case on its own). Cycles chronologically forward
    // from there (3rd most recent, 4th, ...), wrapping around to the most
    // recent name last, right before the cycle repeats from 2nd-most-recent
    // again.
    // Reverse cycling starts with the most recent name on a blank cue,
    // then follows the same ring backward.
    const nextIdx = currentIdx === -1
      ? (direction > 0 && names.length > 1 ? 1 : 0)
      : (currentIdx + direction + names.length) % names.length;
    const nextName = names[nextIdx];
    if (dispatch) {
      const from = $from.before($from.depth) + 1;
      const to = from + node.content.size;
      dispatch(state.tr.insertText(nextName, from, to).scrollIntoView());
    }
    return true;
  };
}

// Enter: split the block, continuing into whichever element type usually
// follows (see ENTER_CONTINUATION) rather than always repeating the current
// type.
//
// Exception: hitting Enter on a line that's already blank means "I'm done
// with this" rather than "give me another one of these" -- otherwise
// Character/Dialogue would keep chaining empty blocks with no way out short
// of Tab-cycling or the slash menu. Real screenwriting software (Final
// Draft, Arc Studio) treats a blank Enter as dropping back to Action, so an
// empty non-Action line converts to Action in place instead of splitting.
function smartEnter(state, dispatch) {
  const { $from, empty } = state.selection;
  if (!empty) return false;
  const node = $from.parent;
  if (!node.type.isBlock) return false;

  const actionType = state.schema.nodes.action;
  if (node.content.size === 0 && node.type !== actionType) {
    if (dispatch) {
      const pos = $from.before($from.depth);
      dispatch(state.tr.setNodeMarkup(pos, actionType, node.attrs).scrollIntoView());
    }
    return true;
  }

  // The continuation-type split below is only meaningful when there's real
  // text staying *behind* in the original block -- it means "I finished
  // this line, start a new one of the usual next type." With the caret at
  // the very start of a non-empty block, there's nothing behind it: every
  // character is "after the caret," so splitting there doesn't produce a
  // finished-old-line/started-new-line pair at all, just the same content
  // relabeled into the continuation type and shoved down a line. That's
  // not a real editing action -- most often it's the touch caret landing
  // at position 0 when the tap actually meant to land mid-sentence (see
  // touchCaretPlugin.js), and even when it isn't, "change the type of
  // everything I already wrote" isn't what Enter should mean. Insert a
  // genuinely blank line of the *same* type above instead, leaving the
  // existing text and its type completely untouched.
  if ($from.parentOffset === 0) {
    if (dispatch) {
      const pos = $from.before($from.depth);
      const blank = node.type.create({ ...node.attrs, id: generateId('block') });
      dispatch(state.tr.insert(pos, blank).scrollIntoView());
    }
    return true;
  }

  const nextTypeName = ENTER_CONTINUATION[node.type.name] || node.type.name;
  const nextType = state.schema.nodes[nextTypeName];
  if (!nextType) return false;
  if (dispatch) {
    const tr = state.tr.split($from.pos, 1, [{ type: nextType, attrs: { id: generateId('block') } }]);
    dispatch(tr.scrollIntoView());
  }
  return true;
}

// `getRecentNames` is a function, not a plain array, so it can read a live
// ref for the current recently-used-names list (see Editor.jsx) --
// editorKeymap() itself runs once at mount and never re-runs, same
// constraint as this editor's other settings-driven plugins.
export function editorKeymap(getRecentNames, exitFullscreen) {
  const nameCycle = cycleCharacterName(getRecentNames);
  const reverseNameCycle = cycleCharacterName(getRecentNames, -1);
  const typeCycle = cycleType(1);
  const reverseTypeCycle = cycleType(-1);
  return keymap({
    ...baseKeymap,
    // The slash-menu plugin runs first; otherwise fullscreen takes priority
    // over ProseMirror's default Escape command (select the parent node).
    Escape: (state, dispatch, view) => exitFullscreen?.()
      || baseKeymap.Escape?.(state, dispatch, view) || false,
    Enter: smartEnter,
    // Cycle through recently-used names on an empty/cycling Character
    // block first, then fall back to the original type-cycle.
    Tab: (state, dispatch) => nameCycle(state, dispatch) || typeCycle(state, dispatch),
    'Shift-Tab': (state, dispatch) => reverseNameCycle(state, dispatch) || reverseTypeCycle(state, dispatch),
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
  });
}
