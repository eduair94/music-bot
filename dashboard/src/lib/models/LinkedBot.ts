import mongoose, { Document, Schema } from 'mongoose';
import type { ILinkedBot as ILinkedBotBase, LinkedBotStatus } from '../../../../shared/types';

// Re-export shared types for backwards compatibility
export type BotStatus = LinkedBotStatus;

export interface ILinkedBot extends Document, ILinkedBotBase {
  _id: mongoose.Types.ObjectId;
}

const LinkedBotSchema = new Schema<ILinkedBot>(
  {
    ownerId: {
      type: String,
      required: true,
      index: true,
    },
    ownerUsername: {
      type: String,
      required: true,
    },
    botId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    botUsername: {
      type: String,
      required: true,
    },
    botAvatar: {
      type: String,
      default: null,
    },
    encryptedToken: {
      type: String,
      required: true,
      select: false, // Don't include in queries by default
    },
    tokenIv: {
      type: String,
      required: true,
      select: false, // Don't include in queries by default
    },
    status: {
      type: String,
      enum: ["offline", "starting", "online", "error", "stopped"],
      default: "offline",
    },
    lastStatusChange: {
      type: Date,
      default: Date.now,
    },
    lastError: {
      type: String,
      default: null,
    },
    processId: {
      type: String,
      default: null,
    },
    allowedGuilds: {
      type: [String],
      default: [],
    },
    totalGuilds: {
      type: Number,
      default: 0,
    },
    totalSongsPlayed: {
      type: Number,
      default: 0,
    },
    totalPlaytime: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for owner queries
LinkedBotSchema.index({ ownerId: 1, status: 1 });

export const LinkedBotModel = mongoose.models.LinkedBot || mongoose.model<ILinkedBot>("LinkedBot", LinkedBotSchema);
