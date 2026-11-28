import mongoose, { Schema } from "mongoose";
import {
  FEEDBACK_ATTRIBUTION_MAX,
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackRecord,
} from "../../../../shared/growth";

export type { FeedbackRecord };

/**
 * Feedback from the site, the dashboard and the bot's /feedback modal
 * (collection `feedbacks`, shared with the bot's models/Feedback.ts, same
 * schema and indexes). Written by POST /api/public/feedback, read and
 * triaged by the owner console. No TTL.
 */
const feedbackSchema = new Schema<FeedbackRecord>(
  {
    kind: { type: String, required: true, enum: [...FEEDBACK_KINDS] },
    source: { type: String, required: true, enum: ["site", "dashboard", "bot"] },
    message: { type: String, default: "", maxlength: FEEDBACK_MESSAGE_MAX },
    score: { type: Number, min: 0, max: 10 },
    contact: { type: String, maxlength: FEEDBACK_CONTACT_MAX },
    quoteOk: Boolean,
    featured: Boolean,
    featuredAt: Date,
    quoteAttribution: { type: String, maxlength: FEEDBACK_ATTRIBUTION_MAX },
    userId: String,
    userName: String,
    guildId: String,
    context: String,
    locale: String,
    country: String,
    status: { type: String, required: true, enum: ["new", "read", "done"], default: "new" },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false, minimize: true, collection: "feedbacks" }
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ kind: 1, createdAt: -1 });
feedbackSchema.index({ status: 1 });
// Landing testimonials: featured items newest first. Partial, so it only holds the few featured docs.
feedbackSchema.index({ featured: 1, createdAt: -1 }, { partialFilterExpression: { featured: true } });

export const Feedback =
  (mongoose.models.Feedback as mongoose.Model<FeedbackRecord> | undefined) ??
  mongoose.model<FeedbackRecord>("Feedback", feedbackSchema);

export default Feedback;
