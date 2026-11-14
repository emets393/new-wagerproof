const START_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatStart(iso: string | null): string {
  if (!iso) return 'Time TBD';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Time TBD';
  return `${START_FORMAT.format(date)} ET`;
}

/** Newest capture, shown as a relative age. Never an average of the market snaps. */
export function formatCaptured(iso: string | null, now = Date.now()): string {
  if (!iso) return 'time unknown';
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'time unknown';
  const minutes = Math.max(0, Math.round((now - ms) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
