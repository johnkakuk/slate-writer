import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { CHARACTER_BIBLE_FILES, NOTES_RESEARCH_FILES, TRASH_FILES } from '../../state/sampleData.js';

const FOLDERS = [
  { key: 'character-bible', label: 'Character Bible', files: CHARACTER_BIBLE_FILES, defaultOpen: true },
  { key: 'notes-research', label: 'Notes & Research', files: NOTES_RESEARCH_FILES, defaultOpen: true },
  { key: 'trash', label: 'Trash', files: TRASH_FILES, defaultOpen: false },
];

function Folder({ folder, activeFile, onFileClick }) {
  const [open, setOpen] = useState(folder.defaultOpen);
  return (
    <>
      <button className="folder" onClick={() => setOpen((o) => !o)}>
        <span className="folder-icon">{open ? '▾' : '▸'}</span>
        {folder.label}
      </button>
      {open && (
        <div className="folder-children">
          {folder.files.map((file) => (
            <button
              key={file}
              className={`file${activeFile === `${folder.key}:${file}` ? ' active' : ''}`}
              onClick={() => onFileClick(folder.key, file)}
            >
              {file}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export default function FileTree() {
  const { project, view, navigate, showToast } = useProject();
  const activeFile = view.name === 'stub' ? view.payload?.fileKey : null;

  function handleFileClick(folderKey, file) {
    navigate('stub', { label: file, fileKey: `${folderKey}:${file}` });
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
        className={`nav-item${view.name === 'screenplay' ? ' active' : ''}`}
        onClick={() => navigate('screenplay')}
      >
        <span className="dot" />
        Screenplay
      </button>

      {FOLDERS.map((folder) => (
        <Folder key={folder.key} folder={folder} activeFile={activeFile} onFileClick={handleFileClick} />
      ))}
    </div>
  );
}
