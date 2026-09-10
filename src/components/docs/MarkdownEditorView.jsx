import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';

const DOC_TYPE_LABEL = {
  characterBible: 'Character Bible',
  notesResearch: 'Notes & Research',
};

function handleTabKey(e) {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const el = e.currentTarget;
  const { selectionStart, selectionEnd, value } = el;
  const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
  el.value = next;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  requestAnimationFrame(() => {
    el.selectionStart = el.selectionEnd = selectionStart + 2;
  });
}

export default function MarkdownEditorView() {
  const { project, view, updateDocContent } = useProject();
  const { docType, docId } = view.payload ?? {};
  const doc = project[docType]?.find((d) => d.id === docId);

  if (!doc) {
    return (
      <div className="placeholder-view">
        <h2>File not found</h2>
        <p>This document may have been deleted. Pick something from the sidebar.</p>
      </div>
    );
  }

  const title = titleFromMarkdown(doc.content, 'Untitled');

  return (
    <div className="markdown-editor-shell">
      <div className="screenplay-head">
        <div className="board-title">{title}</div>
        <div className="board-sub">{DOC_TYPE_LABEL[docType] ?? 'Document'} — plain markdown, autosaved.</div>
      </div>
      <div className="markdown-editor-scroll">
        <textarea
          key={doc.id}
          className="markdown-editor"
          defaultValue={doc.content}
          spellCheck={false}
          onChange={(e) => updateDocContent(docType, docId, e.target.value)}
          onKeyDown={handleTabKey}
        />
      </div>
    </div>
  );
}
