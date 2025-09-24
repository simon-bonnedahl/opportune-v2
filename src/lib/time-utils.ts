/**
 * Formats a timestamp into a human-readable "time ago" string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable time ago string (e.g., "2 hours ago", "3 days ago")
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diffInMs = now - timestamp;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInSeconds < 60) {
    return diffInSeconds <= 1 ? "just now" : `${diffInSeconds} seconds ago`;
  }
  
  if (diffInMinutes < 60) {
    return diffInMinutes === 1 ? "1 minute ago" : `${diffInMinutes} minutes ago`;
  }
  
  if (diffInHours < 24) {
    return diffInHours === 1 ? "1 hour ago" : `${diffInHours} hours ago`;
  }
  
  if (diffInDays < 7) {
    return diffInDays === 1 ? "1 day ago" : `${diffInDays} days ago`;
  }
  
  if (diffInWeeks < 4) {
    return diffInWeeks === 1 ? "1 week ago" : `${diffInWeeks} weeks ago`;
  }
  
  if (diffInMonths < 12) {
    return diffInMonths === 1 ? "1 month ago" : `${diffInMonths} months ago`;
  }
  
  return diffInYears === 1 ? "1 year ago" : `${diffInYears} years ago`;
}

/**
 * Formats a timestamp into a readable date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Dec 15, 2023 at 2:30 PM")
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
