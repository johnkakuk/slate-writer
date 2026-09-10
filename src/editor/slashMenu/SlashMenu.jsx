import React from 'react';
import { filterItems, applySlashItem } from './slashMenuPlugin.js';

export default function SlashMenu({ view, pluginState }) {
  if (!pluginState?.active || !view) return null;

  const items = filterItems(pluginState.query);
  const coords = view.coordsAtPos(pluginState.range.from);

  return (
    <div
      className="slash-menu"
      style={{ left: coords.left, top: coords.bottom + 6 }}
      // Keep focus (and the current selection) inside the editor so the
      // command can still be applied relative to the "/" position.
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 && <div className="slash-menu-empty">No matches</div>}
      {items.map((item, idx) => (
        <button
          key={item.name}
          className={`slash-menu-item${idx === pluginState.selectedIndex ? ' active' : ''}`}
          onMouseDown={() => applySlashItem(view, pluginState, item)}
        >
          <span className="slash-menu-item-label">{item.label}</span>
          <span className="slash-menu-item-hint">{item.hint}</span>
        </button>
      ))}
    </div>
  );
}
