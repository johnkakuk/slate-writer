import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ProjectContextMenu({ onRename }) {
  const { projectMenu, closeProjectMenu, requestDeleteProject } = useProject();
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    if (!projectMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(projectMenu.x, window.innerWidth - rect.width - 8),
      y: Math.min(projectMenu.y, window.innerHeight - rect.height - 8),
    });
  }, [projectMenu]);

  useEffect(() => {
    if (!projectMenu) return undefined;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeProjectMenu();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeProjectMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeProjectMenu, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeProjectMenu, true);
    };
  }, [projectMenu, closeProjectMenu]);

  if (!projectMenu) return null;

  const { x, y } = pos ?? projectMenu;

  return (
    <div className="card-context-menu" style={{ left: x, top: y }} ref={menuRef}>
      <button
        className="card-context-menu-item"
        onClick={() => {
          onRename(projectMenu.projectId, projectMenu.name);
          closeProjectMenu();
        }}
      >
        Rename
      </button>
      <button
        className="card-context-menu-item danger"
        onClick={() => requestDeleteProject(projectMenu.projectId, projectMenu.name, x, y)}
      >
        Delete
      </button>
    </div>
  );
}
