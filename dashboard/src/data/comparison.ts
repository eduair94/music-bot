/**
 * Discord music bot comparison, read by the home table
 * (components/landing/Comparison.tsx) and the /compare page.
 *
 * Rules (PRODUCT.md, "True claims only"):
 *  - A competitor cell says only what that bot publishes about itself (its
 *    website, docs, premium or Patreon page) or what Discord's App Directory
 *    shows for it, and carries the URL it came from. No reviews, no third-party
 *    lists, no opinions.
 *  - `value: null` means we did not find it on those pages. It renders as
 *    "Not stated", never as "No".
 *  - Bypass cells come from our own code and pricing: shared/fleet.ts (free
 *    instances), shared/links.ts (Founder price), services/audioEncoder.ts
 *    (128 kbps standard, 256 kbps ceiling for Premium, a vote or a boost), the
 *    README (sources, 24/7). Never 320 kbps, never 256 for free users, no
 *    priority queue, no "unlimited", no server count above the real one.
 *  - Re-check every URL when anything here changes, and move `checkedOn` with it.
 *
 * Imports are relative (no "@/") so vitest can load this file without aliases.
 */

import { FLEET_FREE_INSTANCES } from "../../../shared/fleet";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../../../shared/links";
import { GITHUB_URL, LANGUAGE_COUNT } from "../lib/site";

/** Day every competitor source below was last read (ISO, UTC). */
export const checkedOn = "2026-11-28";

const day = new Date(`${checkedOn}T00:00:00Z`);
/** "28 Nov 2026" */
export const checkedOnShort = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(day);
/** "28 November 2026" */
export const checkedOnLong = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
}).format(day);

export interface Source {
  url: string;
  label: string;
}

export interface Cell {
  /** What the source says, in our words; null when the vendor's pages don't say. */
  value: string | null;
  /** Required for every competitor cell with a value. Bypass cells use internal facts. */
  source?: Source;
}

export type ColumnKey = "freeBots" | "paidFrom" | "alwaysOn" | "web" | "audio" | "sources" | "servers";

export interface Column {
  key: ColumnKey;
  label: string;
  /** One line under the label on /compare. */
  hint?: string;
  /** Shown in the short table on the home page. */
  home: boolean;
}

export interface Note {
  text: string;
  source?: Source;
}

export interface Bot {
  id: string;
  name: string;
  isBypass: boolean;
  cells: Record<ColumnKey, Cell>;
  /** Who it suits, one or two sentences built from the sourced cells and notes (/compare intro). */
  fit: string;
  /** Short, sourced notes for the bot's section on /compare. */
  notes: Note[];
}

export interface RetiredBot {
  id: string;
  name: string;
  status: string;
  notes: Note[];
}

export const columns: Column[] = [
  {
    key: "freeBots",
    label: "Free bots per server",
    hint: "Separate bots that play in different voice channels of one server at the same time.",
    home: true,
  },
  { key: "paidFrom", label: "Paid plans from", hint: "Lowest listed price, USD, before tax.", home: true },
  { key: "web", label: "On the web", home: true },
  { key: "audio", label: "Audio quality, as stated", hint: "Only figures the vendor publishes.", home: true },
  { key: "alwaysOn", label: "24/7 mode", hint: "Staying in voice when everyone has left.", home: false },
  { key: "sources", label: "Music sources, as listed", home: false },
  {
    key: "servers",
    label: "Servers",
    hint: "Discord App Directory figure on the check date. Bypass: our live count.",
    home: false,
  },
];

export const homeColumns: Column[] = columns.filter((c) => c.home);

