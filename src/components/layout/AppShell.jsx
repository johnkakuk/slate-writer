import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import OutlineBoard from '../outline/OutlineBoard.jsx';
import ScreenplayView from '../screenplay/ScreenplayView.jsx';
import Editor from '../editor/Editor.jsx';
import MarkdownEditorView from '../docs/MarkdownEditorView.jsx';
import SettingsView from '../settings/SettingsView.jsx';
import FileContextMenu from './FileContextMenu.jsx';
import FileDeleteConfirmPopover from './FileDeleteConfirmPopover.jsx';
import Toast from '../shared/Toast.jsx';

function CurrentView() {
  const { view } = useProject();
  switch (view.name) {
    case 'screenplay':
      return <ScreenplayView />;
    case 'editor':
      return <Editor />;
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
    </div>
  );
}
