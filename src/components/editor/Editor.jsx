import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { Node } from 'prosemirror-model';
import { useProject } from '../../state/ProjectContext.jsx';
import { schema } from '../../editor/schema.js';
import { editorKeymap } from '../../editor/keymap.js';
import { autoCapsPlugin } from '../../editor/autoCapsPlugin.js';
import { placeholderPlugin } from '../../editor/placeholderPlugin.js';
import { slashMenuPlugin, slashMenuKey } from '../../editor/slashMenu/slashMenuPlugin.js';
import SlashMenu from '../../editor/slashMenu/SlashMenu.jsx';
import { findBlockById } from '../../editor/docUtils.js';
import { emptyDoc } from '../../editor/docJson.js';
import { fountainPastePlugin } from '../../editor/fountainPastePlugin.js';
import { pageBreakPlugin, pageBreakKey } from '../../editor/pageBreakPlugin.js';
import { touchCaretPlugin } from '../../editor/touchCaretPlugin.js';
import { activeLinePlugin, activeLineKey } from '../../editor/activeLinePlugin.js';
import { autoParentheticalPlugin } from '../../editor/autoParentheticalPlugin.js';
import { characterAutocompletePlugin } from '../../editor/characterAutocompletePlugin.js';
import { getRecentCharacterNames } from '../../editor/characterNames.js';
import { computeScriptPagination } from '../../export/paginate.js';

// Arriving here from a Screenplay-view line click always centers that line
// -- a fixed, predictable landing spot the user can then scroll away from
// freely (when Typewriter Mode is off, nothing scrolls them back). This
// used to instead match wherever the line was on screen when clicked, but
// that meant the same click could land anywhere depending on where in the
// Screenplay view it happened to be, which was harder to predict than just
// always centering.
const SCREENPLAY_ARRIVAL_FRACTION = 0.5;

