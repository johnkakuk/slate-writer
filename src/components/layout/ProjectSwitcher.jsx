import React, { useState } from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import ProjectContextMenu from './ProjectContextMenu.jsx';
import ProjectDeleteConfirmPopover from './ProjectDeleteConfirmPopover.jsx';
import { useLongPress } from '../../utils/useLongPress.js';

function ProjectItemButton({ project, active, onSelect, onOpenMenu }) {
  const longPress = useLongPress((x, y) => onOpenMenu(x, y));
  return (
    <button
      className={`project-item${active ? ' active' : ''}`}
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(e.clientX, e.clientY);
      }}
      onTouchStart={longPress.onTouchStart}
      onTouchMove={longPress.onTouchMove}
      onTouchEnd={longPress.onTouchEnd}
      onTouchCancel={longPress.onTouchCancel}
    >
      {project.name}
    </button>
  );
}

export default function ProjectSwitcher() {
  const { projects, currentProjectId, switchProject, createProject, renameProject, openProjectMenu } =
    useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

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

  function startRename(id, name) {
    // The rename input lives in the (CSS-hidden-when-closed) dropdown list --
    // right-clicking the trigger itself can request a rename while the
    // dropdown is still closed, so make sure it's open or the input would be
    // invisible.
    setOpen(true);
    setQuery('');
    setRenamingId(id);
    setRenameValue(name);
  }

  function handleRenameSubmit(e) {
    e.preventDefault();
    renameProject(renamingId, renameValue);
    setRenamingId(null);
  }

  const currentName = projects[currentProjectId]?.name ?? 'Untitled';

  const triggerLongPress = useLongPress((x, y) => openProjectMenu(currentProjectId, currentName, x, y));

  return (
    <div className={`project${open ? ' open' : ''}`}>
      <button
        className="project-trigger"
        onClick={() => setOpen((o) => !o)}
        onContextMenu={(e) => {
          e.preventDefault();
          openProjectMenu(currentProjectId, currentName, e.clientX, e.clientY);
        }}
        onTouchStart={triggerLongPress.onTouchStart}
        onTouchMove={triggerLongPress.onTouchMove}
        onTouchEnd={triggerLongPress.onTouchEnd}
        onTouchCancel={triggerLongPress.onTouchCancel}
      >
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
          {filtered.map((p) =>
            renamingId === p.id ? (
              <form key={p.id} onSubmit={handleRenameSubmit}>
                <input
                  className="project-item-rename-input"
                  type="text"
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  onBlur={() => {
                    if (renameValue.trim()) renameProject(p.id, renameValue);
                    setRenamingId(null);
                  }}
                />
              </form>
            ) : (
              <ProjectItemButton
                key={p.id}
                project={p}
                active={p.id === currentProjectId}
                onSelect={() => handleSelect(p.id)}
                onOpenMenu={(x, y) => openProjectMenu(p.id, p.name, x, y)}
              />
            )
          )}
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
      <ProjectContextMenu onRename={startRename} />
      <ProjectDeleteConfirmPopover />
    </div>
  );
}