const SRC = {
  jockieSite: { url: "https://www.jockiemusic.com/", label: "jockiemusic.com" },
  jockieFaq: { url: "https://www.jockiemusic.com/faq", label: "Jockie Music FAQ" },
  jockiePatreon: {
    url: "https://www.patreon.com/cw/Jockie/membership",
    label: "Jockie Music on Patreon: membership tiers",
  },
  jockieDirectory: {
    url: "https://discord.com/discovery/applications/411916947773587456",
    label: "Discord App Directory: Jockie Music",
  },
  uzoxHome: { url: "https://uzox.xyz/", label: "uzox.xyz home page" },
  uzoxBots: { url: "https://uzox.xyz/bots", label: "Uzox: more music bots for your server" },
  uzoxPremium: { url: "https://uzox.xyz/premium", label: "Uzox Pro plans" },
  uzox247: { url: "https://uzox.xyz/24-7-discord-music-bot", label: "Uzox: 24/7 music bot" },
  uzoxDirectory: {
    url: "https://discord.com/discovery/applications/760027263046909992",
    label: "Discord App Directory: Uzox",
  },
  greenHome: { url: "https://green-bot.app/", label: "green-bot.app home page" },
  greenMusic: { url: "https://green-bot.app/features/music", label: "Green-bot: music features" },
  greenPremium: { url: "https://green-bot.app/premium", label: "Green-bot: Premium and Custom Bot plans" },
  greenDirectory: {
    url: "https://discord.com/discovery/applications/783708073390112830",
    label: "Discord App Directory: Green-bot",
  },
  fredboatRetired: {
    url: "https://www.reddit.com/r/FredBoat/comments/1tutnoe/fredboat_has_been_retired/",
    label: "r/FredBoat: “Fredboat has been retired” (FredBoat Team, 2 Jun 2026)",
  },
  fredboatSite: { url: "https://fredboat.com/", label: "fredboat.com (did not load on the check date)" },
  hydraArticle: {
    url: "https://hydra.bot/articles/why-is-hydra-dropping-music-features",
    label: "Hydra: “Why is Hydra dropping all music features immediately?” (1 Feb 2023)",
  },
  hydraPremium: { url: "https://hydra.bot/premium", label: "Hydra Premium" },
} satisfies Record<string, Source>;

/** Discord App Directory server counts on the check date. */
const JOCKIE_SERVERS = "10.4 million";
const UZOX_SERVERS = "546,000";
const GREEN_SERVERS = "1.46 million";

const bypass: Bot = {
  id: "bypass",
  name: "Bypass",
  isBypass: true,
  cells: {
    freeBots: { value: `${FLEET_FREE_INSTANCES} (Bypass and Bypass 2 to ${FLEET_FREE_INSTANCES})` },
    paidFrom: { value: `USD ${FOUNDER_PRICE_USD}/month (Founder, on Patreon)` },
    web: { value: "Dashboard with a live player and queue for each bot, visual permissions and every setting" },
    audio: { value: "128 kbps; up to 256 kbps with Premium, a vote or a support-server boost" },
    alwaysOn: { value: "With Founder or a support-server boost, or for 12 hours after a vote" },
    sources: { value: "YouTube, YouTube Music, Spotify, SoundCloud, Apple Music, Deezer, audio files" },
    servers: { value: "About 25 (live count on the status page)" },
  },
  fit: `Servers that play music in more than one voice channel and want to run it from a browser: ${FLEET_FREE_INSTANCES} free bots, a live player and queue for each one in the dashboard, and permissions you can see and change without commands. Premium, a vote or a support-server boost raises audio from 128 kbps to up to 256 kbps.`,
  notes: [
    {
      text: `${FLEET_FREE_INSTANCES} bots per server for free: Bypass plus Bypass 2, 3 and 4. Each one plays in its own voice channel with its own queue.`,
    },
    {
      text: "The web dashboard has a live player and queue for every bot in the server, a permission editor that shows who can do what, and every server setting.",
    },
    {
      text: `Audio goes out at 128 kbps. Premium (the Founder tier, USD ${FOUNDER_PRICE_USD} a month, ${FOUNDER_SPOTS} spots), a vote or a support-server boost raises it to up to 256 kbps.`,
    },
    { text: `The bot speaks ${LANGUAGE_COUNT} languages.` },
    {
      text: "Bypass is new and small: about 25 servers in November 2026. Its code is public on GitHub under the MIT license.",
    },
  ],
};

