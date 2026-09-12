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
// Resolution goes through view.posAtCoords rather than a raw
// document.caretRangeFromPoint call -- both end up calling the same
// underlying browser primitive internally, but posAtCoords layers a set of
// its own browser-specific correction kludges on top (accumulated across
// PM's history for exactly this class of hit-testing unreliability), so it
// tends to land right more often even before the geometry override below
// ever kicks in. Reported as still not 100% reliable even so -- this
// narrows the gap further but a from-scratch character-level hit-test
// would be the only way to fully eliminate it, which isn't attempted here.
function correctTouchCaret(view, touch) {
  const result = view.posAtCoords({ left: touch.clientX, top: touch.clientY });
  if (!result) return;
  const docSize = view.state.doc.content.size;
  let $pos = view.state.doc.resolve(Math.min(result.pos, docSize));

  // Geometry-first override, independent of whatever the initial
  // (potentially ambiguous) resolution above landed on: figure out where
  // *this specific visual line's own rendered text* starts and ends, and
  // if the tap fell outside that -- to the left of the first character or
  // the right of the last one -- the intended target is unambiguous, so
  // just use it directly rather than trusting posAtCoords's answer for
  // that case at all.
  //
  // Finds the line's bounds via the same full-width-block technique
  // activeLinePlugin.js uses to measure a wrapped line's own extent: these
  // blocks span their container's full width, so asking what sits at the
  // block's own left/right edges, at the tap's own Y, lands on this
  // specific visual line's first/last actual text position (posAtCoords
  // clamps to the nearest valid position on that line, which for an X
  // beyond the rendered text *is* the text's own edge) -- independent of
  // the block's own (possibly much wider) box.
  //
  // A tap that lands between blocks (rather than inside one -- e.g. in
  // inter-block padding, or during a fast drag) can resolve to a position
  // at the very top level, where there's no enclosing block to measure
  // line bounds for at all ($pos.before(0) throws) -- skip the bounds
  // refinement in that case and fall through to TextSelection.near($pos)
  // below, which already knows how to find the nearest real cursor
  // position from here.
  if ($pos.depth > 0) {
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
  }

  const sel = TextSelection.near($pos);
  if (sel.eq(view.state.selection)) return;
  // Tagged "pointer" -- the same meta PM's own click handling sets (see
  // prosemirror-view's input.ts) -- so Editor.jsx's Typewriter Mode
  // dispatchTransaction treats this correction exactly like a real click:
  // adopt it as the new sticky-line anchor rather than forcibly scrolling
  // the corrected position back to the OLD anchor. Without this tag, the
  // correction read as a plain caret move, which fought the tap -- the
  // view would jump to satisfy the stale anchor instead of meeting the
  // user where they tapped, landing the active-line highlight somewhere
  // else entirely.
  view.dispatch(view.state.tr.setSelection(sel).setMeta('pointer', true));
}

// Hides the blinking text-insertion caret (not any range-selection
// highlight -- caret-color only ever affects the collapsed caret) for the
// brief window between a tap and its correction landing. Without this, a
// wrong-then-corrected caret painted two frames apart reads as a visible
// "jump" even though the whole thing takes under 20ms -- hiding it for
// that one frame instead just reads as the caret appearing where it
// should, with no flash of the wrong position first.
const HIDE_CLASS = 'touch-caret-correcting';

export function touchCaretPlugin() {
  return new Plugin({
    props: {
      handleDOMEvents: {
        touchend(view, event) {
          if (event.changedTouches.length !== 1) return false;
          const touch = event.changedTouches[0];
          // Single deferred pass, same as the original design -- a prior
          // attempt at also running this synchronously (in addition to the
          // rAF pass, to close a race with fast follow-up keystrokes)
          // reused these same touch coordinates for a *second* dispatch,
          // and each dispatch can trigger its own scroll-into-view side
          // effects; if the first one shifted the layout at all, the
          // second recomputed against now-stale coordinates and produced a
          // visible extra scroll jump on top of the caret correction --
          // worse than the single small jump this was meant to fix.
          // Reverted; the caret-hide below still covers this one pass.
          view.dom.classList.add(HIDE_CLASS);
          requestAnimationFrame(() => {
            if (view.isDestroyed) return;
            correctTouchCaret(view, touch);
            view.dom.classList.remove(HIDE_CLASS);
          });
          return false; // never preventDefault -- native focus/scroll still proceeds normally
        },
      },
    },
  });
}
