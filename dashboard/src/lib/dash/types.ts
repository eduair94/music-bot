/**
 * Client-side shapes of the dashboard v2 API
 * (docs/plans/2026-11-27-dashboard-api.md). Kept separate from the
 * bot's shared types so the UI only depends on the contract.
 */

export type Group =
  | "play"
  | "playback"
  | "skip"
  | "queue"
  | "volume"
  | "effects"
  | "loop_autoplay"
  | "stop_leave"
  | "lyrics_view"
  | "settings";

export const GROUPS: Group[] = [
  "play",
  "playback",
  "skip",
  "queue",
  "volume",
  "effects",
  "loop_autoplay",
  "stop_leave",
  "lyrics_view",
  "settings",
];

export type RuleMode = "everyone" | "dj" | "admins";

export interface GroupRule {
  mode: RuleMode;
  allowRoles: string[];
  denyRoles: string[];
  allowUsers: string[];
  denyUsers: string[];
}

export interface PermissionConfig {
  djRoles: string[];
  groups: Record<Group, GroupRule>;
  options: {
    requesterCanSkipOwn: boolean;
    aloneIsDj: boolean;
    voteSkip: { enabled: boolean; percentage: number };
  };
  instanceChannels: Record<string, string[]>;
}

export interface Requester {
  id: string;
  username: string;
  avatar?: string;
}

export interface Track {
  title: string;
  author: string;
  url: string;
  thumbnail?: string;
  duration: string;
  durationMs?: number;
  source?: string;
  requestedBy?: Requester;
}

export type LoopMode = "off" | "track" | "queue";

export interface PlaybackState {
  guildId: string;
  instance: number;
  isConnected: boolean;
  voiceChannelId?: string;
  voiceChannelName?: string;
  textChannelId?: string;
  isPlaying: boolean;
  isPaused: boolean;
  volume: number;
  currentTrack?: Track;
  currentPosition: number;
  positionAt: number;
  queue: Track[];
  queueSize: number;
  loopMode: LoopMode;
  autoplay?: boolean;
  filters?: string[];
  listeners?: number;
  /** What the bot's Opus encoder sends right now; absent until a song starts. */
  audio?: LiveAudio;
  lastUpdated: number;
}

export interface LiveAudio {
  /** Opus bitrate being sent, kbps. */
  kbps: number;
  /** The session's tier, kbps (128 standard, 320 with Premium, a vote or a support-server boost). */
  tierKbps: number;
  /** The voice channel's bitrate setting, kbps. */
  channelKbps?: number;
}

export interface FleetInstance {
  instance: number;
  name: string;
  applicationId: string;
  avatarUrl?: string;
  inGuild: boolean;
  online: boolean;
  premium: boolean;
  inviteUrl: string;
  binding: { voiceChannelId: string | null };
  playback: PlaybackState | null;
}

export interface Fleet {
  guild: { id: string; name: string; icon: string | null };
  instances: FleetInstance[];
  limits: { free: number; max: number; premiumActive: boolean };
}

export interface Me {
  userId: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
  voiceChannelId: string | null;
  groups: Record<Group, { ok: boolean; reason?: string }>;
}

export interface GuildRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

export interface GuildMeta {
  roles: GuildRole[];
  voiceChannels: { id: string; name: string; parentName?: string }[];
  textChannels: { id: string; name: string }[];
}

/** Plays split by the fleet bot that played them, keyed by instance number: `{ "1": 40, "2": 12 }`. */
export type InstanceSplit = Record<string, number>;

export interface Activity {
  totals: { plays: number; listeningMs: number; requesters: number; skips: number; byInstance: InstanceSplit };
  daily: { date: string; plays: number; listeningMs: number; byInstance: InstanceSplit }[];
  hours: number[];
  /** `instance` is the bot that played the track most. */
  topTracks: { title: string; author: string; url: string; thumbnail?: string; plays: number; byInstance: InstanceSplit; instance: number }[];
  topRequesters: { id: string; username: string; avatar?: string; plays: number }[];
  sources: Record<string, number>;
}

export interface HistoryItem {
  title: string;
  author: string;
  url: string;
  thumbnail?: string;
  duration: string;
  source?: string;
  requestedBy?: Requester;
  playedAt: string;
  autoplay?: boolean;
  /** The fleet bot that played it (1 = Bypass). */
  instance: number;
}

export interface AuditItem {
  ts: string;
  userId: string;
  username: string;
  action: string;
  summary: string;
}

export type CommandName =
  | "play"
  | "pause"
  | "resume"
  | "skip"
  | "previous"
  | "stop"
  | "volume"
  | "seek"
  | "shuffle"
  | "loop"
  | "autoplay"
  | "filter"
  | "remove"
  | "move"
  | "skipto"
  | "clear"
  | "join"
  | "leave"
  | "search";

export interface CommandResult {
  success: boolean;
  message?: string;
  error?: string;
  reason?: string;
  data?: { results?: Track[] } & Record<string, unknown>;
}
