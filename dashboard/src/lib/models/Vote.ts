import mongoose, { Schema } from "mongoose";

/**
 * A vote on a bot listing site (same `votes` collection the bot reads to
 * grant 12-hour vote perks). Written by /api/webhooks/vote/[site].
 */
export interface IVote {
  userId: string;
  site: string;
  votedAt: Date;
  perksUntil: Date;
  isWeekend?: boolean;
}

const voteSchema = new Schema<IVote>(
  {
    userId: { type: String, required: true, index: true },
    site: { type: String, required: true },
    votedAt: { type: Date, required: true },
    perksUntil: { type: Date, required: true },
    isWeekend: { type: Boolean, default: false },
  },
  { timestamps: false, collection: "votes" }
);

voteSchema.index({ userId: 1, perksUntil: -1 });
voteSchema.index({ perksUntil: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Vote = mongoose.models.Vote || mongoose.model<IVote>("Vote", voteSchema);

export default Vote;
