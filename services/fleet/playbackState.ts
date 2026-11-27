import { GuildQueue, Player, QueueRepeatMode, Track } from "discord-player";
import { PlaybackState } from "../../models/PlaybackState";
import type { LivePlaybackState, LiveTrack } from "../../shared/fleet";
import {
  clearPlaybackState as clearRedisPlaybackState,
  isRedisAvailable,
  setPlaybackState as setRedisPlaybackState
} from "../../shared/services/redis";
import type { ITrack, TrackSource } from "../../shared/types";
import { INSTANCE } from "../../utils/instance";
import { DatabaseService } from "../database";
import { isGuessGameQueue, QueueMetadata } from "../discordPlayer";
import { activeEffects } from "../effects";

/** Redis keys live 30 s; refresh well inside that while connected. */
const REFRESH_MS = 5_000;

export function trackSource(source: string | undefined): TrackSource {
  const s = (source ?? "").toLowerCase();
  if (s.includes("youtube")) return "youtube";
  if (s.includes("spotify")) return "spotify";
  if (s.includes("soundcloud")) return "soundcloud";
  if (s.includes("attachment") || s.includes("file")) return "file";
  return "unknown";
}

export function loopModeOf(queue: GuildQueue): LivePlaybackState["loopMode"] {
  if (queue.repeatMode === QueueRepeatMode.TRACK) return "track";
  if (queue.repeatMode === QueueRepeatMode.QUEUE) return "queue";
  return "off";
}

/** A discord-player track in the dashboard contract shape. */
export function toLiveTrack(track: Track): LiveTrack {
  const user = track.requestedBy;
  return {
    title: track.title,
    author: track.author,
    url: track.url,
    thumbnail: track.thumbnail || undefined,
    duration: track.durationMS ? track.duration : "",
    durationMs: track.durationMS || 0,
    source: trackSource(track.source),
    requestedBy: user
      ? { id: user.id, username: user.username, avatar: user.displayAvatarURL?.({ size: 64 }) ?? undefined }
      : undefined
  };
}

/** The live state of this instance's queue in its server. */
export function buildLiveState(queue: GuildQueue): LivePlaybackState {
  const metadata = (queue.metadata || {}) as QueueMetadata;
  const voice = queue.channel;
  const now = Date.now();
  // A guess-the-song round must not reveal what is playing.
  const hidden = isGuessGameQueue(queue);
  const current = hidden ? null : (queue.currentTrack ?? metadata.currentTrack ?? null);
  const position = current && current.durationMS ? (queue.node.getTimestamp()?.current.value ?? 0) : 0;

  return {
    guildId: queue.guild.id,
    instance: INSTANCE,
    isConnected: Boolean(voice),
    voiceChannelId: voice?.id,
    voiceChannelName: voice?.name,
    textChannelId: metadata.channel?.id,
    isPlaying: queue.node.isPlaying(),
    isPaused: queue.node.isPaused(),
    volume: queue.node.volume,
    currentTrack: current ? toLiveTrack(current) : undefined,
    currentPosition: position,
    positionAt: now,
    queue: hidden ? [] : queue.tracks.toArray().slice(0, 50).map(toLiveTrack),
    queueSize: hidden ? 0 : queue.tracks.size,
    loopMode: loopModeOf(queue),
    autoplay: Boolean(metadata.autoplay),
    filters: activeEffects(queue),
    listeners: voice ? voice.members.filter((m) => !m.user.bot).size : 0,
    lastUpdated: now
  };
}

/**
 * The pre-fleet shape (track duration in ms, Date timestamps) for the legacy
 * Redis key and the Mongo mirror, plus the new fields.
 */
export function toLegacyState(state: LivePlaybackState, audioBitrate: number) {
  const track = (t: LiveTrack | undefined): ITrack | null =>
    t
      ? {
          title: t.title,
          author: t.author,
          url: t.url,
          thumbnail: t.thumbnail ?? "",
          duration: t.durationMs ?? 0,
          requestedBy: { id: t.requestedBy?.id ?? "unknown", username: t.requestedBy?.username ?? "Unknown", avatar: null },
          source: (t.source as TrackSource) ?? "unknown"
        }
      : null;

  return {
    guildId: state.guildId,
    instance: state.instance,
    isConnected: state.isConnected,
    voiceChannelId: state.voiceChannelId ?? null,
    voiceChannelName: state.voiceChannelName ?? null,
    textChannelId: state.textChannelId ?? null,
    isPlaying: state.isPlaying,
    isPaused: state.isPaused,
    volume: state.volume,
    currentTrack: track(state.currentTrack),
    currentPosition: state.currentPosition,
    positionAt: state.positionAt,
    queue: state.queue.map(track).filter((t): t is ITrack => t !== null),
    queueSize: state.queueSize,
    loopMode: state.loopMode,
    autoplay: state.autoplay,
    filters: state.filters,
    listeners: state.listeners,
    audioBitrate,
    playbackStartedAt: state.currentTrack ? new Date(state.positionAt - state.currentPosition) : null,
    lastUpdated: new Date(state.lastUpdated)
  };
}

