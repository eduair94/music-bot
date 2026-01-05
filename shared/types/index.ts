/**
 * @fileoverview Shared Types for Music Bot
 * 
 * This module contains all shared TypeScript interfaces and types
 * used across the bot, dashboard, and worker processes.
 * 
 * @module shared/types
 */

// ============================================================================
// PREMIUM TIERS
// ============================================================================

/**
 * Available premium tier levels
 */
export type PremiumTier = "free" | "basic" | "pro" | "enterprise";

/**
 * Premium tier configuration
 */
export interface PremiumTierConfig {
  /** Tier identifier */
  tier: PremiumTier;
  /** Display name */
  name: string;
  /** Minimum pledge in cents */
  minPledgeCents: number;
  /** Maximum linked bots allowed */
  maxLinkedBots: number;
  /** Audio bitrate in kbps */
  audioBitrate: number;
  /** Access to audio filters */
  audioFilters: boolean;
  /** Access to 24/7 mode */
  stayMode: boolean;
}

/**
 * Premium tier limits configuration
 */
export const PREMIUM_TIERS: Record<PremiumTier, PremiumTierConfig> = {
  free: {
    tier: "free",
    name: "Free",
    minPledgeCents: 0,
    maxLinkedBots: 0,
    audioBitrate: 128,
    audioFilters: false,
    stayMode: false,
  },
  basic: {
    tier: "basic",
    name: "Basic",
    minPledgeCents: 300,
    maxLinkedBots: 1,
    audioBitrate: 192,
    audioFilters: true,
    stayMode: false,
  },
  pro: {
    tier: "pro",
    name: "Pro",
    minPledgeCents: 1000,
    maxLinkedBots: 3,
    audioBitrate: 256,
    audioFilters: true,
    stayMode: true,
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    minPledgeCents: 2500,
    maxLinkedBots: 10,
    audioBitrate: 320,
    audioFilters: true,
    stayMode: true,
  },
};

// ============================================================================
// GUILD SETTINGS
// ============================================================================

/**
 * Premium features configuration for a guild
 */
export interface GuildPremiumSettings {
  /** Whether premium is enabled */
  enabled: boolean;
  /** Premium tier level */
  tier: PremiumTier;
  /** When premium expires (null = never) */
  expiresAt: Date | null;
  /** Max concurrent listeners (0 = unlimited) */
  maxConcurrentListeners: number;
  /** Allow custom bot branding */
  customBranding: boolean;
  /** Priority support access */
  prioritySupport: boolean;
  /** Access to analytics */
  analytics: boolean;
}

/**
 * Guild settings interface
 * Defines all customizable settings per Discord server
 */
export interface IGuildSettings {
  /** Discord guild ID */
  guildId: string;

  // Channel Restrictions
  /** Voice channels where bot can play (empty = all) */
  allowedVoiceChannels: string[];
  /** Text channels where commands work (empty = all) */
  allowedTextChannels: string[];
  /** Channel for bot logs */
  logChannelId: string | null;

  // Role Permissions
  /** DJ role for restricted commands */
  djRoleId: string | null;
  /** Admin role for settings changes */
  adminRoleId: string | null;

  // Playback Settings
  /** Default volume (0-100) */
  defaultVolume: number;
  /** Maximum allowed volume (0-100) */
  maxVolume: number;
  /** Maximum songs in queue */
  maxQueueSize: number;
  /** Maximum song duration in seconds (0 = unlimited) */
  maxSongDuration: number;

  // Behavior Settings
  /** Announce songs in text channel */
  announceNowPlaying: boolean;
  /** Leave when voice channel is empty */
  autoLeaveEmpty: boolean;
  /** Seconds before leaving empty channel */
  autoLeaveTimeout: number;
  /** Prevent duplicate songs in queue */
  preventDuplicates: boolean;
  /** Vote skip percentage (0-100) */
  voteSkipPercentage: number;

  // Premium Features
  /** Premium configuration */
  premium: GuildPremiumSettings;

  // Blacklist
  /** User IDs that can't use the bot */
  blacklistedUsers: string[];
  /** Keywords/URLs that are blocked */
  blacklistedSongs: string[];

  // Customization
  /** Locale override for this guild */
  language: string;
  /** Custom embed color (hex) */
  embedColor: string;

