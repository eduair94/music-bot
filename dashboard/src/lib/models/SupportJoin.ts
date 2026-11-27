import mongoose, { Schema } from "mongoose";

/**
 * One row per Discord user the dashboard tried to add to the support server
 * at sign-in (collection `supportjoins`). The row is written before the
 * attempt, so each user is added at most once: someone who leaves the
 * support server is not pulled back in at their next login.
 */
export type SupportJoinOutcome = "pending" | "joined" | "member" | "failed";

export interface ISupportJoin {
  discordId: string;
  /** joined = 201 from Discord, member = 204 (already in), failed = anything else. */
  outcome: SupportJoinOutcome;
  /** Discord's HTTP status for the PUT; 0 when it never answered (timeout, network). */
  httpStatus?: number;
  attemptedAt: Date;
  finishedAt?: Date;
}

const supportJoinSchema = new Schema<ISupportJoin>(
  {
    discordId: { type: String, required: true, unique: true },
    outcome: { type: String, required: true, enum: ["pending", "joined", "member", "failed"] },
    httpStatus: { type: Number },
    attemptedAt: { type: Date, required: true },
    finishedAt: { type: Date },
  },
  { collection: "supportjoins", versionKey: false }
);

export const SupportJoin =
  (mongoose.models.SupportJoin as mongoose.Model<ISupportJoin> | undefined) ??
  mongoose.model<ISupportJoin>("SupportJoin", supportJoinSchema);

export default SupportJoin;
