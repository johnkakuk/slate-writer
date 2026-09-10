import React, { useRef, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

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
  const { dragState, beginDrag, endDrag, navigate, updateCard, openCardMenu, requestDeleteCard } = useProject();
  const [editingField, setEditingField] = useState(null); // 'title' | 'description' | null
  const editingSinceRef = useRef(0);
  const isDragging = dragState?.cardId === card.id;
  const editing = editingField !== null;

  // A double-click's *first* click already focuses whichever field it lands
  // on (same as a plain single click would) before the dblclick event ever
  // fires -- so "is a field focused" can't by itself tell a genuinely
  // in-progress edit (user has been typing, then double-clicks to select a
  // word) apart from a fresh double-click that just happens to land on text
  // (user wants the Editor). Telling them apart by *how long* the field has
  // been focused fixes it: freshly-focused-by-this-very-click still opens
  // the Editor; focused for a while means it's a real edit in progress.
  function isFreshFocus() {
    return editing && Date.now() - editingSinceRef.current < 500;
  }

  function openEditor() {
    navigate('editor', { sceneId: card.sceneId, label: card.title, source: 'beat card' });
  }

  function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', card.id);
    beginDrag(card.id, actId);
  }

  function handleCardDoubleClick() {
    if (editing && !isFreshFocus()) return;
    openEditor();
  }

  function handleFieldDoubleClick(e) {
    if (isFreshFocus()) return; // let it bubble up to open the Editor
    e.stopPropagation(); // genuinely mid-edit -- treat as a normal word-select
  }

  function handleContextMenu(e) {
    if (editing) return; // let the native text-editing context menu show instead
    e.preventDefault();
    openCardMenu(actId, card.id, e.clientX, e.clientY, { sceneId: card.sceneId, title: card.title });
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
    >
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
        onFocus={() => {
          editingSinceRef.current = Date.now();
          setEditingField('title');
        }}
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
        onFocus={() => {
          editingSinceRef.current = Date.now();
          setEditingField('description');
        }}
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
