import React, { useEffect, useRef } from 'react';
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { parseMarkdown, serializeToMarkdown } from '../../richtext/markdownSerde.js';
import { richTextPlugins } from '../../richtext/setup.js';

// Uncontrolled by design, same as the screenplay Editor: remounts fresh
// whenever `docId` changes (switching documents), and otherwise owns its
// own DOM — edits flow *out* via onChange, never back in from a re-render.
export default function MarkdownRichEditor({ docId, initialContent, onChange }) {
  const mountRef = useRef(null);
  const initialContentRef = useRef(initialContent);
  initialContentRef.current = initialContent;

  useEffect(() => {
    const state = EditorState.create({
      doc: parseMarkdown(initialContentRef.current),
      plugins: richTextPlugins(),
    });

    const view = new EditorView(mountRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = view.state.apply(tr);
        view.updateState(newState);
        if (tr.docChanged) onChange(serializeToMarkdown(newState.doc));
      },
    });
    view.focus();

    return () => view.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  return <div className="markdown-rich-editor" ref={mountRef} />;
}
