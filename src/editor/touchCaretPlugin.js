import { Plugin } from 'prosemirror-state';
import { TextSelection } from 'prosemirror-state';

// WebKit's own tap-to-position-caret resolution inside a contenteditable is
// a known-unreliable area on iOS -- reported behavior (not reproducible in
// Chromium's touch emulation, where mouse-click positioning already
// resolves correctly) is a tap landing at the very start of a multi-line
// paragraph instead of where it was actually tapped. ProseMirror faithfully
// syncs to whatever the native selection resolves to, so if the *native*
// resolution itself is wrong, PM's own model just as faithfully ends up
// wrong too -- this isn't a PM sync bug to fix, it's WebKit's own hit
// testing to work around.
//
// Recomputes the tap's target position independently via
// caretRangeFromPoint (the same class of API the browser's own resolution
// is presumably built on, but called explicitly) and corrects the
// selection if it disagrees. Deferred to the next animation frame so this
// runs *after* native touch-driven selection-setting has already settled,
// rather than racing it -- a same-tick correction could just get
// immediately overwritten by whatever the native behavior does next.
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
            let $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));

            // A second, distinct WebKit quirk from the paragraph-start one
            // above: tapping in the empty space to the *right* of a short
            // line's actual text (well past the last character, but still
            // within the block) can resolve ambiguously to the very START
            // of that line instead of its end -- verified by comparing the
            // resolved position's own on-screen coordinates against where
            // the tap actually landed. If the tap is well to the right of
            // where this (start-of-line) position renders, the intended
            // target was almost certainly the end of that visual line, not
            // its start. Finds the true end of *this* line specifically
            // (not necessarily the whole block, which may wrap across
            // several) via the same full-width-block technique
            // activeLinePlugin.js uses to measure a wrapped line's own
            // bounds: these blocks span their container's full width, so
            // asking what sits at the block's right edge, at the tap's own
            // Y, lands on this line's trailing position.
            if ($pos.parentOffset === 0) {
              const resolvedCoords = view.coordsAtPos($pos.pos);
              if (touch.clientX > resolvedCoords.right + 4) {
                const blockStart = $pos.before($pos.depth);
                const blockNode = view.state.doc.nodeAt(blockStart);
                const blockDOM = blockNode && view.nodeDOM(blockStart);
                if (blockDOM instanceof HTMLElement) {
                  const rect = blockDOM.getBoundingClientRect();
                  const endResult = view.posAtCoords({ left: rect.right - 1, top: touch.clientY });
                  if (endResult) {
                    const blockEnd = blockStart + blockNode.nodeSize - 1;
                    const clamped = Math.min(Math.max(endResult.pos, blockStart + 1), blockEnd);
                    $pos = view.state.doc.resolve(clamped);
                  }
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
