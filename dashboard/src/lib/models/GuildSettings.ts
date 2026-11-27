import { Schema, model, models } from "mongoose";
import type { IGuildSettings } from "../../../../shared/types";

/**
 * Mirror of the bot's schema (models/GuildSettings.ts). Every field the bot
 * stores must be declared here too: mongoose drops undeclared paths on
 * writes, which used to erase vote-skip, autoplay, 24/7, blacklists and
 * disabled commands whenever the dashboard saved. Ranges match the bot.
 */
const guildSettingsSchema = new Schema<IGuildSettings>(
  {
    guildId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // Channel Restrictions
    allowedVoiceChannels: { type: [String], default: [] },
    allowedTextChannels: { type: [String], default: [] },
    logChannelId: { type: String, default: null },

    // Role Permissions
    djRoleId: { type: String, default: null },
    adminRoleId: { type: String, default: null },

    // Playback Settings
    defaultVolume: { type: Number, default: 80, min: 0, max: 100 },
    maxVolume: { type: Number, default: 100, min: 0, max: 100 },
    maxQueueSize: { type: Number, default: 100, min: 1, max: 1000 },
    maxSongDuration: { type: Number, default: 0, min: 0 },

    // Behavior Settings
    announceNowPlaying: { type: Boolean, default: true },
    autoLeaveEmpty: { type: Boolean, default: true },
    autoLeaveTimeout: { type: Number, default: 300, min: 30, max: 3600 },
    preventDuplicates: { type: Boolean, default: false },
    voteSkipPercentage: { type: Number, default: 50, min: 0, max: 100 },
    autoplay: { type: Boolean, default: false },
    stay247: {
      enabled: { type: Boolean, default: false },
      voiceChannelId: { type: String, default: null },
      textChannelId: { type: String, default: null },
      enabledBy: { type: String, default: null },
      enabledAt: { type: Date, default: null }
    },

    // Premium Features
    premium: {
      enabled: { type: Boolean, default: false },
      tier: {
        type: String,
        enum: ["free", "basic", "pro", "enterprise"],
        default: "free"
      },
      expiresAt: { type: Date, default: null },
      maxConcurrentListeners: { type: Number, default: 0 },
      customBranding: { type: Boolean, default: false },
      prioritySupport: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false }
    },

    // Blacklist
    blacklistedUsers: { type: [String], default: [] },
    blacklistedSongs: { type: [String], default: [] },
    blacklistedAuthors: { type: [String], default: [] },
    blacklistedTitles: { type: [String], default: [] },
    disabledCommands: { type: [String], default: [] },
    permissions: { type: Object, default: {} },
    // Rule per action group (shared/permissions.ts); null = derived from djRoleId.
    permissionConfig: { type: Schema.Types.Mixed, default: null },
    prefixes: { type: [String], default: ["!"] },
    mappings: { type: Object, default: {} },

    // Customization
    language: { type: String, default: "auto" },
    embedColor: { type: String, default: "#F8AA2A" },

    // Analytics (written by the bot only)
    totalSongsPlayed: { type: Number, default: 0 },
    totalPlaytime: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

export const GuildSettingsModel = models.GuildSettings || model<IGuildSettings>("GuildSettings", guildSettingsSchema);
