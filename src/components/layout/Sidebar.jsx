import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';
import SidebarHeader from './SidebarHeader.jsx';
import ProjectSwitcher from './ProjectSwitcher.jsx';
import FileTree from './FileTree.jsx';
import SidebarFooter from './SidebarFooter.jsx';

export default function Sidebar() {
  const { sidebarCollapsed } = useProject();
  return (
    <div className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-content">
        <SidebarHeader />
        <ProjectSwitcher />
        <FileTree />
        <SidebarFooter />
      </div>
    </div>
  );
}
