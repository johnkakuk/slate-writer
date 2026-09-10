import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import BeatCard from './BeatCard.jsx';

export default function Column({ act, sceneNumbers }) {
  const { dragState, dropPreview, updateDropPreview, dropCard, renameAct, addCard } = useProject();

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
    const title = e.currentTarget.textContent.trim() || act.title;
    renameAct(act.id, title);
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  const showIndicatorAt = dropPreview?.actId === act.id ? dropPreview.beforeCardId : undefined;

  return (
    <div className="board-col">
      <div className="board-col-head">
        <span
          className="board-col-title"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
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
