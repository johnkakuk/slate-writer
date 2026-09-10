import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { emptyDoc } from '../../editor/docJson.js';

// Not read reactively: the document loaded here becomes the live editing
// session's own state. Edits flow *out* to ProjectContext
// (updateCardSceneDoc, scoped to this one card) on every change; they
// don't flow back in, so typing here is never fought by a re-render from
// elsewhere in the app. Each card owns a separate sceneDoc, so opening a
// different card always means a fresh mount with a different document --
// there is no "same file" to leak edits between cards.
export default function Editor() {
  const { project, view, navigate, updateCardSceneDoc } = useProject();
  const { actId, cardId } = view.payload ?? {};
  const act = project.acts.find((a) => a.id === actId);
  const card = act?.cards.find((c) => c.id === cardId);

  // Every card across every act, in outline order -- the same order the
  // Screenplay view concatenates them in -- so Next/Previous walk the beats
  // the way they actually read, not just within the current act.
  const flatCards = useMemo(
    () => project.acts.flatMap((a) => a.cards.map((c) => ({ actId: a.id, cardId: c.id, title: c.title }))),
    [project.acts]
  );
  const currentIndex = flatCards.findIndex((c) => c.actId === actId && c.cardId === cardId);
  const prevCard = currentIndex > 0 ? flatCards[currentIndex - 1] : null;
  const nextCard = currentIndex >= 0 && currentIndex < flatCards.length - 1 ? flatCards[currentIndex + 1] : null;

  function goToCard(target) {
    if (!target) return;
    navigate('editor', { actId: target.actId, cardId: target.cardId, label: target.title, source: view.payload?.source });
  }

  const mountRef = useRef(null);
  const viewRef = useRef(null);
  const initialDocRef = useRef(card?.sceneDoc ?? emptyDoc());
  const initialTargetRef = useRef(view.payload);
  const [slashState, setSlashState] = useState(null);

  useEffect(() => {
    if (!card) return undefined;
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
        if (tr.docChanged) updateCardSceneDoc(actId, cardId, newState.doc.toJSON());
      },
    });
    viewRef.current = editorView;
    setSlashState(slashMenuKey.getState(editorView.state));

    // Only a click on a specific Screenplay-view line carries a blockId to
    // scroll to a precise spot within the scene; opening from a beat card
    // (or the pencil icon, or the context menu) just lands at the top of
    // what is now a single short scene, not a whole script to scroll through.
    // The caret lands at the *end* of that line's text, not the start --
    // clicking a line to jump into the Editor reads as "let me keep writing
    // from here," which is where a screenwriter's cursor would already be.
    const blockId = initialTargetRef.current?.blockId;
    if (blockId) {
      const found = findBlockById(editorView.state.doc, blockId);
      if (found) {
        const endPos = found.pos + 1 + found.node.content.size;
        const sel = TextSelection.near(editorView.state.doc.resolve(endPos), -1);
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

  if (!card) {
    return (
      <div className="placeholder-view">
        <h2>Beat not found</h2>
        <p>This beat card may have been deleted. Pick something from the Outline.</p>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <div className="editor-scroll">
        <div className="screenplay-head">
          <div>
            <div className="board-title">{card.title}</div>
            <div className="board-sub">
              {target?.source ? `Opened from ${target.source}` : 'Tab or “/” to change an element’s type.'}
            </div>
          </div>
          <div className="editor-beat-nav">
            <button
              className="editor-beat-nav-btn"
              disabled={!prevCard}
              title={prevCard ? `Previous: ${prevCard.title}` : 'This is the first beat'}
              onClick={() => goToCard(prevCard)}
            >
              ‹ Previous
            </button>
            <button
              className="editor-beat-nav-btn"
              disabled={!nextCard}
              title={nextCard ? `Next: ${nextCard.title}` : 'This is the last beat'}
              onClick={() => goToCard(nextCard)}
            >
              Next ›
            </button>
          </div>
        </div>
        <div className="screenplay-page editor-page" ref={mountRef} />
      </div>
      <SlashMenu view={viewRef.current} pluginState={slashState} />
    </div>
  );
}
