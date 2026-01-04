import { Document, Schema, Types, model } from "mongoose";
import type { ILinkedBot as ILinkedBotBase, LinkedBotStatus } from "../shared/types";

// Re-export shared types for backwards compatibility
export type BotStatus = LinkedBotStatus;

/**
 * LinkedBot Interface
 * 
 * Extends the shared interface with Mongoose-specific fields.
 */
export interface ILinkedBot extends ILinkedBotBase {
  _id?: Types.ObjectId;
}

// Document type for Mongoose
export type LinkedBotDocument = ILinkedBot & Document;

// Schema
const linkedBotSchema = new Schema<ILinkedBot>(
  {
    // Owner
    ownerId: { 
      type: String, 
      required: true, 
      index: true 
    },
    ownerUsername: { 
      type: String, 
      required: true 
    },
    
    // Bot info
    botId: { 
      type: String, 
      required: true, 
      unique: true,
      index: true 
    },
    botUsername: { 
      type: String, 
      required: true 
    },
    botAvatar: { 
      type: String, 
      default: null 
    },
    
    // Encrypted token
    encryptedToken: { 
      type: String, 
      required: true 
    },
    tokenIv: { 
      type: String, 
      required: true 
    },
    
    // Status
    status: {
      type: String,
      enum: ["offline", "starting", "online", "error", "stopped"],
      default: "offline",
    },
    lastStatusChange: { 
      type: Date, 
      default: Date.now 
    },
    lastError: { 
      type: String, 
      default: null 
    },
    
    // Process
    processId: { 
      type: String, 
      default: null 
    },
    
    // Configuration
    allowedGuilds: { 
      type: [String], 
      default: [] 
    },
    
    // Statistics
    totalGuilds: { 
      type: Number, 
      default: 0 
    },
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

// Compound index for efficient owner lookup
linkedBotSchema.index({ ownerId: 1, status: 1 });

// Export the model
export const LinkedBot = model<ILinkedBot>("LinkedBot", linkedBotSchema);
export default LinkedBot;
