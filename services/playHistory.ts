import { GuildQueue, Player, QueueRepeatMode, Track } from "discord-player";
import { IPlayHistory, PlayHistory } from "../models/PlayHistory";
import { isHttpUrl, truncate } from "../utils/format";
import { isAutoplayTrack } from "./autoplay";
import { DatabaseService } from "./database";
import { DiscordPlayerService } from "./discordPlayer";

/** Most plays /history reads for one server (or one member in it). */
export const HISTORY_LIMIT = 100;
const QUERY_TIMEOUT_MS = 5_000;
/** Audio that isn't music: /say clips are served from Replicate. */
const NON_MUSIC_HOSTS = ["replicate.delivery"];

/** The database is down, so there is no history to show right now. */
export class HistoryUnavailableError extends Error {
  constructor() {
    super("Play history is unavailable (database not connected)");
    this.name = "HistoryUnavailableError";
  }
}

/** Songs worth listing and playing again: links and bridged searches, not local files or TTS. */
function isReplayable(url: string): boolean {
  if (url.startsWith("ytsearch")) return true;
  if (!isHttpUrl(url)) return false;
  const host = new URL(url).hostname;
  return !NON_MUSIC_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Play history: every song that starts playing is saved per server (kept 30
 * days by a TTL index), so /history can list it and play songs again.
 * Guess-the-song rounds are skipped so they don't give answers away.
 */
export class PlayHistoryService {
  private static instance: PlayHistoryService;
  private attachedTo: Player | null = null;
  private waiter: NodeJS.Timeout | null = null;
  /** Last recorded URL per guild, so a looped song is one entry, not one per loop. */
  private lastUrl = new Map<string, string>();

  public static getInstance(): PlayHistoryService {
    if (!this.instance) this.instance = new PlayHistoryService();
    return this.instance;
  }

  /** Start recording as soon as the player is ready. Safe to call more than once. */
  public start(): void {
    if (this.attachedTo || this.waiter) return;
    if (this.tryAttach()) return;
    this.waiter = setInterval(() => {
      if (this.tryAttach() && this.waiter) {
        clearInterval(this.waiter);
        this.waiter = null;
      }
    }, 2_000);
    // Never keep a script (dry runs, tools) alive just to wait for a player.
    this.waiter.unref();
  }

  private tryAttach(): boolean {
    const service = DiscordPlayerService.getInstance();
    const player = service.isInitialized() ? service.getPlayer() : null;
    if (!player) return false;
    if (this.attachedTo !== player) {
      player.events.on("playerStart", (queue: GuildQueue, track: Track) => void this.record(queue, track));
      this.attachedTo = player;
      console.log("[PlayHistory] ✅ Recording plays");
    }
    return true;
  }

  public isAvailable(): boolean {
    return DatabaseService.getInstance().isConnected();
  }

  /** Save one play. Never throws: history is a nice-to-have, playback is not. */
  public async record(queue: GuildQueue, track: Track): Promise<void> {
    try {
      const guildId = queue.guild?.id;
      if (!guildId || !track) return;
      if ((queue.metadata as { guessGame?: boolean } | undefined)?.guessGame) return;

      const url = track.url || "";
      if (!isReplayable(url)) return;
      if (queue.repeatMode === QueueRepeatMode.TRACK && this.lastUrl.get(guildId) === url) return;
      this.lastUrl.set(guildId, url);

      if (!this.isAvailable()) return;
      const requester = track.requestedBy;
      await PlayHistory.create({
        guildId,
        title: truncate(track.title || "Unknown", 200),
        author: truncate(track.author || "", 120),
        url,
        duration: Number.isFinite(track.durationMS) ? Math.max(0, track.durationMS) : 0,
        thumbnail: isHttpUrl(track.thumbnail) ? track.thumbnail : "",
        source: String(track.source || "unknown"),
        requestedBy: requester && !requester.bot ? { id: requester.id, username: requester.username } : null,
        autoplay: isAutoplayTrack(track),
        playedAt: new Date()
      });
    } catch (error) {
      console.warn("[PlayHistory] Could not record a play:", (error as Error)?.message ?? error);
    }
  }

  /** The latest plays in a server, newest first, optionally only one member's requests. */
  public async recent(guildId: string, userId?: string | null): Promise<IPlayHistory[]> {
    if (!this.isAvailable()) throw new HistoryUnavailableError();
    const filter: Record<string, unknown> = { guildId };
    if (userId) filter["requestedBy.id"] = userId;
    return PlayHistory.find(filter).sort({ playedAt: -1 }).limit(HISTORY_LIMIT).maxTimeMS(QUERY_TIMEOUT_MS).lean<IPlayHistory[]>();
  }

  /** Plays by id (from a menu), in the order given; unknown or expired ids are dropped. */
  public async findByIds(guildId: string, ids: string[]): Promise<IPlayHistory[]> {
    if (!this.isAvailable()) throw new HistoryUnavailableError();
    const valid = [...new Set(ids)].filter((id) => /^[a-f\d]{24}$/i.test(id));
    if (valid.length === 0) return [];
    const docs = await PlayHistory.find({ guildId, _id: { $in: valid } }).maxTimeMS(QUERY_TIMEOUT_MS).lean<IPlayHistory[]>();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    return valid.map((id) => byId.get(id)).filter((doc): doc is IPlayHistory => Boolean(doc));
  }
}

export default PlayHistoryService;
