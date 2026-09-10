import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

const THEME_OPTIONS = [
  { value: 'dark', label: 'Dark', hint: 'Production Deck' },
  { value: 'light', label: 'Light', hint: 'Day mode' },
];

export default function SettingsView() {
  const { theme, setTheme } = useProject();

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
        </div>
      </div>
    </div>
  );
}
