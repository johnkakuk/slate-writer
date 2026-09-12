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
// Verified via real iOS Simulator + XCUITest touch automation (not just
// emulated touch events) that this is a genuine, non-deterministic WebKit
// behavior, not something introduced by this file: with this plugin's own
// dispatch disabled outright, the exact same wrong-then-right sequence
// still occurred on repeat taps, and a reliability sweep with no correction
// at all landed wrong on the majority of transition taps (tapping one
// block right after tapping an adjacent one). So native's own resolution
// does NOT reliably self-correct on its own -- this plugin is required, not
// optional, despite iOS getting an out-of-bounds tap right by default in
// most contexts.
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
  if (!result) return null;
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

  // Checked against the *live* DOM selection, not just view.state.selection:
  // PM's model can still be lagging behind a native change that already
  // landed correctly (confirmed via Simulator: WebKit's own default
  // hit-testing frequently already puts the caret exactly where this
  // function would too, but PM hasn't resynced its internal model from
  // that native change yet by the time this runs one frame later, so
  // state.selection still reads the *previous* tap's stale position).
  // Skipping an unnecessary dispatch here when the DOM already agrees
  // avoids one redundant, purely-programmatic setSelection on top of an
  // already-correct native selection -- confirmed via Simulator that this
  // redundant write is when WebKit's own scroll-into-view heuristics can
  // react with a visible extra scroll adjustment, on top of a correction
  // that wasn't even needed. This only covers this first check; the settle
  // loop below still compares against view.state.selection on later
  // frames, since by then enough time has passed that "does the model
  // actually reflect the right thing" is the right question again -- this
  // check is only about not firing a redundant dispatch before native's own
  // resolution (which needs a frame or two) has had a chance to land on
  // its own.
  let liveDomPos = null;
  try {
    const domSel = view.domSelectionRange();
    if (domSel.focusNode) liveDomPos = view.posAtDOM(domSel.focusNode, domSel.focusOffset);
  } catch {
    liveDomPos = null;
  }
  const domAlreadyCorrect = liveDomPos != null && liveDomPos === $pos.pos;

  if (!domAlreadyCorrect && !sel.eq(view.state.selection)) {
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
  return $pos.pos;
}

// Hides the blinking text-insertion caret (not any range-selection
// highlight -- caret-color only ever affects the collapsed caret) for the
// brief window between a tap and its correction landing. Without this, a
// wrong-then-corrected caret painted two frames apart reads as a visible
// "jump" even though the whole thing takes under 20ms -- hiding it for
// that one frame instead just reads as the caret appearing where it
// should, with no flash of the wrong position first.
const HIDE_CLASS = 'touch-caret-correcting';

// How many extra animation frames to keep re-verifying the corrected
// selection after the first correction dispatches. Simulator instrumentation
// (real XCUITest touches, not emulated) caught a genuine three-step
// sequence on a real tap: our correction lands right, then -- 1-2 frames
// later -- a late, spurious native selection re-resolution silently
// overwrites it with the *previous* tap's block/offset, then a further
// frame after that it settles back to correct on its own. Since nothing
// upstream marks that middle native change as illegitimate (it carries the
// same "pointer" meta ours does), the only reliable defense is to keep
// watching for a few frames and re-assert the intended position if it
// drifts. This is NOT redundant with the domAlreadyCorrect check above --
// disabling this settle loop entirely was tried and measured directly: a
// reliability sweep across repeated real transition taps dropped from
// 10/10 to 3/10, meaning WebKit's own multi-step resolution does not
// reliably self-correct back to the right answer within a frame or two on
// its own; without this loop watching for a few frames afterward, the
// wrong intermediate value can simply stick.
const SETTLE_FRAMES = 3;

export function touchCaretPlugin() {
  let generation = 0;
  return new Plugin({
    props: {
      handleDOMEvents: {
        touchend(view, event) {
          if (event.changedTouches.length !== 1) return false;
          const touch = event.changedTouches[0];
          // A newer touchend arriving before this one's settle loop
          // finishes invalidates it -- the user has already moved on
          // (a fresh tap, or typing), so stop chasing a stale target.
          const myGeneration = ++generation;
          view.dom.classList.add(HIDE_CLASS);
          requestAnimationFrame(() => {
            if (view.isDestroyed || myGeneration !== generation) return;
            const target = correctTouchCaret(view, touch);
            const settle = (framesLeft) => {
              requestAnimationFrame(() => {
                if (view.isDestroyed || myGeneration !== generation) return;
                if (target != null) {
                  const docSize = view.state.doc.content.size;
                  const $pos = view.state.doc.resolve(Math.min(target, docSize));
                  const sel = TextSelection.near($pos);
                  if (!sel.eq(view.state.selection)) {
                    view.dispatch(view.state.tr.setSelection(sel).setMeta('pointer', true));
                  }
                }
                if (framesLeft > 0) {
                  settle(framesLeft - 1);
                } else if (myGeneration === generation) {
                  view.dom.classList.remove(HIDE_CLASS);
                }
              });
            };
            settle(SETTLE_FRAMES);
          });
          return false; // never preventDefault -- native focus/scroll still proceeds normally
        },
      },
    },
  });
}
