import mongoose, { Document, Schema } from "mongoose";

/**
 * PatreonUser interface - Links Discord users to their Patreon membership
 */
export interface IPatreonUser extends Document {
  discordId: string;
  patreonId: string;
  email?: string;
  fullName?: string;
  
  // Membership details
  tierId?: string;
  tierTitle?: string;
  patronStatus: "active_patron" | "declined_patron" | "former_patron" | "not_patron";
  
  // Pledge info
  pledgeAmountCents: number;
  lifetimeSupportCents: number;
  lastChargeDate?: Date;
  lastChargeStatus?: string;
  
  // OAuth tokens (for user-initiated linking)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Premium features enabled
  isPremium: boolean;
  isFounder: boolean;
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
  },
  {
    timestamps: true,
  }
);

// Index for quick lookups
PatreonUserSchema.index({ patronStatus: 1 });
PatreonUserSchema.index({ isPremium: 1 });

export const PatreonUser = mongoose.model<IPatreonUser>("PatreonUser", PatreonUserSchema);
