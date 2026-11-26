import axios from "axios";

/**
 * Apple Music and Deezer links → songs we can find on YouTube.
 *
 * discord-player's Apple Music extractor now reads titles from the URL slug
 * ("bohemian-rhapsody — Apple Music, 0:00") because Apple's pages became a
 * client-rendered shell. Both services have public metadata APIs (iTunes
 * lookup, api.deezer.com), so we read the real title/artist there and play
 * the best YouTube match. Collections become "ytsearch1:" entries that
 * yt-dlp resolves when each song's turn comes, so a 100-song album doesn't
 * need 100 searches up front.
 */
export interface BridgedSong {
  title: string;
  artist: string;
  durationSec: number | null;
  thumbnail: string | null;
}

export type BridgeResult =
  | { kind: "song"; song: BridgedSong; query: string }
  | { kind: "collection"; title: string; url: string; thumbnail: string | null; songs: BridgedSong[] };

const http = axios.create({ timeout: 8000, headers: { "User-Agent": "Mozilla/5.0 (BypassMusicBot)" } });

export function searchQueryFor(song: BridgedSong): string {
  return `${song.artist} - ${song.title}`.trim();
}

/** yt-dlp "URL" that streams the first YouTube result for a song. */
export function ytSearchUrl(song: BridgedSong): string {
  return `ytsearch1:${searchQueryFor(song)} audio`;
}

async function appleMusic(url: URL, limit: number): Promise<BridgeResult | null> {
  const country = url.pathname.split("/")[1]?.length === 2 ? url.pathname.split("/")[1] : "us";
  const songId = url.searchParams.get("i") ?? (url.pathname.includes("/song/") ? url.pathname.split("/").pop() : null);

  if (songId && /^\d+$/.test(songId)) {
    const { data } = await http.get("https://itunes.apple.com/lookup", { params: { id: songId, country } });
    const r = data?.results?.[0];
    if (!r?.trackName) return null;
    const song = {
      title: r.trackName,
      artist: r.artistName,
      durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
      thumbnail: r.artworkUrl100 ?? null
    };
    return { kind: "song", song, query: searchQueryFor(song) };
  }

  const albumId = url.pathname.includes("/album/") ? url.pathname.split("/").pop() : null;
  if (albumId && /^\d+$/.test(albumId)) {
    const { data } = await http.get("https://itunes.apple.com/lookup", {
      params: { id: albumId, country, entity: "song", limit: Math.min(200, limit) }
    });
    const results: any[] = data?.results ?? [];
    const album = results.find((r) => r.wrapperType === "collection");
    const songs = results
      .filter((r) => r.wrapperType === "track" && r.trackName)
      .slice(0, limit)
      .map((r) => ({
        title: r.trackName,
        artist: r.artistName,
        durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null,
        thumbnail: r.artworkUrl100 ?? null
      }));
    if (!songs.length) return null;
    return { kind: "collection", title: album?.collectionName ?? "Apple Music album", url: url.toString(), thumbnail: album?.artworkUrl100 ?? null, songs };
  }
  return null; // playlists etc.: let the extractor try
}

async function deezer(url: URL, limit: number): Promise<BridgeResult | null> {
  // Short links (link.deezer.com / deezer.page.link) redirect to the real one.
  if (!url.hostname.endsWith("deezer.com") || url.hostname.startsWith("link.")) {
    const res = await http.get(url.toString(), { maxRedirects: 5, validateStatus: () => true });
    const finalUrl = res.request?.res?.responseUrl as string | undefined;
    if (!finalUrl || finalUrl === url.toString()) return null;
    return deezer(new URL(finalUrl), limit);
  }

  const match = url.pathname.match(/\/(track|album|playlist)\/(\d+)/);
  if (!match) return null;
  const [, type, id] = match;
  const toSong = (t: any): BridgedSong => ({
    title: t.title,
    artist: t.artist?.name ?? "",
    durationSec: typeof t.duration === "number" ? t.duration : null,
    thumbnail: t.album?.cover_medium ?? null
  });

  if (type === "track") {
    const { data } = await http.get(`https://api.deezer.com/track/${id}`);
    if (!data?.title) return null;
    const song = toSong(data);
    return { kind: "song", song, query: searchQueryFor(song) };
  }

  const { data } = await http.get(`https://api.deezer.com/${type}/${id}`);
  if (!data?.title) return null;
  let tracks: any[] = data.tracks?.data ?? [];
  // Collections list 25–50 songs inline; page through the rest up to the limit.
  let next: string | undefined = data.tracks?.next;
  while (next && tracks.length < limit) {
    const page = await http.get(next);
    tracks = tracks.concat(page.data?.data ?? []);
    next = page.data?.next;
  }
  const songs = tracks.filter((t) => t?.title && t.readable !== false).slice(0, limit).map(toSong);
  if (!songs.length) return null;
  return {
    kind: "collection",
    title: data.title,
    url: data.link ?? url.toString(),
    thumbnail: data.picture_medium ?? data.cover_medium ?? null,
    songs
  };
}

/** Bridge an Apple Music / Deezer link; null for anything else (or on failure). */
export async function bridgeLink(query: string, limit = 100): Promise<BridgeResult | null> {
  let url: URL;
  try {
    url = new URL(query);
  } catch {
    return null;
  }
  try {
    if (url.hostname === "music.apple.com" || url.hostname === "itunes.apple.com") return await appleMusic(url, limit);
    if (/(^|\.)deezer\.(com|page\.link)$/.test(url.hostname) || url.hostname === "deezer.page.link") return await deezer(url, limit);
  } catch (error) {
    console.warn(`[LinkBridge] ${url.hostname} lookup failed:`, (error as Error)?.message ?? error);
  }
  return null;
}
