import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const activeLineKey = new PluginKey('activeLine');

// Marks the self-dispatch below as internal bookkeeping, not a real user
// interaction -- Editor.jsx's Typewriter Mode scroll handling checks this
// and skips entirely for a transaction carrying it. Without this, the
// self-dispatch (untagged, so neither "pointer" nor a real key-driven edit)
// fell into the "else" branch there and forcibly re-scrolled to the OLD
// anchor immediately after every tap, undoing the tap's own correct
// no-scroll handling one transaction later -- this is what made tapping a
// line visibly jump and sometimes land the highlight on the wrong line
// once 'line' mode's measurement dispatch entered the picture; the other
// styles never self-dispatch, so they never hit this.
export const LINE_MEASURE_META = 'activeLineMeasure';

// Finds the *visual* (rendered, wrapped) line the caret is currently on, as
// a vertical band relative to its block: `top`/`height` in px, not a
// document position range. There's no way to derive this from the document
// model alone (wrapping depends on rendered width), so it's measured
// straight from the DOM -- but only vertically, via coordsAtPos on the
// caret's own position, which already gives that line's own top/bottom.
//
// An earlier version also hunted for the line's horizontal start/end
// document positions via posAtCoords, to wrap that exact text range in a
// Decoration.inline. That fed back on itself: painting the decoration
// (a real <span> inserted into the text) changed the DOM at the exact
// coordinates the next measurement probed, so posAtCoords could resolve to
// a *different* position depending on whether that span currently existed
// -- oscillating forever between two answers and blowing the call stack
// (self-dispatch -> re-render -> re-measure -> different result -> repeat,
// never converging). Measuring only the caret's own vertical extent avoids
// this entirely: nothing about painting the resulting band can change what
// coordsAtPos(caret position) reports.
function measureActiveLineBand(view, blockStart) {
  const { $from } = view.state.selection;
  const caretCoords = view.coordsAtPos($from.pos);
  const blockDOM = view.nodeDOM(blockStart);
  if (!(blockDOM instanceof HTMLElement)) return null;
  const rect = blockDOM.getBoundingClientRect();
  const top = caretCoords.top - rect.top;
  const height = caretCoords.bottom - caretCoords.top;
  if (height <= 0) return null;
  return { top, height };
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
// measurement (coordsAtPos), which only a live view provides, so it's
// measured in this plugin's own `view()` hook after each update and fed
// back in as plugin state via a guarded self-dispatch (skipped once the
// measured band stops changing, so this converges in one extra step
// instead of looping).
export function activeLinePlugin() {
  return new Plugin({
    key: activeLineKey,
    state: {
      init: () => ({ enabled: false, style: 'paragraph', lineBand: null }),
      apply(tr, value) {
        const meta = tr.getMeta(activeLineKey);
        if (meta !== undefined) return { ...value, ...meta };
        if (value.style === 'line' && (tr.docChanged || tr.selectionSet)) {
          return { ...value, lineBand: null };
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
          if (!view.state.doc.nodeAt(blockStart)) return;
          const band = measureActiveLineBand(view, blockStart);
          const prev = pluginState.lineBand;
          const changed = !prev || !band || prev.top !== band.top || prev.height !== band.height;
          if (!changed) return;
          view.dispatch(
            view.state.tr.setMeta(activeLineKey, { ...pluginState, lineBand: band }).setMeta(LINE_MEASURE_META, true)
          );
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
        const blockEnd = blockStart + blockNode.nodeSize;

        if (pluginState.style === 'line') {
          if (!pluginState.lineBand) return null;
          const { top, height } = pluginState.lineBand;
          return DecorationSet.create(state.doc, [
            Decoration.node(blockStart, blockEnd, {
              class: 'active-line-text',
              style: `--active-line-top: ${top}px; --active-line-height: ${height}px;`,
            }),
          ]);
        }

        const className = pluginState.style === 'underline' ? 'active-line-underline' : 'active-line';
        return DecorationSet.create(state.doc, [Decoration.node(blockStart, blockEnd, { class: className })]);
      },
    },
  });
}
