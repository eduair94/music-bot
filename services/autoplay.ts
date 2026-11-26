import { GuildQueue, QueryType, QueueRepeatMode, Track } from "discord-player";
import { DiscordPlayerService, QueueMetadata, youTubeVideoId } from "./discordPlayer";

/**
 * Autoplay: when the queue is about to run out, queue a related song.
 *
 * Related songs come from the YouTube "Mix" of the current track
 * (watch?v=ID&list=RDID), listed with yt-dlp. youtubei.js parsing rots with
 * every YouTube change (it already broke playlists), while yt-dlp updates
 * itself on boot. The next song is fetched as soon as the last one starts,
 * so there is no silence between them.
 */

const MIN_SECONDS = 60;
const MAX_SECONDS = 12 * 60;
const pending = new Set<string>();

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\[(].*?[\])]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 24);
}

/** A YouTube video id to seed the mix from; non-YouTube tracks are matched by search. */
async function seedId(track: Track): Promise<string | null> {
  const direct = youTubeVideoId(track.url);
  if (direct) return direct;

  const player = DiscordPlayerService.getInstance().getPlayer();
  if (!player) return null;
  try {
    const result = await player.search(`${track.author} ${track.title}`, { searchEngine: QueryType.YOUTUBE_SEARCH });
    return youTubeVideoId(result.tracks[0]?.url);
  } catch {
    return null;
  }
}

export async function findRelatedTrack(queue: GuildQueue, seed: Track): Promise<Track | null> {
  const service = DiscordPlayerService.getInstance();
  const id = await seedId(seed);
  if (!id) return null;

  const listing = await service.listYouTubePlaylist(`https://www.youtube.com/watch?v=${id}&list=RD${id}`, 25);
  if (!listing) return null;

  const metadata = (queue.metadata || {}) as QueueMetadata;
  const seen = metadata.autoplaySeen ?? new Set<string>();
  metadata.autoplaySeen = seen;
  seen.add(id);

  const recentIds = new Set<string>();
  const recentTitles = new Set<string>();
  for (const t of [seed, queue.currentTrack, ...queue.history.tracks.toArray(), ...queue.tracks.toArray()]) {
    if (!t) continue;
    const vid = youTubeVideoId(t.url);
    if (vid) recentIds.add(vid);
    recentTitles.add(normalizeTitle(t.title));
  }

  const candidate = listing.entries.find(
    (entry) =>
      !seen.has(entry.id) &&
      !recentIds.has(entry.id) &&
      !recentTitles.has(normalizeTitle(entry.title)) &&
      (!entry.duration || (entry.duration >= MIN_SECONDS && entry.duration <= MAX_SECONDS))
  );
  if (!candidate) return null;

  seen.add(candidate.id);
  if (seen.size > 500) seen.clear();

  const extractor = seed.extractor?.identifier === service.getYouTubeExtractor()?.identifier
    ? seed.extractor
    : service.getYouTubeExtractor();
  const track = service.buildYouTubeTrack(candidate, queue.player.client.user, extractor);
  track.setMetadata({ autoplay: true });
  return track;
}

export function isAutoplayTrack(track: Track | null | undefined): boolean {
  return Boolean((track?.metadata as { autoplay?: boolean } | null)?.autoplay);
}

/**
 * If autoplay is on and nothing is queued after the current song, queue one
 * related song now. Safe to call repeatedly; one lookup per guild at a time.
 */
export async function ensureAutoplayNext(queue: GuildQueue): Promise<Track | null> {
  const metadata = (queue.metadata || {}) as QueueMetadata;
  if (!metadata.autoplay || queue.deleted) return null;
  if (queue.repeatMode !== QueueRepeatMode.OFF) return null;
  if (queue.tracks.size > 0) return null;

  const seed = queue.currentTrack ?? metadata.currentTrack ?? queue.history.previousTrack;
  if (!seed) return null;

  const guildId = queue.guild.id;
  if (pending.has(guildId)) return null;
  pending.add(guildId);
  try {
    const next = await findRelatedTrack(queue, seed);
    if (!next || queue.deleted || queue.tracks.size > 0) return null;
    queue.addTrack(next);
    console.log(`[Autoplay] ➕ ${queue.guild.name}: ${next.title}`);
    // Queue already ran dry while we were looking: start it.
    if (!queue.currentTrack && !queue.node.isPlaying()) {
      await queue.node.play().catch((error) => console.error("[Autoplay] Could not start:", error));
    }
    return next;
  } catch (error) {
    console.error("[Autoplay] Lookup failed:", error);
    return null;
  } finally {
    pending.delete(guildId);
  }
}
