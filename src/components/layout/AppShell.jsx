import SyncNotice from '../../sync/SyncNotice.jsx';
import SyncSettings from '../../sync/SyncSettings.jsx';
import React, { useEffect, useState } from 'react';
import EditorFullscreenToggle from '../editor/EditorFullscreenToggle.jsx';
import { useProject } from '../../state/ProjectContext.jsx';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import OutlineBoard from '../outline/OutlineBoard.jsx';
import TitlePageEditor from '../titlepage/TitlePageEditor.jsx';
import ScreenplayView from '../screenplay/ScreenplayView.jsx';
import Editor from '../editor/Editor.jsx';
import MarkdownEditorView from '../docs/MarkdownEditorView.jsx';
import SettingsView from '../settings/SettingsView.jsx';
import FileContextMenu from './FileContextMenu.jsx';
import FileDeleteConfirmPopover from './FileDeleteConfirmPopover.jsx';
import DocTypeModal from './DocTypeModal.jsx';
import DocTypeContextMenu from './DocTypeContextMenu.jsx';
import DocTypeDeleteConfirmPopover from './DocTypeDeleteConfirmPopover.jsx';
import Toast from '../shared/Toast.jsx';

function CurrentView({ editorFullscreen, onExitFullscreen }) {
  const { view, sync, currentProjectId } = useProject();
  switch (view.name) {
    case 'titlePage':
      return <TitlePageEditor />;
    case 'screenplay':
      return <ScreenplayView />;
    case 'editor':
      // Keyed on the card being edited: navigating to a different beat while
      // already inside the Editor (e.g. via the Next/Previous controls)
      // must fully remount ProseMirror onto the new card's sceneDoc, not
      // reuse the mounted instance -- the editor's own effect only loads
      // its document once, on mount.
      return <Editor fullscreen={editorFullscreen} onExitFullscreen={onExitFullscreen} key={`${currentProjectId}:${view.payload?.actId ?? ''}:${view.payload?.cardId ?? ''}:${sync.remoteEpoch}`} />;
    case 'doc':
      return <MarkdownEditorView key={`${currentProjectId}:${view.payload?.docId}:${sync.remoteEpoch}`} />;
    case 'settings':
      return <SettingsView />;
    case 'outline':
    default:
      return <OutlineBoard />;
  }
}

export default function AppShell() {
  const { sidebarCollapsed, sync, project, createProject, currentProjectId, view } = useProject();
  // Presentation-only state: never synced, and never changes the saved sidebar preference.
  const [fullscreen, setFullscreen] = useState(false);
  const editorFullscreen = fullscreen && view.name === 'editor';
  useEffect(() => { setFullscreen(false); }, [view.name, currentProjectId]);
  useEffect(() => {
    if (!editorFullscreen) return;
    const onKeyDown = event => {
      // Let editor menus consume Escape first (and leave IME composition alone).
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      event.preventDefault();
      setFullscreen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [editorFullscreen]);
  if (!project) return <div className="settings-view"><p>No projects on this device.</p>
    <button className="settings-btn" onClick={() => createProject('Untitled')}>New Project</button><SyncSettings /></div>;
  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}${editorFullscreen ? ' editor-fullscreen' : ''}`}>
      <Sidebar />
      <div className="main">
        <TopBar />
        {view.name === 'editor' && <EditorFullscreenToggle active={editorFullscreen} onToggle={() => setFullscreen(value => !value)} />}
        <SyncNotice />
        <div className="sync-view" inert={sync.blocker || sync.activeConflict ? '' : undefined}>
          <CurrentView editorFullscreen={editorFullscreen} onExitFullscreen={() => setFullscreen(false)} />
        </div>
      </div>
      <Toast />
      <FileContextMenu />
      <FileDeleteConfirmPopover />
      <DocTypeModal />
      <DocTypeContextMenu />
      <DocTypeDeleteConfirmPopover />
    </div>
  );
}
