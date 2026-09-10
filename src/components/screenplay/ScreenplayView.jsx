import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { ELEMENT_TYPE_BY_NAME } from '../../editor/elementTypes.js';

function nodeText(node) {
  return (node.content ?? []).map((c) => c.text ?? '').join('');
}

// Renders a live concatenation of every beat card's own sceneDoc, in
// current outline order (acts, then cards within each act) -- computed
// fresh on every render directly from `project.acts`, not from a separately
// stored/derived document. That means there's nothing to keep in sync:
// reordering, editing, adding, or deleting a card is reflected here
// immediately just by virtue of reading the same live state.
export default function ScreenplayView() {
  const { project, navigate } = useProject();

  function handleLineClick(act, card, node) {
    navigate('editor', {
      actId: act.id,
      cardId: card.id,
      blockId: node.attrs?.id,
      label: card.title,
      source: 'screenplay line',
    });
  }

  return (
    <div className="screenplay">
      <div className="screenplay-head">
        <div className="board-title">Screenplay — {project.name}</div>
        <div className="board-sub">Read-only. Click any line to open it in the Editor.</div>
      </div>
      <div className="screenplay-scroll">
        <div className="screenplay-page">
          {project.acts.map((act) =>
            act.cards.map((card) => {
              const nodes = card.sceneDoc?.content ?? [];
              return nodes.map((node, idx) => {
                const meta = ELEMENT_TYPE_BY_NAME[node.type];
                const text = nodeText(node);
                if (!meta || !text) return null;
                return (
                  <button
                    key={node.attrs?.id ?? `${card.id}-${idx}`}
                    className={`sp-block ${meta.css}`}
                    onClick={() => handleLineClick(act, card, node)}
                  >
                    {text}
                  </button>
                );
              });
            })
          )}
        </div>
      </div>
    </div>
  );
}
