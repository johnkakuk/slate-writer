import { useEffect, useRef } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

// Unifies long-press-opens-a-menu and press-and-drag-to-reorder onto a
// single gesture, safely, without a dedicated grab handle: the drag can
// only arm *after* the full long-press hold completes (the same 500ms
// useLongPress.js already uses for menus elsewhere), never on the first bit
// of movement the way an immediate "start dragging on touchmove" approach
// would. A real scroll gesture starts moving almost immediately -- long
// before 500ms -- so it cancels the timer and passes through untouched,
// same as useLongPress.js already does. Only a genuinely still hold, the
// same gesture that would open the menu, can ever become a drag.
//
// Once armed (held still for the full duration): lifting without moving
// fires onLongPress (opens the menu); moving instead starts a drag
// (onDragStart/onDragMove/onDrop). The two are mutually exclusive per touch.
//
// Suitable for a row that's *also* the user's normal scroll surface (e.g.
// a sidebar list) -- which is exactly the case a dedicated handle
// (useTouchDragHandle.js) exists for elsewhere, where an immediate-drag
// approach would hijack scrolling. Not a universal replacement for that
// hook: it trades "drag starts instantly from a precise target" for "drag
// requires a half-second deliberate hold first, from anywhere on the row."
export function useLongPressOrDrag({ onLongPress, onDragStart, onDragMove, onDrop }) {
  const elRef = useRef(null);
  const startRef = useRef(null);
  const timerRef = useRef(null);
  const modeRef = useRef('idle'); // idle -> armed -> dragging
  const callbacksRef = useRef({ onLongPress, onDragStart, onDragMove, onDrop });
  callbacksRef.current = { onLongPress, onDragStart, onDragMove, onDrop };

  useEffect(() => {
    const el = elRef.current;
    if (!el) return undefined;

    function clearTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      startRef.current = { x: touch.clientX, y: touch.clientY };
      modeRef.current = 'idle';
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        modeRef.current = 'armed';
      }, LONG_PRESS_MS);
    }

    function handleTouchMove(e) {
      if (!startRef.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      const moved = Math.hypot(dx, dy) > MOVE_CANCEL_PX;

      if (modeRef.current === 'idle') {
        // Never armed -- this is just a scroll (or any other gesture) that
        // happened to start on this row. Let it fall through untouched.
        if (moved) clearTimer();
        return;
      }
      if (modeRef.current === 'armed' && moved) {
        modeRef.current = 'dragging';
        callbacksRef.current.onDragStart();
      }
      if (modeRef.current === 'dragging') {
        e.preventDefault();
        callbacksRef.current.onDragMove(touch.clientX, touch.clientY);
      }
    }

    function handleTouchEnd() {
      clearTimer();
      if (modeRef.current === 'armed') {
        callbacksRef.current.onLongPress(startRef.current.x, startRef.current.y);
      } else if (modeRef.current === 'dragging') {
        callbacksRef.current.onDrop();
      }
      modeRef.current = 'idle';
      startRef.current = null;
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      clearTimer();
    };
  }, []);

  return elRef;
}
