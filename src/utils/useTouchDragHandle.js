import { useEffect, useRef } from 'react';

// Drives touch-driven drag reordering from a dedicated grab handle (see
// TouchDragHandle.jsx) -- deliberately separate from long-press
// (useLongPress.js), and deliberately NOT "long-press anywhere on the row
// then drag": almost the entire row is also the user's normal scroll
// surface, and a scroll gesture that starts on a card is indistinguishable
// from the start of a reorder-drag without a dedicated target to grab.
// Touching the handle is unambiguous by construction, so this can start
// dragging on the very first movement with no timing heuristics at all --
// and can (and must) preventDefault() immediately, since dragging is the
// *only* thing touching this specific element should ever do.
//
// Returns a ref to attach to the handle element. Uses native, non-passive
// listeners (not JSX props) for the same reason as useTouchReorder did --
// React's default-passive touch listeners can't preventDefault().
export function useTouchDragHandle({ onDragStart, onDragMove, onDrop, enabled = true }) {
  const elRef = useRef(null);
  const draggingRef = useRef(false);
  const callbacksRef = useRef({ onDragStart, onDragMove, onDrop });
  callbacksRef.current = { onDragStart, onDragMove, onDrop };

  useEffect(() => {
    const el = elRef.current;
    if (!el || !enabled) return undefined;

    function handleTouchStart(e) {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      draggingRef.current = true;
      callbacksRef.current.onDragStart();
    }

    function handleTouchMove(e) {
      if (!draggingRef.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      callbacksRef.current.onDragMove(touch.clientX, touch.clientY);
    }

    function handleTouchEnd() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      callbacksRef.current.onDrop();
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    el.addEventListener('touchend', handleTouchEnd, { passive: true });
    el.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [enabled]);

  return elRef;
}
