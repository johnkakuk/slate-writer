# Touch caret investigation — 2026-09-12

Two failure modes have now been demonstrated. The initial Simulator investigation
found a late native selection overwrite. The physical-iPad trace and second
recording additionally prove that our correction could calculate the wrong
position for taps outside narrow text blocks, then protect that wrong position.
Typewriter Mode is not required for either observed failure. See the final
section for the physical-device evidence and subsequent geometry fix.

## Evidence

A character-to-dialogue transition in the isolated editor produced this sequence:

| Relative time | Event | DOM caret | PM caret |
| --- | --- | --- | --- |
| 0 ms | touchend / synchronous placement | dialogue end, 62 | 62 |
| 18 ms | native selectionchange | previous character end, 45 | 62 |
| 19 ms | PM adopts native selection | 45 | 45 |
| 50 ms | next sampled animation frame | 45 | 45 |

Preventing touchend's default and placing the caret synchronously **alone** did
not stop that native overwrite: 4 of 24 taps finished incorrectly in the Line
highlight fixture. This is not merely a delayed PM model catching up with an
already-correct DOM caret.

Some native selection transactions also lack `pointer` metadata. In the
installed `prosemirror-view`, `input.ts` records pointer origin on touchstart,
but `domchange.ts` only uses it for 50 ms. The tested touches lasted about
80–100 ms, and native selection changes often preceded the compatibility
mousedown. Editor.jsx can therefore mistake those changes for keyboard moves
and scroll toward an old Typewriter anchor. This can amplify the underlying
selection error.

The supplied commits `9a476e8` and `b83f8f2` have identical editor JavaScript.
Their stylesheet differences do not directly change the screenplay text blocks.
That comparison does not yet identify an introducing commit; settings, layout,
and native versus desktop input remain relevant differences.

## Change

`touchCaretPlugin.js` now places a recognized short tap synchronously, marks the
transaction as pointer input, and focuses through ProseMirror's public API. A
capture-phase `selectionchange` listener repairs a late collapsed native caret
before PM's observer adopts it. The listener compares the **live DOM selection**,
including when PM's model already has the intended position.

Protection lasts at most 400 ms and ends on a new gesture, keyboard/text input,
composition, blur, wheel input, document edits, or programmatic selection moves.
It does not restart its deadline on an overwrite. Drags, multitouch, long presses,
and repeated taps on the same visual line retain native behavior. Native range
selections are preserved.

The old animation-frame correction loop and caret-hiding CSS were removed.
Editor.jsx and its existing scrolling behavior were left unchanged.

## Validation

- Native iPad Pro 11-inch (M5) Simulator, iOS 26.3, Safari, XCUITest/W3C touches.
- Isolated Line highlight fixture: 24/24 correct final caret positions with
  the new plugin. Calibration can include extra taps at other coordinates;
  these must not be counted as wrong frames belonging to the final tap.
- Full application on an isolated localhost origin, generated sample scripts:
  18/18 taps with Typewriter Line mode and 18/18 with Typewriter off. No wrong
  caret position or scroll drift in the sampled frames after the final touch
  release. Each tap recorded 24 animation frames.
- Native typing immediately after a corrected tap inserted at the intended
  position; double tap selected `room`; a scroll drag moved the container
  355 px and preserved the existing range selection.
- Native line-edge checks: 25 cases passed across all six element types,
  three wrapped visual lines, and an empty block. The wrapped-line oracle
  must ignore zero-width rectangles: iOS can return a zero-width rectangle
  on the preceding line before a character's actual rectangle on the next.
- `node --test tests/touchCaretPlugin.test.mjs`: 17 tests passed.
- `npm run build`: passed (existing large-bundle warning).

These are real iOS touch tests, not desktop touch emulation. The frame assertions
measure DOM selection and scroll offsets; they are not a pixel-level assertion
about WKWebView's native caret overlay. A packaged-app check on a physical device
is still needed to confirm the user's perceived flicker is fully resolved.
No production script data or installed app data was modified.

## Reproduce independently

Run `npm run dev -- --host 127.0.0.1`, then open
`http://127.0.0.1:5173/tests/caret-fixture.html` in Simulator Safari (use the actual
port printed by Vite). This fixture has no storage and cannot save script edits.

- Default: patched touch plugin and Line highlight.
- `?native=1`: native selection with no touch correction.
- `?native=1&style=none`: no correction or highlight.

Tap beyond the ends of adjacent character/dialogue lines repeatedly. Also check
both edges of wrapped text, empty blocks, double taps, long presses, and dragging.
`window.caretFixture.trace` records selection events, PM transactions, and frames;
`window.caretFixture.snapshot()` reports the current native and model positions.
If automating Safari touches, calibrate screen coordinates against the received
`touchend.clientX/clientY`: Safari chrome and keyboard changes alter their offset.
Evaluate frames belonging to the last calibrated touch, not earlier retry taps.

## Physical-device recording follow-up

The user's `ScreenRecording_09-12-2026 08-39-03_1.MP4` shows that the visible
caret problem remains after the patch. The user reports all taps were on the
right side of the text column. Frame-by-frame observations:

