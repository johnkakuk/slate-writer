import React, { useMemo, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { ELEMENT_TYPE_BY_NAME } from '../../editor/elementTypes.js';
import { exportScreenplayPdf } from '../../export/screenplayPdf.js';
import { computeScriptPagination } from '../../export/paginate.js';

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
  const { project, navigate, showToast } = useProject();
  const [exporting, setExporting] = useState(false);

  // This view is read-only and isn't mounted while the user is actively
  // typing elsewhere (there's no split-screen), so unlike the Editor's own
  // pagination effect, there's no need to debounce this -- it only
  // recomputes when `project` actually changes underneath it.
  const pagination = useMemo(() => computeScriptPagination(project), [project]);
  const pageById = useMemo(() => new Map(pagination.blocks.map((b) => [b.id, b])), [pagination]);

  function handleLineClick(act, card, node) {
    // Where the line lands in the Editor is Editor.jsx's call (currently:
    // always centered) -- this just says which line.
    navigate('editor', {
      actId: act.id,
      cardId: card.id,
      blockId: node.attrs?.id,
      label: card.title,
      source: 'screenplay line',
    });
  }

  async function handleExport() {
    setExporting(true);
    try {
      // Yield a frame so the "Exporting…" label actually paints before the
      // (synchronous) PDF build work blocks the thread.
      await new Promise((resolve) => setTimeout(resolve, 0));
      exportScreenplayPdf(project);
      showToast(`Exported “${project.name}.pdf”`);
    } catch (err) {
      console.error(err);
      showToast('Export failed — see console for details');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="screenplay">
      <div className="screenplay-head">
        <div>
          <div className="board-title">Screenplay</div>
          <div className="board-sub">Read-only. Click any line to open it in the Editor.</div>
        </div>
        <div className="screenplay-head-actions">
          <span className="page-range-badge">
            {pagination.totalPages} page{pagination.totalPages === 1 ? '' : 's'}
          </span>
          <button className="export-btn" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
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
                const id = node.attrs?.id;
                const pageInfo = pageById.get(id);
                return (
                  <React.Fragment key={id ?? `${card.id}-${idx}`}>
                    {pageInfo?.startsNewPage && <div className="page-break-marker">Page {pageInfo.page}</div>}
                    <button className={`sp-block ${meta.css}`} onClick={() => handleLineClick(act, card, node)}>
                      {text}
                    </button>
                  </React.Fragment>
                );
              });
            })
          )}
        </div>
      </div>
    </div>
  );
}
