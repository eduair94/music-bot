/**
 * Bypass fleet: several Discord applications ("Bypass", "Bypass 2", …) run the
 * same bot image, one process per application, so a server can have music in
 * several voice channels at once. Instance 1 is the primary: it owns the slash
 * commands and hands jobs to the others through the command bus.
 *
 * Shared by the bot and the dashboard (no Node-only imports).
 */
import { BOT_APPLICATION_ID, botInviteUrl } from "./links";

/** Instances every server gets for free (Bypass … Bypass 4). */
export const FLEET_FREE_INSTANCES = 4;
/** Highest instance number (Bypass 5 … Bypass 8 need Premium). */
export const FLEET_MAX_INSTANCES = 8;

export interface FleetMember {
  instance: number;
  /** Display name, e.g. "Bypass 2". */
  name: string;
  /** Discord application id (= bot user id); null while the application does not exist yet. */
  applicationId: string | null;
  /** Instances above the free four need a Premium server. */
  premium: boolean;
}

/** A valid instance number (1..8), or null. */
export function parseInstance(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= FLEET_MAX_INSTANCES ? n : null;
}

export function instanceName(instance: number): string {
  return instance === 1 ? "Bypass" : `Bypass ${instance}`;
}

const SNOWFLAKE = /^\d{15,25}$/;

/**
 * "2:<id>,3:<id>" → { 2: "<id>", 3: "<id>" }. Malformed entries are ignored.
 * "1:<id>" overrides the primary's id (development applications).
 */
export function parseFleetApplicationIds(raw: string | undefined | null): Record<number, string> {
  const out: Record<number, string> = {};
  for (const part of (raw ?? "").split(",")) {
    const [left, right] = part.split(":").map((s) => s?.trim());
    const instance = parseInstance(left);
    if (instance && right && SNOWFLAKE.test(right)) out[instance] = right;
  }
  return out;
}

/** Every instance slot 1..8; unset application ids mean "not created yet". */
export function fleetRegistry(env: Record<string, string | undefined> = process.env): FleetMember[] {
  const ids = parseFleetApplicationIds(env.FLEET_APPLICATION_IDS);
  const members: FleetMember[] = [];
  for (let instance = 1; instance <= FLEET_MAX_INSTANCES; instance++) {
    members.push({
      instance,
      name: instanceName(instance),
      applicationId: ids[instance] ?? (instance === 1 ? BOT_APPLICATION_ID : null),
      premium: instance > FLEET_FREE_INSTANCES
    });
  }
  return members;
}

/** Instances whose application exists (always includes instance 1). */
export function configuredInstances(env: Record<string, string | undefined> = process.env): (FleetMember & { applicationId: string })[] {
  return fleetRegistry(env).filter((m): m is FleetMember & { applicationId: string } => Boolean(m.applicationId));
}

export function fleetMember(instance: number, env: Record<string, string | undefined> = process.env): FleetMember | null {
  return fleetRegistry(env).find((m) => m.instance === instance) ?? null;
}

/** True once at least one extra instance exists. With only Bypass, every fleet path is a no-op. */
export function fleetEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return configuredInstances(env).some((m) => m.instance > 1);
}

/** Invite link for an instance (optionally pre-selecting a server); null when its application does not exist. */
export function inviteUrl(instance: number, guildId?: string, env: Record<string, string | undefined> = process.env): string | null {
  const member = fleetMember(instance, env);
  return member?.applicationId ? botInviteUrl(member.applicationId, guildId) : null;
}

/**
 * Redis keys and channels. Instance 1 also keeps the legacy keys
 * (`playback:<guildId>`, `bot:status`, `bot:guilds`) during the migration.
 */
export const fleetKeys = {
  playback: (guildId: string, instance: number) => `playback:${guildId}:${instance}`,
  legacyPlayback: (guildId: string) => `playback:${guildId}`,
  status: (instance: number) => `bot:status:${instance}`,
  legacyStatus: "bot:status",
  guilds: (instance: number) => `bot:guilds:${instance}`,
  legacyGuilds: "bot:guilds",
  /** Pub/sub channel the dashboard's /stream route listens on. */
  events: (guildId: string) => `bypass:events:${guildId}`
} as const;

// ---------------------------------------------------------------- live state

/** A track as the dashboard v2 contract shows it. */
export interface LiveTrack {
  title: string;
  author: string;
  url: string;
  thumbnail?: string;
  /** "3:45", "1:02:03"; "" for live streams. */
  duration: string;
  durationMs?: number;
  source?: string;
  requestedBy?: { id: string; username: string; avatar?: string };
}

/** Playback state of one instance in one server (Redis `playback:<guildId>:<n>`, SSE `event: playback`). */
export interface LivePlaybackState {
  guildId: string;
  instance: number;
  isConnected: boolean;
  voiceChannelId?: string;
  voiceChannelName?: string;
  textChannelId?: string;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  currentTrack?: LiveTrack;
  /** Position in ms, measured at `positionAt` (epoch ms). */
  currentPosition: number;
  positionAt: number;
  queue: LiveTrack[];
  queueSize: number;
  loopMode: "off" | "track" | "queue";
  autoplay?: boolean;
  filters?: string[];
  /** People (not bots) in the voice channel. */
  listeners?: number;
  /** What the Opus encoder sends right now; absent until a song starts. */
  audio?: LiveAudio;
  /** Epoch ms. */
  lastUpdated: number;
}