  // Analytics
  /** Total songs played in this guild */
  totalSongsPlayed: number;
  /** Total playback time in seconds */
  totalPlaytime: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// PLAYBACK STATE
// ============================================================================

/**
 * Track source types
 */
export type TrackSource = "youtube" | "spotify" | "soundcloud" | "file" | "unknown";

/**
 * Loop mode options
 */
export type LoopMode = "off" | "track" | "queue";

/**
 * Track information
 */
export interface ITrack {
  /** Track title */
  title: string;
  /** Track artist/author */
  author: string;
  /** Track URL */
  url: string;
  /** Thumbnail URL */
  thumbnail: string;
  /** Duration in milliseconds */
  duration: number;
  /** Who requested the track */
  requestedBy: {
    id: string;
    username: string;
    avatar: string | null;
  };
  /** Track source platform */
  source: TrackSource;
}

/**
 * Real-time playback state for a guild
 */
export interface IPlaybackState {
  /** Discord guild ID */
  guildId: string;
  /** Whether bot is connected to voice */
  isConnected: boolean;
  /** Current voice channel ID */
  voiceChannelId: string | null;
  /** Voice channel name */
  voiceChannelName: string | null;
  /** Text channel for responses */
  textChannelId: string | null;
  /** Whether music is playing */
  isPlaying: boolean;
  /** Whether playback is paused */
  isPaused: boolean;
  /** Current volume (0-100) */
  volume: number;
  /** Currently playing track */
  currentTrack: ITrack | null;
  /** Current position in ms */
  currentPosition: number;
  /** Upcoming tracks */
  queue: ITrack[];
  /** Total queue size */
  queueSize: number;
  /** Current loop mode */
  loopMode: LoopMode;
  /** Audio bitrate in kbps */
  audioBitrate: number;
  /** Last state update time */
  lastUpdated: Date;
  /** When playback started */
  playbackStartedAt: Date | null;
}

// ============================================================================
// BOT COMMANDS
// ============================================================================

/**
 * Player command types
 */
export type PlayerCommandType =
  | "play"
  | "pause"
  | "resume"
  | "skip"
  | "stop"
  | "volume"
  | "shuffle"
  | "loop"
  | "remove"
  | "skipto"
  | "move"
  | "clear"
  | "seek";

/**
 * Linked bot control command types
 */
export type LinkedBotCommandType =
  | "linked_bot_start"
  | "linked_bot_stop"
  | "linked_bot_restart";

/**
 * All command types
 */
export type BotCommandType = PlayerCommandType | LinkedBotCommandType;

/**
 * Command status
 */
export type CommandStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Parameters for bot commands
 */
export interface BotCommandParams {
  /** Search query for play command */
  query?: string;
  /** Volume level (0-100) */
  volume?: number;
  /** Loop mode to set */
  loopMode?: LoopMode;
  /** Position in queue */
  position?: number;
  /** Source position for move */
  from?: number;
  /** Target position for move */
  to?: number;
  /** Seek position in seconds */
  seconds?: number;
  /** Voice channel to join */
  voiceChannelId?: string;
}

/**
 * Command sent from dashboard to bot
 */
export interface IBotCommand {
  /** Guild ID (for player commands) */
  guildId?: string;
  /** User who sent command */
  userId?: string;
  /** Bot ID (for linked bot commands) */
  botId?: string;
  /** Command type string (alternative to command) */
  type?: string;
  /** Command type */
  command?: BotCommandType;
  /** Command parameters */
  params?: BotCommandParams;
  /** Execution status */
  status: CommandStatus;
  /** Result message */
  result?: string;
  /** Error message */
  error?: string;
  /** When command was created */
  createdAt: Date;
  /** When command was processed */
  processedAt?: Date;
  /** Who requested the command */
  requestedBy?: {
    id: string;
    username: string;
  };
}

// ============================================================================
// LINKED BOTS
// ============================================================================

/**
 * Linked bot status
 */
export type LinkedBotStatus = "offline" | "starting" | "online" | "error" | "stopped";

/**
 * Linked bot configuration
 */
export interface ILinkedBot {
  /** Owner's Discord ID */
  ownerId: string;
  /** Owner's Discord username */
  ownerUsername: string;
  /** Bot's Discord ID */
  botId: string;
  /** Bot's Discord username */
  botUsername: string;
  /** Bot's avatar hash */
  botAvatar: string | null;
  /** Encrypted bot token */
  encryptedToken: string;
  /** Encryption IV */
  tokenIv: string;
  /** Current bot status */
  status: LinkedBotStatus;
  /** Last status change time */
  lastStatusChange: Date;
  /** Last error message */
  lastError: string | null;
  /** Process ID if running */
  processId: string | null;
  /** Guilds the bot can operate in */
  allowedGuilds: string[];
  /** Number of guilds bot is in */
  totalGuilds: number;
  /** Total songs played */
  totalSongsPlayed: number;
  /** Total playtime in seconds */
  totalPlaytime: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================================================
// PATREON INTEGRATION
// ============================================================================

/**
 * Patron status types
 */
export type PatronStatus = "active_patron" | "declined_patron" | "former_patron" | "not_patron";

/**
 * Patreon user information
 */
export interface IPatreonUser {
  /** Discord user ID */
  discordId: string;
  /** Patreon user ID */
  patreonId: string;
  /** Patreon email */
  email?: string;
  /** Patreon full name */
  fullName?: string;
  /** Patreon tier ID */
  tierId?: string;
  /** Tier display name */
  tierTitle?: string;
  /** Current patron status */
  patronStatus: PatronStatus;
  /** Pledge amount in cents */
  pledgeAmountCents: number;
  /** Lifetime support in cents */
  lifetimeSupportCents: number;
  /** Last charge date */
  lastChargeDate?: Date;
  /** Last charge status */
  lastChargeStatus?: string;
  /** Is currently premium */
  isPremium: boolean;
  /** Is founder tier */
  isFounder: boolean;
  /** Audio bitrate setting */
  audioBitrate: number;
  /** Custom bot name */
  customBotName?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================================================
// DISCORD API TYPES
// ============================================================================

/**
 * Discord guild (server) information
 */
export interface DiscordGuild {
  /** Guild ID */
  id: string;
  /** Guild name */
  name: string;
  /** Guild icon hash */
  icon: string | null;
  /** Whether user owns the guild */
  owner: boolean;
  /** User's permissions in guild */
  permissions: string;
  /** Guild features */
  features: string[];
}

/**
 * Guild with bot presence info
 */
export interface GuildWithBot extends DiscordGuild {
  /** Whether our bot is in the guild */
  botInGuild: boolean;
  /** Whether user can manage the guild */
  hasManagePermission: boolean;
}

/**
 * Discord channel information
 */
export interface DiscordChannel {
  /** Channel ID */
  id: string;
  /** Channel name */
  name: string;
  /** Channel type (0=text, 2=voice) */
  type: number;
  /** Position in channel list */
  position: number;
  /** Parent category ID */
  parent_id: string | null;
}

/**
 * Discord role information
 */
export interface DiscordRole {
  /** Role ID */
  id: string;
  /** Role name */
  name: string;
  /** Role color (integer) */
  color: number;
  /** Position in role list */
  position: number;
  /** Role permissions */
  permissions: string;
  /** Whether role is managed by integration */
  managed: boolean;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * API response wrapper
 */
export interface ApiResponse<T = unknown> {
  /** Whether request was successful */
  success: boolean;
  /** Response data */
  data?: T;
  /** Error message if failed */
  error?: string;
  /** Additional message */
  message?: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Items for current page */
  items: T[];
  /** Total item count */
  total: number;
  /** Current page */
  page: number;
  /** Items per page */
  limit: number;
  /** Total pages */
  totalPages: number;
  /** Has next page */
  hasNext: boolean;
  /** Has previous page */
  hasPrev: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get premium tier from pledge amount
 * @param pledgeCents - Pledge amount in cents
 * @returns Premium tier
 */
export function getTierFromPledge(pledgeCents: number): PremiumTier {
  if (pledgeCents >= PREMIUM_TIERS.enterprise.minPledgeCents) return "enterprise";
  if (pledgeCents >= PREMIUM_TIERS.pro.minPledgeCents) return "pro";
  if (pledgeCents >= PREMIUM_TIERS.basic.minPledgeCents) return "basic";
  return "free";
}

/**
 * Get maximum linked bots for a pledge amount
 * @param pledgeCents - Pledge amount in cents
 * @returns Maximum linked bots allowed
 */
export function getMaxLinkedBots(pledgeCents: number): number {
  const tier = getTierFromPledge(pledgeCents);
  return PREMIUM_TIERS[tier].maxLinkedBots;
}

/**
 * Get audio bitrate for a tier
 * @param tier - Premium tier
 * @returns Audio bitrate in kbps
 */
export function getAudioBitrate(tier: PremiumTier): number {
  return PREMIUM_TIERS[tier].audioBitrate;
}

/**
 * Format duration from milliseconds to human readable
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "3:45")
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Validate Discord snowflake ID
 * @param id - ID to validate
 * @returns Whether ID is valid
 */
export function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}
