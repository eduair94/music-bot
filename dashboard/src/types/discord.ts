/**
 * Discord API Types
 * 
 * Re-exports shared types and adds dashboard-specific types
 */

// Re-export all shared types
export {
    PREMIUM_TIERS, formatDuration, getAudioBitrate, getMaxLinkedBots,
    // Helper functions
    getTierFromPledge, isValidSnowflake,
    // Utility types
    type ApiResponse, type BotCommandParams, type BotCommandType, type CommandStatus, type DiscordChannel,
    // Discord API
    type DiscordGuild, type DiscordRole, type GuildPremiumSettings, type GuildWithBot,
    // Bot commands
    type IBotCommand,
    // Guild settings
    type IGuildSettings,
    // Linked bots
    type ILinkedBot,
    // Patreon
    type IPatreonUser, type IPlaybackState,
    // Playback
    type ITrack, type LinkedBotCommandType, type LinkedBotStatus, type LoopMode, type PaginatedResponse, type PaginationParams, type PatronStatus, type PlayerCommandType,
    // Premium types
    type PremiumTier,
    type PremiumTierConfig, type TrackSource
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