- At 1.975 s the visible caret is after `you insane?`; at 1.991667 s it is
  before `you` on the same wrapped line. It stays at the left, with normal
  blinking, until the next visible caret move. The same end-to-start sequence
  occurs at 3.768333 → 3.785 s and 7.703333 → 7.720 s.
- At 6.311667 s the caret is after `What? It’s romantic! And it’s true.`;
  at 6.328333 s it is before the following `ALEXANDER` cue.
- At 10.288333 s and 14.138333 s the caret settles before `JOHN`, although
  taps were on the right. Other taps settle after `JOHN` correctly.
- At 14.790 s it successfully settles after `you insane?`, so even that
  wrapped line is not uniformly failing.
- The text/page stays stationary during these jumps. The scene-heading
  position was also checked across all 733 decoded frames.

These observations concern the **painted caret**. The recording cannot reveal
whether PM's model, the DOM selection, and iOS's native caret overlay agree.
It also cannot establish exact tap times/coordinates or attribute a move to a
particular JavaScript/native callback.

The next diagnostic must record the target calculated by `selectionAtTouch`,
both native selection endpoints, PM selection, and the guard's activation or
cancellation reason alongside physical-device frames. A wrong calculated target
could make the new guard preserve the wrong position; alternatively the guard
may be cancelled or the native overlay may disagree with the DOM. The current
edge refinement still derives all three probes from `posAtCoords`, so it is not
an independent geometric check. Do not assume another longer settle interval
will fix this. No further production code change was made during video analysis.

## Physical trace + second recording: confirmed target calculation bug

`ScreenRecording_09-12-2026 08-58-22_1.MP4` was captured alongside 2,769
in-memory diagnostic events on the actual USB-connected iPad. The recording
includes a tap counter and marker. The trace contains 23 gestures: 20 handled
taps and 3 gestures left to native behavior. Typewriter Mode was off.

Fifteen handled taps received a first `posAtCoords` result with `inside: -1`
and a position between blocks. The old refinement skipped these depth-zero
positions. `TextSelection.near` then advanced into the following text block.

For example, around 27 seconds, tap 18's marker is beside the first visual
line of the three-line dialogue above `JOHN`. The painted caret is before
`JOHN`. The trace identifies exactly why:

| Event | Position / outcome |
| --- | --- |
| Touch release | x=900.5, y=243 |
| Original hit test | pos=482, inside=-1 (after the whole dialogue) |
| Calculated selection | pos=483 (start of the following `JOHN`) |
| Late native selection, 10 ms after release | pos=436 (end of the tapped visual line) |
| Guard repair | restores DOM to pos=483, matching the incorrect PM selection |

This particular failure is **our incorrect target**, not an overlay disagreeing
with an otherwise-correct model. The native caret briefly reaches the intended
line end, then our guard restores the wrong target. Tap 6 similarly targets
pos=323 in a parenthetical below the tapped dialogue instead of its end, pos=321.
The initial native-overwrite evidence remains valid, but the guard alone could
not fix this second failure.

### Geometry correction

The touch handler now finds the closest text block by vertical bounds, then
uses DOM Range rectangles to identify its closest rendered visual line. It
clamps the hit-test coordinates inside that line's actual text, including its
vertical glyph band. This handles margin taps outside a narrow dialogue box
and taps in the leading above/below the glyphs. Empty blocks select their own
start directly. An out-of-block result is never converted to a selection in
another block. The gesture recognition and bounded selection guard remain.

### Validation of the geometry correction

- Native iPad Simulator Safari: **56/56 margin taps passed**, with highlight
  off and Line highlight on. Includes both page margins, three wrapped dialogue
  lines, centered cues, parentheticals, right-aligned transitions, empty blocks,
  and taps just below the glyph band. These are final DOM/model assertions.
- Isolated desktop geometry regression: **272/272 passed in Chromium and
  272/272 in WebKit**, across none/line/paragraph/underline styles. Evaluating
  the previous target function at the same points produced 67 wrong targets
  in Chromium and 128 in WebKit. These synthetic tests establish geometry,
  not native touch event ordering or painted caret stability.
- `node --test tests/touchCaretPlugin.test.mjs`: **19 passed**, including a
  margin result that previously resolved between blocks and an out-of-block
  result that must not advance to a neighbor.
- `npm run build` and `npx cap sync ios`: passed. The Xcode project has the
  updated web assets ready for a physical-device Run.

The browser regression is retained in `tests/caretGeometry.browser.mjs`.
Start Vite on port 5187, then run
`node tests/caretGeometry.browser.mjs /path/to/playwright/index.mjs` (or omit
the argument if Playwright is installed locally). `CARET_FIXTURE_ORIGIN` can
override the origin. The fixture and browser tests never access script storage.

After rebuilding/running through Xcode, the user retested on the physical iPad
and confirmed the issue is resolved: "It's working. It's just working."
This is the user's visual confirmation of the second patch, in addition to
the automated DOM/model checks above. Changes remain uncommitted.
