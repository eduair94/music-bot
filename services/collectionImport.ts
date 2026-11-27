import { QueryType, Track } from "discord-player";
import { User } from "discord.js";
import { isHttpUrl, truncate } from "../utils/format";
import { normalizeYouTubeQuery } from "../utils/youtubeUrl";
import type { NewCollectionTrack } from "./collection";
import { DiscordPlayerService } from "./discordPlayer";
import { bridgeLink, BridgedSong, ytSearchUrl } from "./linkBridge";

/**
 * Playlist links → tracks to store in a collection (/collections import).
 *
 * Every source goes through the resolver the player already uses for it:
 * YouTube playlists through yt-dlp (DiscordPlayerService.listYouTubePlaylist),
 * Apple Music albums and Deezer through linkBridge, Spotify (and SoundCloud
 * sets) through the registered discord-player extractors.
 *
 * Stored URLs are ones /collections load can play later: YouTube watch links,
 * real Spotify track links, or "ytsearch1:Artist - Title audio" for bridged
 * songs, which yt-dlp resolves when the song's turn comes.
 */
export type ImportPlatform = "spotify" | "youtube" | "apple" | "deezer" | "soundcloud" | "link";

export const PLATFORM_NAMES: Record<ImportPlatform, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  apple: "Apple Music",
  deezer: "Deezer",
  soundcloud: "SoundCloud",
  link: "link",
};

export interface ImportedPlaylist {
  title: string;
  platform: ImportPlatform;
  tracks: NewCollectionTrack[];
  /** Entries the source listed that can't be stored (no title, local files…). */
  invalid: number;
}

export type ImportErrorCode = "invalidUrl" | "notReady" | "notFound";

export class ImportError extends Error {
  constructor(public readonly code: ImportErrorCode) {
    super(code);
    this.name = "ImportError";
  }
}

/** discord-player's placeholder art for Spotify embeds; not worth storing. */
const SPOTIFY_PLACEHOLDER = "twitter_card-default";

function searchUrl(title: string, author: string | null | undefined): string {
  const song: BridgedSong = { title, artist: author && author !== "Unknown" && author !== "Unknown Artist" ? author : "", durationSec: null, thumbnail: null };
  return song.artist ? ytSearchUrl(song) : `ytsearch1:${title} audio`;
}

/** The playlist id of a YouTube / YouTube Music link, if it has one. */
function youTubePlaylistId(query: string): string | null {
  try {
    const url = new URL(query);
    if (!/(^|\.)youtube\.com$/i.test(url.hostname)) return null;
    return url.searchParams.get("list");
  } catch {
    return null;
  }
}

/**
 * The Spotify extractor's embed fallback builds track links from the
 * playlist-item uid (`open.spotify.com/tracks/<uid>`), which point nowhere;
 * the real track id is in the raw metadata (`spotify:track:<id>`).
 */
function spotifyTrackUrl(track: Track): string | null {
  const source = (track.metadata as { source?: { uri?: unknown } } | null)?.source;
  const uri = typeof source?.uri === "string" ? source.uri : "";
  const id = uri.match(/^spotify:track:([A-Za-z0-9]+)$/)?.[1] ?? track.url?.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]+)/)?.[1];
  return id ? `https://open.spotify.com/track/${id}` : null;
}

function fromPlayerTrack(track: Track): NewCollectionTrack | null {
  const title = track.title?.trim();
  if (!title) return null;
  const author = track.author?.trim() || "Unknown";
  let url: string | null = track.url;
  if (track.source === "spotify") url = spotifyTrackUrl(track);
  if (!url || !isHttpUrl(url)) url = searchUrl(title, author);
  const thumbnail = isHttpUrl(track.thumbnail) && !track.thumbnail.includes(SPOTIFY_PLACEHOLDER) ? track.thumbnail : undefined;
  return {
    title: truncate(title, 300),
    author: truncate(author, 200),
    url,
    duration: Math.max(0, Math.round((track.durationMS || 0) / 1000)),
    thumbnail,
  };
}

function fromBridgedSong(song: BridgedSong): NewCollectionTrack | null {
  const title = song.title?.trim();
  if (!title) return null;
  return {
    title: truncate(title, 300),
    author: truncate(song.artist?.trim() || "Unknown", 200),
    url: searchUrl(title, song.artist),
    duration: Math.max(0, Math.round(song.durationSec ?? 0)),
    thumbnail: song.thumbnail ?? undefined,
  };
}

function platformOf(source: string | undefined): ImportPlatform {
  if (source === "spotify" || source === "youtube" || source === "soundcloud") return source;
  return "link";
}

function compact<T>(items: (T | null)[]): { kept: T[]; invalid: number } {
  const kept = items.filter((item): item is T => item !== null);
  return { kept, invalid: items.length - kept.length };
}

/**
 * Read a playlist (or album) link into storable tracks, at most `limit`.
 * Throws ImportError when the link isn't usable.
 */
export async function resolvePlaylist(input: string, requestedBy: User | null, limit: number): Promise<ImportedPlaylist> {
  const query = normalizeYouTubeQuery(input.trim());
  if (!isHttpUrl(query)) throw new ImportError("invalidUrl");
  const playerService = DiscordPlayerService.getInstance();

  // YouTube: yt-dlp lists playlists (youtubei.js can no longer parse them).
  const listId = youTubePlaylistId(query);
  if (listId) {
    const expanded = await playerService.listYouTubePlaylist(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, limit);
    if (!expanded || expanded.entries.length === 0) throw new ImportError("notFound");
    const { kept, invalid } = compact(
      expanded.entries.map((entry) =>
        entry.title
          ? {
              title: truncate(entry.title, 300),
              author: truncate(entry.uploader || "Unknown", 200),
              url: `https://www.youtube.com/watch?v=${entry.id}`,
              duration: Math.max(0, Math.round(entry.duration ?? 0)),
              thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
            }
          : null
      )
    );
    return { title: expanded.title, platform: "youtube", tracks: kept, invalid };
  }

  // Apple Music albums and Deezer: their public APIs, same as /play.
  const host = new URL(query).hostname;
  const bridged = await bridgeLink(query, limit);
  if (bridged) {
    const platform: ImportPlatform = /apple\.com$/i.test(host) ? "apple" : "deezer";
    if (bridged.kind === "song") {
      const track = fromBridgedSong(bridged.song);
      if (!track) throw new ImportError("notFound");
      return { title: bridged.song.title, platform, tracks: [track], invalid: 0 };
    }
    const { kept, invalid } = compact(bridged.songs.map(fromBridgedSong));
    return { title: bridged.title, platform, tracks: kept, invalid };
  }

  // Spotify, SoundCloud and anything else an extractor understands.
  const player = playerService.getPlayer();
  if (!player) throw new ImportError("notReady");
  const result = await player.search(query, { requestedBy: requestedBy ?? undefined, searchEngine: QueryType.AUTO });
  if (!result || result.isEmpty()) throw new ImportError("notFound");

  const tracks = result.playlist ? result.tracks : result.tracks.slice(0, 1);
  const { kept, invalid } = compact(tracks.map(fromPlayerTrack));
  if (kept.length === 0) throw new ImportError("notFound");
  return {
    title: result.playlist?.title || tracks[0].title,
    platform: platformOf(result.playlist?.source ?? tracks[0].source),
    tracks: kept,
    invalid,
  };
}
