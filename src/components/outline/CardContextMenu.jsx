import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function CardContextMenu() {
  const { cardMenu, closeCardMenu, requestDeleteCard, navigate } = useProject();
  const menuRef = useRef(null);
  const [pos, setPos] = useState(null);

  // Clamp to the viewport after measuring, so a right-click near the edge
  // of the board doesn't render the menu partly off-screen.
  useLayoutEffect(() => {
    if (!cardMenu || !menuRef.current) {
      setPos(null);
      return;
    }
    const rect = menuRef.current.getBoundingClientRect();
    setPos({
      x: Math.min(cardMenu.x, window.innerWidth - rect.width - 8),
      y: Math.min(cardMenu.y, window.innerHeight - rect.height - 8),
    });
  }, [cardMenu]);

  useEffect(() => {
    if (!cardMenu) return undefined;
    function handlePointerDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) closeCardMenu();
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeCardMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', closeCardMenu, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', closeCardMenu, true);
    };
  }, [cardMenu, closeCardMenu]);

  if (!cardMenu) return null;

  const { x, y } = pos ?? cardMenu;

  return (
    <div className="card-context-menu" style={{ left: x, top: y }} ref={menuRef}>
      <button
        className="card-context-menu-item"
        onClick={() => {
          navigate('editor', { sceneId: cardMenu.sceneId, label: cardMenu.title, source: 'beat card' });
          closeCardMenu();
        }}
      >
        Edit
      </button>
      <button
        className="card-context-menu-item danger"
        onClick={() => requestDeleteCard(cardMenu.actId, cardMenu.cardId, cardMenu.title, x, y)}
      >
        Delete
      </button>
    </div>
  );
}
