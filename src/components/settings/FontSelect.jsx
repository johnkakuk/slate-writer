import React, { useEffect, useRef, useState } from 'react';
import { FONT_OPTIONS, FONT_BY_ID } from '../../state/fontOptions.js';

const CATEGORIES = ['Monospace', 'Serif', 'Sans-serif'];

export default function FontSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handlePointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const current = FONT_BY_ID[value] ?? FONT_OPTIONS[0];

  return (
    <div className={`font-select${open ? ' open' : ''}`} ref={rootRef}>
      <button className="font-select-trigger" onClick={() => setOpen((o) => !o)}>
        <span style={{ fontFamily: current.stack }}>{current.label}</span>
        <span className="project-chevron">▾</span>
      </button>
      {open && (
        <div className="font-dropdown">
          {CATEGORIES.map((category) => (
            <div key={category} className="font-dropdown-group">
              <div className="font-dropdown-label">{category}</div>
              {FONT_OPTIONS.filter((f) => f.category === category).map((f) => (
                <button
                  key={f.id}
                  className={`font-option${f.id === value ? ' active' : ''}`}
                  style={{ fontFamily: f.stack }}
                  onClick={() => {
                    onChange(f.id);
                    setOpen(false);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
