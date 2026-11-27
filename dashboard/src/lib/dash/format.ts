import type { PlaybackState, Track } from "./types";

/** "4:18" / "1:02:09" → ms. Returns 0 for live streams or unknown values. */
export function parseDuration(text: string | undefined): number {
  if (!text) return 0;
  const parts = text.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0) * 1000;
}

export function trackMs(track: Track | undefined): number {
  if (!track) return 0;
  return track.durationMs && track.durationMs > 0 ? track.durationMs : parseDuration(track.duration);
}

/** ms → "4:18" (or "1:02:09"). */
export function fmtMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Wall-clock "01:47" in the viewer's locale. */
export function fmtClock(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Hours as "61 h" or "45 min". */
export function fmtListening(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 120) return `${minutes} min`;
  return `${Math.round(minutes / 60).toLocaleString()} h`;
}

export function fmtCount(n: number): string {
  return n.toLocaleString();
}

/** Position right now, interpolated from the last measurement while playing. */
export function livePosition(state: PlaybackState | null | undefined, now = Date.now()): number {
  if (!state?.currentTrack) return 0;
  const dur = trackMs(state.currentTrack);
  const base = state.currentPosition ?? 0;
  if (!state.isPlaying || state.isPaused) return base;
  const at = state.positionAt || state.lastUpdated || now;
  const pos = base + Math.max(0, now - at);
  return dur > 0 ? Math.min(pos, dur) : pos;
}

/** "2 min ago", "yesterday", or a date. */
export function fmtAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
}
