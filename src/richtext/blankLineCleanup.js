import { Plugin } from 'prosemirror-state';

const NBSP = ' ';

// Placeholder blank paragraphs (see markdownSerde.js) hold a lone NBSP so
// they survive markdown round-trips instead of collapsing away. Once the
// user types real content into one, the NBSP is left sitting at the start
// of it -- harmless but sloppy. Rather than intercepting input to prevent
// it (which fights the browser's own native text insertion and turned out
// to drop keystrokes), let typing happen completely normally and just strip
// a leading NBSP off any paragraph that now has more than just that one
// character, right after each change.
export function blankLineCleanupPlugin() {
  return new Plugin({
    appendTransaction(transactions, _oldState, newState) {
      if (!transactions.some((tr) => tr.docChanged)) return null;
      let tr = null;
      newState.doc.descendants((node, pos) => {
        if (node.type.name !== 'paragraph') return;
        const text = node.textContent;
        if (text.length > 1 && text[0] === NBSP) {
          const start = pos + 1;
          tr = (tr ?? newState.tr).delete(start, start + 1);
        }
      });
      return tr;
    },
  });
}
