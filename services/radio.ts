import { GuildQueue, QueryType, Track } from "discord-player";
import type { User } from "discord.js";
import { AiTrack, generatePlaylist, songLine } from "./ai/playlistGenerator";
import { AI_RADIO_BATCH, AI_REFILLS_DAILY, consumeQuota } from "./ai/aiAccess";
import { DiscordPlayerService, QueueMetadata, youTubeVideoId } from "./discordPlayer";

/**
 * Radio sessions: what keeps the music going after the queue runs out.
 *
 * - song:    /radio song — related songs from the YouTube mix of the seed.
 * - station: /radio station — a genre station seeded with a few well-known
 *            songs of that genre.
 * - ai:      /radio prompt (AI DJ) — Claude picks the next batch of songs
 *            for the prompt each time the queue runs out.
 *
 * Plain autoplay follows whatever is playing, so a long session drifts away
 * from where it started (a lo-fi station ends up in pop). A session keeps
 * "anchors" (YouTube ids of its seed songs) and seeds every third pick from
 * an anchor instead of the current song, which keeps it on genre.
 */

export {
  ANCHOR_EVERY,
  isStationId,
  RADIO_STATIONS,
  radioSeedId,
  shuffledSeeds,
  STATION_IDS,
  type RadioKind,
  type RadioRequest,
  type RadioSession,
  type StationId
} from "./radioLogic";
import type { RadioRequest, RadioSession } from "./radioLogic";

export function radioSession(queue: GuildQueue | null | undefined): RadioSession | undefined {
  return ((queue?.metadata || {}) as QueueMetadata).radio;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

/** A queue track for an AI pick, matched on YouTube by yt-dlp when it plays. */
export function aiQueueTrack(song: AiTrack, requestedBy: User | null): Track | null {
  const service = DiscordPlayerService.getInstance();
  const player = service.getPlayer();
  const extractor = service.getYouTubeExtractor();
  if (!player || !extractor) return null;
  const url = `ytsearch1:${songLine(song)} audio`;
  const track = new Track(player, {
    title: song.title,
    description: "",
    author: song.artist,
    url,
    thumbnail: "",
    duration: "0:00",
    views: 0,
    requestedBy: requestedBy ?? undefined,
    source: "youtube",
    queryType: QueryType.YOUTUBE_SEARCH,
    raw: { title: song.title, author: song.artist, url, host: hostOf(url) }
  });
  track.extractor = extractor;
  track.setMetadata({ autoplay: true, aiRadio: true });
  return track;
}

/** YouTube id of the first search hit for each query (yt-dlp search, run in parallel). */
export async function resolveAnchors(queries: string[]): Promise<string[]> {
  const service = DiscordPlayerService.getInstance();
  const found = await Promise.all(
    queries.map((q) =>
      service
        .listYouTubePlaylist(`ytsearch1:${q}`, 1)
        .then((r) => r?.entries[0]?.id ?? null)
        .catch(() => null)
    )
  );
  return found.filter((id): id is string => Boolean(id));
}

/**
 * Start a radio session on a queue whose first song was just queued: turns
 * autoplay on, records the anchors and queues the rest of an AI batch.
 * Works the same on the instance that took a fleet handover.
 */
export function startRadio(queue: GuildQueue, request: RadioRequest, firstTrack: Track | null, requestedBy: User | null): RadioSession {
  const metadata = (queue.metadata || {}) as QueueMetadata;
  const firstId = youTubeVideoId(firstTrack?.url);
  const session: RadioSession = {
    kind: request.kind,
    label: request.label.slice(0, 120),
    prompt: request.prompt?.slice(0, 300),
    anchorIds: firstId && request.kind !== "ai" ? [firstId] : [],
    picks: 1,
    batches: request.kind === "ai" ? 1 : 0,
    batchLimit: Math.max(0, request.batchLimit ?? 0),
    language: request.language,
    startedBy: request.startedBy
  };
  metadata.radio = session;
  metadata.autoplay = true;
  queue.metadata = metadata;

  if (request.kind === "ai") {
    // A server with autoplay on by default may have queued a YouTube-mix song when the
    // first song started; the AI batch replaces it.
    for (const t of queue.tracks.toArray()) {
      const meta = t.metadata as { autoplay?: boolean; aiRadio?: boolean } | null;
      if (meta?.autoplay && !meta.aiRadio) queue.removeTrack(t);
    }
  }

  if (request.pending?.length) {
    const tracks = request.pending.map((song) => aiQueueTrack(song, requestedBy)).filter((t): t is Track => t !== null);
    if (tracks.length) queue.addTrack(tracks);
  }

  if (request.anchorQueries?.length) {
    void resolveAnchors(request.anchorQueries.slice(0, 3)).then((ids) => {
      if (metadata.radio !== session) return; // a newer session replaced it
      for (const id of ids) if (!session.anchorIds.includes(id)) session.anchorIds.push(id);
    });
  }
  return session;
}

/** Stop the radio session (autoplay itself stays as it is). */
export function endRadio(queue: GuildQueue): void {
  const metadata = (queue.metadata || {}) as QueueMetadata;
  delete metadata.radio;
}

/** "Artist - Title" of what played and is queued, newest last (the AI must not repeat them). */
function recentSongs(queue: GuildQueue): string[] {
  const all = [...queue.history.tracks.toArray().reverse(), queue.currentTrack, ...queue.tracks.toArray()];
  return all.filter((t): t is Track => Boolean(t)).slice(-60).map((t) => `${t.author} - ${t.title}`);
}

/**
 * AI radio: queue the next batch for the session's prompt. Null when the
 * session is out of batches, the server is out of refills today, or Claude
 * didn't answer; autoplay then falls back to the YouTube mix.
 */
export async function refillAiRadio(queue: GuildQueue): Promise<Track[] | null> {
  const session = radioSession(queue);
  if (!session || session.kind !== "ai" || !session.prompt) return null;
  if (session.batches >= session.batchLimit) return null;
  if (!(await consumeQuota("refill", queue.guild.id, AI_REFILLS_DAILY()))) return null;

  session.batches++;
  try {
    const playlist = await generatePlaylist({
      prompt: session.prompt,
      count: AI_RADIO_BATCH,
      language: session.language || "en",
      exclude: recentSongs(queue),
      feature: "ai_radio"
    });
    // Autoplay turned off (or the session replaced) while Claude was answering: drop the batch.
    if (queue.deleted || radioSession(queue) !== session || !(queue.metadata as QueueMetadata | undefined)?.autoplay) return null;
    const me = queue.player.client.user;
    const tracks = playlist.tracks.map((song) => aiQueueTrack(song, me)).filter((t): t is Track => t !== null);
    if (!tracks.length) return null;
    queue.addTrack(tracks);
    console.log(`[Radio] 🤖 ${queue.guild.name}: +${tracks.length} (batch ${session.batches}/${session.batchLimit})`);
    return tracks;
  } catch (error) {
    console.warn("[Radio] AI refill failed:", (error as Error)?.message ?? error);
    return null;
  }
}
