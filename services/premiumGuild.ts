import { IPremiumGuild, PremiumGuild } from "../models/PremiumGuild";
import { config } from "../utils/config";
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
      const patreonService = PatreonService.getInstance();
      const patron = await patreonService.getPatronByDiscordId(discordId);
      const isOwner = this.isOwner(discordId);

      // Check if user has Patreon membership (owner bypasses this check)
      if (!isOwner && (!patron || !patron.isPremium)) {
        return {
          success: false,
          message: "❌ You need an active Patreon membership to link servers.\n\n" +
                   "Support us on Patreon to unlock premium features!",
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
          message: `❌ You've reached your server limit (${maxServers} servers).\n\n` +
                   `Current tier: **${patron?.tierTitle || "Patron"}**\n` +
                   `Linked servers: **${currentServers}/${maxServers}**\n\n` +
                   `Upgrade your tier to link more servers!`,
        };
      }

      // Check if server is already linked by this user
      const existing = await PremiumGuild.findOne({ guildId, discordId });
      if (existing) {
        return {
          success: false,
          message: `ℹ️ This server is already linked to your account.`,
          guild: existing,
        };
      }
      // Check if server is linked by another user (owner can override)
      const otherLink = await PremiumGuild.findOne({ guildId, isActive: true });
      if (otherLink && !isOwner) {
        return {
          success: false,
          message: `❌ This server is already linked to another Patreon account.\n\n` +
                   `Only one Patreon account can have premium features active per server.`,
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
        message: `✅ **Server linked successfully!**\n\n` +
                 `🎵 **Audio Quality:** ${defaultBitrate}kbps\n` +
                 `🎸 **Bot Identity:** ${defaultIdentity === "indie" ? "Indie Music Bot" : defaultIdentity || "Premium"}\n` +
                 `📊 **Servers:** ${currentServers + 1}/${isOwner ? "∞" : maxServers}\n\n` +
                 `Premium features are now active in this server!`,
        guild,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error linking server:", error);
      return {
        success: false,
        message: `❌ Error linking server: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      const guild = await PremiumGuild.findOne({ guildId, discordId });

      if (!guild) {
        return {
          success: false,
          message: `❌ This server is not linked to your account.`,
        };
      }

      await PremiumGuild.deleteOne({ _id: guild._id });

      console.log(`[PremiumGuild] ✅ Unlinked server ${guildId} from user ${discordId}`);

      return {
        success: true,
        message: `✅ **Server unlinked successfully!**\n\n` +
                 `Premium features have been disabled for this server.\n` +
                 `You can link another server with your available slots.`,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error unlinking server:", error);
      return {
        success: false,
        message: `❌ Error unlinking server: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get all servers linked to a user
   */
  public async getUserServers(discordId: string): Promise<IPremiumGuild[]> {
    try {
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
      const guild = await PremiumGuild.findOne({ guildId, discordId, isActive: true });

      if (!guild) {
        return {
          success: false,
          message: `❌ This server is not linked to your account.`,
        };
      }

      if (settings.audioBitrate !== undefined) {
        if (![128, 192, 256, 320].includes(settings.audioBitrate)) {
          return {
            success: false,
            message: `❌ Invalid bitrate. Choose: 128, 192, 256, or 320 kbps`,
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
        message: `✅ Server settings updated successfully!`,
      };
    } catch (error) {
      console.error("[PremiumGuild] Error updating guild settings:", error);
      return {
        success: false,
        message: `❌ Error updating settings: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check if a server has premium features
   */
  public async isPremiumGuild(guildId: string): Promise<boolean> {
    const guild = await this.getGuildSettings(guildId);
    return guild !== null && guild.isActive;
  }
}

// Export singleton getter
export function usePremiumGuild(): PremiumGuildService {
  return PremiumGuildService.getInstance();
}
