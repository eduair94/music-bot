import type { IBotHeartbeat, IGuildSettings, IPlaybackState, LinkedBotStatus } from "../../../shared/types";
import type { DailyPoint, Freshness } from "@/lib/admin/aggregate";

export type { IBotHeartbeat, DailyPoint };

export interface InfraCheck {
  ok: boolean;
  ms: number | null;
}

export interface AdminOverview {
  status: { heartbeat: IBotHeartbeat | null; state: Freshness; ageSec: number | null };
  infra: { redis: InfraCheck; mongo: InfraCheck; debugPanel: InfraCheck & { configured: boolean } };
  totals: {
    guilds: number;
    members: number;
    playing: number;
    paused: number;
    premiumUsers: number;
    premiumGuilds: number;
    linkedBots: Record<LinkedBotStatus, number>;
    guildsWithSettings: number;
  };
  activity: {
    commands24h: number;
    commandsPrev24h: number;
    tracks24h: number;
    tracksPrev24h: number;
    errors24h: number;
    errorRate24h: number;
    uniqueUsers7d: number;
    uniqueGuilds7d: number;
  };
  series14d: DailyPoint[];
  topCommands7d: { command: string; count: number; failed: number }[];
  sources7d: { source: string; starts: number; errors: number }[];
  recentErrors: RecentError[];
  membership30d: { joins: number; leaves: number; recent: MembershipEvent[] };
  generatedAt: string;
}

export interface RecentError {
  ts: string;
  kind: "error" | "command" | "track";
  scope?: string;
  guildId?: string;
  guildName?: string;
  command?: string;
  track?: string;
  message: string;
}

export interface MembershipEvent {
  ts: string;
  event: "join" | "leave";
  guildId: string;
  name: string;
  memberCount: number;
}

export interface AdminGuild {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  joinedAt: number;
  hasSettings: boolean;
  isCurrentlyPlaying: boolean;
  lastActive?: string;
  premium: { active: boolean; bitrate: number; tier?: string } | null;
  settingsSummary: {
    djRoleId: string | null;
    language: string;
    maxQueueSize: number;
    logChannelId: string | null;
    totalSongsPlayed: number;
    totalPlaytime: number;
  } | null;
  activity7d: { commands: number; tracks: number };
  playback: {
    isPlaying: boolean;
    isPaused: boolean;
    currentTrack: string | null;
    queueSize: number;
    voiceChannelName: string | null;
  } | null;
}

export interface AdminGuildsResponse {
  guilds: AdminGuild[];
  stats: {
    totalGuilds: number;
    totalMembers: number;
    activeGuilds: number;
    guildsWithSettings: number;
    premiumGuilds: number;
  };
}

export interface GuildEventRow {
  ts: string;
  kind: string;
  summary: string;
  ok?: boolean;
}

export type AdminPlaybackDetail = Pick<
  IPlaybackState,
  "isPlaying" | "isPaused" | "volume" | "queueSize" | "voiceChannelName" | "currentTrack" | "loopMode" | "audioBitrate"
> & { lastUpdated: string };

export interface AdminGuildDetail {
  guild: AdminGuild | null;
  settings: Partial<IGuildSettings> | null;
  premium: { active: boolean; bitrate: number; discordId: string; linkedAt: string; tier?: string } | null;
  playback: AdminPlaybackDetail | null;
  events: GuildEventRow[];
  activity: {
    commands7d: number;
    tracks7d: number;
    topCommands: { command: string; count: number }[];
    topRequesters: { userId: string; count: number }[];
  };
}

export interface AuditEntry {
  ts: string;
  actorId: string;
  actorName: string;
  action: string;
  targetGuildId?: string;
  targetName?: string;
  ok: boolean;
  result?: string;
  error?: string;
}

export interface LogEntry {
  ts: string;
  level: "log" | "info" | "warn" | "error" | "debug";
  message: string;
}

export interface ActionResult {
  ok: boolean;
  result?: string;
  error?: string;
}

export interface PatronRow {
  discordId: string;
  fullName?: string;
  tierTitle?: string;
  patronStatus: string;
  pledgeUsd: number;
  lifetimeUsd: number;
  isPremium: boolean;
  isFounder: boolean;
  lastChargeDate?: string;
  lastChargeStatus?: string;
}

export interface PremiumGuildRow {
  guildId: string;
  guildName?: string;
  discordId: string;
  audioBitrate: number;
  isActive: boolean;
  linkedAt: string;
  lastUsed?: string;
}

export interface LinkedBotRow {
  botId: string;
  botUsername: string;
  ownerId: string;
  ownerUsername: string;
  status: string;
  totalGuilds: number;
  totalSongsPlayed: number;
  lastError: string | null;
  lastStatusChange: string;
}

export interface AdminPremium {
  patrons: PatronRow[];
  premiumGuilds: PremiumGuildRow[];
  linkedBots: LinkedBotRow[];
}
