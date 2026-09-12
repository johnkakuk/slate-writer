// Keep compact footer labels and detailed Settings messages in one place.
const statuses = {
  disconnected: { label: 'Not connected', message: 'Not connected' },
  checking: { label: 'Checking folder…', message: 'Checking sync folder…' },
  pending: { label: 'Waiting for folder', message: 'Saved locally · waiting to write to folder' },
  waiting: { label: 'Waiting for iCloud', message: 'Waiting for more revisions from iCloud' },
  ready: { label: 'Folder up to date', message: 'Saved locally · folder up to date on this device' },
  error: { label: 'Sync needs attention', message: 'Sync paused · retrying' },
};

export function getSyncStatus({ phase, folder, pending, error, conflicts = [] }) {
  if (error) return statuses.error;
  if (conflicts.length) return {
    label: `${conflicts.length} sync conflict${conflicts.length === 1 ? '' : 's'}`,
    message: 'Choose a version in Settings. All conflicting writing is retained.',
  };
  if (folder && pending) return statuses.pending;
  return statuses[phase] ?? statuses.disconnected;
}
