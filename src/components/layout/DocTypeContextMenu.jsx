import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function DocTypeContextMenu() {
  const { project, docTypeMenu, closeDocTypeMenu, openEditDocTypeModal, requestDeleteDocType } = useProject();
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!docTypeMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(docTypeMenu.x, window.innerWidth - rect.width - 8),
      y: Math.min(docTypeMenu.y, window.innerHeight - rect.height - 8),
    });
  }, [docTypeMenu]);

  useEffect(() => {
    if (!docTypeMenu) return undefined;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeDocTypeMenu();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeDocTypeMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeDocTypeMenu, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeDocTypeMenu, true);
    };
  }, [docTypeMenu, closeDocTypeMenu]);

  if (!docTypeMenu) return null;

  const { x, y } = pos ?? docTypeMenu;
  const docType = project.docTypes.find((t) => t.id === docTypeMenu.docTypeId);
  const docCount = docType?.docs.length ?? 0;

  return (
    <div className="card-context-menu" style={{ left: x, top: y }} ref={menuRef}>
      <button
        className="card-context-menu-item"
        onClick={() => {
          openEditDocTypeModal(docTypeMenu.docTypeId);
          closeDocTypeMenu();
        }}
      >
        Edit
      </button>
      <button
        className="card-context-menu-item danger"
        onClick={() => requestDeleteDocType(docTypeMenu.docTypeId, docTypeMenu.pluralLabel, docCount, x, y)}
      >
        Delete
      </button>
    </div>
  );
}
