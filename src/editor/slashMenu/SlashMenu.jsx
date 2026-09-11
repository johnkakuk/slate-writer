import React, { useLayoutEffect, useRef, useState } from 'react';
import { filterItems, applySlashItem } from './slashMenuPlugin.js';

export default function SlashMenu({ view, pluginState }) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);
  const active = Boolean(pluginState?.active && view);
  const coords = active ? view.coordsAtPos(pluginState.range.from) : null;
  const items = active ? filterItems(pluginState.query) : [];

  // Measures the menu's actual rendered size (it varies with the filtered
  // item count as the user keeps typing after "/") and repositions it --
  // opening downward from the "/" by default, but flipping to open upward
  // instead whenever downward would run off the bottom of the screen. Runs
  // in useLayoutEffect (before paint) so the flip never has a visible
  // flash at the wrong position first.
  useLayoutEffect(() => {
    if (!active || !menuRef.current || !coords) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    const margin = 8;
    const fitsBelow = coords.bottom + 6 + rect.height <= window.innerHeight - margin;
    const top = fitsBelow ? coords.bottom + 6 : coords.top - 6 - rect.height;
    const left = Math.min(coords.left, window.innerWidth - rect.width - margin);
    setPos({ top: Math.max(margin, top), left: Math.max(margin, left) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, coords?.left, coords?.top, coords?.bottom, pluginState?.query]);

  if (!active) return null;

  const style = pos ?? { left: coords.left, top: coords.bottom + 6 };

  return (
    <div
      ref={menuRef}
      className="slash-menu"
      style={style}
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
