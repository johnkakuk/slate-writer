import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import Sidebar from './Sidebar.jsx';
import TopBar from './TopBar.jsx';
import OutlineBoard from '../outline/OutlineBoard.jsx';
import ScreenplayView from '../screenplay/ScreenplayView.jsx';
import Editor from '../editor/Editor.jsx';
import SettingsView from '../settings/SettingsView.jsx';
import StubView from '../shared/StubView.jsx';
import Toast from '../shared/Toast.jsx';

function CurrentView() {
  const { view } = useProject();
  switch (view.name) {
    case 'screenplay':
      return <ScreenplayView />;
    case 'editor':
      return <Editor />;
    case 'settings':
      return <SettingsView />;
    case 'stub':
      return <StubView label={view.payload?.label} />;
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
    </div>
  );
}
