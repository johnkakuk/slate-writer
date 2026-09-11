import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import FontSelect from './FontSelect.jsx';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', hint: 'Production Deck' },
  { value: 'light', label: 'Light', hint: 'Day mode' },
];

const HIGHLIGHT_STYLE_OPTIONS = [
  { value: 'paragraph', label: 'Paragraph', hint: 'Full-width highlight' },
  { value: 'line', label: 'Line', hint: 'Just the current line' },
  { value: 'underline', label: 'Underline', hint: 'No background fill' },
  { value: 'none', label: 'None', hint: 'Sticky scroll only' },
];

export default function SettingsView() {
  const {
    theme,
    setTheme,
    fontId,
    setFontId,
    scriptFontId,
    setScriptFontId,
    typewriterMode,
    setTypewriterMode,
    typewriterHighlightStyle,
    setTypewriterHighlightStyle,
    autoParenthetical,
    setAutoParenthetical,
  } = useProject();

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

        <div className="settings-section">
          <div className="settings-section-label">Editor</div>
          <div className="settings-subsection-label">Typewriter Mode</div>
          <div className="theme-toggle">
            <button
              className={`theme-toggle-btn${!typewriterMode ? ' active' : ''}`}
              onClick={() => setTypewriterMode(false)}
            >
              <span className="theme-toggle-label">Off</span>
              <span className="theme-toggle-hint">Normal scrolling</span>
            </button>
            <button
              className={`theme-toggle-btn${typewriterMode ? ' active' : ''}`}
              onClick={() => setTypewriterMode(true)}
            >
              <span className="theme-toggle-label">On</span>
              <span className="theme-toggle-hint">Active line stays put as you write</span>
            </button>
          </div>
          <div className="settings-field-hint">
            Scroll the Editor while writing to reposition where the active line sticks.
          </div>

          {typewriterMode && (
            <>
              <div className="settings-subsection-label">Active Line Highlight</div>
              <div className="theme-toggle">
                {HIGHLIGHT_STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`theme-toggle-btn${typewriterHighlightStyle === opt.value ? ' active' : ''}`}
                    onClick={() => setTypewriterHighlightStyle(opt.value)}
                  >
                    <span className="theme-toggle-label">{opt.label}</span>
                    <span className="theme-toggle-hint">{opt.hint}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <div className="settings-subsection-label">Auto Parenthetical</div>
          <div className="theme-toggle">
            <button
              className={`theme-toggle-btn${!autoParenthetical ? ' active' : ''}`}
              onClick={() => setAutoParenthetical(false)}
            >
              <span className="theme-toggle-label">Off</span>
              <span className="theme-toggle-hint">Use the slash menu only</span>
            </button>
            <button
              className={`theme-toggle-btn${autoParenthetical ? ' active' : ''}`}
              onClick={() => setAutoParenthetical(true)}
            >
              <span className="theme-toggle-label">On</span>
              <span className="theme-toggle-hint">Typing "(" converts the line</span>
            </button>
          </div>
          <div className="settings-field-hint">
            Typing "(" as the first character of an empty Dialogue or Action line converts it to a Parenthetical.
          </div>
        </div>
      </div>
    </div>
  );
}
