import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';

function DocFolder({ label, docs, docType, activeDocId, defaultOpen, onAdd, onFileClick, onFileContextMenu }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <div className="folder-row">
        <button className="folder" onClick={() => setOpen((o) => !o)}>
          <span className="folder-icon">{open ? '▾' : '▸'}</span>
          {label}
        </button>
        <button className="folder-add" onClick={onAdd} title={`New ${label.toLowerCase()} file`}>
          +
        </button>
      </div>
      {open && (
        <div className="folder-children">
          {docs.map((doc) => {
            const title = titleFromMarkdown(doc.content, 'Untitled');
            return (
              <button
                key={doc.id}
                className={`file${activeDocId === doc.id ? ' active' : ''}`}
                onClick={() => onFileClick(docType, doc.id)}
                onContextMenu={(e) => onFileContextMenu(e, docType, doc.id, title)}
              >
                {title}
              </button>
            );
          })}
          {docs.length === 0 && <div className="folder-empty">No files yet.</div>}
        </div>
      )}
    </>
  );
}

export default function FileTree() {
  const { project, view, navigate, addCharacterDoc, addNoteDoc, openFileMenu, showToast } = useProject();
  const activeDocId = view.name === 'doc' ? view.payload?.docId : null;
  const activeDocType = view.name === 'doc' ? view.payload?.docType : null;

  function handleFileClick(docType, docId) {
    navigate('doc', { docType, docId });
  }

  function handleFileContextMenu(e, docType, docId, title) {
    e.preventDefault();
    openFileMenu(docType, docId, e.clientX, e.clientY, title);
  }

  return (
    <div className="files">
      <div className="files-h">
        <span>{project.name.toUpperCase()}</span>
        <button className="files-h-add" onClick={() => showToast('Adding files isn’t available yet')} title="Add file">
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

      <DocFolder
        label="Character Bible"
        docs={project.characterBible}
        docType="characterBible"
        activeDocId={activeDocType === 'characterBible' ? activeDocId : null}
        defaultOpen
        onAdd={addCharacterDoc}
        onFileClick={handleFileClick}
        onFileContextMenu={handleFileContextMenu}
      />
      <DocFolder
        label="Notes & Research"
        docs={project.notesResearch}
        docType="notesResearch"
        activeDocId={activeDocType === 'notesResearch' ? activeDocId : null}
        defaultOpen
        onAdd={addNoteDoc}
        onFileClick={handleFileClick}
        onFileContextMenu={handleFileContextMenu}
      />
    </div>
  );
}
