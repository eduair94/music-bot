import { Document, Schema, model, models } from "mongoose";

/**
 * PremiumGuild interface - Links Discord servers to Patreon users
 * Each Patreon supporter can link multiple servers based on their tier
 */
export interface IPremiumGuild extends Document {
  guildId: string;              // Discord server ID
  discordId: string;            // Discord user ID (Patreon supporter)
  patreonId?: string;           // Patreon user ID
  
  // Premium settings for this guild
  audioBitrate: number;         // Audio quality: 128, 192, 256, 320 kbps
  customBotName?: string;       // Custom bot identity for this server
  
  // Server info
  guildName?: string;           // Server name (for display)
  linkedAt: Date;               // When the server was linked
  lastUsed?: Date;              // Last time premium features were used
  
  // Status
  isActive: boolean;            // Whether premium is currently active
  expiresAt?: Date;             // When premium expires (if applicable)
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const PremiumGuildSchema = new Schema<IPremiumGuild>(
  {
    guildId: {
      type: String,
      required: true,
      index: true,
    },
    discordId: {
      type: String,
      required: true,
      index: true,
    },
    patreonId: String,
    
    // Premium settings
    audioBitrate: {
      type: Number,
      default: 320, // Premium servers get 320kbps by default
      enum: [128, 192, 256, 320],
    },
    customBotName: String,
    
    // Server info
    guildName: String,
    linkedAt: {
      type: Date,
      default: Date.now,
    },
    lastUsed: Date,
    
    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    expiresAt: Date,
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure one user can only link a server once
PremiumGuildSchema.index({ guildId: 1, discordId: 1 }, { unique: true });

export const PremiumGuild = models.PremiumGuild || model<IPremiumGuild>("PremiumGuild", PremiumGuildSchema);
