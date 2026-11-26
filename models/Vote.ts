import { model, models, Schema } from "mongoose";

/**
 * One vote on a bot listing site. Written by the dashboard's vote webhook
 * (`/api/webhooks/vote/[site]`), read by the bot to grant vote perks.
 * Documents expire 30 days after the perks do.
 */
export interface IVote {
  userId: string;
  site: string;
  votedAt: Date;
  /** Perks last until this moment (12 h after the vote on most sites). */
  perksUntil: Date;
  isWeekend?: boolean;
}

const voteSchema = new Schema<IVote>(
  {
    userId: { type: String, required: true, index: true },
    site: { type: String, required: true },
    votedAt: { type: Date, required: true },
    perksUntil: { type: Date, required: true },
    isWeekend: { type: Boolean, default: false }
  },
  { timestamps: false, collection: "votes" }
);

voteSchema.index({ userId: 1, perksUntil: -1 });
voteSchema.index({ perksUntil: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Vote = models.Vote || model<IVote>("Vote", voteSchema);
