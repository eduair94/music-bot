import { PatreonService } from "../services/patreon";
import { PremiumGuildService } from "../services/premiumGuild";
import { hasActiveVote } from "../services/votes";
import { isSupportBooster } from "../services/boosters";
import { config } from "./config";
import { INSTANCE_NAME, isLinked } from "./instance";

/**
 * Audio quality tier information
 */
export interface AudioQualityInfo {
  bitrate: number;
  qualityBadge: string;
  tier: "free" | "basic" | "premium" | "ultra";
  source: "user" | "guild" | "owner" | "linked" | "default";
}

/**
 * Bot identity information
 */
export interface BotIdentityInfo {
  name: string;
  displayName: string;
  isCustom: boolean;
}

/**
 * Badge for an Opus bitrate. Pass what the encoder will really send
 * (`targetKbps` in services/audioEncoder.ts), not just the tier.
 */
export function getQualityBadge(bitrate?: number): string {
  const kbps = bitrate || 128;
  return `${kbps >= 192 ? "🔊" : "🔉"} Opus ${kbps} kbps`;
}

/**
 * Get quality tier based on bitrate
 */
export function getQualityTier(bitrate: number): "free" | "basic" | "premium" | "ultra" {
  if (bitrate >= 320) return "ultra";
  if (bitrate >= 256) return "premium";
  if (bitrate >= 192) return "basic";
  return "free";
}

/**
 * Check if a user is the bot owner
 */
export function isOwner(userId: string): boolean {
  return config.OWNER_ID === userId;
}

/**
 * Get audio quality settings for a user in a guild
 * Priority: Owner override > User Patreon > Guild Premium > Default (128kbps)
 */
export async function getAudioQuality(userId: string, guildId: string): Promise<AudioQualityInfo> {
  // Private bots play at the Hi-Fi tier for everyone: their owner pays for it.
  if (isLinked) return { bitrate: 320, qualityBadge: getQualityBadge(320), tier: getQualityTier(320), source: "linked" };
  const patreonService = PatreonService.getInstance();
  const premiumService = PremiumGuildService.getInstance();
  
  // Check if user is bot owner - owners get max quality
  if (isOwner(userId)) {
    const ownerBitrate = await patreonService.getAudioBitrate(userId);
    // If owner has a custom bitrate set, use it; otherwise default to 320
    const bitrate = ownerBitrate > 128 ? ownerBitrate : 320;
    return {
      bitrate,
      qualityBadge: getQualityBadge(bitrate),
      tier: getQualityTier(bitrate),
      source: "owner"
    };
  }

  // Get user's personal bitrate (from Patreon or /setbitrate)
  const userBitrate = await patreonService.getAudioBitrate(userId);
  
  // Get guild's premium bitrate
  const guildBitrate = await premiumService.getGuildBitrate(guildId);
  
  // Use the higher of user or guild bitrate
  let bitrate: number;
  let source: "user" | "guild" | "default";
  
  if (userBitrate > 128 && userBitrate >= guildBitrate) {
    bitrate = userBitrate;
    source = "user";
  } else if (guildBitrate > 128) {
    bitrate = guildBitrate;
    source = "guild";
  } else if ((await hasActiveVote(userId)) || (await isSupportBooster(userId))) {
    // Vote perk (12 hours) or support-server boost: studio quality
    bitrate = 320;
    source = "user";
  } else {
    bitrate = 128;
    source = "default";
  }

  return {
    bitrate,
    qualityBadge: getQualityBadge(bitrate),
    tier: getQualityTier(bitrate),
    source
  };
}

/**
 * Get bot identity/branding for a guild
 */
export async function getBotIdentity(guildId: string): Promise<BotIdentityInfo> {
  if (isLinked) return { name: INSTANCE_NAME, displayName: INSTANCE_NAME, isCustom: true };
  const premiumService = PremiumGuildService.getInstance();
  const customBotName = await premiumService.getGuildBotName(guildId);
  
  if (!customBotName) {
    return {
      name: "bypass",
      displayName: "Bypass",
      isCustom: false
    };
  }
  
  // Handle special identity names
  if (customBotName === "indie") {
    return {
      name: "indie",
      displayName: "🎸 Indie Music Bot",
      isCustom: true
    };
  }
  
  return {
    name: customBotName,
    displayName: customBotName,
    isCustom: true
  };
}

/**
 * Get combined audio settings for playback
 * This is the main function to use in play commands
 */
export async function getPlaybackSettings(userId: string, guildId: string): Promise<{
  quality: AudioQualityInfo;
  identity: BotIdentityInfo;
}> {
  const [quality, identity] = await Promise.all([
    getAudioQuality(userId, guildId),
    getBotIdentity(guildId)
  ]);
  
  return { quality, identity };
}
