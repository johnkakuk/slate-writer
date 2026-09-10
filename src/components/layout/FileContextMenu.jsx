import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function FileContextMenu() {
  const { fileMenu, closeFileMenu, navigate, duplicateDoc, requestDeleteDoc } = useProject();
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!fileMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(fileMenu.x, window.innerWidth - rect.width - 8),
      y: Math.min(fileMenu.y, window.innerHeight - rect.height - 8),
    });
  }, [fileMenu]);

  useEffect(() => {
    if (!fileMenu) return undefined;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeFileMenu();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeFileMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeFileMenu, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeFileMenu, true);
    };
  }, [fileMenu, closeFileMenu]);

  if (!fileMenu) return null;

  const { x, y } = pos ?? fileMenu;

  return (
    <div className="card-context-menu" style={{ left: x, top: y }} ref={menuRef}>
      <button
        className="card-context-menu-item"
        onClick={() => {
          navigate('doc', { docTypeId: fileMenu.docTypeId, docId: fileMenu.docId });
          closeFileMenu();
        }}
      >
        Edit
      </button>
      <button className="card-context-menu-item" onClick={() => duplicateDoc(fileMenu.docTypeId, fileMenu.docId)}>
        Duplicate
      </button>
      <button
        className="card-context-menu-item danger"
        onClick={() => requestDeleteDoc(fileMenu.docTypeId, fileMenu.docId, fileMenu.title, x, y)}
      >
        Delete
      </button>
    </div>
  );
}
