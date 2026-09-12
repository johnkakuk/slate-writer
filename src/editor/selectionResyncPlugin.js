import { Plugin, TextSelection } from 'prosemirror-state';

// ProseMirror does not update state.selection synchronously on mousedown or
// click -- it relies entirely on the browser's own (asynchronous)
// "selectionchange" DOM event reaching its domObserver, which then dispatches
// a correcting transaction. That event is not guaranteed to land before the
// next keystroke: a script (or a fast typist/an external keyboard) issuing
// Home/End/arrow-driven navigation immediately followed by a keymap-bound
// command like Enter can easily outrun it, so Enter fires while
// state.selection is still stale from *before* the click or native caret
// move. Confirmed via a repro: clicking a line, pressing End, then Enter in
// quick succession intermittently split a completely different (and wrong)
// block, corrupting content -- entirely explained by Enter's smartEnter
// command (see keymap.js) reading the stale selection.
//
// Registered first in the plugins array (props.handleKeyDown handlers run
// in plugin-array order, and this always returns false, so it never
// "handles" the key -- it just runs its side effect and gets out of the
// way): reads the *live* DOM selection directly and, if it disagrees with
// state.selection, dispatches a correcting transaction before anything else
// -- including our own keymap's Enter binding -- gets a chance to act on
// the (possibly stale) old value. This sidesteps ProseMirror's own
// selectionchange-driven timing entirely rather than trying to out-race it.
export function selectionResyncPlugin() {
  return new Plugin({
    props: {
      handleKeyDown(view) {
        if (!view.hasFocus()) return false;
        const domSel = view.domSelectionRange();
        if (!domSel.focusNode || !view.dom.contains(domSel.focusNode)) return false;
        if (!domSel.anchorNode || !view.dom.contains(domSel.anchorNode)) return false;
        // Reads BOTH ends of the live DOM selection, not just the caret/focus
        // end -- an earlier version resolved only the focus point and
        // rebuilt the selection with TextSelection.near(), which always
        // produces a *collapsed* cursor selection. That silently collapsed
        // any active range (e.g. drag-selected text) back to a single point
        // the instant any key was pressed, before the key's own handler
        // (Backspace, Delete, typing a replacement character, ...) ever saw
        // it -- so "select some text, hit Backspace" deleted one character
        // next to the selection instead of the selection itself.
        // TextSelection.between($anchor, $head) preserves the full range
        // and its direction, only ever collapsing when the DOM selection
        // itself is actually collapsed.
        let anchorPos, headPos;
        try {
          anchorPos = view.posAtDOM(domSel.anchorNode, domSel.anchorOffset);
          headPos = view.posAtDOM(domSel.focusNode, domSel.focusOffset);
        } catch {
          return false;
        }
        if (typeof anchorPos !== 'number' || typeof headPos !== 'number' || anchorPos < 0 || headPos < 0) return false;
        const docSize = view.state.doc.content.size;
        const $anchor = view.state.doc.resolve(Math.min(anchorPos, docSize));
        const $head = view.state.doc.resolve(Math.min(headPos, docSize));
        let sel;
        try {
          sel = TextSelection.between($anchor, $head);
        } catch {
          return false;
        }
        if (!sel.eq(view.state.selection)) {
          view.dispatch(view.state.tr.setSelection(sel));
        }
        return false;
      },
    },
  });
}
