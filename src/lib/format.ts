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
  } catch {
    return '';
  }
}

export function formatDuration(startMs?: number, endMs?: number, decimals: number = 0) {
  if (!startMs || !endMs) return '';
  const totalSeconds = Math.max(0, (endMs - startMs) / 1000);
  if (totalSeconds < 60) {
    return decimals > 0 ? `${totalSeconds.toFixed(decimals)}s` : `${Math.round(totalSeconds)}s`;
  }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return decimals > 0 ? `${m}m ${s.toFixed(decimals)}s` : `${m}m ${Math.round(s)}s`;
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