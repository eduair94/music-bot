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

// ------------------------------------------------------------ synced lyrics

/** One timed lyric line; an empty `line` is an instrumental gap. */
export interface SyncedLine {
  timeMs: number;
  line: string;
}

const LRC_STAMP = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

/**
 * Parse LRC text ("[01:02.34] words"). Handles several stamps on one line
 * ("[00:12.00][00:45.10] chorus"), "[mm:ss]" and "[mm:ss:xx]" stamps and an
 * "[offset:+250]" tag, and returns the lines in time order.
 */
export function parseLrc(lrc: string): SyncedLine[] {
  const offsetMatch = lrc.match(/^\[offset:\s*([+-]?\d+)\]/im);
  // LRC offset: positive values make the lyrics appear sooner.
  const offset = offsetMatch ? Number(offsetMatch[1]) : 0;
  const out: SyncedLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(LRC_STAMP)];
    if (stamps.length === 0) continue;
    const text = raw.replace(LRC_STAMP, "").trim();
    for (const stamp of stamps) {
      const seconds = Number(stamp[2].replace(":", "."));
      if (!Number.isFinite(seconds)) continue;
      out.push({ timeMs: Math.max(0, Math.round((Number(stamp[1]) * 60 + seconds) * 1000) - offset), line: text });
    }
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

/** Index of the line being sung at `positionMs` (-1 before the first line). */
export function lineIndexAt(lines: SyncedLine[], positionMs: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].timeMs <= positionMs) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** What a live view shows around line `index`: the previous line, the current one and the next `ahead`. */
export function liveWindow(
  lines: SyncedLine[],
  index: number,
  ahead = 2
): { previous: string | null; current: string | null; next: string[] } {
  const at = (i: number) => (i >= 0 && i < lines.length ? lines[i].line : null);
  const next: string[] = [];
  for (let i = index + 1; i <= index + ahead && i < lines.length; i++) next.push(lines[i].line);
  return { previous: at(index - 1), current: at(index), next };
}

/**
 * Choose among LRCLIB hits for the same song: synced ones first, then the one
 * whose duration is closest to the track's (album vs. video versions differ),
 * keeping LRCLIB's own order for ties. With `requireSynced`, a hit without
 * timings is never returned.
 */
export function pickLrclibHit<T extends { syncedLyrics?: string | null; duration?: number | null }>(
  hits: T[],
  durationSec?: number,
  requireSynced = false
): T | null {
  const synced = hits.filter((hit) => hit.syncedLyrics);
  const pool = synced.length ? synced : requireSynced ? [] : hits;
  if (pool.length === 0) return null;
  if (!durationSec) return pool[0];
  const gap = (hit: T) => (typeof hit.duration === "number" ? Math.abs(hit.duration - durationSec) : Number.POSITIVE_INFINITY);
  return pool.reduce((best, hit) => (gap(hit) < gap(best) ? hit : best));
}
