import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function DocTypeDeleteConfirmPopover() {
  const { docTypeDeleteConfirm, cancelDeleteDocType, confirmDeleteDocType } = useProject();
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!docTypeDeleteConfirm || !ref.current) {
      setPos(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    setPos({
      x: Math.min(docTypeDeleteConfirm.x, window.innerWidth - rect.width - 8),
      y: Math.min(docTypeDeleteConfirm.y, window.innerHeight - rect.height - 8),
    });
  }, [docTypeDeleteConfirm]);

  useEffect(() => {
    if (!docTypeDeleteConfirm) return undefined;
    function handlePointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) cancelDeleteDocType();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') cancelDeleteDocType();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', cancelDeleteDocType, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', cancelDeleteDocType, true);
    };
  }, [docTypeDeleteConfirm, cancelDeleteDocType]);

  if (!docTypeDeleteConfirm) return null;
  const { x, y } = pos ?? docTypeDeleteConfirm;
  const { pluralLabel, docCount } = docTypeDeleteConfirm;

  return (
    <div className="delete-confirm" style={{ left: x, top: y }} ref={ref}>
      <div className="delete-confirm-text">
        Delete <strong>“{pluralLabel}”</strong>? This also removes{' '}
        {docCount === 0 ? 'it — it has no files in it' : `the ${docCount} file${docCount === 1 ? '' : 's'} inside it`}.
      </div>
      <div className="delete-confirm-actions">
        <button className="delete-confirm-cancel" onClick={cancelDeleteDocType}>
          Cancel
        </button>
        <button className="delete-confirm-danger" onClick={confirmDeleteDocType}>
          Delete
        </button>
      </div>
    </div>
  );
}
