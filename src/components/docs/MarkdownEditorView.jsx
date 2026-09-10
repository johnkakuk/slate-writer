import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { titleFromMarkdown } from '../../utils/markdown.js';
import MarkdownRichEditor from './MarkdownRichEditor.jsx';

export default function MarkdownEditorView() {
  const { project, view, updateDocContent } = useProject();
  const { docTypeId, docId } = view.payload ?? {};
  const docType = project.docTypes.find((t) => t.id === docTypeId);
  const doc = docType?.docs.find((d) => d.id === docId);

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
        <div className="board-sub">{docType.pluralLabel} — markdown, autosaved.</div>
      </div>
      <div className="markdown-editor-scroll">
        <MarkdownRichEditor
          docId={doc.id}
          initialContent={doc.content}
          onChange={(content) => updateDocContent(docTypeId, docId, content)}
        />
      </div>
    </div>
  );
}