const jockie: Bot = {
  id: "jockie-music",
  name: "Jockie Music",
  isBypass: false,
  cells: {
    freeBots: { value: "4 (more with Patreon boosts)", source: SRC.jockieFaq },
    paidFrom: { value: "USD 5/month (Patreon, 5 boosts)", source: SRC.jockiePatreon },
    web: { value: "Web dashboard with listening statistics", source: SRC.jockiePatreon },
    audio: { value: null },
    alwaysOn: { value: "Needs 5 boosts on the server", source: SRC.jockieFaq },
    sources: {
      value:
        "Spotify, Apple Music, Deezer, Tidal, Bandcamp, Vimeo, Twitch, Mixcloud, Newgrounds, 20,000+ radio stations, direct audio links",
      source: SRC.jockieFaq,
    },
    servers: { value: JOCKIE_SERVERS, source: SRC.jockieDirectory },
  },
  fit: `The largest bot in this table, in about ${JOCKIE_SERVERS} servers on Discord's App Directory, with the longest source list: Tidal, Bandcamp, Twitch and over 20,000 radio stations among them.`,
  notes: [
    {
      text: "Four free bots act as one: they answer the same prefix, and when one is in use the next one joins.",
      source: SRC.jockieFaq,
    },
    {
      text: "Premium works through Patreon boosts. The USD 5 a month tier gives 5 boosts; on a server, 2 boosts unlock audio filters and 5 unlock 24/7 for all four bots plus one premium bot.",
      source: SRC.jockiePatreon,
    },
    {
      text: "Its FAQ lists Spotify, Apple Music, Deezer, Tidal, Bandcamp, Vimeo, Twitch, Mixcloud, Newgrounds, direct audio links and over 20,000 radio stations.",
      source: SRC.jockieFaq,
    },
    { text: "Permissions such as a DJ role are set with its permission commands.", source: SRC.jockieFaq },
    { text: "The site links a dashboard; the Patreon tiers describe listening statistics on it.", source: SRC.jockieSite },
    { text: `Discord's App Directory lists it in ${JOCKIE_SERVERS} servers.`, source: SRC.jockieDirectory },
  ],
};

const uzox: Bot = {
  id: "uzox",
  name: "Uzox",
  isBypass: false,
  cells: {
    freeBots: { value: "4 (Pro bots with server plans)", source: SRC.uzoxBots },
    paidFrom: { value: "USD 3.99/month (Pro User)", source: SRC.uzoxPremium },
    web: { value: "Web dashboard", source: SRC.uzoxPremium },
    audio: { value: null },
    alwaysOn: { value: "Needs a server plan", source: SRC.uzox247 },
    sources: { value: "Spotify, Apple Music, Deezer, Tidal, YouTube", source: SRC.uzoxHome },
    servers: { value: UZOX_SERVERS, source: SRC.uzoxDirectory },
  },
  fit: `Also four free bots, plus free radio stations and a song quiz, in about ${UZOX_SERVERS} servers.`,
  notes: [
    {
      text: "Four free bots (uzox and three more), each in its own voice channel. Server plans add 3 to 6 Pro bots.",
      source: SRC.uzoxBots,
    },
    {
      text: "Free: playing music, the queue (up to 300 tracks), autoplay, radio stations, the song quiz and saved queues.",
      source: SRC.uzoxHome,
    },
    {
      text: "Pro User, from USD 3.99 a month, adds audio filters, a 14-band EQ, lyrics and text-to-speech. Server plans add 24/7 and Pro bots, and lift the 300-track queue limit.",
      source: SRC.uzoxPremium,
    },
    { text: "Its FAQ says plans are managed and cancelled from the web dashboard.", source: SRC.uzoxPremium },
    {
      text: `Discord's App Directory lists it in ${UZOX_SERVERS} servers.`,
      source: SRC.uzoxDirectory,
    },
  ],
};

