import { Plugin } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';

// WebKit's own tap-to-position-caret resolution inside a contenteditable is
// a known-unreliable area on iOS -- reported behavior (not reproducible in
// Chromium's touch emulation, where mouse-click positioning already
// resolves correctly) is a tap landing at the very start of a line instead
// of where it was actually tapped, including when the tap is nowhere near
// the start (e.g. in the empty space well past the last character). PM
// faithfully syncs to whatever the native selection resolves to, so if the
// *native* resolution itself is wrong, PM's own model just as faithfully
// ends up wrong too -- this isn't a PM sync bug to fix, it's WebKit's own
// hit testing to work around.
//
// Deferred to the next animation frame so this runs *after* native
// touch-driven selection-setting has already settled, rather than racing
// it -- a same-tick correction could just get immediately overwritten by
// whatever the native behavior does next.
export function touchCaretPlugin() {
  return new Plugin({
    props: {
      handleDOMEvents: {
        touchend(view, event) {
          if (event.changedTouches.length !== 1 || typeof document.caretRangeFromPoint !== 'function') {
            return false;
          }
          const touch = event.changedTouches[0];
          requestAnimationFrame(() => {
            if (view.isDestroyed) return;
            const range = document.caretRangeFromPoint(touch.clientX, touch.clientY);
            if (!range || !view.dom.contains(range.startContainer)) return;
            let pos;
            try {
              pos = view.posAtDOM(range.startContainer, range.startOffset);
            } catch {
              return;
            }
            if (typeof pos !== 'number' || pos < 0) return;
            const docSize = view.state.doc.content.size;
            let $pos = view.state.doc.resolve(Math.min(pos, docSize));

            // Geometry-first override, independent of whatever the initial
            // (potentially ambiguous) resolution above landed on: figure
            // out where *this specific visual line's own rendered text*
            // starts and ends, and if the tap fell outside that -- to the
            // left of the first character or the right of the last one --
            // the intended target is unambiguous, so just use it directly
            // rather than trusting caretRangeFromPoint's answer for that
            // case at all.
            //
            // Finds the line's bounds via the same full-width-block
            // technique activeLinePlugin.js uses to measure a wrapped
            // line's own extent: these blocks span their container's full
            // width, so asking what sits at the block's own left/right
            // edges, at the tap's own Y, lands on this specific visual
            // line's first/last actual text position (posAtCoords clamps
            // to the nearest valid position on that line, which for an X
            // beyond the rendered text *is* the text's own edge) --
            // independent of the block's own (possibly much wider) box.
            const blockStart = $pos.before($pos.depth);
            const blockNode = view.state.doc.nodeAt(blockStart);
            const blockDOM = blockNode && view.nodeDOM(blockStart);
            if (blockDOM instanceof HTMLElement) {
              const rect = blockDOM.getBoundingClientRect();
              const lineStart = view.posAtCoords({ left: rect.left + 1, top: touch.clientY });
              const lineEnd = view.posAtCoords({ left: rect.right - 1, top: touch.clientY });
              if (lineStart && lineEnd) {
                const startCoords = view.coordsAtPos(lineStart.pos);
                const endCoords = view.coordsAtPos(lineEnd.pos);
                if (touch.clientX < startCoords.left - 2) {
                  $pos = view.state.doc.resolve(Math.min(lineStart.pos, docSize));
                } else if (touch.clientX > endCoords.right + 2) {
                  $pos = view.state.doc.resolve(Math.min(lineEnd.pos, docSize));
                }
              }
            }

            const sel = TextSelection.near($pos);
            if (sel.eq(view.state.selection)) return;
            // Tagged "pointer" -- the same meta PM's own click handling sets
            // (see prosemirror-view's input.ts) -- so Editor.jsx's Typewriter
            // Mode dispatchTransaction treats this correction exactly like a
            // real click: adopt it as the new sticky-line anchor rather than
            // forcibly scrolling the corrected position back to the OLD
            // anchor. Without this tag, the correction read as a plain caret
            // move, which fought the tap -- the view would jump to satisfy
            // the stale anchor instead of meeting the user where they tapped,
            // landing the active-line highlight somewhere else entirely.
            view.dispatch(view.state.tr.setSelection(sel).setMeta('pointer', true));
          });
          return false; // never preventDefault -- native focus/scroll still proceeds normally
        },
      },
    },
  });
}
