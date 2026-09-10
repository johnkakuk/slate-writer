import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { ELEMENT_TYPE_BY_NAME } from '../../editor/elementTypes.js';

function nodeText(node) {
  return (node.content ?? []).map((c) => c.text ?? '').join('');
}

// Renders the live screenplay document read-only — this *is* the document
// the Editor edits (src/state/ProjectContext.jsx `project.screenplayDoc`),
// not a separate derived copy, so there's nothing to keep in sync.
export default function ScreenplayView() {
  const { project, navigate } = useProject();
  const nodes = project.screenplayDoc?.content ?? [];

  function handleLineClick(node) {
    navigate('editor', { sceneId: node.attrs?.id, label: nodeText(node), source: 'screenplay line' });
  }

  return (
    <div className="screenplay">
      <div className="screenplay-head">
        <div className="board-title">Screenplay — {project.name}</div>
        <div className="board-sub">Read-only. Click any line to open it in the Editor.</div>
      </div>
      <div className="screenplay-scroll">
        <div className="screenplay-page">
          {nodes.map((node, idx) => {
            const meta = ELEMENT_TYPE_BY_NAME[node.type];
            const text = nodeText(node);
            if (!meta || !text) return null;
            return (
              <button
                key={node.attrs?.id ?? idx}
                className={`sp-block ${meta.css}`}
                onClick={() => handleLineClick(node)}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
