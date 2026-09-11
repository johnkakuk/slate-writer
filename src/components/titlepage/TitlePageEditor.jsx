import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import { exportScreenplayPdf } from '../../export/screenplayPdf.js';

// Deliberately plain <input>/<textarea> fields rather than the app's usual
// contentEditable spans -- this is short structured metadata, not prose, and
// the fields double as a WYSIWYG preview of the actual title page: this is
// exactly what prints on the exported PDF's first page (see
// src/export/screenplayPdf.js), laid out the same way (centered title block,
// contact info bottom-left, draft info bottom-right).
export default function TitlePageEditor() {
  const { project, updateTitlePage, showToast } = useProject();
  const tp = project.titlePage ?? {};
  const [exporting, setExporting] = useState(false);

  function field(key) {
    return {
      value: tp[key] ?? '',
      onChange: (e) => updateTitlePage({ [key]: e.target.value }),
    };
  }

  async function handleExport() {
    setExporting(true);
    try {
      // Yield a frame so the "Exporting…" label actually paints before the
      // (synchronous) PDF build work blocks the thread -- same as the
      // Screenplay view's own Export PDF button.
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
          <div className="board-title">Title Page</div>
          <div className="board-sub">This is exactly what prints on the first page of the exported PDF.</div>
        </div>
        <button className="export-btn" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>
      <div className="screenplay-scroll">
        <div className="screenplay-page title-page">
          <div className="title-page-center">
            <input
              className="title-page-field title-page-title-input"
              placeholder={project.name}
              {...field('title')}
            />
            <input className="title-page-field title-page-credit-input" placeholder="Written by" {...field('credit')} />
            <input
              className="title-page-field title-page-author-input"
              placeholder="Your name"
              {...field('author')}
            />
            <input
              className="title-page-field title-page-basedon-input"
              placeholder="Based on a story by… (optional)"
              {...field('basedOn')}
            />
          </div>
          <div className="title-page-corners">
            <textarea
              className="title-page-field title-page-contact-input"
              placeholder={'Contact info (optional)\naddress / phone / email / representation'}
              rows={4}
              {...field('contact')}
            />
            <input
              className="title-page-field title-page-draft-input"
              placeholder="Draft info (optional)"
              {...field('draftInfo')}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
