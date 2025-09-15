export function formatDate(
  date: Date | string | number | undefined,
  opts: Intl.DateTimeFormatOptions = {}
) {
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat('en-US', {
      month: opts.month ?? 'long',
      day: opts.day ?? 'numeric',
      year: opts.year ?? 'numeric',
      ...opts
    }).format(new Date(date));
  } catch (_err) {
    return '';
  }
}

export function formatDuration(startMs?: number, endMs?: number) {
  if (!startMs || !endMs) return '';
  const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function timeAgo(ms: number) {
  const delta = Math.max(0, Date.now() - ms);
  const days = Math.floor(delta / (24 * 60 * 60 * 1000));
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(delta / (60 * 60 * 1000));
  if (hours >= 1) return `${hours}h ago`;
  const minutes = Math.floor(delta / (60 * 1000));
  if (minutes >= 1) return `${minutes}m ago`;
  const seconds = Math.floor(delta / 1000);
  return `${seconds}s ago`;
}

export function formatShortDate(ms: number) {
  const date = new Date(ms);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return `${day} ${month}`;
}