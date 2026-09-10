import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';

function DocFolder({
  docType,
  activeDocId,
  isDragging,
  showIndicatorBefore,
  onAdd,
  onFileClick,
  onFileContextMenu,
  onDragStart,
  onDragEnd,
  onContextMenu,
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {showIndicatorBefore && <div className="drop-indicator" />}
      <div
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
              <button
                key={doc.id}
                className={`file${activeDocId === doc.id ? ' active' : ''}`}
                onClick={() => onFileClick(docType.id, doc.id)}
                onContextMenu={(e) => onFileContextMenu(e, docType.id, doc.id, title)}
              >
                {title}
              </button>
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

  function handleDocTypeContextMenu(e, docType) {
    e.preventDefault();
    openDocTypeMenu(docType.id, docType.pluralLabel, e.clientX, e.clientY);
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

      <div onDragOver={handleDragOver} onDrop={handleDrop}>
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
            onDragStart={() => beginDocTypeDrag(docType.id)}
            onDragEnd={endDocTypeDrag}
            onContextMenu={(e) => handleDocTypeContextMenu(e, docType)}
          />
        ))}
        {showIndicatorAt === null && docTypeDrag && <div className="drop-indicator" />}
      </div>
    </div>
  );
}
