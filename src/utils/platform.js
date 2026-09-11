import { Capacitor } from '@capacitor/core';

// Gates every touch-specific interaction pattern added for the iOS build
// (long-press context menus, touch-driven drag reordering, always-visible
// affordances that would otherwise be hover-revealed) -- deliberately keyed
// to "is this the native app shell," not to touch capability in general, so
// none of it activates for the Electron/web desktop app, which stays
// exactly as it already is. If Android ever gets added, this already
// covers it (isNativePlatform() is true for any native Capacitor platform,
// not iOS specifically).
export function isTouchPlatform() {
  return Capacitor.isNativePlatform();
}
