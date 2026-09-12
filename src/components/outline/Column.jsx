import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import BeatCard from './BeatCard.jsx';
import { useLongPress } from '../../utils/useLongPress.js';

export default function Column({ act, sceneNumbers }) {
  const { dragState, dropPreview, updateDropPreview, dropCard, renameAct, addCard, openActMenu } = useProject();
  const [editingTitle, setEditingTitle] = useState(false);

  function handleDragOver(e) {
    e.preventDefault();
    if (!dragState) return;
    const container = e.currentTarget;
    const cardEls = [...container.querySelectorAll('.beat-card')].filter(
      (el) => el.dataset.cardId !== dragState.cardId
    );
    let beforeCardId = null;
    let closestOffset = -Infinity;
    cardEls.forEach((el) => {
      const box = el.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        beforeCardId = el.dataset.cardId;
      }
    });
    updateDropPreview(act.id, beforeCardId);
  }

  function handleDrop(e) {
    e.preventDefault();
    dropCard(act.id);
  }

  function handleTitleBlur(e) {
    setEditingTitle(false);
    const title = e.currentTarget.textContent.trim() || act.title;
    renameAct(act.id, title);
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  // Same fix as the beat card fields: a right-click's mousedown would
  // otherwise focus the contentEditable title first, which would make the
  // header's context-menu handler think an edit is already in progress.
  function blockRightClickFocus(e) {
    if (e.button === 2) e.preventDefault();
  }

  function handleHeadContextMenu(e) {
    if (editingTitle) return; // let the native text-editing context menu show instead
    e.preventDefault();
    openActMenu(act.id, act.title, e.clientX, e.clientY);
  }

  const longPress = useLongPress((x, y) => {
    if (editingTitle) return;
    openActMenu(act.id, act.title, x, y);
  });

  const showIndicatorAt = dropPreview?.actId === act.id ? dropPreview.beforeCardId : undefined;

  return (
    <div className="board-col" data-act-id={act.id}>
      <div
        className="board-col-head"
        onContextMenu={handleHeadContextMenu}
        onMouseDown={blockRightClickFocus}
        onTouchStart={longPress.onTouchStart}
        onTouchMove={longPress.onTouchMove}
        onTouchEnd={longPress.onTouchEnd}
        onTouchCancel={longPress.onTouchCancel}
      >
        <span
          className="board-col-title"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onFocus={() => setEditingTitle(true)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onMouseDown={blockRightClickFocus}
        >
          {act.title}
        </span>
        <span className="board-col-count">{act.cards.length}</span>
      </div>
      <div className="board-col-cards" onDragOver={handleDragOver} onDrop={handleDrop}>
        {act.cards.map((card) => (
          <React.Fragment key={card.id}>
            {showIndicatorAt === card.id && <div className="drop-indicator" />}
            <BeatCard card={card} actId={act.id} number={sceneNumbers.get(card.id)} />
          </React.Fragment>
        ))}
        {showIndicatorAt === null && <div className="drop-indicator" />}
      </div>
      <button className="board-col-add" onClick={() => addCard(act.id)}>
        + add card
      </button>
    </div>
  );
}
