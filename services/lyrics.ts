import axios from "axios";
import { isSameSong, lyricsQueries, parseTrackForLyrics } from "../utils/lyricsQuery";
import { SpotifyService } from "./spotify";

export interface LyricsResult {
  title: string;
  artist: string;
  text: string;
  source: string;
  /** LRC lines ([mm:ss.xx] text) when a synced version exists. */
  synced?: { timeMs: number; line: string }[];
}

const cache = new Map<string, { at: number; value: LyricsResult | null }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function parseLrc(lrc: string): { timeMs: number; line: string }[] {
  const out: { timeMs: number; line: string }[] = [];
  for (const raw of lrc.split("\n")) {
    const match = raw.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (!match) continue;
    out.push({ timeMs: (Number(match[1]) * 60 + Number(match[2])) * 1000, line: match[3] });
  }
  return out;
}

/** LRCLIB: keyless, community lyrics with synced timings. */
async function fromLrclib(title: string, artist: string): Promise<LyricsResult | null> {
  try {
    const { data } = await axios.get("https://lrclib.net/api/search", {
      params: artist ? { track_name: title, artist_name: artist } : { q: title },
      timeout: 8000,
      headers: { "User-Agent": "BypassMusicBot/1.0 (+https://music-bot.checkleaked.com)" }
    });
    if (!Array.isArray(data)) return null;
    const hit = data.find((item: any) => item?.plainLyrics && isSameSong(title, item.trackName || ""));
    if (!hit) return null;
    return {
      title: hit.trackName,
      artist: hit.artistName || artist,
      text: hit.plainLyrics,
      source: "LRCLIB",
      synced: hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : undefined
    };
  } catch {
    return null;
  }
}

/**
 * Find lyrics for a track title/uploader (or a free-text query).
 * Tries the Spotify-backed lyrics API first, then LRCLIB. Never throws.
 */
export async function findLyrics(rawTitle: string, rawAuthor = ""): Promise<LyricsResult | null> {
  const lookup = parseTrackForLyrics(rawTitle, rawAuthor);
  const key = `${lookup.title}|${lookup.artist}`.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  let result: LyricsResult | null = null;

  for (const query of lyricsQueries(lookup)) {
    const found = await SpotifyService.getInstance().searchLyrics(query);
    // search_lyrics answers for its top search hit; another song's lyrics are worse than none
    if (found && isSameSong(lookup.title, found.trackName)) {
      result = {
        title: found.trackName || lookup.title,
        artist: found.artist || lookup.artist,
        text: found.lines.join("\n"),
        source: found.source || "Spotify"
      };
      break;
    }
  }

  if (!result) result = await fromLrclib(lookup.title, lookup.artist);
  if (!result && lookup.artist) result = await fromLrclib(lookup.title, "");

  cache.set(key, { at: Date.now(), value: result });
  if (cache.size > 500) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return result;
}