const greenBot: Bot = {
  id: "green-bot",
  name: "Green-bot",
  isBypass: false,
  cells: {
    freeBots: { value: null },
    paidFrom: { value: "USD 2/month (Pro); USD 3.50/month per server", source: SRC.greenPremium },
    web: { value: "Web dashboard, web player and Discord Activity, all free", source: SRC.greenPremium },
    audio: { value: "Pro lists “better audio quality”; no bitrate given", source: SRC.greenPremium },
    alwaysOn: { value: "Needs Pro Server or a Custom Bot", source: SRC.greenMusic },
    sources: { value: null },
    servers: { value: GREEN_SERVERS, source: SRC.greenDirectory },
  },
  fit: "A free web player and Discord Activity for everyone, levels, tickets and giveaways in the same bot, and the lowest paid plan in this table.",
  notes: [
    {
      text: "An all-in-one bot: music plus levels, tickets, giveaways and welcome messages, set up from a web dashboard.",
      source: SRC.greenHome,
    },
    {
      text: "The web player and the Discord Activity are the same player, free, with synced lyrics; everyone in the voice channel sees changes at once.",
      source: SRC.greenMusic,
    },
    {
      text: "Pro (USD 2 a month) adds audio filters and lists better audio quality; Pro Server (USD 3.50 a month) adds 24/7 for the whole server; a Custom Bot with your own name and picture is USD 7.50 a month.",
      source: SRC.greenPremium,
    },
    {
      text: `Discord's App Directory lists it in ${GREEN_SERVERS} servers.`,
      source: SRC.greenDirectory,
    },
  ],
};

/** Table rows, Bypass first. */
export const bots: Bot[] = [bypass, jockie, uzox, greenBot];

/** The honest last word of the /compare intro. */
export const bypassCaveat =
  "Bypass is new and small, about 25 servers in November 2026, so it has the shortest record of the four.";

/** Bots the old home table listed that no longer play music. */
export const retiredBots: RetiredBot[] = [
  {
    id: "fredboat",
    name: "FredBoat",
    status: "Retired in June 2026",
    notes: [
      {
        text: "The FredBoat team announced on its official subreddit on 2 June 2026 that FredBoat has been retired.",
        source: SRC.fredboatRetired,
      },
      { text: "fredboat.com returned an error (HTTP 522) when we checked.", source: SRC.fredboatSite },
    ],
  },
  {
    id: "hydra",
    name: "Hydra",
    status: "No music since February 2023",
    notes: [
      {
        text: "Hydra removed all music features on 7 February 2023, after a letter from YouTube's legal team.",
        source: SRC.hydraArticle,
      },
      {
        text: "Its premium plans now cover levels, welcome messages, reaction roles and the message builder.",
        source: SRC.hydraPremium,
      },
    ],
  },
];

/** Where Bypass facts can be checked (not required per cell). */
export const bypassSources: Source[] = [
  { url: GITHUB_URL, label: "Bypass source code on GitHub (bot instances, audio encoder, pricing constants)" },
  { url: PATREON_URL, label: "Bypass on Patreon (Founder tier)" },
];

export interface SourceGroup {
  id: string;
  name: string;
  sources: Source[];
}

function unique(sources: (Source | undefined)[]): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const source of sources) {
    if (!source || seen.has(source.url)) continue;
    seen.add(source.url);
    out.push(source);
  }
  return out;
}

/** Every URL used on the page, grouped by bot, for the Sources list. */
export const sourceGroups: SourceGroup[] = [
  ...bots.map((bot) => ({
    id: bot.id,
    name: bot.name,
    sources: bot.isBypass
      ? bypassSources
      : unique([...columns.map((c) => bot.cells[c.key].source), ...bot.notes.map((n) => n.source)]),
  })),
  ...retiredBots.map((bot) => ({ id: bot.id, name: bot.name, sources: unique(bot.notes.map((n) => n.source)) })),
];
