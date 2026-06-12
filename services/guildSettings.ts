import { GuildSettings, IGuildSettings } from "../models/GuildSettings";
import { DatabaseService } from "./database";

/**
 * GuildSettingsService - Manages guild settings with caching
 * 
 * This service provides CRUD operations for guild settings
 * with an in-memory cache for fast access.
 */
export class GuildSettingsService {
  private static instance: GuildSettingsService;
  private cache: Map<string, IGuildSettings> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes cache

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): GuildSettingsService {
    if (!this.instance) {
      this.instance = new GuildSettingsService();
    }
    return this.instance;
  }

  /**
   * Get default settings for a guild
   */
  private getDefaultSettings(guildId: string): IGuildSettings {
    return {
      guildId,
      allowedVoiceChannels: [],
      allowedTextChannels: [],
      logChannelId: null,
      djRoleId: null,
      adminRoleId: null,
      defaultVolume: 80,
      maxVolume: 100,
      maxQueueSize: 100,
      maxSongDuration: 0,
      announceNowPlaying: true,
      autoLeaveEmpty: true,
      autoLeaveTimeout: 300,
      preventDuplicates: false,
      voteSkipPercentage: 50,
      premium: {
        enabled: false,
        tier: "free",
        expiresAt: null,
        maxConcurrentListeners: 0,
        customBranding: false,
        prioritySupport: false,
        analytics: false,
      },
      blacklistedUsers: [],
      blacklistedSongs: [],
      language: "en",
      embedColor: "#F8AA2A",
      totalSongsPlayed: 0,
      totalPlaytime: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get settings for a guild (from cache, database, or defaults)
   */
  public async getSettings(guildId: string): Promise<IGuildSettings> {
    // Check cache first
    const cached = this.cache.get(guildId);
    if (cached) {
      return cached;
    }

    // Check database if connected
    if (DatabaseService.getInstance().isConnected()) {
      try {
        let settings = await GuildSettings.findOne({ guildId }).lean<IGuildSettings>();
        
        if (!settings) {
          // Create new settings document
          const newSettings = new GuildSettings({ guildId });
          await newSettings.save();
          settings = newSettings.toObject() as unknown as IGuildSettings;
        }

        // Cache the settings
        this.cache.set(guildId, settings);
        
        // Set cache expiry
        setTimeout(() => {
          this.cache.delete(guildId);
        }, this.cacheTimeout);

        return settings;
      } catch (error) {
        console.error(`[GuildSettings] Error fetching settings for ${guildId}:`, error);
      }
    }

    // Return defaults if no database or error.
    // Cache briefly only — once the DB recovers, real settings must win.
    const defaults = this.getDefaultSettings(guildId);
    this.cache.set(guildId, defaults);
    setTimeout(() => {
      if (this.cache.get(guildId) === defaults) {
        this.cache.delete(guildId);
      }
    }, 30 * 1000);
    return defaults;
  }

  /**
   * Update settings for a guild
   */
  public async updateSettings(
    guildId: string, 
    updates: Partial<IGuildSettings>
  ): Promise<IGuildSettings | null> {
    // Remove fields that shouldn't be updated directly
    delete (updates as any).guildId;
    delete (updates as any).createdAt;
    delete (updates as any).updatedAt;

    if (DatabaseService.getInstance().isConnected()) {
      try {
        const settings = await GuildSettings.findOneAndUpdate(
          { guildId },
          { $set: updates },
          { new: true, upsert: true }
        ).lean();

        if (settings) {
          // Update cache
          this.cache.set(guildId, settings as IGuildSettings);
        }

        return settings as IGuildSettings;
      } catch (error) {
        console.error(`[GuildSettings] Error updating settings for ${guildId}:`, error);
        return null;
      }
    }

    // Update in-memory cache only if no database
    const cached = this.cache.get(guildId) || this.getDefaultSettings(guildId);
    const updated = { ...cached, ...updates, updatedAt: new Date() };
    this.cache.set(guildId, updated);
    return updated;
  }

  /**
   * Check if a voice channel is allowed
   */
  public async isVoiceChannelAllowed(guildId: string, channelId: string): Promise<boolean> {
    const settings = await this.getSettings(guildId);
    // Empty array = all channels allowed
    if (settings.allowedVoiceChannels.length === 0) return true;
    return settings.allowedVoiceChannels.includes(channelId);
  }

  /**
   * Check if a text channel is allowed
   */
  public async isTextChannelAllowed(guildId: string, channelId: string): Promise<boolean> {
    const settings = await this.getSettings(guildId);
    // Empty array = all channels allowed
    if (settings.allowedTextChannels.length === 0) return true;
    return settings.allowedTextChannels.includes(channelId);
  }

  /**
   * Get the log channel ID for a guild
   * Returns the configured log channel, or null if none set
   */
  public async getLogChannelId(guildId: string): Promise<string | null> {
    const settings = await this.getSettings(guildId);
    return settings.logChannelId;
  }

  /**
   * Check if a user is blacklisted
   */
  public async isUserBlacklisted(guildId: string, userId: string): Promise<boolean> {
    const settings = await this.getSettings(guildId);
    return settings.blacklistedUsers.includes(userId);
  }

  /**
   * Check if user has DJ role or is admin
   */
  public async hasDJPermission(
    guildId: string, 
    userRoles: string[], 
    isAdmin: boolean
  ): Promise<boolean> {
    if (isAdmin) return true;
    
    const settings = await this.getSettings(guildId);
    
    // No DJ role set = everyone can use DJ commands
    if (!settings.djRoleId) return true;
    
    return userRoles.includes(settings.djRoleId);
  }

  /**
   * Check if user can change settings (admin role or server admin)
   */
  public async canManageSettings(
    guildId: string, 
    userRoles: string[], 
    isServerAdmin: boolean
  ): Promise<boolean> {
    if (isServerAdmin) return true;
    
    const settings = await this.getSettings(guildId);
    
    // No admin role set = only server admins can manage
    if (!settings.adminRoleId) return false;
    
    return userRoles.includes(settings.adminRoleId);
  }

  /**
   * Check if guild has premium feature
   */
  public async hasPremiumFeature(
    guildId: string, 
    feature: keyof IGuildSettings["premium"]
  ): Promise<boolean> {
    const settings = await this.getSettings(guildId);
    
    // Check if premium is enabled and not expired
    if (!settings.premium.enabled) return false;
    
    if (settings.premium.expiresAt && new Date() > settings.premium.expiresAt) {
      // Premium expired - disable it
      await this.updateSettings(guildId, {
        premium: { ...settings.premium, enabled: false }
      });
      return false;
    }

    // Check the specific feature
    const featureValue = settings.premium[feature];
    if (typeof featureValue === "boolean") {
      return featureValue;
    }
    
    return settings.premium.enabled;
  }

  /**
   * Increment song played counter
   */
  public async incrementSongPlayed(guildId: string): Promise<void> {
    if (DatabaseService.getInstance().isConnected()) {
      try {
        await GuildSettings.updateOne(
          { guildId },
          { $inc: { totalSongsPlayed: 1 } }
        );
        
        // Update cache
        const cached = this.cache.get(guildId);
        if (cached) {
          cached.totalSongsPlayed++;
        }
      } catch (error) {
        console.error(`[GuildSettings] Error incrementing song count:`, error);
      }
    }
  }

  /**
   * Add playtime to analytics
   */
  public async addPlaytime(guildId: string, seconds: number): Promise<void> {
    if (DatabaseService.getInstance().isConnected()) {
      try {
        await GuildSettings.updateOne(
          { guildId },
          { $inc: { totalPlaytime: seconds } }
        );
        
        // Update cache
        const cached = this.cache.get(guildId);
        if (cached) {
          cached.totalPlaytime += seconds;
        }
      } catch (error) {
        console.error(`[GuildSettings] Error adding playtime:`, error);
      }
    }
  }

  /**
   * Reset all settings to default for a guild
   */
  public async resetSettings(guildId: string): Promise<IGuildSettings> {
    const defaults = this.getDefaultSettings(guildId);
    
    if (DatabaseService.getInstance().isConnected()) {
      try {
        // Delete existing and create new with defaults
        await GuildSettings.deleteOne({ guildId });
        const newSettings = new GuildSettings({ guildId });
        await newSettings.save();
        const settings = newSettings.toObject() as unknown as IGuildSettings;
        
        // Update cache
        this.cache.set(guildId, settings);
        return settings;
      } catch (error) {
        console.error(`[GuildSettings] Error resetting settings for ${guildId}:`, error);
      }
    }

    // Reset in-memory cache
    this.cache.set(guildId, defaults);
    return defaults;
  }

  /**
   * Clear cache for a guild
   */
  public clearCache(guildId?: string): void {
    if (guildId) {
      this.cache.delete(guildId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get all premium guilds (for admin purposes)
   */
  public async getPremiumGuilds(): Promise<IGuildSettings[]> {
    if (!DatabaseService.getInstance().isConnected()) {
      return [];
    }

    try {
      const guilds = await GuildSettings.find({
        "premium.enabled": true
      }).lean();
      return guilds as IGuildSettings[];
    } catch (error) {
      console.error("[GuildSettings] Error fetching premium guilds:", error);
      return [];
    }
  }
}

// Export singleton getter for convenience
export function useGuildSettings(): GuildSettingsService {
  return GuildSettingsService.getInstance();
}
