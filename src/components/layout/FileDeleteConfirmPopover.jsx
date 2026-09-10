import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function FileDeleteConfirmPopover() {
  const { fileDeleteConfirm, cancelDeleteDoc, confirmDeleteDoc } = useProject();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!fileDeleteConfirm || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(fileDeleteConfirm.x, window.innerWidth - rect.width - 8),
      y: Math.min(fileDeleteConfirm.y, window.innerHeight - rect.height - 8),
    });
  }, [fileDeleteConfirm]);

  useEffect(() => {
    if (!fileDeleteConfirm) return undefined;
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) cancelDeleteDoc();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') cancelDeleteDoc();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', cancelDeleteDoc, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', cancelDeleteDoc, true);
    };
  }, [fileDeleteConfirm, cancelDeleteDoc]);

  if (!fileDeleteConfirm) return null;
  const { x, y } = pos ?? fileDeleteConfirm;

  return (
    <div className="delete-confirm" style={{ left: x, top: y }} ref={ref}>
      <div className="delete-confirm-text">
        Delete <strong>“{fileDeleteConfirm.title}”</strong>? This can't be undone.
      </div>
      <div className="delete-confirm-actions">
        <button className="delete-confirm-cancel" onClick={cancelDeleteDoc}>
          Cancel
        </button>
        <button className="delete-confirm-danger" onClick={confirmDeleteDoc}>
          Delete
        </button>
      </div>
    </div>
  );
}
