import { Capacitor, registerPlugin } from '@capacitor/core';
const native = registerPlugin('FolderSync');
export function syncTransport() {
  if (Capacitor.getPlatform() === 'ios') return native;
  return typeof window !== 'undefined' ? window.iCloudSync ?? null : null;
}
export const isICloudSyncAvailable = () => !!syncTransport();
