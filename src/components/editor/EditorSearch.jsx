import React, { useRef, useState, useEffect } from 'react';
import { searchKey, navigateMatch, replaceMatches } from '../../editor/searchPlugin.js';

export default function EditorSearch({ getView, search, onClose }) {
  const [replacement, setReplacement] = useState('');
  const inputRef = useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  const update = patch => {
    const view = getView();
    if (view) view.dispatch(view.state.tr.setMeta(searchKey, patch));
  };
  const move = direction => {
    const view = getView();
    if (view) navigateMatch(view, direction);
  };
  return <div className="editor-search" role="search" aria-label="Find and replace in this scene"
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}>
    <div className="editor-search-row">
      <input ref={inputRef} aria-label="Find in this scene" placeholder="Find in this scene" value={search.query}
        onChange={event => update({ query: event.target.value })}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); move(event.shiftKey ? -1 : 1); }
        }} />
      <span className="search-count" role="status">{search.matches.length ? `${search.active + 1} of ${search.matches.length}` : search.query ? 'No matches' : 'This scene'}</span>
      <button type="button" aria-label="Previous match" disabled={!search.matches.length} onClick={() => move(-1)}>↑</button>
      <button type="button" aria-label="Next match" disabled={!search.matches.length} onClick={() => move(1)}>↓</button>
      <button type="button" aria-label="Close find and replace" onClick={onClose}>×</button>
    </div>
    <div className="editor-search-row">
      <input aria-label="Replace with" placeholder="Replace with" value={replacement} onChange={event => setReplacement(event.target.value)} />
      <label><input type="checkbox" checked={search.caseSensitive} onChange={event => update({ caseSensitive: event.target.checked })} /> Match case</label>
      <button type="button" disabled={!search.matches.length} onClick={() => replaceMatches(getView(), replacement)}>Replace</button>
      <button type="button" disabled={!search.matches.length} onClick={() => replaceMatches(getView(), replacement, true)}>Replace all</button>
    </div>
  </div>;
}
