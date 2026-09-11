import React from 'react';

// Grip icon for touch-driven drag reordering (see useTouchDragHandle.js) --
// rendered only on touch platforms (gated by the .touch-platform class from
// a parent, in each call site's CSS) since desktop already reorders via
// native HTML5 drag-and-drop from anywhere on the row.
export default function TouchDragHandle({ dragRef }) {
  return (
    <div ref={dragRef} className="touch-drag-handle" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="14" height="14">
        <circle cx="5" cy="3" r="1.3" fill="currentColor" />
        <circle cx="11" cy="3" r="1.3" fill="currentColor" />
        <circle cx="5" cy="8" r="1.3" fill="currentColor" />
        <circle cx="11" cy="8" r="1.3" fill="currentColor" />
        <circle cx="5" cy="13" r="1.3" fill="currentColor" />
        <circle cx="11" cy="13" r="1.3" fill="currentColor" />
      </svg>
    </div>
  );
}
