import { ClaudeCallError, ClaudeEffort, claudeCredits } from "./claudeCredits";

/**
 * Prompt → playlist with Claude (structured output). Used by /ai playlist and
 * by AI radio, which asks for the next batch whenever the queue runs out.
 *
 * Songs come back as artist + title only; they are matched on YouTube when
 * their turn comes (the same way imported Spotify collections play).
 */

export interface AiTrack {
  artist: string;
  title: string;
}

export interface AiPlaylist {
  title: string;
  description: string;
  tracks: AiTrack[];
}

export interface PlaylistRequest {
  prompt: string;
  count: number;
  /** Locale code for the title and description ("es", "pt_br"). */
  language: string;
  /** "Artist - Title" lines that must not come back (already played). */
  exclude?: string[];
  feature: "ai_playlist" | "ai_radio";
}

export const MIN_AI_TRACKS = 5;
export const MAX_AI_TRACKS = 50;
export const MAX_PROMPT_LENGTH = 300;

const MODEL = () => (process.env.AI_MODEL || "claude-opus-5-5").trim();
const EFFORT = () => ((process.env.AI_EFFORT || "low").trim() as ClaudeEffort);

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short playlist name, at most 60 characters." },
    description: { type: "string", description: "One sentence about the playlist, at most 140 characters." },
    tracks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          artist: { type: "string", description: "Main artist as credited on the official release." },
          title: { type: "string", description: "Song title as officially released, without extra tags." }
        },
        required: ["artist", "title"],
        additionalProperties: false
      }
    }
  },
  required: ["title", "description", "tracks"],
  additionalProperties: false
};

const SYSTEM = `You are the resident DJ of a Discord music bot. You turn a listener's request into a playlist of real recordings that can be found on YouTube.

Rules:
- Only songs that really exist, with the artist and title exactly as officially released. Never invent a song; if you are not sure a track exists, pick another one.
- Follow the request closely: genre, mood, era, language, tempo, occasion, artists to include or avoid.
- Vary the artists: at most two songs per artist, unless the request is about one artist.
- Order the list like a good DJ set: a strong opener, a steady flow, no jarring jumps.
- Original studio versions, unless the request asks otherwise (no karaoke, covers, live, slowed or sped-up edits).
- If the request isn't about music, read its mood or theme and answer with music that fits it.
- Return exactly the number of tracks asked for.`;

/** Lowercase, no brackets or punctuation: "Daft Punk - One More Time (Radio Edit)" ≈ "daft punk one more time". */
export function normalizeSong(artist: string, title: string): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[\[(].*?[\])]/g, "")
      .replace(/\b(feat|ft)\.?\s.*$/, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return `${clean(artist)}|${clean(title)}`;
}

/** Pure: trims, drops empty and duplicate songs (and excluded ones), caps the count. */
export function sanitizePlaylist(raw: Partial<AiPlaylist> | null | undefined, count: number, exclude: string[] = []): AiPlaylist {
  const banned = new Set(
    exclude.map((line) => {
      const [artist, ...rest] = line.split(" - ");
      return normalizeSong(artist ?? "", rest.join(" - "));
    })
  );
  const seen = new Set<string>();
  const tracks: AiTrack[] = [];
  for (const t of Array.isArray(raw?.tracks) ? raw!.tracks : []) {
    const artist = String(t?.artist ?? "").trim().slice(0, 100);
    const title = String(t?.title ?? "").trim().slice(0, 150);
    if (!artist || !title) continue;
    const key = normalizeSong(artist, title);
    if (seen.has(key) || banned.has(key)) continue;
    seen.add(key);
    tracks.push({ artist, title });
    if (tracks.length >= count) break;
  }
  return {
    title: String(raw?.title ?? "").trim().slice(0, 60) || "AI Mix",
    description: String(raw?.description ?? "").trim().slice(0, 140),
    tracks
  };
}

/** Pure: the user message. */
export function buildPlaylistPrompt(request: PlaylistRequest): string {
  const lines = [
    `Request: """${request.prompt.slice(0, MAX_PROMPT_LENGTH)}"""`,
    `Number of tracks: ${request.count}`,
    `Write the title and description in this language (locale code): ${request.language || "en"}`
  ];
  if (request.exclude?.length) {
    lines.push("", "Already played, do not include any of these:", ...request.exclude.slice(-60).map((s) => `- ${s}`));
  }
  return lines.join("\n");
}

/**
 * Ask Claude for a playlist. Throws ClaudeCallError (reason says why) when
 * no usable list comes back.
 */
export async function generatePlaylist(request: PlaylistRequest): Promise<AiPlaylist> {
  const count = Math.min(MAX_AI_TRACKS, Math.max(1, Math.round(request.count)));
  const result = await claudeCredits().generateJson<AiPlaylist>({
    feature: request.feature,
    model: MODEL(),
    effort: EFFORT(),
    system: SYSTEM,
    prompt: buildPlaylistPrompt({ ...request, count }),
    schema: SCHEMA,
    // ~40 tokens per song plus the title, with room to spare.
    maxTokens: 1200 + count * 80,
    timeoutMs: 90_000
  });
  const playlist = sanitizePlaylist(result.data, count, request.exclude);
  console.log(
    `[AI] ${request.feature}: ${playlist.tracks.length}/${count} tracks via ${result.model} on ${result.key} ($${result.costUsd.toFixed(4)})`
  );
  if (playlist.tracks.length === 0) throw new ClaudeCallError("invalid", "no tracks");
  return playlist;
}

/** "Artist - Title" for a song (search text and exclude lists). */
export function songLine(track: AiTrack): string {
  return `${track.artist} - ${track.title}`;
}