/** The audio a stage is really sending (services/audioEncoder.ts). */
export interface LiveAudio {
  /** Opus bitrate the encoder is set to, in kbps. */
  kbps: number;
  /** The most this session's tier can send under the bot's limit, in kbps (128 standard, 256 Hi-Fi). */
  tierKbps: number;
  /** The voice channel's own bitrate setting, in kbps. */
  channelKbps?: number;
}

/** One instance as `GET /fleet` lists it. */
export interface FleetInstanceInfo {
  instance: number;
  name: string;
  applicationId: string;
  avatarUrl?: string;
  inGuild: boolean;
  online: boolean;
  premium: boolean;
  inviteUrl: string;
  binding: { voiceChannelId: string | null };
  playback: LivePlaybackState | null;
}

/** Messages published on `bypass:events:<guildId>`. */
export type FleetEvent =
  | { type: "playback"; instance: number; state: LivePlaybackState }
  | { type: "fleet"; instance: number; online: boolean; inGuild: boolean }
  | { type: "settings"; keys: string[] };

/** State of an instance that is not in a voice channel in this server. */
export function idlePlaybackState(guildId: string, instance: number, now = Date.now()): LivePlaybackState {
  return {
    guildId,
    instance,
    isConnected: false,
    isPlaying: false,
    isPaused: false,
    volume: 80,
    currentPosition: 0,
    positionAt: now,
    queue: [],
    queueSize: 0,
    loopMode: "off",
    autoplay: false,
    filters: [],
    listeners: 0,
    lastUpdated: now
  };
}

// ------------------------------------------------------------------ routing

/** What the primary knows about one instance when routing a play request. */
export interface RouteCandidate {
  instance: number;
  online: boolean;
  inGuild: boolean;
  premium: boolean;
  /** Voice channel it is connected to in this server, if any. */
  voiceChannelId: string | null;
  /** Something is playing (or paused) on it. */
  hasTrack: boolean;
  /** People in its voice channel. */
  listeners: number;
  /** Channel an admin pinned it to (fleet.bindings), if any. */
  boundTo: string | null;
  /** Voice channels it may serve (permissionConfig.instanceChannels); empty = any. */
  allowedChannels: string[];
}

export interface RouteInput {
  /** Voice channel the requester is in. */
  voiceChannelId: string;
  candidates: RouteCandidate[];
  premiumActive: boolean;
}

export type RouteDecision =
  | { kind: "instance"; instance: number; reason: "inChannel" | "binding" | "primary" | "idle" }
  | { kind: "none" };

/** Playing for people in another channel: moving it would hijack their music. */
export function isBusyElsewhere(c: RouteCandidate, voiceChannelId: string): boolean {
  return Boolean(c.voiceChannelId && c.voiceChannelId !== voiceChannelId && c.hasTrack && c.listeners > 0);
}

function allowedIn(c: RouteCandidate, voiceChannelId: string): boolean {
  return c.allowedChannels.length === 0 || c.allowedChannels.includes(voiceChannelId);
}

/**
 * Pure routing rules (roadmap Pillar 1):
 * 1. an instance already in the channel takes it;
 * 2. else the instance bound to the channel;
 * 3. else the primary, when it is free to come;
 * 4. else the first idle instance in the server, online and allowed there
 *    (not in voice first, then idle in another channel; ones bound to other
 *    channels last);
 * 5. else none.
 */
export function chooseInstance(input: RouteInput): RouteDecision {
  const { voiceChannelId, premiumActive } = input;
  const usable = (c: RouteCandidate) => c.online && c.inGuild && (!c.premium || premiumActive) && allowedIn(c, voiceChannelId);
  const sorted = [...input.candidates].sort((a, b) => a.instance - b.instance);

  const inChannel = sorted.find((c) => c.voiceChannelId === voiceChannelId && c.online);
  if (inChannel) return { kind: "instance", instance: inChannel.instance, reason: "inChannel" };

  const bound = sorted.find((c) => c.boundTo === voiceChannelId && usable(c) && !isBusyElsewhere(c, voiceChannelId));
  if (bound) return { kind: "instance", instance: bound.instance, reason: "binding" };

  const primary = sorted.find((c) => c.instance === 1);
  if (primary && allowedIn(primary, voiceChannelId) && !isBusyElsewhere(primary, voiceChannelId)) {
    return { kind: "instance", instance: 1, reason: "primary" };
  }

  const free = sorted.filter((c) => c.instance !== 1 && usable(c) && !isBusyElsewhere(c, voiceChannelId));
  const rank = (c: RouteCandidate) => (c.boundTo && c.boundTo !== voiceChannelId ? 2 : c.voiceChannelId ? 1 : 0);
  const pick = free.sort((a, b) => rank(a) - rank(b) || a.instance - b.instance)[0];
  if (pick) return { kind: "instance", instance: pick.instance, reason: "idle" };

  return { kind: "none" };
}
