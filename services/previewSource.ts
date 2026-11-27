import axios from "axios";
import { dedupeTracks, PreviewTrack } from "./guessLogic";

/**
 * Songs with 30-second preview clips for the guess-the-song game, from
 * keyless APIs: Deezer charts and playlists first, iTunes Search as the
 * fallback. Deezer preview URLs are signed and expire ~15 minutes after the
 * listing was fetched, so `freshPreviewUrl` re-signs one right before it plays.
 */

export const GENRE_KEYS = ["top", "pop", "rock", "hiphop", "latin", "electronic", "80s", "90s", "2000s"] as const;
export type GenreKey = (typeof GENRE_KEYS)[number];

interface GenreSource {
  /** Deezer chart id (0 = all genres; others from https://api.deezer.com/genre). */
  deezerChart?: number;
  /** A curated Deezer playlist. */
  deezerPlaylist?: number;
  /** Deezer playlist search used when the curated playlist is gone. */
  deezerSearch?: string;
  /** iTunes Search fallback. */
  itunesTerm: string;
  itunesGenre?: boolean;
}

const GENRES: Record<GenreKey, GenreSource> = {
  top: { deezerChart: 0, itunesTerm: "top hits" },
  pop: { deezerChart: 132, itunesTerm: "pop", itunesGenre: true },
  rock: { deezerChart: 152, itunesTerm: "rock", itunesGenre: true },
  hiphop: { deezerChart: 116, itunesTerm: "hip-hop/rap", itunesGenre: true },
  latin: { deezerChart: 197, itunesTerm: "latino", itunesGenre: true },
  electronic: { deezerChart: 106, itunesTerm: "dance", itunesGenre: true },
  // "80s/90s/2000s HITS" playlists curated by Filtr (Sony Music) on Deezer.
  "80s": { deezerPlaylist: 1321696237, deezerSearch: "80s hits", itunesTerm: "80s hits" },
  "90s": { deezerPlaylist: 1319830927, deezerSearch: "90s hits", itunesTerm: "90s hits" },
  "2000s": { deezerPlaylist: 1318937087, deezerSearch: "2000s hits", itunesTerm: "2000s hits" }
};

export function isGenreKey(value: string | null | undefined): value is GenreKey {
  return Boolean(value && (GENRE_KEYS as readonly string[]).includes(value));
}

const DEEZER = "https://api.deezer.com";
const HTTP = { timeout: 8000, headers: { "User-Agent": "Mozilla/5.0 (compatible; MusicBot/1.0)" } };
/** Enough songs for a long game plus decoys. */
const ENOUGH = 40;
const POOL_TTL_MS = 10 * 60 * 1000;
const pools = new Map<GenreKey, { at: number; tracks: PreviewTrack[] }>();

interface DeezerTrack {
  id?: number;
  title?: string;
  title_short?: string;
  preview?: string;
  readable?: boolean;
  artist?: { name?: string };
}

function fromDeezer(items: DeezerTrack[] | undefined): PreviewTrack[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((t) => t && t.id && t.preview && t.readable !== false && t.artist?.name)
    .map((t) => ({
      id: `dz:${t.id}`,
      title: t.title_short || t.title || "",
      artist: t.artist!.name!,
      preview: t.preview!,
      source: "deezer" as const,
      deezerId: t.id
    }));
}

async function deezerGet(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const { data } = await axios.get(`${DEEZER}${path}`, { ...HTTP, params });
  if (data?.error) throw new Error(`Deezer: ${data.error.message ?? data.error.type ?? "error"}`);
  return data;
}

async function deezerPool(source: GenreSource): Promise<PreviewTrack[]> {
  if (source.deezerChart !== undefined) {
    const data = await deezerGet(`/chart/${source.deezerChart}/tracks`, { limit: 100 });
    return fromDeezer(data?.data);
  }
  if (source.deezerPlaylist) {
    try {
      const data = await deezerGet(`/playlist/${source.deezerPlaylist}/tracks`, { limit: 200 });
      const tracks = fromDeezer(data?.data);
      if (tracks.length >= ENOUGH) return tracks;
    } catch {
      /* playlist removed: search below */
    }
  }
  if (source.deezerSearch) {
    const found = await deezerGet("/search/playlist", { q: source.deezerSearch, limit: 10 });
    const best = (found?.data ?? [])
      .filter((p: { nb_tracks?: number }) => (p.nb_tracks ?? 0) >= ENOUGH)
      .sort((a: { nb_tracks?: number }, b: { nb_tracks?: number }) => (b.nb_tracks ?? 0) - (a.nb_tracks ?? 0))[0];
    if (best?.id) {
      const data = await deezerGet(`/playlist/${best.id}/tracks`, { limit: 200 });
      return fromDeezer(data?.data);
    }
  }
  return [];
}

async function itunesPool(source: GenreSource): Promise<PreviewTrack[]> {
  const params: Record<string, string | number> = { term: source.itunesTerm, media: "music", entity: "song", limit: 200 };
  if (source.itunesGenre) params.attribute = "genreTerm";
  const { data } = await axios.get("https://itunes.apple.com/search", { ...HTTP, params });
  const results: any[] = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((r) => r?.kind === "song" && r.previewUrl && r.trackName && r.artistName)
    .map((r) => ({
      id: `it:${r.trackId}`,
      title: String(r.trackCensoredName || r.trackName),
      artist: String(r.artistName),
      preview: String(r.previewUrl),
      source: "itunes" as const
    }));
}

/**
 * Songs with previews for a genre (cached for 10 minutes). Empty when every
 * source failed. Never throws.
 */
export async function loadPreviewPool(genre: GenreKey): Promise<PreviewTrack[]> {
  const cached = pools.get(genre);
  if (cached && Date.now() - cached.at < POOL_TTL_MS) return cached.tracks;

  const source = GENRES[genre];
  let tracks: PreviewTrack[] = [];
  try {
    tracks = dedupeTracks(await deezerPool(source));
  } catch (error) {
    console.warn(`[GuessGame] Deezer pool for ${genre} failed:`, (error as Error)?.message ?? error);
  }
  if (tracks.length < ENOUGH) {
    try {
      tracks = dedupeTracks([...tracks, ...(await itunesPool(source))]);
    } catch (error) {
      console.warn(`[GuessGame] iTunes pool for ${genre} failed:`, (error as Error)?.message ?? error);
    }
  }
  if (tracks.length) pools.set(genre, { at: Date.now(), tracks });
  return tracks;
}

/** A playable preview URL for the track: Deezer links are re-signed (they expire). */
export async function freshPreviewUrl(track: PreviewTrack): Promise<string> {
  if (track.source !== "deezer" || !track.deezerId) return track.preview;
  try {
    const data = await deezerGet(`/track/${track.deezerId}`);
    return typeof data?.preview === "string" && data.preview ? data.preview : track.preview;
  } catch {
    return track.preview;
  }
}
