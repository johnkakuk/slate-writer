import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const activeLineKey = new PluginKey('activeLine');

// Finds the ProseMirror position range of the *visual* (rendered, wrapped)
// line the caret is currently on -- not the whole block, and not a
// grammatical sentence. There's no way to derive this from the document
// model alone (wrapping depends on rendered width), so it's measured
// straight from the DOM: project the block's left/right screen edges onto
// the caret's own vertical midpoint and ask the view what position sits at
// each. Works because these blocks (action/dialogue/etc.) are block-level
// elements the full width of their container, so any wrapped line within
// one spans that same left-to-right span -- not true for inline content
// generally, but true here.
function measureLineRange(view, blockStart, blockEnd) {
  const { $from } = view.state.selection;
  const caretCoords = view.coordsAtPos($from.pos);
  const blockDOM = view.nodeDOM(blockStart);
  if (!(blockDOM instanceof HTMLElement)) return null;
  const rect = blockDOM.getBoundingClientRect();
  const midY = (caretCoords.top + caretCoords.bottom) / 2;

  const clamp = (pos) => Math.min(Math.max(pos, blockStart + 1), blockEnd - 1);
  const startResult = view.posAtCoords({ left: rect.left + 1, top: midY });
  const endResult = view.posAtCoords({ left: rect.right - 1, top: midY });
  if (!startResult || !endResult) return null;

  const from = clamp(startResult.pos);
  const to = clamp(endResult.pos);
  if (from >= to) return null;
  return [from, to];
}

// Highlights the active line while Typewriter Mode is on, in whichever
// style the user picked in Settings (see SettingsView.jsx): the whole
// block, just the current visual line, an underline instead of a
// background, or nothing. Editor.jsx pushes both the on/off flag and the
// style together via `tr.setMeta(activeLineKey, { enabled, style })`
// whenever either changes.
//
// 'paragraph'/'underline'/'none' are derived straight from `state.selection`
// on every update, same as always. 'line' can't be -- it needs DOM
// measurement (coordsAtPos/posAtCoords), which only a live view provides,
// so it's measured in this plugin's own `view()` hook after each update and
// fed back in as plugin state via a guarded self-dispatch (skipped once the
// measured range stops changing, so this converges in one extra step
// instead of looping).
export function activeLinePlugin() {
  return new Plugin({
    key: activeLineKey,
    state: {
      init: () => ({ enabled: false, style: 'paragraph', lineRange: null }),
      apply(tr, value) {
        const meta = tr.getMeta(activeLineKey);
        if (meta !== undefined) return { ...value, ...meta };
        if (value.style === 'line' && (tr.docChanged || tr.selectionSet)) {
          return { ...value, lineRange: null };
        }
        return value;
      },
    },
    view() {
      return {
        update(view) {
          const pluginState = activeLineKey.getState(view.state);
          if (!pluginState?.enabled || pluginState.style !== 'line') return;
          const { $from } = view.state.selection;
          const blockStart = $from.before(1);
          const blockNode = view.state.doc.nodeAt(blockStart);
          if (!blockNode) return;
          const blockEnd = blockStart + blockNode.nodeSize;
          const range = measureLineRange(view, blockStart, blockEnd);
          const prev = pluginState.lineRange;
          const changed = !prev || !range || prev[0] !== range[0] || prev[1] !== range[1];
          if (!changed) return;
          view.dispatch(view.state.tr.setMeta(activeLineKey, { ...pluginState, lineRange: range }));
        },
      };
    },
    props: {
      decorations(state) {
        const pluginState = activeLineKey.getState(state);
        if (!pluginState?.enabled || pluginState.style === 'none') return null;
        const { $from } = state.selection;
        const blockStart = $from.before(1);
        const blockNode = state.doc.nodeAt(blockStart);
        if (!blockNode) return null;

        if (pluginState.style === 'line') {
          if (!pluginState.lineRange) return null;
          const [from, to] = pluginState.lineRange;
          return DecorationSet.create(state.doc, [Decoration.inline(from, to, { class: 'active-line-text' })]);
        }

        const blockEnd = blockStart + blockNode.nodeSize;
        const className = pluginState.style === 'underline' ? 'active-line-underline' : 'active-line';
        return DecorationSet.create(state.doc, [Decoration.node(blockStart, blockEnd, { class: className })]);
      },
    },
  });
}
