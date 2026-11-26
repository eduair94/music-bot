/**
 * Fast YouTube search for /play autocomplete and /search (~0.7 s).
 *
 * youtube-sr stopped working ("fetch failed" for every query), which is why
 * /search never returned anything. youtubei.js search still parses today's
 * results page; playlists are expanded with yt-dlp instead (see
 * discordPlayer.listYouTubePlaylist) because its playlist parser broke.
 */
export interface VideoResult {
  id: string;
  title: string;
  author: string;
  durationText: string | null;
  durationSec: number | null;
  url: string;
  isLive: boolean;
}

type Innertube = any;

let client: Promise<Innertube> | null = null;
const cache = new Map<string, { at: number; results: VideoResult[] }>();
const inflight = new Map<string, Promise<VideoResult[]>>();
const CACHE_MS = 15 * 60 * 1000;

async function getClient(): Promise<Innertube> {
  if (!client) {
    client = (async () => {
      // youtubei.js is ESM-only; a dynamic import keeps this CommonJS build working.
      const { Innertube } = await (new Function("m", "return import(m)") as (m: string) => Promise<any>)("youtubei.js");
      return Innertube.create({ retrieve_player: false, generate_session_locally: true });
    })().catch((error) => {
      client = null;
      throw error;
    });
  }
  return client;
}

function toSeconds(text: string | null | undefined): number | null {
  if (!text) return null;
  const parts = text.split(":").map(Number);
  if (parts.some(Number.isNaN)) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export async function searchYouTube(query: string, limit = 8): Promise<VideoResult[]> {
  const key = `${limit}:${query.trim().toLowerCase()}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.results;
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    const yt = await getClient();
    const response = await yt.search(query, { type: "video" });
    const videos: any[] = (response.videos || response.results || []).filter((v: any) => v?.id && v.type === "Video");
    const results = videos.slice(0, limit).map((v: any): VideoResult => {
      const durationText: string | null = v.duration?.text ?? null;
      const title = v.title?.text ?? String(v.title ?? "Unknown");
      return {
        id: v.id,
        title,
        author: v.author?.name ?? "Unknown",
        durationText,
        durationSec: v.duration?.seconds ?? toSeconds(durationText),
        url: `https://www.youtube.com/watch?v=${v.id}`,
        isLive: Boolean(v.is_live) || !durationText
      };
    });
    cache.set(key, { at: Date.now(), results });
    if (cache.size > 1000) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return results;
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

/** searchYouTube with a deadline; resolves [] instead of exceeding it. */
export function searchYouTubeWithin(query: string, ms: number, limit = 8): Promise<VideoResult[]> {
  return Promise.race([
    searchYouTube(query, limit).catch(() => [] as VideoResult[]),
    new Promise<VideoResult[]>((resolve) => setTimeout(() => resolve([]), ms).unref())
  ]);
}

/** Warm the client at startup so the first autocomplete isn't slow. */
export function warmYouTubeSearch(): void {
  void getClient().catch((error) => console.warn("[YouTubeSearch] Warm-up failed:", error?.message ?? error));
}
