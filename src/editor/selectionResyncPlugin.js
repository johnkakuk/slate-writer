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
        let pos;
        try {
          pos = view.posAtDOM(domSel.focusNode, domSel.focusOffset);
        } catch {
          return false;
        }
        if (typeof pos !== 'number' || pos < 0) return false;
        const resolved = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
        const sel = TextSelection.near(resolved);
        if (!sel.eq(view.state.selection)) {
          view.dispatch(view.state.tr.setSelection(sel));
        }
        return false;
      },
    },
  });
}
