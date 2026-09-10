import React, { useEffect, useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import MarkdownRichEditor from '../docs/MarkdownRichEditor.jsx';

// Add/Edit are the same form -- the only difference is which action fires
// on save. Delete deliberately isn't offered here; it lives on the
// folder's own right-click menu (DocTypeContextMenu.jsx), same place every
// other delete in this app lives, not buried inside an edit modal.
export default function DocTypeModal() {
  const { docTypeModal, closeDocTypeModal, addDocType, updateDocType } = useProject();
  const [pluralLabel, setPluralLabel] = useState('');
  const [singularLabel, setSingularLabel] = useState('');
  const [template, setTemplate] = useState('');

  useEffect(() => {
    if (!docTypeModal) return;
    setPluralLabel(docTypeModal.pluralLabel ?? '');
    setSingularLabel(docTypeModal.singularLabel ?? '');
    setTemplate(docTypeModal.template ?? '');
  }, [docTypeModal]);

  useEffect(() => {
    if (!docTypeModal) return undefined;
    function handleKeyDown(e) {
      if (e.key === 'Escape') closeDocTypeModal();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [docTypeModal, closeDocTypeModal]);

  if (!docTypeModal) return null;

  const isEdit = docTypeModal.mode === 'edit';
  const trimmedPlural = pluralLabel.trim();

  function handleSave() {
    if (!trimmedPlural) return;
    const payload = { pluralLabel, singularLabel, template };
    if (isEdit) updateDocType(docTypeModal.docTypeId, payload);
    else addDocType(payload);
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeDocTypeModal();
      }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{isEdit ? 'Edit Data Type' : 'Add Data Type'}</div>
          <button className="modal-close" onClick={closeDocTypeModal} title="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <label className="modal-field-label" htmlFor="doctype-plural">
            Plural Label
          </label>
          <input
            id="doctype-plural"
            className="modal-input"
            value={pluralLabel}
            onChange={(e) => setPluralLabel(e.target.value)}
            placeholder='i.e. "Locations"'
            autoFocus
          />

          <label className="modal-field-label" htmlFor="doctype-singular">
            Singular Label
          </label>
          <input
            id="doctype-singular"
            className="modal-input"
            value={singularLabel}
            onChange={(e) => setSingularLabel(e.target.value)}
            placeholder='i.e. "Location"'
          />

          <label className="modal-field-label">Default template (optional)</label>
          <div className="modal-template-editor">
            {/* initialContent reads docTypeModal.template directly, not the
                `template` state below -- MarkdownRichEditor is uncontrolled
                and seeds itself once, at mount, from whatever initialContent
                is on the render where its `key` first appears. `template`
                state only catches up to docTypeModal.template a render
                later (via the effect above), which is too late for a fresh
                mount: Edit would open showing a blank editor even though a
                template already exists. `template` state still tracks
                edits (onChange) and is what actually gets saved. */}
            <MarkdownRichEditor
              key={docTypeModal.key}
              docId={docTypeModal.key}
              initialContent={docTypeModal.template ?? ''}
              onChange={setTemplate}
              placeholder="Paste markdown"
            />
          </div>
          <div className="modal-field-hint">
            Seeds every new file in this section. Leave blank to start new files empty.
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={closeDocTypeModal}>
            Cancel
          </button>
          <button className="modal-save-btn" onClick={handleSave} disabled={!trimmedPlural}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
