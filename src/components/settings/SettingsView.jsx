import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import FontSelect from './FontSelect.jsx';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', hint: 'Production Deck' },
  { value: 'light', label: 'Light', hint: 'Day mode' },
];

export default function SettingsView() {
  const { theme, setTheme, fontId, setFontId, scriptFontId, setScriptFontId } = useProject();

  return (
    <div className="settings-view">
      <div className="board-head">
        <div>
          <div className="board-title">Settings</div>
          <div className="board-sub">App-level preferences — not tied to a specific project.</div>
        </div>
      </div>

      <div className="settings-body">
        <div className="settings-section">
          <div className="settings-section-label">Appearance</div>
          <div className="theme-toggle">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`theme-toggle-btn${theme === opt.value ? ' active' : ''}`}
                onClick={() => setTheme(opt.value)}
              >
                <span className="theme-toggle-label">{opt.label}</span>
                <span className="theme-toggle-hint">{opt.hint}</span>
              </button>
            ))}
          </div>

          <div className="settings-subsection-label">Font</div>
          <div className="settings-font-grid">
            <div className="settings-field">
              <label className="settings-field-label">UI</label>
              <FontSelect value={fontId} onChange={setFontId} />
              <div className="settings-field-hint">The app itself — sidebar, cards, everything but the script.</div>
            </div>
            <div className="settings-field">
              <label className="settings-field-label">Editor</label>
              <FontSelect value={scriptFontId} onChange={setScriptFontId} />
              <div className="settings-field-hint">The script itself — the Editor and the Screenplay view.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
