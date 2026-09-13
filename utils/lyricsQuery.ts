export interface LyricsLookup {
  title: string;
  artist: string;
}

// "(Official Music Video)", "[Lyrics]", "(Letra/Lyrics)", "(HD)"… — upload
// decorations that are not part of the song title.
const DECORATION = /\s*[\[(][^\])]*\b(?:official|lyrics?|letra|audio|video|visuali[sz]er|hd|hq|4k|mv)\b[^\])]*[\])]/gi;
// "Song - Remastered 2004", "Song - Live" — a version suffix, not an "Artist - Title" split.
const VERSION_SUFFIX = /\s+[-–—]\s+(?:\d{4}\s+)?(?:remaster(?:ed)?|live|radio edit|acoustic)\b.*$/i;

/**
 * Derive the song title and artist to search lyrics for from a queued track.
 * YouTube tracks carry the upload title and the uploader channel, so strip
 * video decorations and channel suffixes ("- Topic", "VEVO", "Official"), and
 * prefer the artist named in an "Artist - Title" upload over the uploader.
 */
export function parseTrackForLyrics(title: string, author: string): LyricsLookup {
  let song = title.replace(DECORATION, "").replace(/\s*\|.*$/, "").replace(VERSION_SUFFIX, "").trim() || title.trim();
  let artist = author.replace(/\s*-\s*Topic$/i, "").replace(/\s*(?:VEVO|Official)$/i, "").trim();

  const dash = song.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash) {
    artist = dash[1].trim();
    song = dash[2].trim();
  }
  return { title: song, artist };
}

/** Artist-qualified search first; the bare title catches a misleading uploader name. */
export function lyricsQueries({ title, artist }: LyricsLookup): string[] {
  return [...new Set([artist ? `${title} ${artist}` : title, title])];
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Whether the song a lyrics search matched is the one asked for. One title must
 * start the other ("Mr. Brightside" ~ "Mr. Brightside - Remastered 2004"), so a
 * top search hit for a different song is rejected rather than shown.
 */
export function isSameSong(wanted: string, found: string): boolean {
  const a = normalize(wanted);
  const b = normalize(found);
  if (!a || !b) return false;
  return `${a} `.startsWith(`${b} `) || `${b} `.startsWith(`${a} `);
}
