import { Schema, model, models } from "mongoose";
import type { IGuildSettings } from "../../../../shared/types";

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
      default: []
    },
    allowedTextChannels: { 
      type: [String], 
      default: []
    },
    logChannelId: {
      type: String,
      default: null
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
      max: 200 
    },
    maxQueueSize: { 
      type: Number, 
      default: 100, 
      min: 1, 
      max: 1000 
    },
    maxSongDuration: { 
      type: Number, 
      default: 0
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
      default: 300, 
      min: 30 
    },
    preventDuplicates: { 
      type: Boolean, 
      default: false 
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
      analytics: { type: Boolean, default: false },
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
    },
  },
  {
    timestamps: true,
  }
);

export const GuildSettingsModel = models.GuildSettings || model<IGuildSettings>("GuildSettings", guildSettingsSchema);
