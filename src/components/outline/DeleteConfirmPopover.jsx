import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function DeleteConfirmPopover() {
  const { deleteConfirm, cancelDeleteCard, confirmDeleteCard } = useProject();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!deleteConfirm || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(deleteConfirm.x, window.innerWidth - rect.width - 8),
      y: Math.min(deleteConfirm.y, window.innerHeight - rect.height - 8),
    });
  }, [deleteConfirm]);

  useEffect(() => {
    if (!deleteConfirm) return undefined;
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) cancelDeleteCard();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') cancelDeleteCard();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', cancelDeleteCard, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', cancelDeleteCard, true);
    };
  }, [deleteConfirm, cancelDeleteCard]);

  if (!deleteConfirm) return null;
  const { x, y } = pos ?? deleteConfirm;

  return (
    <div className="delete-confirm" style={{ left: x, top: y }} ref={ref}>
      <div className="delete-confirm-text">
        Delete <strong>“{deleteConfirm.title}”</strong>? This also removes its scene from the script.
      </div>
      <div className="delete-confirm-actions">
        <button className="delete-confirm-cancel" onClick={cancelDeleteCard}>
          Cancel
        </button>
        <button className="delete-confirm-danger" onClick={confirmDeleteCard}>
          Delete
        </button>
      </div>
    </div>
  );
}
