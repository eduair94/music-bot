import mongoose, { Document, Schema } from "mongoose";
import {
  type IPatreonUser as IPatreonUserBase,
  PREMIUM_TIERS,
  getMaxLinkedBots,
  getTierFromPledge
} from "../../../../shared/types";

/**
 * PatreonUser interface - Links Discord users to their Patreon membership
 */
export interface IPatreonUser extends Document, IPatreonUserBase {}

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

export const PatreonUserModel = mongoose.models.PatreonUser || mongoose.model<IPatreonUser>("PatreonUser", PatreonUserSchema);

// Re-export shared tier functions for backwards compatibility
export { getMaxLinkedBots as getLinkedBotLimit, getTierFromPledge as getUserTier };

// Legacy TIER_LIMITS format for backwards compatibility
export const TIER_LIMITS = {
  free: PREMIUM_TIERS.free.maxLinkedBots,
  basic: PREMIUM_TIERS.basic.maxLinkedBots,
  pro: PREMIUM_TIERS.pro.maxLinkedBots,
  enterprise: PREMIUM_TIERS.enterprise.maxLinkedBots,
};
