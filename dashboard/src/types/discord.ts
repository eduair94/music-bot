/**
 * Discord API Types
 * 
 * Re-exports shared types and adds dashboard-specific types
 */

// Re-export all shared types
export {
  // Premium types
  type PremiumTier,
  type PremiumTierConfig,
  PREMIUM_TIERS,
  
  // Guild settings
  type IGuildSettings,
  type GuildPremiumSettings,
  
  // Playback
  type ITrack,
  type IPlaybackState,
  type TrackSource,
  type LoopMode,
  
  // Bot commands
  type IBotCommand,
  type BotCommandType,
  type PlayerCommandType,
  type LinkedBotCommandType,
  type CommandStatus,
  type BotCommandParams,
  
  // Linked bots
  type ILinkedBot,
  type LinkedBotStatus,
  
  // Patreon
  type IPatreonUser,
  type PatronStatus,
  
  // Discord API
  type DiscordGuild,
  type GuildWithBot,
  type DiscordChannel,
  type DiscordRole,
  
  // Utility types
  type ApiResponse,
  type PaginationParams,
  type PaginatedResponse,
  
  // Helper functions
  getTierFromPledge,
  getMaxLinkedBots,
  getAudioBitrate,
  formatDuration,
  isValidSnowflake,
} from "../../../shared/types";

// Aliases for backwards compatibility with existing dashboard code
export type GuildSettings = import("../../../shared/types").IGuildSettings;
export type Track = import("../../../shared/types").ITrack;
export type PlaybackState = import("../../../shared/types").IPlaybackState;

/**
 * Discord User (dashboard-specific, not needed in bot)
 */
export interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  verified?: boolean;
  global_name?: string | null;
}
