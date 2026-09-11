import { useRef } from 'react';

const LONG_PRESS_MS = 500;
const MOVE_CANCEL_PX = 10;

// Touch equivalent of onContextMenu, which has no touch gesture behind it
// at all -- everywhere a component opens a context menu on right-click,
// spreading this onto the same element opens it on a long-press too. Only
// meant to be wired up when isTouchPlatform() is true; harmless but inert
// if attached on desktop (nothing sends touch events there), so call sites
// don't need their own platform check just to use it.
//
// Cancels if the finger moves more than MOVE_CANCEL_PX before the timer
// fires -- that reads as "the user's trying to scroll," not summon a menu.
// Callers are expected to pair this with CSS suppressing iOS's own
// long-press text-selection/callout UI on the same element (see
// .touch-platform's -webkit-touch-callout rules in index.css), or that
// native UI will fight this for the same gesture.
export function useLongPress(onLongPress) {
  const timerRef = useRef(null);
  const startRef = useRef(null);
  // Whether the long-press already fired for this touch -- if so, the
  // finger lifting still generates a normal synthetic click right after
  // (nothing about a long-press suppresses that on its own), which for a
  // clickable target (a project-list row, a file row) would immediately
  // also trigger its regular tap action right after opening the menu.
  // preventDefault() on touchend is the standard way to suppress that
  // trailing click.
  const firedRef = useRef(false);

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY };
    firedRef.current = false;
    clear();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      firedRef.current = true;
      onLongPress(startRef.current.x, startRef.current.y);
    }, LONG_PRESS_MS);
  }

  function onTouchMove(e) {
    if (!startRef.current || !timerRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clear();
  }

  function onTouchEnd(e) {
    clear();
    if (firedRef.current) {
      e.preventDefault();
      firedRef.current = false;
    }
  }

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: clear };
}
