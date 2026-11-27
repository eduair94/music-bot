/**
 * Development-only demo server ("Night Owls"), so the dashboard can be
 * designed and verified without Discord, Mongo or Redis. Active only when
 * NEXT_PUBLIC_DASH_DEMO=1 and the guild id is "demo". Synthetic data.
 */
import type {
  Activity,
  AuditItem,
  Fleet,
  GuildMeta,
  HistoryItem,
  Me,
  PermissionConfig,
  PlaybackState,
  Track,
} from "./types";
import { GROUPS } from "./types";

export const DEMO_GUILD = "demo";

/** Window event a demo "invite" fires (`detail.instance`); the demo engine has that bot join shortly after. */
export const DEMO_INVITE_EVENT = "fest:demo-invite";

export function isDemo(guildId?: string): boolean {
  return process.env.NEXT_PUBLIC_DASH_DEMO === "1" && (!guildId || guildId === DEMO_GUILD);
}

const people = {
  mika: { id: "100000000000000001", username: "mika" },
  toaster: { id: "100000000000000002", username: "Toaster" },
  junko: { id: "100000000000000003", username: "jun.ko" },
  dex: { id: "100000000000000004", username: "dex" },
  rook: { id: "100000000000000005", username: "rook" },
};

function t(title: string, author: string, duration: string, by: keyof typeof people, source = "youtube"): Track {
  return {
    title,
    author,
    duration,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${author}`)}`,
    source,
    requestedBy: people[by],
  };
}

/**
 * Night Owls' bill. "full": Bypass, Bypass 2 and 3 in the server, Bypass 4
 * missing. "fresh": Bypass was just added, the three extra stages are not.
 */
export function demoFleet(now = Date.now(), variant: "full" | "fresh" = "full"): Fleet {
  const s1: PlaybackState = {
    guildId: DEMO_GUILD,
    instance: 1,
    isConnected: true,
    voiceChannelId: "v1",
    voiceChannelName: "Lobby",
    isPlaying: true,
    isPaused: false,
    volume: 70,
    currentTrack: t("Nightcall", "Kavinsky", "4:18", "mika"),
    currentPosition: 161_000,
    positionAt: now,
    queue: [
      t("Midnight City", "M83", "4:03", "toaster"),
      t("Instant Crush", "Daft Punk", "5:37", "junko"),
      t("Genesis", "Justice", "3:54", "dex"),
      t("Resonance", "HOME", "3:31", "mika"),
      t("A Real Hero", "College & Electric Youth", "4:28", "toaster", "spotify"),
    ],
    queueSize: 5,
    loopMode: "off",
    autoplay: true,
    filters: [],
    listeners: 6,
    audio: { kbps: 256, tierKbps: 256, channelKbps: 96 },
    lastUpdated: now,
  };
  const s2: PlaybackState = {
    guildId: DEMO_GUILD,
    instance: 2,
    isConnected: true,
    voiceChannelId: "v2",
    voiceChannelName: "Ranked 5-stack",
    isPlaying: true,
    isPaused: false,
    volume: 55,
    currentTrack: t("Around the World", "Daft Punk", "7:09", "rook"),
    currentPosition: 72_000,
    positionAt: now,
    queue: [
      t("One More Time", "Daft Punk", "5:20", "dex"),
      t("Digital Love", "Daft Punk", "4:58", "rook", "spotify"),
    ],
    queueSize: 2,
    loopMode: "queue",
    autoplay: false,
    filters: ["bassboost"],
    listeners: 5,
    audio: { kbps: 128, tierKbps: 128, channelKbps: 64 },
    lastUpdated: now,
  };
  const fresh = variant === "fresh";
  return {
    guild: { id: DEMO_GUILD, name: "Night Owls", icon: null },
    instances: [
      { instance: 1, name: "Bypass", applicationId: "1315125264786653225", inGuild: true, online: true, premium: false, inviteUrl: "#", binding: { voiceChannelId: null }, playback: s1 },
      { instance: 2, name: "Bypass 2", applicationId: "demo-2", inGuild: !fresh, online: true, premium: false, inviteUrl: "#", binding: { voiceChannelId: fresh ? null : "v2" }, playback: fresh ? null : s2 },
      { instance: 3, name: "Bypass 3", applicationId: "demo-3", inGuild: !fresh, online: true, premium: false, inviteUrl: "#", binding: { voiceChannelId: fresh ? null : "v4" }, playback: null },
      { instance: 4, name: "Bypass 4", applicationId: "demo-4", inGuild: false, online: true, premium: false, inviteUrl: "#", binding: { voiceChannelId: null }, playback: null },
    ],
    limits: { free: 4, max: 8, premiumActive: false },
  };
}