// Not read reactively: the document loaded here becomes the live editing
// session's own state. Edits flow *out* to ProjectContext
// (updateCardSceneDoc, scoped to this one card) on every change; they
// don't flow back in, so typing here is never fought by a re-render from
// elsewhere in the app. Each card owns a separate sceneDoc, so opening a
// different card always means a fresh mount with a different document --
// there is no "same file" to leak edits between cards.
export default function Editor() {
  const {
    project,
    view,
    navigate,
    updateCardSceneDoc,
    typewriterMode,
    typewriterHighlightStyle,
    autoParenthetical,
    typewriterAnchor,
    setTypewriterAnchor,
  } = useProject();
  const { actId, cardId } = view.payload ?? {};
  const act = project.acts.find((a) => a.id === actId);
  const card = act?.cards.find((c) => c.id === cardId);

  // Every card across every act, in outline order -- the same order the
  // Screenplay view concatenates them in -- so Next/Previous walk the beats
  // the way they actually read, not just within the current act.
  const flatCards = useMemo(
    () => project.acts.flatMap((a) => a.cards.map((c) => ({ actId: a.id, cardId: c.id, title: c.title }))),
    [project.acts]
  );
  const currentIndex = flatCards.findIndex((c) => c.actId === actId && c.cardId === cardId);
  const prevCard = currentIndex > 0 ? flatCards[currentIndex - 1] : null;
  const nextCard = currentIndex >= 0 && currentIndex < flatCards.length - 1 ? flatCards[currentIndex + 1] : null;

  function goToCard(target) {
    if (!target) return;
    navigate('editor', { actId: target.actId, cardId: target.cardId, label: target.title, source: view.payload?.source });
  }

  const mountRef = useRef(null);
  const viewRef = useRef(null);
  const initialDocRef = useRef(card?.sceneDoc ?? emptyDoc());
  const initialTargetRef = useRef(view.payload);
  const [slashState, setSlashState] = useState(null);
  const [pageRange, setPageRange] = useState(null); // { start, end, total } | null

  // Kept in sync with the latest Provider values for use inside the
  // dispatchTransaction/scroll-listener closures set up once in the mount
  // effect below (which intentionally never re-runs, or every keystroke
  // would tear down and recreate the whole ProseMirror view) -- same
  // pattern as initialDocRef/initialTargetRef.
  const typewriterModeRef = useRef(typewriterMode);
  const typewriterHighlightStyleRef = useRef(typewriterHighlightStyle);
  const autoParentheticalRef = useRef(autoParenthetical);
  const typewriterAnchorRef = useRef(typewriterAnchor);
  // Recomputed whenever the project changes (cheap: plain text scanning, no
  // layout/measurement work, so unlike pagination this doesn't need
  // debouncing) rather than once at mount -- Tab should see a
  // just-introduced character's name on the very next block, not only
  // after reopening the Editor.
  const recentCharacterNamesRef = useRef(getRecentCharacterNames(project));
  useEffect(() => {
    // Exclude whatever block the caret is in right now -- if it's a
    // Character block, its text is still being typed (see
    // characterNames.js) and shouldn't count as a used name yet.
    const caretBlockId = viewRef.current?.state.selection.$from.parent.attrs?.id ?? null;
    recentCharacterNamesRef.current = getRecentCharacterNames(project, 5, caretBlockId);
  }, [project]);
  useEffect(() => {
    typewriterModeRef.current = typewriterMode;
  }, [typewriterMode]);
  useEffect(() => {
    autoParentheticalRef.current = autoParenthetical;
  }, [autoParenthetical]);
  useEffect(() => {
    typewriterHighlightStyleRef.current = typewriterHighlightStyle;
  }, [typewriterHighlightStyle]);
  useEffect(() => {
    typewriterAnchorRef.current = typewriterAnchor;
  }, [typewriterAnchor]);
  // Set right before this component scrolls the container itself, so the
  // native `scroll` listener below (which reinterprets a manual scroll as
  // "the user just repositioned the Typewriter Mode anchor") can tell our
  // own programmatic corrections apart from the user's own trackpad/wheel
  // input and ignore them -- otherwise every auto-correction would
  // immediately feed back in as a (redundant, but not harmless-forever)
  // anchor update.
  const programmaticScrollRef = useRef(false);

  // Defends against ANY scroll drift while a tap's selection change is
  // being resolved -- not just this component's own scrollToFraction calls,
  // but also WebKit's own native "scroll the focused/selected point into
  // view" behavior, which fires independently of anything dispatched
  // through ProseMirror. Tapping a line is only supposed to move which
  // line is active, never the scroll position itself.
  //
  // Two things turned out NOT to reliably distinguish a tap from the start
  // of a scroll-drag gesture, both tried and both wrong:
  //   - Locking from a raw touchstart/mousedown: touching the editor is
  //     also how a drag starts, so every native momentum-scroll frame
  //     during a real drag got fought and snapped back (visible flashing),
  //     then jumped once the lock let go.
  //   - Gating on PM's "pointer" selection-change meta instead: PM resolves
  //     (tentatively places the caret for) a touch as soon as it starts,
  //     before it's clear the gesture will turn into a drag -- so this
  //     transaction fires at touchstart-time regardless, same problem.
  // What actually distinguishes them is *movement*: a drag moves the touch
  // point meaningfully before release, a tap doesn't. touchMovedRef below
  // tracks that (see the touchstart/touchmove listeners in the mount
  // effect) and gates the lock on it not having happened yet.
  const pointerScrollLockRef = useRef(null);
  const pointerScrollLockTimerRef = useRef(null);
  const touchMovedRef = useRef(false);
  const touchStartYRef = useRef(null);

  function lockScrollAgainstPointer(scrollEl) {
    if (!scrollEl || touchMovedRef.current) return;
    pointerScrollLockRef.current = scrollEl.scrollTop;
    clearTimeout(pointerScrollLockTimerRef.current);
    pointerScrollLockTimerRef.current = setTimeout(() => {
      pointerScrollLockRef.current = null;
    }, 500);
  }

  // Forces scrollTop back to the locked value, if it's drifted -- called
  // right after a pointer-tagged transaction settles, and again a couple of
  // frames later to also catch autoscroll that lands after layout settles
  // (the same class of timing WebKit needs for touchCaretPlugin's own
  // correction).
  function reassertScrollLock(scrollEl) {
    if (pointerScrollLockRef.current == null || !scrollEl || touchMovedRef.current) return;
    const locked = pointerScrollLockRef.current;
    if (scrollEl.scrollTop !== locked) {
      programmaticScrollRef.current = true;
      scrollEl.scrollTop = locked;
    }
  }

  // A touch that moves more than this many px vertically before release
  // reads as the start of a scroll-drag, not a tap -- releases the lock
  // immediately (mid-gesture, not just gating future locks) so the drag's
  // own native/manual scrolling is free to proceed uncontested.
  const TAP_MOVE_THRESHOLD = 10;

  function handleTouchStart(event) {
    touchMovedRef.current = false;
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }

  function handleTouchMove(event) {
    if (touchStartYRef.current == null || touchMovedRef.current) return;
    const y = event.touches[0]?.clientY;
    if (typeof y !== 'number') return;
    if (Math.abs(y - touchStartYRef.current) > TAP_MOVE_THRESHOLD) {
      touchMovedRef.current = true;
      pointerScrollLockRef.current = null;
      clearTimeout(pointerScrollLockTimerRef.current);
    }
  }

  // Scrolls so the current selection lands at a given fractional position
  // down the .editor-scroll viewport (0 = top, 1 = bottom). Used two ways:
  // centering the line when arriving here from a Screenplay-view line
  // click (see SCREENPLAY_ARRIVAL_FRACTION below), and -- when Typewriter
  // Mode is on -- keeping the active line pinned to its sticky anchor.
  // Expressed as a fraction rather than a raw pixel/doc offset since it has
  // to hold up across window sizes. Falls back to PM's own scrollIntoView
  // (nearest-edge, not position-preserving) when there's no fraction to
  // target at all.
  function scrollToFraction(editorView, fraction) {
    const scrollEl = mountRef.current?.closest('.editor-scroll');
    if (typeof fraction !== 'number' || !scrollEl) {
      editorView.dispatch(editorView.state.tr.scrollIntoView());
      return;
    }
    const coords = editorView.coordsAtPos(editorView.state.selection.from);
    const containerRect = scrollEl.getBoundingClientRect();
    const targetY = containerRect.top + fraction * containerRect.height;
    const delta = coords.top - targetY;
    if (Math.abs(delta) < 0.5) return;
    programmaticScrollRef.current = true;
    scrollEl.scrollTop += delta;
  }

  // The reverse of scrollToFraction: reads where the caret currently sits
  // (as a fraction of the viewport) and adopts that as the new Typewriter
  // Mode anchor, rather than moving anything on screen. Used whenever the
  // *user* just chose a position -- a manual scroll, or clicking a specific
  // line -- so the sticky line moves to meet them there instead of the
  // reverse.
  function adoptCurrentFractionAsAnchor(editorView) {
    const scrollEl = mountRef.current?.closest('.editor-scroll');
    if (!scrollEl) return;
    const coords = editorView.coordsAtPos(editorView.state.selection.from);
    const containerRect = scrollEl.getBoundingClientRect();
    const fraction = (coords.top - containerRect.top) / containerRect.height;
    setTypewriterAnchor(Math.min(1, Math.max(0, fraction)));
  }

  useEffect(() => {
    if (!card) return undefined;
    const state = EditorState.create({
      doc: Node.fromJSON(schema, initialDocRef.current),
      plugins: [
        slashMenuPlugin(),
        editorKeymap(() => recentCharacterNamesRef.current),
        history(),
        autoCapsPlugin(),
        placeholderPlugin(),
        fountainPastePlugin(),
        pageBreakPlugin(),
        activeLinePlugin(),
        touchCaretPlugin(),
        autoParentheticalPlugin(autoParentheticalRef),
        characterAutocompletePlugin(() => recentCharacterNamesRef.current),
      ],
    });

    const editorView = new EditorView(mountRef.current, {
      state,
      dispatchTransaction(tr) {
        const newState = editorView.state.apply(tr);
        editorView.updateState(newState);
        setSlashState(slashMenuKey.getState(newState));
        if (tr.docChanged) updateCardSceneDoc(actId, cardId, newState.doc.toJSON());
        // Runs on every transaction -- typing, Enter (splits a new block),
        // Backspace/Delete (merges or removes one), arrow-key caret moves,
        // paste, undo/redo, slash-menu element-type changes, all of it --
        // rather than special-casing which kinds of edits "count."
        // scrollToFraction already no-ops once the active line is already
        // sitting at the anchor, so this is cheap when there's nothing to
        // correct. A mouse/touch click is the one exception: ProseMirror
        // tags those transactions with a "pointer" meta (see
        // prosemirror-view's input.ts) distinct from "key"-origin caret
        // moves, and a click is the user deliberately choosing where to
        // look -- forcibly scrolling their choice to the anchor would fight
        // the click itself. The sticky line should go meet them there
        // instead, same as it does for a manual scroll.
        if (typewriterModeRef.current) {
          if (tr.getMeta('pointer')) {
            // A real click/tap-driven selection change, per PM's own
            // "pointer" tag -- as opposed to a scroll/drag gesture, which
            // never produces one of these (dragging just scrolls the
            // container; it doesn't change the selection). Lock the
            // *current* scrollTop as the baseline to defend for a short
            // window, covering this transaction, touchCaretPlugin's
            // next-frame correction of the same tap (which dispatches its
            // own follow-up "pointer" transaction), and a couple of settle
            // frames after for native autoscroll-on-focus that lands late.
            const scrollEl = mountRef.current?.closest('.editor-scroll');
            lockScrollAgainstPointer(scrollEl);
            adoptCurrentFractionAsAnchor(editorView);
            reassertScrollLock(scrollEl);
            requestAnimationFrame(() => {
              reassertScrollLock(scrollEl);
              requestAnimationFrame(() => reassertScrollLock(scrollEl));
            });
          } else {
            scrollToFraction(editorView, typewriterAnchorRef.current);
          }
        }
      },
    });
    viewRef.current = editorView;
    editorView.dom.addEventListener('touchstart', handleTouchStart, { passive: true });
    editorView.dom.addEventListener('touchmove', handleTouchMove, { passive: true });
    setSlashState(slashMenuKey.getState(editorView.state));
    editorView.dispatch(
      editorView.state.tr.setMeta(activeLineKey, {
        enabled: typewriterModeRef.current,
        style: typewriterHighlightStyleRef.current,
      })
    );

    // Only a click on a specific Screenplay-view line carries a blockId to
    // scroll to a precise spot within the scene; opening from a beat card
    // (or the pencil icon, or the context menu) just lands at the top of
    // what is now a single short scene, not a whole script to scroll through.
    // The caret lands at the *end* of that line's text, not the start --
    // clicking a line to jump into the Editor reads as "let me keep writing
    // from here," which is where a screenwriter's cursor would already be.
    const blockId = initialTargetRef.current?.blockId;
    if (blockId) {
      const found = findBlockById(editorView.state.doc, blockId);
      if (found) {
        const endPos = found.pos + 1 + found.node.content.size;
        const sel = TextSelection.near(editorView.state.doc.resolve(endPos), -1);
        editorView.dispatch(editorView.state.tr.setSelection(sel));
      }
    }
    // Measuring/scrolling right here would run against a layout that hasn't
    // settled yet -- the .editor-scroll container was just mounted this
    // same tick, so it'd (wrongly) no-op. Typing afterwards "fixed" it only
    // because the browser's own native caret-follow scrolling kicks in for
    // real keystrokes, independent of this. Deferring to the next animation
    // frame gives layout a chance to settle first, so the very first scroll
    // attempt actually lands. Runs whenever there's anywhere in particular
    // to land -- arriving at a specific clicked line (always centered), or
    // Typewriter Mode's sticky anchor, which takes priority: if it's on,
    // every arrival should land at that same consistent spot instead.
    if (blockId || typewriterModeRef.current) {
      requestAnimationFrame(() => {
        // In dev, React.StrictMode mounts this effect, tears it down, and
        // mounts it again -- by the time this fires, `editorView` (this
        // specific mount's closed-over instance) may already be a destroyed
        // leftover from the throwaway first pass, distinct from whatever
        // `viewRef.current` now points to. Only proceed if this is still
        // the live view.
        if (viewRef.current !== editorView) return;
        scrollToFraction(
          editorView,
          typewriterModeRef.current ? typewriterAnchorRef.current : SCREENPLAY_ARRIVAL_FRACTION
        );
      });
    }
    editorView.focus();

    return () => {
      editorView.dom.removeEventListener('touchstart', handleTouchStart);
      editorView.dom.removeEventListener('touchmove', handleTouchMove);
      clearTimeout(pointerScrollLockTimerRef.current);
      editorView.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recomputes where this scene's blocks fall in the exported PDF's page
  // count -- across the *whole* script, not just this scene, since a page
  // break can land here purely because of how much came before it in
  // earlier beats. Debounced so a fast typist isn't re-running full-script
  // pagination (which re-measures every block's text wrapping) on every
  // keystroke; it only needs to be eventually consistent, not live.
  const firstPaginationRef = useRef(true);
  useEffect(() => {
    const ids = new Set((card?.sceneDoc?.content ?? []).map((n) => n.attrs?.id).filter(Boolean));
    if (!ids.size) {
      setPageRange(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      const { blocks, totalPages } = computeScriptPagination(project);
      const mine = blocks.filter((b) => ids.has(b.id));
      if (!mine.length) return;
      const pages = mine.map((b) => b.page);
      setPageRange({ start: Math.min(...pages), end: Math.max(...pages), total: totalPages });
      const breaks = mine.filter((b) => b.startsNewPage);
      viewRef.current?.dispatch(viewRef.current.state.tr.setMeta(pageBreakKey, breaks));
      // Inserting a marker can push content (and the caret) down enough to
      // scroll it back out of view -- only matters for the very first
      // pagination pass right after opening via a specific line (see the
      // scrollIntoView fix above); re-nudge it back into view just this once
      // rather than fighting the user's scroll position on every later edit.
      // (Typewriter Mode doesn't need this: the setMeta dispatch just above
      // already runs through dispatchTransaction, which re-corrects the
      // scroll on every transaction whenever the mode is on.)
      if (firstPaginationRef.current && initialTargetRef.current?.blockId && !typewriterModeRef.current) {
        requestAnimationFrame(() => {
          if (viewRef.current) scrollToFraction(viewRef.current, SCREENPLAY_ARRIVAL_FRACTION);
        });
      }
      firstPaginationRef.current = false;
    }, 300);
    return () => clearTimeout(timer);
  }, [project, card]);

  // Handles toggling Typewriter Mode on/off, and changing its highlight
  // style, *while this card is already open* (the mount effect above only
  // covers arriving with a setting already applied). Flips the active-line
  // highlight and, if the mode just turned on, immediately snaps the
  // current caret to the anchor rather than waiting for the next edit or
  // scroll to trigger a correction.
  useEffect(() => {
    const editorView = viewRef.current;
    if (!editorView) return;
    editorView.dispatch(
      editorView.state.tr.setMeta(activeLineKey, { enabled: typewriterMode, style: typewriterHighlightStyle })
    );
    if (typewriterMode) scrollToFraction(editorView, typewriterAnchorRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typewriterMode, typewriterHighlightStyle]);

  // While Typewriter Mode is on, a manual scroll (trackpad/wheel/scrollbar
  // -- anything that isn't this component's own corrective scrollTop writes,
  // which set programmaticScrollRef first so they're ignored here) is read
  // as "the user just dragged the sticky line to a new spot": whatever
  // fraction down the viewport the active line ends up at becomes the new
  // anchor, so it "sticks where it lands" from then on.
  useEffect(() => {
    const scrollEl = mountRef.current?.closest('.editor-scroll');
    if (!scrollEl) return undefined;
    function handleScroll() {
      if (programmaticScrollRef.current) {
        programmaticScrollRef.current = false;
        return;
      }
      // A tap/click is still being resolved (see pointerScrollLockRef) --
      // this drift is native autoscroll-on-focus, not the user manually
      // scrolling, so snap it back instead of adopting it as a new anchor.
      if (pointerScrollLockRef.current != null) {
        reassertScrollLock(scrollEl);
        return;
      }
      if (!typewriterModeRef.current || !viewRef.current) return;
      adoptCurrentFractionAsAnchor(viewRef.current);
    }
    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollEl.removeEventListener('scroll', handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const target = view.payload;

  if (!card) {
    return (
      <div className="placeholder-view">
        <h2>Beat not found</h2>
        <p>This beat card may have been deleted. Pick something from the Outline.</p>
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <div className={`editor-scroll${typewriterMode ? ' typewriter-mode' : ''}`}>
        <div className="screenplay-head">
          <div>
            <div className="board-title">{card.title}</div>
            <div className="board-sub">
              {target?.source ? `Opened from ${target.source}` : 'Tab or “/” to change an element’s type.'}
            </div>
          </div>
          <div className="editor-beat-nav">
            {pageRange && (
              <span className="page-range-badge" title="Script page(s) this beat spans, and the script's total page count">
                {pageRange.start === pageRange.end ? `Page ${pageRange.start}` : `Pages ${pageRange.start}–${pageRange.end}`}
                {' '}of {pageRange.total}
              </span>
            )}
            <button
              className="editor-beat-nav-btn"
              disabled={!prevCard}
              title={prevCard ? `Previous: ${prevCard.title}` : 'This is the first beat'}
              onClick={() => goToCard(prevCard)}
            >
              ‹ Previous
            </button>
            <button
              className="editor-beat-nav-btn"
              disabled={!nextCard}
              title={nextCard ? `Next: ${nextCard.title}` : 'This is the last beat'}
              onClick={() => goToCard(nextCard)}
            >
              Next ›
            </button>
          </div>
        </div>
        <div className="screenplay-page editor-page" ref={mountRef} />
      </div>
      <SlashMenu view={viewRef.current} pluginState={slashState} />
    </div>
  );
}
