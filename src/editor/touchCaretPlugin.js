import { Plugin, TextSelection } from 'prosemirror-state';

const TAP_MOVE_PX = 10;
const TAP_MAX_MS = 300;
const MULTITAP_MS = 400;
const SETTLE_MS = 400;

function distanceToBand(value, start, end) {
  return Math.max(start - value, value - end, 0);
}

function selectionAtTouch(view, touch) {
  const doc = view.state.doc;
  const x = touch.clientX, y = touch.clientY;
  let block = null;

  // In the page margin, posAtCoords can return a position BETWEEN blocks
  // (inside: -1). TextSelection.near then chooses the next block, even when
  // the touch is beside a wrapped line in the preceding dialogue. Identify
  // the block vertically before asking the browser for a text position.
  doc.forEach((node, pos) => {
    if (!node.isTextblock) return;
    const dom = view.nodeDOM(pos);
    const rect = dom?.getBoundingClientRect();
    if (!rect || rect.bottom <= rect.top) return;
    const distance = distanceToBand(y, rect.top, rect.bottom);
    if (!block || distance < block.distance) block = { node, pos, dom, distance };
  });
  if (!block) return null;
  const start = block.pos + 1, end = start + block.node.content.size;
  if (start === end) return TextSelection.create(doc, start);

  // Range rectangles follow actual visual lines, including wrapping and
  // centered/right-aligned text. Move a margin tap just inside that line's
  // ink, where native hit testing can identify the correct text endpoint.
  // This also avoids probing the leading below/above a glyph, where WebKit
  // can fall back to the beginning of the text node.
  const range = view.dom.ownerDocument.createRange();
  range.selectNodeContents(block.dom);
  let line = null, dy = Infinity, dx = Infinity;
  for (const rect of range.getClientRects()) {
    if (rect.right <= rect.left || rect.bottom <= rect.top) continue;
    const vertical = distanceToBand(y, rect.top, rect.bottom);
    const horizontal = distanceToBand(x, rect.left, rect.right);
    if (vertical < dy || (vertical === dy && horizontal < dx)) {
      line = rect; dy = vertical; dx = horizontal;
    }
  }
  if (!line) return null;
  const inset = Math.min(0.5, (line.right - line.left) / 2);
  const result = view.posAtCoords({
    left: Math.max(line.left + inset, Math.min(line.right - inset, x)),
    top: (line.top + line.bottom) / 2,
  });
  // Never turn another between-block result into a caret on a different line.
  if (!result || result.pos < start || result.pos > end) return null;
  return TextSelection.create(doc, result.pos);
}

function moved(touch, start) {
  return Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > TAP_MOVE_PX;
}

export function touchCaretPlugin() {
  let gesture = null;
  let lastTap = null;
  let pending = null;

  function cancel() {
    gesture = null;
    pending = null;
  }

  return new Plugin({
    props: {
      handleDOMEvents: {
        touchstart(view, event) {
          cancel();
          if (event.touches.length !== 1 || view.composing) return false;
          const touch = event.touches[0];
          const now = Date.now();
          gesture = {
            id: touch.identifier, x: touch.clientX, y: touch.clientY,
            time: now,
          };
          return false;
        },
        touchmove(view, event) {
          if (!gesture) return false;
          const touch = Array.from(event.touches).find(t => t.identifier === gesture.id);
          if (!touch || event.touches.length !== 1 || moved(touch, gesture)) cancel();
          return false;
        },
        touchcancel() {
          cancel();
          return false;
        },
        touchend(view, event) {
          const start = gesture;
          gesture = null;
          if (!start || event.touches.length || event.changedTouches.length !== 1) return false;
          const touch = event.changedTouches[0];
          const now = Date.now();
          if (touch.identifier !== start.id || moved(touch, start) ||
              now - start.time > TAP_MAX_MS || view.composing) return false;
          if (event.defaultPrevented || !event.cancelable) return false;
          const selection = selectionAtTouch(view, touch);
          if (!selection) return false;
          const lineTop = view.coordsAtPos(selection.head).top;
          const blockStart = selection.$head.start();
          const repeated = lastTap && start.time - lastTap.time < MULTITAP_MS &&
            Math.hypot(touch.clientX - lastTap.x, touch.clientY - lastTap.y) < 24 &&
            blockStart === lastTap.blockStart && Math.abs(lineTop - lastTap.lineTop) < 1;
          lastTap = { x: touch.clientX, y: touch.clientY, time: now, blockStart, lineTop };
          // Leave double/triple taps on one visual line to native selection.
          // Nearby taps on adjacent lines are still separate caret moves.
          if (repeated) return false;

          // A completed tap gets one synchronous placement. Suppress the
          // compatibility mouse click, and focus through PM's public API
          // (which uses preventScroll and syncs even a stale DOM selection).
          event.preventDefault();
          pending = { selection, doc: view.state.doc, until: now + SETTLE_MS };
          if (!selection.eq(view.state.selection)) {
            view.dispatch(view.state.tr.setSelection(selection).setMeta('pointer', true));
          }
          view.focus();
          return true;
        },
      },
    },
    view(view) {
      const document = view.dom.ownerDocument;
      function repairSelection() {
        if (!pending) return;
        if (Date.now() > pending.until || view.composing || !view.hasFocus() ||
            view.state.doc !== pending.doc || !view.state.selection.eq(pending.selection)) {
          pending = null;
          return;
        }
        const live = view.domSelectionRange();
        if (!live.anchorNode || !live.focusNode ||
            !view.dom.contains(live.anchorNode) || !view.dom.contains(live.focusNode)) {
          pending = null;
          return;
        }
        // A native range selection belongs to the user's selection UI.
        if (live.anchorNode !== live.focusNode || live.anchorOffset !== live.focusOffset) {
          pending = null;
          return;
        }
        let pos;
        try {
          pos = view.posAtDOM(live.focusNode, live.focusOffset);
        } catch {
          pending = null;
          return;
        }
        if (pos !== pending.selection.head) view.focus();
      }

      // Real iOS touches can place the caret correctly, then restore the
      // previous block tens of milliseconds later, even with touchend's
      // default prevented. Repair in capture phase, before PM's observer
      // adopts it. A requestAnimationFrame loop lets that wrong selection
      // reach the model, active-line decoration, scrolling, and paint first.
      document.addEventListener('selectionchange', repairSelection, true);
      const cancelEvents = ['pointerdown', 'keydown', 'beforeinput', 'compositionstart', 'blur', 'wheel'];
      for (const event of cancelEvents) document.addEventListener(event, cancel, true);
      return {
        update() {
          if (pending && (view.state.doc !== pending.doc || !view.state.selection.eq(pending.selection))) {
            pending = null;
          }
        },
        destroy() {
          cancel();
          document.removeEventListener('selectionchange', repairSelection, true);
          for (const event of cancelEvents) document.removeEventListener(event, cancel, true);
        },
      };
    },
  });
}
