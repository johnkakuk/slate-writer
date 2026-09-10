import { Plugin, PluginKey } from 'prosemirror-state';
import { ELEMENT_TYPES } from '../elementTypes.js';

export const slashMenuKey = new PluginKey('slashMenu');

const EMPTY_STATE = { active: false, range: null, query: '', selectedIndex: 0 };

// Strict prefix match on the label only — typing "d" shows just Dialogue,
// not anything that merely contains a "d" somewhere. .filter() preserves
// the canonical element order among whatever matches.
export function filterItems(query) {
  const q = query.trim().toLowerCase();
  if (!q) return ELEMENT_TYPES;
  return ELEMENT_TYPES.filter((t) => t.label.toLowerCase().startsWith(q));
}

// The menu is derived fresh from selection + doc on every transaction: it's
// active exactly when the text from the current block's start to the cursor
// is "/" followed by a run of non-space characters (the query). That keeps
// it in sync with typing, backspacing, and cursor movement for free.
function deriveState(state) {
  const { $from } = state.selection;
  if (!state.selection.empty) return EMPTY_STATE;
  const blockStart = $from.start($from.depth);
  const textBefore = state.doc.textBetween(blockStart, $from.pos, '\n', '\n');
  const match = /^\/(\S*)$/.exec(textBefore);
  if (!match) return EMPTY_STATE;
  return { active: true, range: { from: blockStart, to: $from.pos }, query: match[1], selectedIndex: 0 };
}

// Replaces the "/query" text and changes the current block to the chosen
// element type in one transaction, preserving the block's id (its anchor).
export function applySlashItem(view, pluginState, item) {
  const { state } = view;
  const nodeType = state.schema.nodes[item.name];
  if (!nodeType || !pluginState.range) return;
  const $blockStart = state.doc.resolve(pluginState.range.from);
  const nodePos = $blockStart.before($blockStart.depth);
  const node = state.doc.nodeAt(nodePos);
  let tr = state.tr.delete(pluginState.range.from, pluginState.range.to);
  tr = tr.setNodeMarkup(nodePos, nodeType, node.attrs);
  tr.setMeta(slashMenuKey, { type: 'close' });
  view.dispatch(tr.scrollIntoView());
  view.focus();
}

export function slashMenuPlugin() {
  return new Plugin({
    key: slashMenuKey,
    state: {
      init: () => EMPTY_STATE,
      apply(tr, prev, _oldState, newState) {
        const meta = tr.getMeta(slashMenuKey);
        if (meta?.type === 'move') return { ...prev, selectedIndex: meta.index };
        if (meta?.type === 'close') return EMPTY_STATE;

        const next = deriveState(newState);
        if (next.active && prev.active && next.range.from === prev.range.from && next.query === prev.query) {
          return { ...next, selectedIndex: prev.selectedIndex };
        }
        return next;
      },
    },
    props: {
      handleKeyDown(view, event) {
        const pState = slashMenuKey.getState(view.state);
        if (!pState.active) return false;
        const items = filterItems(pState.query);

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const index = (pState.selectedIndex + 1) % Math.max(items.length, 1);
          view.dispatch(view.state.tr.setMeta(slashMenuKey, { type: 'move', index }));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          const index = (pState.selectedIndex - 1 + items.length) % Math.max(items.length, 1);
          view.dispatch(view.state.tr.setMeta(slashMenuKey, { type: 'move', index }));
          return true;
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          event.preventDefault();
          const item = items[pState.selectedIndex] ?? items[0];
          if (item) applySlashItem(view, pState, item);
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          view.dispatch(view.state.tr.setMeta(slashMenuKey, { type: 'close' }));
          return true;
        }
        return false;
      },
    },
  });
}
