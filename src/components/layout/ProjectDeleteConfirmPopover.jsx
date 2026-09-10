import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ProjectDeleteConfirmPopover() {
  const { projectDeleteConfirm, cancelDeleteProject, confirmDeleteProject } = useProject();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!projectDeleteConfirm || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(projectDeleteConfirm.x, window.innerWidth - rect.width - 8),
      y: Math.min(projectDeleteConfirm.y, window.innerHeight - rect.height - 8),
    });
  }, [projectDeleteConfirm]);

  useEffect(() => {
    if (!projectDeleteConfirm) return undefined;
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) cancelDeleteProject();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') cancelDeleteProject();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', cancelDeleteProject, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', cancelDeleteProject, true);
    };
  }, [projectDeleteConfirm, cancelDeleteProject]);

  if (!projectDeleteConfirm) return null;
  const { x, y } = pos ?? projectDeleteConfirm;

  return (
    <div className="delete-confirm" style={{ left: x, top: y }} ref={ref}>
      <div className="delete-confirm-text">
        Delete <strong>“{projectDeleteConfirm.name}”</strong>? Its outline, screenplay, and docs all go with it —
        this can't be undone.
      </div>
      <div className="delete-confirm-actions">
        <button className="delete-confirm-cancel" onClick={cancelDeleteProject}>
          Cancel
        </button>
        <button className="delete-confirm-danger" onClick={confirmDeleteProject}>
          Delete
        </button>
      </div>
    </div>
  );
}
