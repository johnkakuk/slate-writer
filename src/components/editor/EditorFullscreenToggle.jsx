import React from 'react';

export default function EditorFullscreenToggle({ active, onToggle }) {
  const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
  return (
    <button
      className="editor-fullscreen-toggle"
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={active ? `${label} (Esc)` : label}
      onMouseDown={event => event.preventDefault()}
      onClick={onToggle}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={active
          ? 'M4 9h5V4 M15 4v5h5 M20 15h-5v5 M9 20v-5H4'
          : 'M9 4H4v5 M15 4h5v5 M20 15v5h-5 M9 20H4v-5'} />
      </svg>
    </button>
  );
}
