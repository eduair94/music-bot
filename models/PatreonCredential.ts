import mongoose, { Schema } from "mongoose";

/**
 * The Patreon creator's current OAuth token pair. A refresh rotates both
 * tokens, so they are kept here instead of being re-read from .env.
 */
export interface IPatreonCredential {
  key: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  seededFrom: string;
}

const PatreonCredentialSchema = new Schema<IPatreonCredential>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
    },
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: String,
    expiresAt: Date,
    seededFrom: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PatreonCredential = mongoose.model<IPatreonCredential>("PatreonCredential", PatreonCredentialSchema);
