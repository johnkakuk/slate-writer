import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ProjectSwitcher() {
  const { recentProjectNames, selectedProjectName, setSelectedProjectName, showToast } = useProject();
  const [open, setOpen] = useState(false);

  function handleSelect(name) {
    setSelectedProjectName(name);
    setOpen(false);
    if (name !== recentProjectNames[0]) {
      showToast('Project switching isn’t wired up yet');
    }
  }

  return (
    <div className={`project${open ? ' open' : ''}`}>
      <button className="project-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{selectedProjectName}</span>
        <span className="project-chevron">▾</span>
      </button>
      <div className="project-dropdown">
        <input className="project-search" type="text" placeholder="Search projects…" />
        <div className="project-list">
          {recentProjectNames.map((name) => (
            <button
              key={name}
              className={`project-item${name === selectedProjectName ? ' active' : ''}`}
              onClick={() => handleSelect(name)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
