# Bug: unreliable tap-to-position-caret in the screenplay editor (iOS)

## App context

Slate Writer is a screenwriting app. The iOS build is a Capacitor-wrapped
WKWebView running a ProseMirror-based rich text editor
(`src/components/editor/Editor.jsx` and the plugins under `src/editor/`).
Each scene is a single `contenteditable` ProseMirror document made up of
typed text blocks (scene heading, action, character, dialogue,
parenthetical, transition — see `src/editor/schema.js` and
`src/editor/elementTypes.js`).

## Expected behavior

Tapping anywhere within or near a line of text should place the text
cursor at the nearest valid position to the tap — the same behavior every
standard iOS text view/text editor has. In particular: tapping to the
right of the last character on a line (in the empty space past the end of
the text) should put the cursor at the end of that line's text; tapping to
the left of the first character should put it at the start. This should
happen instantly and reliably, with no visible flicker, flash, or scroll
movement beyond the caret simply appearing where tapped.

## Actual behavior

On real iOS (Simulator or device — see "Testing notes" below), tapping to
position the cursor is unreliable:

- The cursor sometimes lands somewhere other than the tapped position —
  most reproducible when tapping near the end of a line, and when tapping
  a line right after having just tapped a different, adjacent line/block.
- Even on taps where the cursor *does* end up in the right final position,
  there is often a brief, visible "jump" — for roughly a single frame, the
  cursor or the scroll position appears to move to a different spot before
  snapping to the correct one. It reads as a flicker, not a clean, instant
  placement.

Both symptoms are intermittent, not reproducible on literally every single
tap, but common enough to be very noticeable in ordinary use (tapping
around in a script to reposition where you're writing).

## Reference behavior

Ulysses (a native macOS/iOS writing app) does not exhibit either symptom:
tapping past the end of a line reliably and instantly places the cursor at
the end of that line, with no flicker. That's the target behavior.

## Reproduction steps

1. Open a scene with several lines of different element types (action,
   character, dialogue) visible on screen at once, on an iOS Simulator or
   real device (see note below on why this matters).
2. Tap in the empty space past the end of one line's text.
3. Immediately tap in the empty space past the end of a different,
   adjacent line.
4. Observe the cursor's final position and whether any visible jump/
   flicker occurs during either tap. Repeat several times — the issue is
   intermittent, so a single trial isn't conclusive either way.

## Testing notes

This has **not** been reproducible via desktop browser testing — not with
emulated/synthetic touch events, and not even using a real WebKit engine
(desktop Safari, or Playwright's WebKit engine with an iPad device
profile/user-agent). It appears to require an actual iOS Simulator or
device receiving real touch input to observe at all.

## Bisection

Manually tested via two Electron (desktop, mouse-driven — not iOS/touch)
builds, each built from this exact repo at a specific commit:

- `9a476e8` ("Add Typewriter Mode with a sticky active line," on branch
  `overnight/character-bible-notes-projects-ios`) — **confirmed
  acceptable. This is the last known-good commit.** Not necessary the last good commit, just the most recent one I've tested.
- `b83f8f2` ("Separate the beat-card drag handle from its icon cluster;
  sidebar drops the handle for hold-then-drag," on this branch, the commit
  immediately before `src/editor/touchCaretPlugin.js` was first added) —
  reproduces the issue even on Electron.

This comparison used the Electron/desktop builds (mouse clicks, not
touch), so treat it as a data point on when the underlying behavior
changed, not confirmation that the Electron build shows the exact same
touch-specific symptoms described above — that hasn't been separately
verified.

## Where the current touch/selection-handling code lives

(Pointers only — no claim about where the bug actually originates.)

- `src/editor/touchCaretPlugin.js`
- `src/editor/selectionResyncPlugin.js`
- `src/editor/activeLinePlugin.js` (Typewriter Mode's active-line tracking
  and scroll behavior)
- `src/components/editor/Editor.jsx` (scroll/pointer handling in the
  editor's `dispatchTransaction`)
- `src/editor/keymap.js`

## Prior work

This bug has already been the subject of extensive investigation and
several fix attempts on this branch (`overnight/ios-persistence-and-touch-ux`),
without a full resolution. That history is available in this branch's git
log if you want it, but it's deliberately not summarized here — go in
fresh and reach your own conclusions about the cause before consulting it,
if at all.
