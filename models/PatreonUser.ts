import mongoose, { Document, Schema } from "mongoose";
import type { IPatreonUser as IPatreonUserBase, PatronStatus } from "../shared/types";

/**
 * PatreonUser interface - Extends shared interface with bot-specific fields
 */
export interface IPatreonUser extends Document, IPatreonUserBase {
  // OAuth tokens (bot-specific, not in dashboard)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

const PatreonUserSchema = new Schema<IPatreonUser>(
  {
    discordId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    patreonId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: String,
    fullName: String,
    
    // Membership details
    tierId: String,
    tierTitle: String,
    patronStatus: {
      type: String,
      enum: ["active_patron", "declined_patron", "former_patron", "not_patron"],
      default: "not_patron",
    },
    
    // Pledge info
    pledgeAmountCents: {
      type: Number,
      default: 0,
    },
    lifetimeSupportCents: {
      type: Number,
      default: 0,
    },
    lastChargeDate: Date,
    lastChargeStatus: String,
    
    // OAuth tokens
    accessToken: String,
    refreshToken: String,
    tokenExpiresAt: Date,
    
    // Premium features
    isPremium: {
      type: Boolean,
      default: false,
    },
    isFounder: {
      type: Boolean,
      default: false,
    },
    
    // Audio quality settings
    audioBitrate: {
      type: Number,
      default: 128, // Default 128kbps for free users
    },
    customBotName: {
      type: String,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups
PatreonUserSchema.index({ patronStatus: 1 });
PatreonUserSchema.index({ isPremium: 1 });

export const PatreonUser = mongoose.model<IPatreonUser>("PatreonUser", PatreonUserSchema);
