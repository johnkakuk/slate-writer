import React from 'react';
import { ProjectProvider } from './state/ProjectContext.jsx';
import AppShell from './components/layout/AppShell.jsx';

export default function App() {
  return (
    <ProjectProvider>
      <AppShell />
    </ProjectProvider>
  );
}
