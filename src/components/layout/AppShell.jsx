import React from 'react';
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

function CurrentView() {
  const { view } = useProject();
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
      return <Editor key={`${view.payload?.actId ?? ''}:${view.payload?.cardId ?? ''}`} />;
    case 'doc':
      return <MarkdownEditorView />;
    case 'settings':
      return <SettingsView />;
    case 'outline':
    default:
      return <OutlineBoard />;
  }
}

export default function AppShell() {
  const { sidebarCollapsed } = useProject();
  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar />
      <div className="main">
        <TopBar />
        <CurrentView />
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
