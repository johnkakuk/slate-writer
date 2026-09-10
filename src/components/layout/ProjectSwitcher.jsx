import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function ProjectSwitcher() {
  const { projects, currentProjectId, switchProject, createProject } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const projectList = Object.values(projects).sort((a, b) => a.name.localeCompare(b.name));
  const filtered = query.trim()
    ? projectList.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    : projectList;

  function handleSelect(id) {
    switchProject(id);
    setOpen(false);
    setQuery('');
  }

  function handleCreateSubmit(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    createProject(newName);
    setNewName('');
    setCreating(false);
    setOpen(false);
    setQuery('');
  }

  const currentName = projects[currentProjectId]?.name ?? 'Untitled';

  return (
    <div className={`project${open ? ' open' : ''}`}>
      <button className="project-trigger" onClick={() => setOpen((o) => !o)}>
        <span>{currentName}</span>
        <span className="project-chevron">▾</span>
      </button>
      <div className="project-dropdown">
        <input
          className="project-search"
          type="text"
          placeholder="Search projects…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="project-list">
          {filtered.map((p) => (
            <button
              key={p.id}
              className={`project-item${p.id === currentProjectId ? ' active' : ''}`}
              onClick={() => handleSelect(p.id)}
            >
              {p.name}
            </button>
          ))}
          {filtered.length === 0 && <div className="project-empty">No projects match.</div>}
        </div>
        <div className="project-new">
          {creating ? (
            <form onSubmit={handleCreateSubmit}>
              <input
                className="project-new-input"
                type="text"
                autoFocus
                placeholder="Project name…"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setCreating(false);
                    setNewName('');
                  }
                }}
                onBlur={() => {
                  if (!newName.trim()) setCreating(false);
                }}
              />
            </form>
          ) : (
            <button className="project-new-btn" onClick={() => setCreating(true)}>
              + New Project
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
