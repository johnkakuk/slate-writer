import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ActDeleteConfirmPopover() {
  const { actDeleteConfirm, cancelDeleteAct, confirmDeleteAct } = useProject();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!actDeleteConfirm || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(actDeleteConfirm.x, window.innerWidth - rect.width - 8),
      y: Math.min(actDeleteConfirm.y, window.innerHeight - rect.height - 8),
    });
  }, [actDeleteConfirm]);

  useEffect(() => {
    if (!actDeleteConfirm) return undefined;
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) cancelDeleteAct();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') cancelDeleteAct();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', cancelDeleteAct, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', cancelDeleteAct, true);
    };
  }, [actDeleteConfirm, cancelDeleteAct]);

  if (!actDeleteConfirm) return null;
  const { x, y } = pos ?? actDeleteConfirm;

  return (
    <div className="delete-confirm" style={{ left: x, top: y }} ref={ref}>
      <div className="delete-confirm-text">
        Delete <strong>“{actDeleteConfirm.title}”</strong>? This also removes every card inside it.
      </div>
      <div className="delete-confirm-actions">
        <button className="delete-confirm-cancel" onClick={cancelDeleteAct}>
          Cancel
        </button>
        <button className="delete-confirm-danger" onClick={confirmDeleteAct}>
          Delete
        </button>
      </div>
    </div>
  );
}
