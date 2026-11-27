/**
 * Pure radio logic (no player imports, so it is unit-testable): the session
 * shapes, genre stations and the anchor rotation. services/radio.ts runs it.
 */
import type { AiTrack } from "./ai/playlistGenerator";

export type RadioKind = "song" | "station" | "ai";

/** What a radio start carries (serializable: fleet handovers send it to another bot instance). */
export interface RadioRequest {
  kind: RadioKind;
  /** Song query, station id or prompt (shown on the panel). */
  label: string;
  /** AI: the prompt; asked again for every batch. */
  prompt?: string;
  /** Station: more seed songs, matched in the background and added as anchors. */
  anchorQueries?: string[];
  /** AI: the rest of the first batch, queued right after the first song. */
  pending?: AiTrack[];
  /** AI: how many batches this session may ask for (trial sessions are short). */
  batchLimit?: number;
  /** Locale for AI titles. */
  language?: string;
  startedBy?: string;
}

export interface RadioSession {
  kind: RadioKind;
  label: string;
  prompt?: string;
  anchorIds: string[];
  /** Autoplay picks made so far (every third one comes from an anchor). */
  picks: number;
  /** AI batches asked for (the first one included). */
  batches: number;
  batchLimit: number;
  language?: string;
  startedBy?: string;
}

/** A pick seeded from an anchor every this many picks. */
export const ANCHOR_EVERY = 3;

/**
 * Genre stations. Seeds are well-known studio recordings (not hour-long
 * compilations, which autoplay would skip as too long).
 */
export const RADIO_STATIONS = {
  pop: { emoji: "🎤", seeds: ["Dua Lipa - Levitating", "The Weeknd - Blinding Lights", "Harry Styles - As It Was", "Taylor Swift - Anti-Hero"] },
  rock: { emoji: "🎸", seeds: ["Foo Fighters - Everlong", "Arctic Monkeys - Do I Wanna Know?", "The Killers - Mr. Brightside", "Queen - Don't Stop Me Now"] },
  hiphop: { emoji: "🎧", seeds: ["Kendrick Lamar - HUMBLE.", "Drake - God's Plan", "Travis Scott - SICKO MODE", "J. Cole - No Role Modelz"] },
  latin: { emoji: "🌴", seeds: ["Bad Bunny - Tití Me Preguntó", "Karol G - Provenza", "Daddy Yankee - Gasolina", "Rauw Alejandro - Todo de Ti"] },
  rockes: { emoji: "🤘", seeds: ["Soda Stereo - De Música Ligera", "Café Tacvba - Eres", "Enanitos Verdes - Lamento Boliviano", "Maná - Rayando el Sol"] },
  electronic: { emoji: "⚡", seeds: ["Avicii - Levels", "Daft Punk - One More Time", "Calvin Harris - Summer", "Swedish House Mafia - Don't You Worry Child"] },
  lofi: { emoji: "☕", seeds: ["Nujabes - Aruarian Dance", "Nujabes - Feather", "potsu - i'm closing my eyes", "Tomppabeats - Monday Loop"] },
  chill: { emoji: "🌙", seeds: ["Rex Orange County - Best Friend", "Clairo - Sofia", "Mac DeMarco - Chamber of Reflection", "Cigarettes After Sex - Apocalypse"] },
  rnb: { emoji: "💜", seeds: ["SZA - Kill Bill", "Frank Ocean - Thinkin Bout You", "Daniel Caesar - Best Part", "The Weeknd - Earned It"] },
  indie: { emoji: "🌻", seeds: ["Tame Impala - The Less I Know The Better", "MGMT - Electric Feel", "Phoenix - 1901", "Two Door Cinema Club - What You Know"] },
  metal: { emoji: "🔥", seeds: ["Metallica - Enter Sandman", "System Of A Down - Chop Suey!", "Slipknot - Duality", "Iron Maiden - The Trooper"] },
  jazz: { emoji: "🎷", seeds: ["Dave Brubeck - Take Five", "Miles Davis - So What", "Bill Evans - Waltz for Debby", "Chet Baker - My Funny Valentine"] },
  classical: { emoji: "🎻", seeds: ["Debussy - Clair de Lune", "Erik Satie - Gymnopédie No.1", "Vivaldi - Spring", "Beethoven - Moonlight Sonata"] },
  eighties: { emoji: "📼", seeds: ["a-ha - Take On Me", "Toto - Africa", "Michael Jackson - Billie Jean", "Cyndi Lauper - Girls Just Want to Have Fun"] },
  twothousands: { emoji: "💿", seeds: ["OutKast - Hey Ya!", "Beyoncé - Crazy in Love", "The Black Eyed Peas - I Gotta Feeling", "Linkin Park - In the End"] },
  kpop: { emoji: "💖", seeds: ["BTS - Dynamite", "BLACKPINK - How You Like That", "NewJeans - Super Shy", "Stray Kids - S-Class"] },
  anime: { emoji: "🌸", seeds: ["LiSA - Gurenge", "YOASOBI - Idol", "Kenshi Yonezu - KICK BACK", "Aimer - Zankyosanka"] },
  reggae: { emoji: "🦁", seeds: ["Bob Marley & The Wailers - Is This Love", "Bob Marley & The Wailers - Three Little Birds", "UB40 - Red Red Wine", "Damian Marley - Welcome To Jamrock"] }
} as const satisfies Record<string, { emoji: string; seeds: readonly string[] }>;

export type StationId = keyof typeof RADIO_STATIONS;
export const STATION_IDS = Object.keys(RADIO_STATIONS) as StationId[];

export function isStationId(value: unknown): value is StationId {
  return typeof value === "string" && value in RADIO_STATIONS;
}

/** Pure: a station's seeds in a random order (the first one is played). */
export function shuffledSeeds(id: StationId, random: () => number = Math.random): string[] {
  const seeds = [...RADIO_STATIONS[id].seeds];
  for (let i = seeds.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [seeds[i], seeds[j]] = [seeds[j], seeds[i]];
  }
  return seeds;
}

/**
 * Pure: the YouTube id to seed the next autoplay pick from. Every
 * ANCHOR_EVERY-th pick uses one of the session's anchors (rotating), the
 * others follow the current song.
 */
export function radioSeedId(session: RadioSession | undefined, currentId: string | null): string | null {
  if (!session || session.anchorIds.length === 0) return currentId;
  if (currentId && session.picks % ANCHOR_EVERY !== 0) return currentId;
  // Picks 3, 6, 9… use anchors 0, 1, 2… (pick 1 with no current song uses the first one).
  const turn = Math.max(0, Math.floor(session.picks / ANCHOR_EVERY) - 1);
  const anchor = session.anchorIds[turn % session.anchorIds.length];
  return anchor ?? currentId;
}
