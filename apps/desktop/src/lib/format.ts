/**
 * Shared formatting helpers for human-readable timestamps and durations.
 *
 * `formatRelative` powers "added 2h ago" labels; `formatDuration` renders
 * Whisper / translator run wall-clocks. Both intentionally tolerate
 * missing / malformed input so they're safe to use directly in JSX
 * (returns "" instead of throwing).
 */

export function formatRelative(iso: string | undefined | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const delta = Date.now() - then;
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Format a millisecond duration as `1m 02s` / `42s`. Mirrors the
 * previous `formatDurationMs` helper that lived in VideoDetailModal —
 * accepts ms (run.durationMs in the sidecar history).
 */
export function formatDuration(ms: number | undefined | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/**
 * Format a whole-second duration (used by VideoDetail.durationSeconds —
 * the source video length, not a run wall-clock).
 */
export function formatDurationSeconds(seconds: number | undefined | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}