export function demoMe(): Me {
  const groups = Object.fromEntries(GROUPS.map((g) => [g, { ok: true }])) as Me["groups"];
  return { userId: people.rook.id, username: "rook", avatar: null, isAdmin: true, voiceChannelId: "v1", groups };
}

export function demoMeta(): GuildMeta {
  return {
    roles: [
      { id: "200000000000000001", name: "Owls", color: 0x8b5cf6, position: 9, managed: false },
      { id: "200000000000000002", name: "DJ", color: 0x2a5bd7, position: 8, managed: false },
      { id: "200000000000000003", name: "Mods", color: 0x1f9d55, position: 7, managed: false },
      { id: "200000000000000004", name: "Ranked crew", color: 0xf07d16, position: 6, managed: false },
      { id: "200000000000000005", name: "Muted", color: 0x6b665d, position: 5, managed: false },
      { id: "200000000000000006", name: "Bypass", color: 0, position: 4, managed: true },
    ],
    voiceChannels: [
      { id: "v1", name: "Lobby", parentName: "Voice" },
      { id: "v2", name: "Ranked 5-stack", parentName: "Games" },
      { id: "v3", name: "Casual", parentName: "Games" },
      { id: "v4", name: "Study Hall", parentName: "Quiet" },
      { id: "v5", name: "Karaoke", parentName: "Voice" },
      { id: "v6", name: "AFK", parentName: "Voice" },
    ],
    textChannels: [
      { id: "t1", name: "general" },
      { id: "t2", name: "music" },
      { id: "t3", name: "bot-commands" },
      { id: "t4", name: "mod-log" },
    ],
  };
}

export function demoPermissions(): PermissionConfig {
  const base = { allowRoles: [], denyRoles: [], allowUsers: [], denyUsers: [] };
  return {
    djRoles: ["200000000000000002"],
    groups: {
      play: { mode: "everyone", ...base, denyRoles: ["200000000000000005"] },
      playback: { mode: "dj", ...base },
      skip: { mode: "dj", ...base, allowRoles: ["200000000000000004"] },
      queue: { mode: "dj", ...base },
      volume: { mode: "dj", ...base },
      effects: { mode: "dj", ...base },
      loop_autoplay: { mode: "dj", ...base },
      stop_leave: { mode: "admins", ...base },
      lyrics_view: { mode: "everyone", ...base },
      settings: { mode: "admins", ...base },
    },
    options: { requesterCanSkipOwn: true, aloneIsDj: true, voteSkip: { enabled: true, percentage: 50 } },
    instanceChannels: { "2": ["v2", "v3"], "3": ["v4"] },
  };
}

