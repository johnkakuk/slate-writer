import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { isTouchPlatform } from './utils/platform.js';
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import './styles/index.css';

// A single root-level class every touch-specific style/behavior can key
// off, set once here rather than duplicated as inline platform checks
// scattered through the stylesheet -- keeps the "mobile-only interaction
// layer" boundary explicit and easy to audit (grep .touch-platform) instead
// of implicit in a dozen separate places.
if (isTouchPlatform()) {
  document.documentElement.classList.add('touch-platform');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
