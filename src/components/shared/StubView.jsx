import React from 'react';

export default function StubView({ label }) {
  return (
    <div className="placeholder-view">
      <h2>{label} — coming soon</h2>
      <p>This screen isn’t built yet. It’s wired into navigation so the app shell is complete.</p>
    </div>
  );
}
