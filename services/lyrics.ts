import axios from "axios";
import {
  isSameSong,
  lyricsQueries,
  parseLrc,
  parseTrackForLyrics,
  pickLrclibHit,
  SyncedLine
} from "../utils/lyricsQuery";
import { SpotifyService } from "./spotify";

export type { SyncedLine } from "../utils/lyricsQuery";

export interface LyricsResult {
  title: string;
  artist: string;
  text: string;
  source: string;
  /** LRC lines ([mm:ss.xx] text) when a synced version exists. */
  synced?: SyncedLine[];
  /** Where the synced lines came from (may differ from `source`, which names the text). */
  syncedSource?: string;
  /** Length of the version the synced lines were timed against, in seconds. */
  syncedDurationSec?: number;
}

export interface FindLyricsOptions {
  /** Length of the playing track; picks the LRCLIB version that matches it. */
  durationMs?: number;
  /** When the first hit has no timings, look for a synced version on LRCLIB too. */
  preferSynced?: boolean;
}

const cache = new Map<string, { at: number; value: LyricsResult | null }>();
const syncedCache = new Map<string, { at: number; value: LyricsResult | null }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;

const LRCLIB = "https://lrclib.net/api";
const LRCLIB_HEADERS = { "User-Agent": "BypassMusicBot/1.0 (+https://music-bot.checkleaked.com)" };

interface LrclibHit {
  trackName?: string;
  artistName?: string;
  duration?: number;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function remember(store: Map<string, { at: number; value: LyricsResult | null }>, key: string, value: LyricsResult | null): void {
  store.set(key, { at: Date.now(), value });
  if (store.size > CACHE_MAX) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
}

function recall(store: Map<string, { at: number; value: LyricsResult | null }>, key: string): LyricsResult | null | undefined {
  const cached = store.get(key);
  return cached && Date.now() - cached.at < CACHE_TTL_MS ? cached.value : undefined;
}

function fromHit(hit: LrclibHit, fallbackTitle: string, fallbackArtist: string): LyricsResult {
  const synced = hit.syncedLyrics ? parseLrc(hit.syncedLyrics) : [];
  const text = hit.plainLyrics || synced.map((l) => l.line).join("\n");
  return {
    title: hit.trackName || fallbackTitle,
    artist: hit.artistName || fallbackArtist,
    text,
    source: "LRCLIB",
    synced: synced.length ? synced : undefined,
    syncedSource: synced.length ? "LRCLIB" : undefined,
    syncedDurationSec: synced.length && typeof hit.duration === "number" ? hit.duration : undefined
  };
}

async function lrclibSearch(params: Record<string, string>): Promise<LrclibHit[]> {
  try {
    const { data } = await axios.get(`${LRCLIB}/search`, { params, timeout: 8000, headers: LRCLIB_HEADERS });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** LRCLIB exact match (title + artist, ±2 s on the duration when given). */
async function lrclibGet(title: string, artist: string, durationSec?: number): Promise<LrclibHit | null> {
  try {
    const params: Record<string, string> = { track_name: title, artist_name: artist };
    if (durationSec) params.duration = String(durationSec);
    const { data } = await axios.get(`${LRCLIB}/get`, { params, timeout: 8000, headers: LRCLIB_HEADERS });
    return data && typeof data === "object" ? (data as LrclibHit) : null;
  } catch {
    return null; // 404 TrackNotFound, timeouts
  }
}

/** LRCLIB: keyless, community lyrics with synced timings. */
async function fromLrclib(title: string, artist: string, durationSec?: number): Promise<LyricsResult | null> {
  const hits = await lrclibSearch(artist ? { track_name: title, artist_name: artist } : { q: title });
  const hit = pickLrclibHit(
    hits.filter((item) => item?.plainLyrics && isSameSong(title, item.trackName || "")),
    durationSec
  );
  return hit ? fromHit(hit, title, artist) : null;
}

/** A synced LRCLIB version: exact match first, then the closest-length search hit. */
async function syncedFromLrclib(title: string, artist: string, durationSec?: number): Promise<LyricsResult | null> {
  if (artist) {
    const exact = await lrclibGet(title, artist, durationSec);
    if (exact?.syncedLyrics) return fromHit(exact, title, artist);
  }
  const searches: Record<string, string>[] = artist
    ? [{ track_name: title, artist_name: artist }, { q: `${artist} ${title}` }]
    : [{ q: title }];
  for (const params of searches) {
    const hits = (await lrclibSearch(params)).filter((item) => item?.syncedLyrics && isSameSong(title, item.trackName || ""));
    const hit = pickLrclibHit(hits, durationSec, true);
    if (hit) return fromHit(hit, title, artist);
  }
  return null;
}

/**
 * Find lyrics for a track title/uploader (or a free-text query).
 * Tries the Spotify-backed lyrics API first, then LRCLIB. With `preferSynced`,
 * a first hit without timings is completed with LRCLIB's synced lines for the
 * same song when they exist. Never throws.
 */
export async function findLyrics(rawTitle: string, rawAuthor = "", options: FindLyricsOptions = {}): Promise<LyricsResult | null> {
  const lookup = parseTrackForLyrics(rawTitle, rawAuthor);
  const key = `${lookup.title}|${lookup.artist}`.toLowerCase();
  const durationSec = options.durationMs && options.durationMs > 0 ? Math.round(options.durationMs / 1000) : undefined;

  let result = recall(cache, key);
  if (result === undefined) {
    result = null;
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

    if (!result) result = await fromLrclib(lookup.title, lookup.artist, durationSec);
    if (!result && lookup.artist) result = await fromLrclib(lookup.title, "", durationSec);
    remember(cache, key, result);
  }

  if (!options.preferSynced || !result || result.synced?.length) return result;

  // The first hit has no timings: look for a synced version of the same song.
  const syncedKey = `${key}|${durationSec ?? ""}`;
  let synced = recall(syncedCache, syncedKey);
  if (synced === undefined) {
    synced = await syncedFromLrclib(lookup.title, lookup.artist, durationSec);
    remember(syncedCache, syncedKey, synced);
  }
  if (!synced?.synced?.length) return result;
  return {
    ...result,
    synced: synced.synced,
    syncedSource: synced.syncedSource,
    syncedDurationSec: synced.syncedDurationSec
  };
}
