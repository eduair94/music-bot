import { Document, Schema, model } from "mongoose";

/**
 * Guild Settings Interface
 * 
 * Defines all customizable settings per Discord server.
 * These settings allow server admins to customize the bot behavior.
 */
export interface IGuildSettings {
  guildId: string;
  
  // Channel Restrictions
  allowedVoiceChannels: string[];      // Voice channels where bot can play
  allowedTextChannels: string[];       // Text channels where commands work
  logChannelId: string | null;         // Channel for bot logs (now playing, etc.)
  
  // Role Permissions
  djRoleId: string | null;             // DJ role that can use restricted commands
  adminRoleId: string | null;          // Admin role that can change settings
  
  // Playback Settings
  defaultVolume: number;               // Default volume (0-100)
  maxVolume: number;                   // Maximum allowed volume (0-100)
  maxQueueSize: number;                // Maximum songs in queue
  maxSongDuration: number;             // Maximum song duration in seconds (0 = unlimited)
  
  // Behavior Settings
  announceNowPlaying: boolean;         // Announce songs in text channel
  autoLeaveEmpty: boolean;             // Leave when channel is empty
  autoLeaveTimeout: number;            // Seconds before leaving empty channel
  preventDuplicates: boolean;          // Prevent duplicate songs in queue
  
  // Premium Features
  premium: {
    enabled: boolean;                  // Is premium enabled for this guild
    tier: "free" | "basic" | "pro" | "enterprise";
    expiresAt: Date | null;            // When premium expires (null = never)
    maxConcurrentListeners: number;    // Max listeners before queue (0 = unlimited)
    customBranding: boolean;           // Allow custom bot name/avatar
    prioritySupport: boolean;          // Priority support access
    analytics: boolean;                // Access to usage analytics
  };
  
  // Blacklist
  blacklistedUsers: string[];          // User IDs that can't use the bot
  blacklistedSongs: string[];          // Keywords/URLs that are blocked
  
  // Customization
  language: string;                    // Locale override for this guild
  embedColor: string;                  // Custom embed color (hex)
  
  // Analytics
  totalSongsPlayed: number;            // Total songs played in this guild
  totalPlaytime: number;               // Total playback time in seconds
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

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
