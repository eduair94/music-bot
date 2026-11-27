import mongoose, { Model, Schema } from "mongoose";
import { LINK_PROVIDERS, LINKED_ACCOUNTS_COLLECTION, type LinkedAccountDoc } from "../../../../shared/linkedAccounts";

/**
 * A connected Spotify or YouTube account (shared/linkedAccounts.ts). The
 * dashboard writes it at the end of the OAuth flow (/api/connect/<p>/callback);
 * the bot reads it to play the user's own playlists and refreshes the access
 * token in place. Tokens are stored encrypted and never leave the server.
 */
export type ILinkedAccount = LinkedAccountDoc;

const linkedAccountSchema = new Schema<ILinkedAccount>(
  {
    userId: { type: String, required: true },
    provider: { type: String, enum: [...LINK_PROVIDERS], required: true },
    providerUserId: { type: String, required: true },
    displayName: { type: String, required: true },
    avatarUrl: { type: String },
    scopes: { type: [String], default: [] },
    // Encrypted, and still left out of queries unless asked for ("+accessToken").
    accessToken: { type: String, required: true, select: false },
    refreshToken: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: LINKED_ACCOUNTS_COLLECTION },
);

// One account per provider per Discord user.
linkedAccountSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const LinkedAccount: Model<ILinkedAccount> =
  (mongoose.models.LinkedAccount as Model<ILinkedAccount>) || mongoose.model<ILinkedAccount>("LinkedAccount", linkedAccountSchema);

export default LinkedAccount;
