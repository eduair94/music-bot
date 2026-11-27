import type { LivePlaybackState, LiveTrack } from "../../../shared/fleet";

/**
 * Playback state normalisation for the fleet routes (pure, unit-tested):
 * the bot writes the dashboard v2 contract shape; the legacy Redis key and
 * Mongo documents use the pre-fleet shape.
 */

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function epoch(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" || value instanceof Date) {
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

/** Any stored track (contract or pre-fleet shape) as the contract's Track. */
export function normalizeTrack(raw: unknown): LiveTrack | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, any>;
  // Contract shape: duration "3:45" + durationMs; pre-fleet shape: duration in ms.
  const durationMs = typeof t.durationMs === "number" ? t.durationMs : typeof t.duration === "number" ? t.duration : 0;
  const duration = typeof t.duration === "string" ? t.duration : durationMs ? formatMs(durationMs) : "";
  const by = t.requestedBy && typeof t.requestedBy === "object" && t.requestedBy.id ? t.requestedBy : null;
  return {
    title: String(t.title ?? ""),
    author: String(t.author ?? ""),
    url: String(t.url ?? ""),
    thumbnail: str(t.thumbnail),
    duration,
    durationMs,
    source: str(t.source),
    requestedBy: by ? { id: String(by.id), username: String(by.username ?? ""), avatar: str(by.avatar) } : undefined
  };
}

/**
 * Any stored playback state (contract shape from the fleet bot, the legacy
 * Redis key or a Mongo document) in the dashboard v2 contract shape.
 */
export function normalizePlayback(raw: Record<string, any>, guildId: string, instance: number): LivePlaybackState {
  const now = Date.now();
  const lastUpdated = epoch(raw.lastUpdated, now);
  const queue = Array.isArray(raw.queue) ? raw.queue.map(normalizeTrack).filter((t): t is LiveTrack => Boolean(t)) : [];
  return {
    guildId,
    instance,
    isConnected: Boolean(raw.isConnected),
    voiceChannelId: str(raw.voiceChannelId),
    voiceChannelName: str(raw.voiceChannelName),
    textChannelId: str(raw.textChannelId),
    isPlaying: Boolean(raw.isPlaying),
    isPaused: Boolean(raw.isPaused),
    volume: typeof raw.volume === "number" ? raw.volume : 80,
    currentTrack: normalizeTrack(raw.currentTrack),
    currentPosition: typeof raw.currentPosition === "number" ? raw.currentPosition : 0,
    positionAt: epoch(raw.positionAt, lastUpdated),
    queue,
    queueSize: typeof raw.queueSize === "number" ? raw.queueSize : queue.length,
    loopMode: raw.loopMode === "track" || raw.loopMode === "queue" ? raw.loopMode : "off",
    autoplay: Boolean(raw.autoplay),
    filters: Array.isArray(raw.filters) ? raw.filters.filter((f: unknown): f is string => typeof f === "string") : [],
    listeners: typeof raw.listeners === "number" ? raw.listeners : 0,
    lastUpdated
  };
}
