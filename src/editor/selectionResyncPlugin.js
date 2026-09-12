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
//
// EXCEPT for one specific, confirmed case: WebKit (desktop Safari/WebKit
// *and* real iOS -- reproduced against Playwright's own WebKit engine with
// an iPad user agent, not just theorized) handles Enter completely
// differently from every other key. To avoid confusing the virtual
// keyboard, ProseMirror never preventDefaults it and never calls
// handleKeyDown on the raw keydown at all there (see prosemirror-view's
// editHandlers.keydown, gated on its own internal `ios`-named but
// WebKit-general flag -- Chromium never sets it, which is why none of this
// was reachable while testing there). Instead it lets the browser's own
// native "insertParagraph" DOM mutation happen first -- splitting the
// block itself, in the DOM, independently of our model -- and only calls
// handleKeyDown afterward, once its own DOM-mutation observer notices a
// change shaped like what Enter produces.
//
// By the time THIS handler runs for that later call, the live DOM
// selection points into a brand-new DOM node WebKit's own split just
// created, one that doesn't correspond to any position in our *current*
// document model at all (that native split hasn't been reconciled into a
// transaction yet -- that's smartEnter's job, about to run next). Resolving
// that orphan node via posAtDOM doesn't throw -- it silently resolves to
// something nonsensical (confirmed: position 1, the very start of the
// block, regardless of where the actual split point was) instead of an
// error we could catch. Trusting that and resyncing state.selection to
// match, immediately before smartEnter runs off that same call, was
// confirmed via a full instrumented trace to be exactly what corrupted the
// mid-text Enter case: the resync fires, drags state.selection to position
// 1, and smartEnter then sees a caret at the very start of the block that
// was never really there.
//
// Detected via view.input.lastIOSEnter, prosemirror-view's own internal
// bookkeeping for exactly this window (not a public API, but a plain
// object property, guarded defensively in case a future PM version
// reshapes it -- falls through to the normal resync if so, same as today).
// Deliberately NOT gated on platform detection (an earlier version checked
// isTouchPlatform(), i.e. "is this the packaged Capacitor app" -- wrong
// signal entirely: this is a WebKit *engine* behavior, unrelated to
// whether Capacitor's native bridge is present, and the earlier check
// never fired in the very scenario it was meant for).
const IOS_ENTER_WINDOW_MS = 300;

export function selectionResyncPlugin() {
  return new Plugin({
    props: {
      handleKeyDown(view, event) {
        if (!view.hasFocus()) return false;
        if (event.keyCode === 13) {
          const lastIOSEnter = view.input?.lastIOSEnter;
          if (typeof lastIOSEnter === 'number' && lastIOSEnter > 0 && Date.now() - lastIOSEnter < IOS_ENTER_WINDOW_MS) {
            return false;
          }
        }
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
