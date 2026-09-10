import React, { useEffect, useRef, useState } from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { Node } from 'prosemirror-model';
import { useProject } from '../../state/ProjectContext.jsx';
import { schema } from '../../editor/schema.js';
import { editorKeymap } from '../../editor/keymap.js';
import { autoCapsPlugin } from '../../editor/autoCapsPlugin.js';
import { placeholderPlugin } from '../../editor/placeholderPlugin.js';
import { slashMenuPlugin, slashMenuKey } from '../../editor/slashMenu/slashMenuPlugin.js';
import SlashMenu from '../../editor/slashMenu/SlashMenu.jsx';
import { findBlockById } from '../../editor/docUtils.js';

// Not read reactively: the document loaded here becomes the live editing
// session's own state. Edits flow *out* to ProjectContext (updateScreenplayDoc)
// on every change; they don't flow back in, so typing here is never fought
// by a re-render from elsewhere in the app.
export default function Editor() {
  const { project, view, updateScreenplayDoc } = useProject();
  const mountRef = useRef(null);
  const viewRef = useRef(null);
  const initialDocRef = useRef(project.screenplayDoc);
  const initialTargetRef = useRef(view.payload);
  const [slashState, setSlashState] = useState(null);

  useEffect(() => {
    const state = EditorState.create({
      doc: Node.fromJSON(schema, initialDocRef.current),
      plugins: [slashMenuPlugin(), editorKeymap(), history(), autoCapsPlugin(), placeholderPlugin()],
    });

    const editorView = new EditorView(mountRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = editorView.state.apply(tr);
        editorView.updateState(newState);
        setSlashState(slashMenuKey.getState(newState));
        if (tr.docChanged) updateScreenplayDoc(newState.doc.toJSON());
      },
    });
    viewRef.current = editorView;
    setSlashState(slashMenuKey.getState(editorView.state));

    const target = initialTargetRef.current;
    if (target?.sceneId) {
      const found = findBlockById(editorView.state.doc, target.sceneId);
      if (found) {
        const sel = TextSelection.near(editorView.state.doc.resolve(found.pos + 1));
        editorView.dispatch(editorView.state.tr.setSelection(sel).scrollIntoView());
      }
    }
    editorView.focus();

    return () => {
      editorView.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = view.payload;

  return (
    <div className="editor-shell">
      <div className="editor-scroll">
        <div className="screenplay-head">
          <div className="board-title">Editor — {project.name}</div>
          <div className="board-sub">
            {target?.label
              ? `Opened at “${target.label}”${target.source ? ` (from ${target.source})` : ''}`
              : 'Tab or “/” to change an element’s type.'}
          </div>
        </div>
        <div className="screenplay-page editor-page" ref={mountRef} />
      </div>
      <SlashMenu view={viewRef.current} pluginState={slashState} />
    </div>
  );
}
