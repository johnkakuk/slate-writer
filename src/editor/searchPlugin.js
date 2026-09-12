import { Plugin, PluginKey, TextSelection } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { closeHistory } from 'prosemirror-history';

export const searchKey = new PluginKey('sceneSearch');
export const emptySearch = { query: '', caseSensitive: false, matches: [], active: -1 };

export function findMatches(doc, query, caseSensitive = false) {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
  const matches = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    pattern.lastIndex = 0;
    for (const match of node.textContent.matchAll(pattern))
      matches.push({ from: pos + 1 + match.index, to: pos + 1 + match.index + match[0].length });
    return false;
  });
  return matches;
}

export function searchPlugin() {
  return new Plugin({
    key: searchKey,
    state: {
      init: () => emptySearch,
      apply(tr, previous, oldState, state) {
        const action = tr.getMeta(searchKey);
        if (!action && !tr.docChanged) return previous;
        const next = { ...previous, ...action };
        next.matches = findMatches(state.doc, next.query, next.caseSensitive);
        const oldMatch = previous.matches[previous.active];
        const start = action?.from ?? (oldMatch ? tr.mapping.map(oldMatch.from) : state.selection.from);
        const index = next.matches.findIndex(match => match.from >= start);
        next.active = next.matches.length ? (index < 0 ? 0 : index) : -1;
        return next;
      },
    },
    props: {
      decorations(state) {
        const search = searchKey.getState(state);
        return DecorationSet.create(state.doc, search.matches.map((match, index) =>
          Decoration.inline(match.from, match.to, { class: `search-match${index === search.active ? ' search-match-active' : ''}` })));
      },
    },
  });
}

export function navigateMatch(view, direction) {
  const search = searchKey.getState(view.state);
  if (!search.matches.length) return;
  const index = (search.active + direction + search.matches.length) % search.matches.length;
  const match = search.matches[index];
  view.dispatch(view.state.tr.setMeta(searchKey, { from: match.from })
    .setSelection(TextSelection.create(view.state.doc, match.from, match.to)).scrollIntoView());
}

export function replaceMatches(view, replacement, all = false) {
  const search = searchKey.getState(view.state);
  const matches = all ? search.matches : search.matches.slice(search.active, search.active + 1);
  if (!matches.length) return;
  const tr = closeHistory(view.state.tr);
  // Back-to-front replacement preserves offsets and never searches inserted text.
  for (const match of [...matches].reverse()) tr.insertText(replacement, match.from, match.to);
  tr.setMeta(searchKey, { from: all ? 0 : tr.mapping.map(matches[0].to, 1) });
  view.dispatch(tr);
  view.dispatch(closeHistory(view.state.tr));
  if (!all) navigateMatch(view, 0);
}
