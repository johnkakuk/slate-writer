import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ActContextMenu() {
  const { actMenu, closeActMenu, requestDeleteAct } = useProject();
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!actMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(actMenu.x, window.innerWidth - rect.width - 8),
      y: Math.min(actMenu.y, window.innerHeight - rect.height - 8),
    });
  }, [actMenu]);

  useEffect(() => {
    if (!actMenu) return undefined;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeActMenu();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeActMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeActMenu, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeActMenu, true);
    };
  }, [actMenu, closeActMenu]);

  if (!actMenu) return null;

  const { x, y } = pos ?? actMenu;

  function handleRename() {
    closeActMenu();
    // The column's title span is already a contentEditable in place -- focus
    // and select it rather than building a parallel rename input, matching
    // the "ready to type a replacement" UX used for project rename.
    const el = document.querySelector(`.board-col[data-act-id="${actMenu.actId}"] .board-col-title`);
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  return (
    <div className="card-context-menu" style={{ left: x, top: y }} ref={menuRef}>
      <button className="card-context-menu-item" onClick={handleRename}>
        Rename
      </button>
      <button
        className="card-context-menu-item danger"
        onClick={() => requestDeleteAct(actMenu.actId, actMenu.title, x, y)}
      >
        Delete
      </button>
    </div>
  );
}
