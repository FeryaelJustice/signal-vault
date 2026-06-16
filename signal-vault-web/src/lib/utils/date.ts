/**
 * Returns a human-readable relative time string like "3 minutes ago".
 * Falls back gracefully if the date is invalid.
 */
export function formatDistanceToNow(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 60) return "just now";
    if (diffSec < 3600) {
      const m = Math.floor(diffSec / 60);
      return `${m} minute${m !== 1 ? "s" : ""} ago`;
    }
    if (diffSec < 86400) {
      const h = Math.floor(diffSec / 3600);
      return `${h} hour${h !== 1 ? "s" : ""} ago`;
    }
    const d = Math.floor(diffSec / 86400);
    if (d < 30) return `${d} day${d !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}
