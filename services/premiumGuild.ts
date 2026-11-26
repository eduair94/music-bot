import { IPremiumGuild, PremiumGuild } from "../models/PremiumGuild";
import { config } from "../utils/config";
import { i18n } from "../utils/i18n";
import { DatabaseService } from "./database";
import { PatreonService } from "./patreon";

/**
 * PremiumGuildService - Manages server-based premium features
 * Links Discord servers to Patreon supporters based on their tier
 * Bot owner can bypass Patreon requirements for testing
 */
export class PremiumGuildService {
  private static instance: PremiumGuildService;
  
  // Max servers per Patreon tier
  private readonly MAX_SERVERS_BY_TIER = {
    free: 0,
    tier1: 1,      // $5-9.99: 1 server
    tier2: 3,      // $10-14.99: 3 servers
    tier3: 10,     // $15+: 10 servers
  };

  private constructor() {}

  public static getInstance(): PremiumGuildService {
    if (!this.instance) {
      this.instance = new PremiumGuildService();
    }
    return this.instance;
  }

  /**
   * Ensure database connection is available before operations
   * @throws Error if database is not connected and cannot reconnect
   */
  private async ensureDbConnection(): Promise<void> {
    const db = DatabaseService.getInstance();
    
    // Check if already connected
    if (db.isReady()) {
      return;
    }

    // Try to establish/re-establish connection
    const connected = await db.ensureConnection();
    if (!connected) {
      throw new Error("Database connection is not available. Please try again later.");
    }
  }

  /**
   * Check if user is the bot owner
   */
  private isOwner(discordId: string): boolean {
    return config.OWNER_ID === discordId;
  }

  /**
   * Get maximum servers allowed for a user based on their Patreon tier
   * Bot owner gets unlimited servers
   */
  public async getMaxServersForUser(discordId: string): Promise<number> {
    // Owner gets unlimited servers
    if (this.isOwner(discordId)) {
      return 999;
    }

    const patreonService = PatreonService.getInstance();
    const patron = await patreonService.getPatronByDiscordId(discordId);

    if (!patron || !patron.isPremium) {
      return this.MAX_SERVERS_BY_TIER.free;
    }

    const pledgeDollars = patron.pledgeAmountCents / 100;

    if (pledgeDollars >= 15) {
      return this.MAX_SERVERS_BY_TIER.tier3;
    } else if (pledgeDollars >= 10) {
      return this.MAX_SERVERS_BY_TIER.tier2;
    } else if (pledgeDollars >= 5) {
      return this.MAX_SERVERS_BY_TIER.tier1;
    }

    return this.MAX_SERVERS_BY_TIER.free;
  }

  /**
   * Get default bitrate for a Patreon tier
   */
  private getDefaultBitrateForTier(pledgeDollars: number): number {
    if (pledgeDollars >= 5) {
      return 320; // All tiers get 320kbps
    }
    return 128;
  }

  /**
   * Get default bot identity for a Patreon tier
   */
  private getDefaultIdentityForTier(pledgeDollars: number, tierTitle?: string): string | undefined {
    if (pledgeDollars >= 5 && pledgeDollars < 10) {
      return "indie"; // Tier 1: Indie identity
    } else if (pledgeDollars >= 10 && pledgeDollars < 15) {
      return tierTitle || "premium"; // Tier 2
    } else if (pledgeDollars >= 15) {
      return tierTitle || "founder"; // Tier 3+
    }
    return undefined;
  }

  /**
   * Link a server to a Patreon user
   * Bot owner bypasses Patreon membership check
   */
  public async linkServer(
    discordId: string,
    guildId: string,
    guildName?: string
  ): Promise<{ success: boolean; message: string; guild?: IPremiumGuild }> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();

      const patreonService = PatreonService.getInstance();
      const patron = await patreonService.getPatronByDiscordId(discordId);
      const isOwner = this.isOwner(discordId);

      // Check if user has Patreon membership (owner bypasses this check)
      if (!isOwner && (!patron || !patron.isPremium)) {
        return {
          success: false,
          message: `❌ ${i18n.__("premium.service.needMembership")}`,
        };
      }

      // Check max servers limit
      const maxServers = await this.getMaxServersForUser(discordId);
      const currentServers = await PremiumGuild.countDocuments({
        discordId,
        isActive: true,
      });

      if (currentServers >= maxServers) {
        return {
          success: false,
          message: `❌ ${i18n.__mf("premium.service.limitReached", {
            max: maxServers,
            tier: patron?.tierTitle || i18n.__("premium.service.patron"),
            current: currentServers
          })}`,
        };
      }

      // Check if server is already linked by this user
      const existing = await PremiumGuild.findOne({ guildId, discordId });
      if (existing) {
        return {
          success: false,
          message: `ℹ️ ${i18n.__("premium.service.alreadyLinkedYou")}`,
          guild: existing,
        };
      }
      // Check if server is linked by another user (owner can override)
      const otherLink = await PremiumGuild.findOne({ guildId, isActive: true });
      if (otherLink && !isOwner) {
        return {
          success: false,
          message: `❌ ${i18n.__("premium.service.alreadyLinkedOther")}`,
        };
      }

      // If owner is overriding, remove the old link
      if (otherLink && isOwner) {
        await PremiumGuild.deleteOne({ _id: otherLink._id });
        console.log(`[PremiumGuild] 🔄 Owner overriding existing link for guild ${guildId}`);
      }

