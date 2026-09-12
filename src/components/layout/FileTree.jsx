import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';
import { useLongPress } from '../../utils/useLongPress.js';
import { useLongPressOrDrag } from '../../utils/useLongPressOrDrag.js';

function DocFolder({
  docType,
  activeDocId,
  isDragging,
  showIndicatorBefore,
  onAdd,
  onFileClick,
  onFileContextMenu,
  onFileLongPress,
  onDragStart,
  onDragEnd,
  onContextMenu,
  onLongPress,
  onTouchDragMove,
  onTouchDrop,
}) {
  const [open, setOpen] = useState(true);
  // No dedicated drag handle here (contrast BeatCard.jsx) -- a folder row
  // holding still for the full long-press duration before any movement is
  // what arms a drag, so a normal scroll swipe (which starts moving almost
  // immediately) never gets hijacked. See useLongPressOrDrag.js.
  const rowRef = useLongPressOrDrag({
    onLongPress: (x, y) => onLongPress(x, y, docType),
    onDragStart: () => onDragStart(),
    onDragMove: onTouchDragMove,
    onDrop: onTouchDrop,
  });

  return (
    <>
      {showIndicatorBefore && <div className="drop-indicator" />}
      <div
        ref={rowRef}
        className={`folder-row${isDragging ? ' dragging' : ''}`}
        draggable
        data-doctype-id={docType.id}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
      >
        <button className="folder" onClick={() => setOpen((o) => !o)}>
          <span className="folder-icon">{open ? '▾' : '▸'}</span>
          {docType.pluralLabel}
        </button>
        <button className="folder-add" onClick={onAdd} title={`Add ${docType.singularLabel}`}>
          +
        </button>
      </div>
      {open && (
        <div className="folder-children">
          {docType.docs.map((doc) => {
            const title = titleFromMarkdown(doc.content, 'Untitled');
            return (
              <FileRow
                key={doc.id}
                active={activeDocId === doc.id}
                title={title}
                onClick={() => onFileClick(docType.id, doc.id)}
                onContextMenu={(e) => onFileContextMenu(e, docType.id, doc.id, title)}
                onLongPress={(x, y) => onFileLongPress(x, y, docType.id, doc.id, title)}
              />
            );
          })}
          {docType.docs.length === 0 && (
            <button className="folder-empty-add" onClick={onAdd}>
              + {docType.singularLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function FileRow({ active, title, onClick, onContextMenu, onLongPress }) {
  const longPress = useLongPress(onLongPress);
  return (
    <button
      className={`file${active ? ' active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onTouchCancel={longPress.onTouchCancel}
    >
      {title}
    </button>
  );
}

export default function FileTree() {
  const {
    project,
    view,
    navigate,
    addDoc,
    openFileMenu,
    openAddDocTypeModal,
    openDocTypeMenu,
    docTypeDrag,
    docTypeDropPreview,
    beginDocTypeDrag,
    endDocTypeDrag,
    updateDocTypeDropPreview,
    dropDocType,
  } = useProject();
  const activeDocId = view.name === 'doc' ? view.payload?.docId : null;
  const activeDocTypeId = view.name === 'doc' ? view.payload?.docTypeId : null;

  function handleFileClick(docTypeId, docId) {
    navigate('doc', { docTypeId, docId });
  }

  function handleFileContextMenu(e, docTypeId, docId, title) {
    e.preventDefault();
    openFileMenu(docTypeId, docId, e.clientX, e.clientY, title);
  }

  function handleFileLongPress(x, y, docTypeId, docId, title) {
    openFileMenu(docTypeId, docId, x, y, title);
  }

  function handleDocTypeContextMenu(e, docType) {
    e.preventDefault();
    openDocTypeMenu(docType.id, docType.pluralLabel, e.clientX, e.clientY);
  }

  function handleDocTypeLongPress(x, y, docType) {
    openDocTypeMenu(docType.id, docType.pluralLabel, x, y);
  }

  // Only the custom doc-type folders reorder -- Outline/Beats, Title Page,
  // and Screenplay above them are fixed nav, not part of this drag
  // container at all, so they're never in reach of this handler.
  function handleDragOver(e) {
    e.preventDefault();
    if (!docTypeDrag) return;
    const container = e.currentTarget;
    const rows = [...container.querySelectorAll('.folder-row')].filter(
      (el) => el.dataset.doctypeId !== docTypeDrag.docTypeId
    );
    let beforeDocTypeId = null;
    let closestOffset = -Infinity;
    rows.forEach((el) => {
      const box = el.getBoundingClientRect();
      const offset = e.clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        beforeDocTypeId = el.dataset.doctypeId;
      }
    });
    updateDocTypeDropPreview(beforeDocTypeId);
  }

  function handleDrop(e) {
    e.preventDefault();
    dropDocType();
  }

  // Touch equivalent of handleDragOver/handleDrop above -- same underlying
  // updateDocTypeDropPreview/dropDocType calls, driven by manually
  // hit-testing document.elementFromPoint(x, y) instead of relying on
  // native dragover targeting, which touch doesn't have. docTypeDrag itself
  // is set by the drag handle's onDragStart (useTouchDragHandle), so by the
  // time this fires it's already the same shared state the mouse path uses.
  function handleTouchDragMove(x, y) {
    if (!docTypeDrag) return;
    const el = document.elementFromPoint(x, y);
    const container = el?.closest('.doctype-list');
    if (!container) return;
    const rows = [...container.querySelectorAll('.folder-row')].filter(
      (rowEl) => rowEl.dataset.doctypeId !== docTypeDrag.docTypeId
    );
    let beforeDocTypeId = null;
    let closestOffset = -Infinity;
    rows.forEach((rowEl) => {
      const box = rowEl.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closestOffset) {
        closestOffset = offset;
        beforeDocTypeId = rowEl.dataset.doctypeId;
      }
    });
    updateDocTypeDropPreview(beforeDocTypeId);
  }

  function handleTouchDrop() {
    dropDocType();
    endDocTypeDrag();
  }

  const showIndicatorAt = docTypeDropPreview?.beforeDocTypeId;

  return (
    <div className="files">
      <div className="files-h">
        <span>{project.name.toUpperCase()}</span>
        <button className="files-h-add" onClick={openAddDocTypeModal} title="Add data type">
          +
        </button>
      </div>

      <button
        className={`nav-item${view.name === 'outline' ? ' active' : ''}`}
        onClick={() => navigate('outline')}
      >
        <span className="dot" />
        Outline / Beats
      </button>
      <button
        className={`nav-item${view.name === 'titlePage' ? ' active' : ''}`}
        onClick={() => navigate('titlePage')}
      >
        <span className="dot" />
        Title Page
      </button>
      <button
        className={`nav-item${view.name === 'screenplay' ? ' active' : ''}`}
        onClick={() => navigate('screenplay')}
      >
        <span className="dot" />
        Screenplay
      </button>

      <div className="doctype-list" onDragOver={handleDragOver} onDrop={handleDrop}>
        {project.docTypes.map((docType) => (
          <DocFolder
            key={docType.id}
            docType={docType}
            activeDocId={activeDocTypeId === docType.id ? activeDocId : null}
            isDragging={docTypeDrag?.docTypeId === docType.id}
            showIndicatorBefore={showIndicatorAt === docType.id}
            onAdd={() => addDoc(docType.id)}
            onFileClick={handleFileClick}
            onFileContextMenu={handleFileContextMenu}
            onFileLongPress={handleFileLongPress}
            onDragStart={() => beginDocTypeDrag(docType.id)}
            onDragEnd={endDocTypeDrag}
            onContextMenu={(e) => handleDocTypeContextMenu(e, docType)}
            onLongPress={handleDocTypeLongPress}
            onTouchDragMove={handleTouchDragMove}
            onTouchDrop={handleTouchDrop}
          />
        ))}
        {showIndicatorAt === null && docTypeDrag && <div className="drop-indicator" />}
      </div>
    </div>
  );
}
