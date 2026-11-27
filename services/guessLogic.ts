/**
 * Pure guess-the-song rules (no Discord, no network), so they can be tested
 * offline: cleaning titles for the answer buttons, picking the songs of a
 * game, building the four choices and scoring an answer.
 */

/** A song with a ~30 s preview clip, from Deezer or iTunes. */
export interface PreviewTrack {
  /** Unique per source, e.g. "dz:3135556" or "it:1440818839". */
  id: string;
  title: string;
  artist: string;
  /** Direct MP3/M4A preview URL. */
  preview: string;
  source: "deezer" | "itunes";
  /** Deezer track id, to refresh the signed preview URL before playing. */
  deezerId?: number;
}

export type Rng = () => number;

export const CHOICES_PER_ROUND = 4;

// "(feat. X)", "[with Y]" — guests, not part of the song's name.
const FEATURING = /\s*[([](?:feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]/gi;
// "(2016 Remaster)", "[From "Film"]", "(Radio Edit)", "(Live)"… — version noise.
const VERSION_TAG =
  /\s*[([][^)\]]*\b(?:remaster(?:ed)?|version|edit|mix|remix|live|mono|stereo|deluxe|from|soundtrack|anniversary|bonus|explicit|clean|acoustic|instrumental|original)\b[^)\]]*[)\]]/gi;
// "Song - Remastered 2004", "Song - Radio Edit", "Song - Live at Wembley".
const VERSION_SUFFIX = /\s+[-–—]\s+[^-–—]*\b(?:remaster(?:ed)?|version|edit|mix|live|mono|stereo|acoustic)\b.*$/i;

/** The song's plain name for an answer button: no guests or version tags. */
export function displayTitle(title: string): string {
  const cleaned = title.replace(FEATURING, "").replace(VERSION_TAG, "").replace(VERSION_SUFFIX, "").replace(/\s{2,}/g, " ").trim();
  return cleaned || title.trim();
}

/** Lowercase, accent- and punctuation-free form used to compare titles and artists. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function titleKey(track: Pick<PreviewTrack, "title">): string {
  return normalizeKey(displayTitle(track.title));
}

export function artistKey(track: Pick<PreviewTrack, "artist">): string {
  return normalizeKey(track.artist);
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Drop tracks without a preview and repeats of the same song (same title + artist). */
export function dedupeTracks(tracks: PreviewTrack[]): PreviewTrack[] {
  const seen = new Set<string>();
  const out: PreviewTrack[] = [];
  for (const track of tracks) {
    if (!track.preview || !track.title || !track.artist) continue;
    const key = `${titleKey(track)}|${artistKey(track)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(track);
  }
  return out;
}

/**
 * The songs to play, one per round: different artists first, so a game is
 * not three songs by the same act; repeats of an artist only fill the rest.
 */
export function pickRoundTracks(pool: PreviewTrack[], rounds: number, rng: Rng = Math.random): PreviewTrack[] {
  const shuffled = shuffle(pool, rng);
  const picked: PreviewTrack[] = [];
  const artists = new Set<string>();
  for (const track of shuffled) {
    if (picked.length >= rounds) break;
    if (artists.has(artistKey(track))) continue;
    artists.add(artistKey(track));
    picked.push(track);
  }
  for (const track of shuffled) {
    if (picked.length >= rounds) break;
    if (!picked.includes(track)) picked.push(track);
  }
  return picked;
}

/**
 * Four answer options: the right song plus three decoys from the same pool,
 * shuffled. Decoys never share the right song's title, and have distinct
 * artists (from each other and from the right song) whenever the pool allows.
 * Songs in `avoid` (other rounds' answers) are used as decoys only as a last
 * resort, so an answer is not spoiled by showing up earlier as a decoy.
 */
export function buildChoices(
  correct: PreviewTrack,
  pool: PreviewTrack[],
  rng: Rng = Math.random,
  avoid: ReadonlySet<string> = new Set()
): { options: PreviewTrack[]; correctIndex: number } {
  const wanted = CHOICES_PER_ROUND - 1;
  const candidates = shuffle(
    pool.filter((t) => t.id !== correct.id && titleKey(t) !== titleKey(correct)),
    rng
  );
  // Preferred decoys first, songs from other rounds last.
  const ordered = [...candidates.filter((t) => !avoid.has(t.id)), ...candidates.filter((t) => avoid.has(t.id))];

  const decoys: PreviewTrack[] = [];
  const usedTitles = new Set([titleKey(correct)]);
  const usedArtists = new Set([artistKey(correct)]);
  const take = (strictArtists: boolean) => {
    for (const track of ordered) {
      if (decoys.length >= wanted) return;
      if (decoys.includes(track) || usedTitles.has(titleKey(track))) continue;
      if (strictArtists && usedArtists.has(artistKey(track))) continue;
      decoys.push(track);
      usedTitles.add(titleKey(track));
      usedArtists.add(artistKey(track));
    }
  };
  take(true);
  // Small pools: allow a repeated artist rather than fewer buttons.
  if (decoys.length < wanted) take(false);

  const options = shuffle([correct, ...decoys], rng);
  return { options, correctIndex: options.indexOf(correct) };
}

/** Points for a correct answer: 100 when instant, down to 50 at the buzzer. */
export function scoreFor(elapsedMs: number, roundMs: number): number {
  const remaining = roundMs > 0 ? Math.min(1, Math.max(0, 1 - elapsedMs / roundMs)) : 0;
  return Math.round(50 + 50 * remaining);
}

export interface ScoreEntry {
  points: number;
  correct: number;
}

/** Leaderboard order: points, then correct answers, then who scored first. */
export function rankScores(scores: ReadonlyMap<string, ScoreEntry>): Array<{ userId: string } & ScoreEntry> {
  return [...scores.entries()]
    .map(([userId, entry], order) => ({ userId, ...entry, order }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct || a.order - b.order)
    .map(({ order: _order, ...rest }) => rest);
}