export function demoSettings(): Record<string, unknown> {
  return {
    language: "auto",
    embedColor: "#e8402a",
    defaultVolume: 70,
    maxVolume: 100,
    maxQueueSize: 200,
    maxSongDuration: 900,
    preventDuplicates: true,
    announceNowPlaying: true,
    autoLeaveEmpty: true,
    autoLeaveTimeout: 300,
    autoplay: true,
    voteSkipPercentage: 50,
    allowedTextChannels: ["t2", "t3"],
    allowedVoiceChannels: [],
    logChannelId: "t4",
    djRoleId: "200000000000000002",
    adminRoleId: null,
    stay247: { enabled: false },
    disabledCommands: ["say"],
    blacklistedUsers: [],
  };
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Night Owls' three bots split the plays roughly 60 / 32 / 8: Bypass holds
 * the Lobby every day, Bypass 2 follows the ranked 5-stack (busiest on
 * Friday and Saturday nights), Bypass 3 plays in Study Hall on weekdays only.
 */
export function demoActivity(days = 30): Activity {
  const daily = Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86_400_000);
    const weekend = d.getDay() === 5 || d.getDay() === 6;
    const plays = Math.round(28 + 18 * Math.sin(i / 2.3) + (weekend ? 26 : 0) + ((i * 37) % 11));
    const study = weekend || d.getDay() === 0 ? 0 : Math.round(plays * (0.14 + ((i * 7) % 5) / 100));
    const ranked = Math.round(plays * (weekend ? 0.38 : 0.23)) + ((i * 5) % 3);
    const byInstance: Record<string, number> = { "1": plays - ranked - study, "2": ranked };
    if (study) byInstance["3"] = study;
    return { date: dayKey(d), plays, listeningMs: plays * 205_000, byInstance };
  });
  const plays = daily.reduce((a, d) => a + d.plays, 0);
  const byInstance: Record<string, number> = {};
  for (const d of daily) for (const [k, v] of Object.entries(d.byInstance)) byInstance[k] = (byInstance[k] ?? 0) + v;
  const hours = [6, 3, 1, 0, 0, 0, 0, 1, 2, 3, 4, 6, 9, 8, 7, 9, 12, 18, 26, 34, 41, 44, 37, 19];
  return {
    totals: { plays, listeningMs: daily.reduce((a, d) => a + d.listeningMs, 0), requesters: 38, skips: Math.round(plays * 0.11), byInstance },
    daily,
    hours,
    topTracks: [
      { title: "Nightcall", author: "Kavinsky", url: "#", plays: 41, byInstance: { "1": 34, "2": 7 }, instance: 1 },
      { title: "Around the World", author: "Daft Punk", url: "#", plays: 33, byInstance: { "1": 9, "2": 24 }, instance: 2 },
      { title: "Midnight City", author: "M83", url: "#", plays: 29, byInstance: { "1": 21, "2": 6, "3": 2 }, instance: 1 },
      { title: "Genesis", author: "Justice", url: "#", plays: 24, byInstance: { "1": 13, "2": 11 }, instance: 1 },
      { title: "Resonance", author: "HOME", url: "#", plays: 19, byInstance: { "1": 4, "3": 15 }, instance: 3 },
    ],
    topRequesters: [
      { id: people.mika.id, username: "mika", plays: 212 },
      { id: people.rook.id, username: "rook", plays: 187 },
      { id: people.toaster.id, username: "Toaster", plays: 141 },
      { id: people.dex.id, username: "dex", plays: 96 },
      { id: people.junko.id, username: "jun.ko", plays: 77 },
    ],
    sources: { youtube: Math.round(plays * 0.62), spotify: Math.round(plays * 0.27), soundcloud: Math.round(plays * 0.06), deezer: Math.round(plays * 0.05) },
  };
}

export function demoHistory(): HistoryItem[] {
  const now = Date.now();
  // title, artist, length, requester, minutes ago, bot, autoplay
  const items: [string, string, string, keyof typeof people, number, number, boolean?][] = [
    ["Lose Yourself to Dance", "Daft Punk", "5:53", "rook", 9, 2],
    ["Sunset", "The Midnight", "5:21", "mika", 16, 1],
    ["Turbo Killer", "Carpenter Brut", "3:22", "dex", 24, 2],
    ["Tech Noir", "Gunship", "4:57", "toaster", 31, 1, true],
    ["Odd Look", "Kavinsky", "4:12", "junko", 37, 1],
    ["D.A.N.C.E.", "Justice", "4:02", "mika", 44, 1],
    ["Strobe", "deadmau5", "10:37", "rook", 52, 3],
    ["Breakthru", "Breakbot", "3:51", "toaster", 63, 1, true],
  ];
  return items.map(([title, author, duration, by, mins, instance, autoplay]) => ({
    title,
    author,
    duration,
    url: "#",
    source: "youtube",
    requestedBy: autoplay ? undefined : people[by],
    playedAt: new Date(now - mins * 60_000).toISOString(),
    autoplay: Boolean(autoplay),
    instance,
  }));
}

export function demoAudit(): AuditItem[] {
  const now = Date.now();
  return [
    { ts: new Date(now - 3_600_000).toISOString(), userId: people.rook.id, username: "rook", action: "permissions", summary: "Skip: Ranked crew allowed" },
    { ts: new Date(now - 86_400_000).toISOString(), userId: people.rook.id, username: "rook", action: "binding", summary: "Bypass 3 now serves Study Hall" },
    { ts: new Date(now - 3 * 86_400_000).toISOString(), userId: people.mika.id, username: "mika", action: "settings", summary: "Max song length 15 min" },
  ];
}

export function demoSearch(query: string): Track[] {
  const q = query.trim() || "night";
  const pool: Track[] = [
    t("Nightcall", "Kavinsky", "4:18", "rook"),
    t("Night Drive", "Chromatics", "6:12", "rook"),
    t("Nights", "Frank Ocean", "5:07", "rook", "spotify"),
    t("The Night Out", "Martin Solveig", "3:01", "rook"),
    t("Into the Night", "YOASOBI", "4:21", "rook"),
    t("Night Owl", "Galimatias", "3:47", "rook", "soundcloud"),
  ];
  return pool.map((track) => ({ ...track, requestedBy: undefined, title: track.title.replace(/night/i, (m) => (q.length > 2 ? m : m)) }));
}