      // Get default settings based on tier (owner gets max tier settings)
      const pledgeDollars = isOwner ? 100 : (patron?.pledgeAmountCents || 0) / 100;
      const defaultBitrate = this.getDefaultBitrateForTier(pledgeDollars);
      const defaultIdentity = isOwner ? "owner" : this.getDefaultIdentityForTier(pledgeDollars, patron?.tierTitle);

      // Create premium guild link
      const guild = await PremiumGuild.create({
        guildId,
        discordId,
        patreonId: patron?.patreonId || "owner",
        guildName,
        audioBitrate: defaultBitrate,
        customBotName: defaultIdentity,
        isActive: true,
        linkedAt: new Date(),
      });

      console.log(`[PremiumGuild] ✅ Linked server ${guildId} to user ${discordId} (${defaultBitrate}kbps)${isOwner ? " [OWNER]" : ""}`);

      return {
        success: true,
        message: `✅ **${i18n.__("premium.service.linked")}**\n\n` +
                 `🎵 **${i18n.__("premium.audioQuality")}:** ${defaultBitrate}kbps\n` +
                 `🎸 **${i18n.__("premium.botIdentity")}:** ${defaultIdentity === "indie" ? "Indie Music Bot" : defaultIdentity || "Premium"}\n` +
                 `📊 **${i18n.__("premium.service.servers")}:** ${currentServers + 1}/${isOwner ? "∞" : maxServers}\n\n` +
                 i18n.__("premium.service.linkedActive"),
        guild,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error linking server:", error);
      return {
        success: false,
        message: `❌ ${i18n.__mf("premium.service.linkError", { error: error instanceof Error ? error.message : i18n.__("common.unknownError") })}`,
      };
    }
  }

  /**
   * Unlink a server from a Patreon user
   */
  public async unlinkServer(
    discordId: string,
    guildId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();

      const guild = await PremiumGuild.findOne({ guildId, discordId });

      if (!guild) {
        return {
          success: false,
          message: `❌ ${i18n.__("premium.service.notLinked")}`,
        };
      }

      await PremiumGuild.deleteOne({ _id: guild._id });

      console.log(`[PremiumGuild] ✅ Unlinked server ${guildId} from user ${discordId}`);

      return {
        success: true,
        message: `✅ **${i18n.__("premium.service.unlinked")}**\n\n${i18n.__("premium.service.unlinkedBody")}`,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error unlinking server:", error);
      return {
        success: false,
        message: `❌ ${i18n.__mf("premium.service.unlinkError", { error: error instanceof Error ? error.message : i18n.__("common.unknownError") })}`,
      };
    }
  }

  /**
   * Get all servers linked to a user
   */
  public async getUserServers(discordId: string): Promise<IPremiumGuild[]> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();

      return await PremiumGuild.find({ discordId, isActive: true }).sort({ linkedAt: -1 });
    } catch (error) {
      console.error("[PremiumGuild] Error getting user servers:", error);
      return [];
    }
  }

  /**
   * Get premium guild settings for a server
   */
  public async getGuildSettings(guildId: string): Promise<IPremiumGuild | null> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();

      const guild = await PremiumGuild.findOne({ guildId, isActive: true });
      
      if (guild) {
        // Update last used timestamp
        guild.lastUsed = new Date();
        await guild.save();
      }
      
      return guild;
    } catch (error) {
      console.error("[PremiumGuild] Error getting guild settings:", error);
      return null;
    }
  }

  /**
   * Get audio bitrate for a guild (returns 128 for non-premium)
   */
  public async getGuildBitrate(guildId: string): Promise<number> {
    const guild = await this.getGuildSettings(guildId);
    return guild?.audioBitrate || 128; // Default to 128kbps for free servers
  }

  /**
   * Get custom bot name for a guild
   */
  public async getGuildBotName(guildId: string): Promise<string | undefined> {
    const guild = await this.getGuildSettings(guildId);
    return guild?.customBotName;
  }

  /**
   * Update guild premium settings
   */
  public async updateGuildSettings(
    guildId: string,
    discordId: string,
    settings: { audioBitrate?: number; customBotName?: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();

      const guild = await PremiumGuild.findOne({ guildId, discordId, isActive: true });

      if (!guild) {
        return {
          success: false,
          message: `❌ ${i18n.__("premium.service.notLinked")}`,
        };
      }

      if (settings.audioBitrate !== undefined) {
        if (![128, 192, 256, 320].includes(settings.audioBitrate)) {
          return {
            success: false,
            message: `❌ ${i18n.__("premium.service.invalidBitrate")}`,
          };
        }
        guild.audioBitrate = settings.audioBitrate;
      }

      if (settings.customBotName !== undefined) {
        guild.customBotName = settings.customBotName || undefined;
      }

      await guild.save();

      return {
        success: true,
        message: `✅ ${i18n.__("premium.service.updated")}`,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error updating guild settings:", error);
      return {
        success: false,
        message: `❌ ${i18n.__mf("premium.service.updateError", { error: error instanceof Error ? error.message : i18n.__("common.unknownError") })}`,
      };
    }
  }

  /**
   * Check if a server has premium features
   */
  public async isPremiumGuild(guildId: string): Promise<boolean> {
    try {
      // Ensure database connection is ready
      await this.ensureDbConnection();
      
      const guild = await this.getGuildSettings(guildId);
      return guild !== null && guild.isActive;
    } catch (error) {
      console.error("[PremiumGuild] Error checking premium status:", error);
      return false;
    }
  }
}

// Export singleton getter
export function usePremiumGuild(): PremiumGuildService {
  return PremiumGuildService.getInstance();
}