/**
 * Publish this instance's state for a queue: Redis (+ live stream) always,
 * the Mongo mirror when `persist` (player events; the 5 s refresh skips it).
 */
export async function publishPlayback(queue: GuildQueue, persist = true): Promise<LivePlaybackState | null> {
  if (!queue.guild) return null;
  const guildId = queue.guild.id;
  const state = buildLiveState(queue);
  const legacy = toLegacyState(state, ((queue.metadata || {}) as QueueMetadata).audioBitrate || 96);

  try {
    if (await isRedisAvailable()) await setRedisPlaybackState(guildId, INSTANCE, state, legacy);
  } catch (error) {
    console.warn("[PlaybackState] Redis write failed:", (error as Error)?.message ?? error);
  }

  if (persist && DatabaseService.getInstance().isConnected()) {
    // Two events in the same tick (trackAdd + playerStart) can both try to
    // insert; the loser hits E11000 and just updates the winner's document.
    const filter = { guildId, instance: INSTANCE };
    try {
      await PlaybackState.findOneAndUpdate(filter, legacy, { upsert: true, new: true });
    } catch (error: any) {
      if (error?.code !== 11000) {
        console.error("[PlaybackState] ❌ Mongo write failed:", error?.message ?? error);
      } else {
        await PlaybackState.findOneAndUpdate(filter, legacy, { new: true }).catch(() => undefined);
      }
    }
  }
  return state;
}

/** The instance left (or its queue ended): drop its state and tell live dashboards. */
export async function clearPlayback(guildId: string | undefined): Promise<void> {
  if (!guildId) return;
  try {
    if (await isRedisAvailable()) await clearRedisPlaybackState(guildId, INSTANCE);
  } catch (error) {
    console.warn("[PlaybackState] Redis clear failed:", (error as Error)?.message ?? error);
  }
  try {
    if (DatabaseService.getInstance().isConnected()) await PlaybackState.deleteOne({ guildId, instance: INSTANCE });
  } catch (error) {
    console.error("[PlaybackState] ❌ Mongo clear failed:", (error as Error)?.message ?? error);
  }
}

/**
 * Re-publish every connected queue every 5 s: keeps the 30 s Redis keys alive
 * through long songs and gives live dashboards a fresh position.
 */
export function startPlaybackRefresher(getPlayer: () => Player | null): NodeJS.Timeout {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const player = getPlayer();
      if (!player || player.nodes.cache.size === 0) return;
      if (!(await isRedisAvailable())) return;
      for (const queue of player.nodes.cache.values()) {
        if (!queue || queue.deleted || !queue.channel) continue;
        await publishPlayback(queue, false);
      }
    } catch (error) {
      console.warn("[PlaybackState] Refresh failed:", (error as Error)?.message ?? error);
    } finally {
      running = false;
    }
  }, REFRESH_MS);
  timer.unref();
  return timer;
}

/**
 * One-time index migration: `playbackstates` was unique on guildId; the fleet
 * keys it by (guildId, instance). Tags old documents as instance 1, drops the
 * old unique index and creates the pair index. Idempotent and safe to run
 * from every instance; never throws. Returns true when the indexes are in place.
 */
export async function ensurePlaybackIndexes(): Promise<boolean> {
  if (!DatabaseService.getInstance().isConnected()) return false;
  const collection = PlaybackState.collection;
  try {
    await collection.updateMany({ instance: { $exists: false } }, { $set: { instance: 1 } });

    const indexes = await collection.indexes().catch(() => [] as { name?: string }[]);
    if (indexes.some((index) => index.name === "guildId_1")) {
      await collection.dropIndex("guildId_1").catch((error: any) => {
        // Another instance dropped it first.
        if (error?.codeName !== "IndexNotFound") throw error;
      });
      console.log("[PlaybackState] 🔁 Dropped the pre-fleet unique guildId index");
    }

    const pairIndex = () => collection.createIndex({ guildId: 1, instance: 1 }, { unique: true, name: "guildId_1_instance_1" });
    try {
      await pairIndex();
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      // Duplicates written mid-migration: this collection is a cache of live
      // state (TTL 1 h), so start it over.
      await collection.deleteMany({});
      await pairIndex();
    }
    await collection.createIndex({ lastUpdated: 1 }, { expireAfterSeconds: 3600, name: "lastUpdated_1" }).catch(() => undefined);
    return true;
  } catch (error) {
    console.warn("[PlaybackState] ⚠️ Index migration failed (will retry):", (error as Error)?.message ?? error);
    return false;
  }
}
