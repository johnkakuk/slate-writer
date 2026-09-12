import React, { useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { useLongPress } from '../../utils/useLongPress.js';
import { useTouchDragHandle } from '../../utils/useTouchDragHandle.js';
import { isTouchPlatform } from '../../utils/platform.js';
import TouchDragHandle from '../shared/TouchDragHandle.jsx';

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.5M4.5 4.5 5 13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M11 2.5 13.5 5 5 13.5 2 14l0.5-3L11 2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FlagIcon({ filled }) {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path d="M4 2v12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      <path
        d="M4 2.5 12 5 4 7.5 Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function BeatCard({ card, actId, number }) {
  const { dragState, beginDrag, endDrag, updateDropPreview, dropCard, navigate, updateCard, openCardMenu, requestDeleteCard } =
    useProject();
  const [editingField, setEditingField] = useState(null); // 'title' | 'description' | null
  const isDragging = dragState?.cardId === card.id;
  const editing = editingField !== null;
  // Where a touch drag is currently hovering, so touchend (which fires on
  // this card, the drag's origin, not wherever the finger ends up) knows
  // which act to drop into -- unlike native HTML5 DnD, touch events don't
  // bubble/target based on the finger's current position, they stay
  // captured on the element the gesture started on.
  const touchHoverActIdRef = useRef(null);

  function openEditor() {
    navigate('editor', { actId, cardId: card.id, label: card.title, source: 'beat card' });
  }

  function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    beginDrag(card.id, actId);
  }

  // Touch equivalent of the handleDragStart/Column.jsx-handleDragOver/
  // handleDrop/endDrag chain above -- same underlying beginDrag/
  // updateDropPreview/dropCard/endDrag calls, just driven by manually
  // hit-testing document.elementFromPoint(x, y) each move instead of relying
  // on the browser's native dragover targeting (which touch has no
  // equivalent of).
  function handleTouchDragMove(x, y) {
    const el = document.elementFromPoint(x, y);
    const columnCardsEl = el?.closest('.board-col-cards');
    const actIdAtPoint = columnCardsEl?.closest('[data-act-id]')?.dataset.actId;
    if (!actIdAtPoint) return;
    touchHoverActIdRef.current = actIdAtPoint;
    const cardEls = [...columnCardsEl.querySelectorAll('.beat-card')].filter((c) => c.dataset.cardId !== card.id);
    let beforeCardId = null;
    let closestOffset = -Infinity;
    cardEls.forEach((cardEl) => {
      const box = cardEl.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        beforeCardId = cardEl.dataset.cardId;
      }
    });
    updateDropPreview(actIdAtPoint, beforeCardId);
  }

  function handleTouchDrop() {
    if (touchHoverActIdRef.current) dropCard(touchHoverActIdRef.current);
    touchHoverActIdRef.current = null;
    endDrag();
  }

  // Long-press anywhere on the card body opens the same menu a right-click
  // would -- safe to attach broadly since it only ever cancels on
  // movement, it never hijacks a scroll the way starting a drag from
  // anywhere on the card would (see the handle below for why dragging
  // itself needs a dedicated target instead).
  const longPress = useLongPress((x, y) => {
    if (editing) return;
    openCardMenu(actId, card.id, x, y, { title: card.title });
  });

  const dragHandleRef = useTouchDragHandle({
    onDragStart: () => beginDrag(card.id, actId),
    onDragMove: handleTouchDragMove,
    onDrop: handleTouchDrop,
    enabled: isTouchPlatform(),
  });

  function handleCardDoubleClick() {
    if (editing) return;
    openEditor();
  }

  // Double/triple-click on the title or description text is always a normal
  // text selection (word / line) -- never opens the Editor. Only a
  // double-click on the card's background (this handler bubbling up
  // unblocked) does that. Stopping propagation here just keeps the click off
  // the card-level handler; it doesn't preventDefault, so the browser's own
  // double-click-selects-word / triple-click-selects-line behavior proceeds.
  function handleFieldDoubleClick(e) {
    e.stopPropagation();
  }

  function handleContextMenu(e) {
    if (editing) return; // let the native text-editing context menu show instead
    e.preventDefault();
    openCardMenu(actId, card.id, e.clientX, e.clientY, { title: card.title });
  }

  function handleEditIconClick(e) {
    e.stopPropagation();
    openEditor();
  }

  function handleFlagClick(e) {
    e.stopPropagation();
    updateCard(actId, card.id, { isFlagged: !card.isFlagged });
  }

  function handleDeleteClick(e) {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    requestDeleteCard(actId, card.id, card.title, rect.left, rect.bottom + 4);
  }

  function handleTitleBlur(e) {
    setEditingField(null);
    const text = e.currentTarget.textContent.trim() || card.title;
    updateCard(actId, card.id, { title: text });
  }

  function handleDescBlur(e) {
    setEditingField(null);
    const text = e.currentTarget.textContent.trim() || card.description;
    updateCard(actId, card.id, { description: text });
  }

  function handleFieldKeyDown(e) {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }

  // A right-click on a contentEditable field focuses it just like a left
  // click would, which would make handleContextMenu think an edit is in
  // progress and defer to the native menu -- even though the user never
  // actually started editing. Block only the focus-shift half of a
  // right-click's mousedown so the card's own context menu still gets a
  // chance (a field that's already genuinely focused stays that way).
  function blockRightClickFocus(e) {
    if (e.button === 2) e.preventDefault();
  }

  const tag = `SC. ${String(number).padStart(2, '0')}`;

  return (
    <div
      className={`beat-card${isDragging ? ' dragging' : ''}${card.isFlagged ? ' flagged' : ''}`}
      draggable={!editing}
      data-card-id={card.id}
      onDragStart={handleDragStart}
      onDragEnd={endDrag}
      onDoubleClick={handleCardDoubleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onTouchCancel={longPress.onTouchCancel}
    >
      <TouchDragHandle dragRef={dragHandleRef} corner="top-left" />
      <div className="beat-card-actions">
        <button
          className="beat-card-icon-btn"
          title="Delete"
          draggable={false}
          onClick={handleDeleteClick}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <TrashIcon />
        </button>
        <button
          className="beat-card-icon-btn"
          title="Open in Editor"
          draggable={false}
          onClick={handleEditIconClick}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <PencilIcon />
        </button>
        <button
          className={`beat-card-icon-btn${card.isFlagged ? ' flagged' : ''}`}
          title={card.isFlagged ? 'Remove flag' : 'Flag this beat'}
          draggable={false}
          onClick={handleFlagClick}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <FlagIcon filled={card.isFlagged} />
        </button>
      </div>
      <div className="beat-card-num">{tag}</div>
      <div
        className="beat-card-title"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={() => setEditingField('title')}
        onBlur={handleTitleBlur}
        onKeyDown={handleFieldKeyDown}
        onMouseDown={blockRightClickFocus}
        onDoubleClick={handleFieldDoubleClick}
      >
        {card.title}
      </div>
      <div
        className="beat-card-desc"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        onFocus={() => setEditingField('description')}
        onBlur={handleDescBlur}
        onKeyDown={handleFieldKeyDown}
        onMouseDown={blockRightClickFocus}
        onDoubleClick={handleFieldDoubleClick}
      >
        {card.description}
      </div>
    </div>
  );
}
