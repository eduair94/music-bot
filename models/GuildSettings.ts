import { Document, Schema, model } from "mongoose";
import type { IGuildSettings as IGuildSettingsBase, GuildPremiumSettings, PremiumTier } from "../shared/types";

/**
 * Guild Settings Interface
 * 
 * Extends the shared interface with Mongoose Document type.
 */
export interface IGuildSettings extends IGuildSettingsBase {}
export interface IGuildSettingsDocument extends IGuildSettings, Document {}

const guildSettingsSchema = new Schema<IGuildSettings>(
  {
    guildId: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true 
    },
    
    // Channel Restrictions
    allowedVoiceChannels: { 
      type: [String], 
      default: [] // Empty = all channels allowed
    },
    allowedTextChannels: { 
      type: [String], 
      default: [] // Empty = all channels allowed
    },
    logChannelId: {
      type: String,
      default: null // null = try to find "bot-commands" channel, if not found don't log
    },
    
    // Role Permissions
    djRoleId: { 
      type: String, 
      default: null 
    },
    adminRoleId: { 
      type: String, 
      default: null 
    },
    
    // Playback Settings
    defaultVolume: { 
      type: Number, 
      default: 80, 
      min: 0, 
      max: 100 
    },
    maxVolume: { 
      type: Number, 
      default: 100, 
      min: 0, 
      max: 100 
    },
    maxQueueSize: { 
      type: Number, 
      default: 100, 
      min: 1, 
      max: 1000 
    },
    maxSongDuration: { 
      type: Number, 
      default: 0, // 0 = unlimited
      min: 0 
    },
    
    // Behavior Settings
    announceNowPlaying: { 
      type: Boolean, 
      default: true 
    },
    autoLeaveEmpty: { 
      type: Boolean, 
      default: true 
    },
    autoLeaveTimeout: { 
      type: Number, 
      default: 300, // 5 minutes
      min: 30, 
      max: 3600 
    },
    preventDuplicates: { 
      type: Boolean, 
      default: false 
    },
    
    // Premium Features
    premium: {
      enabled: { 
        type: Boolean, 
        default: false 
      },
      tier: { 
        type: String, 
        enum: ["free", "basic", "pro", "enterprise"], 
        default: "free" 
      },
      expiresAt: { 
        type: Date, 
        default: null 
      },
      maxConcurrentListeners: { 
        type: Number, 
        default: 0 // 0 = unlimited
      },
      customBranding: { 
        type: Boolean, 
        default: false 
      },
      prioritySupport: { 
        type: Boolean, 
        default: false 
      },
      analytics: { 
        type: Boolean, 
        default: false 
      }
    },
    
    // Blacklist
    blacklistedUsers: { 
      type: [String], 
      default: [] 
    },
    blacklistedSongs: { 
      type: [String], 
      default: [] 
    },
    
    // Customization
    language: { 
      type: String, 
      default: "en" 
    },
    embedColor: { 
      type: String, 
      default: "#F8AA2A" 
    },
    
    // Analytics
    totalSongsPlayed: { 
      type: Number, 
      default: 0 
    },
    totalPlaytime: { 
      type: Number, 
      default: 0 
    }
  },
  {
    timestamps: true, // Automatically manage createdAt and updatedAt
  }
);

// Indexes for faster queries
guildSettingsSchema.index({ "premium.enabled": 1, "premium.tier": 1 });
guildSettingsSchema.index({ "premium.expiresAt": 1 });

export const GuildSettings = model<IGuildSettings>("GuildSettings", guildSettingsSchema);
