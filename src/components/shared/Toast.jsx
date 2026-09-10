import React from 'react';
import { useProject } from '../../state/ProjectContext.jsx';

export default function Toast() {
  const { toast } = useProject();
  return (
    <div className={`toast${toast ? ' show' : ''}`}>{toast?.message ?? ''}</div>
  );
}
