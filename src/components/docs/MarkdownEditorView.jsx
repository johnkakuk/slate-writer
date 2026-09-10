import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';
import MarkdownRichEditor from './MarkdownRichEditor.jsx';

const DOC_TYPE_LABEL = {
  characterBible: 'Character Bible',
  notesResearch: 'Notes & Research',
};

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
        <div className="board-sub">{DOC_TYPE_LABEL[docType] ?? 'Document'} — markdown, autosaved.</div>
      </div>
      <div className="markdown-editor-scroll">
        <MarkdownRichEditor
          docId={doc.id}
          initialContent={doc.content}
          onChange={(content) => updateDocContent(docType, docId, content)}
        />
      </div>
    </div>
  );
}
