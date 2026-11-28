import { model, models, Schema } from "mongoose";
import { FEEDBACK_CONTACT_MAX, FEEDBACK_KINDS, FEEDBACK_MESSAGE_MAX, type FeedbackRecord } from "../shared/growth";

/**
 * One piece of feedback (collection `feedbacks`): an idea, bug, praise or
 * NPS answer from the website, the dashboard or the bot's /feedback modal.
 * Written by the bot (/feedback) and by the dashboard (POST /api/public/feedback),
 * read by the owner console's Feedback panel. Kept forever: no TTL.
 * The dashboard defines the same schema in dashboard/src/lib/models/Feedback.ts.
 */
const feedbackSchema = new Schema<FeedbackRecord>(
  {
    kind: { type: String, required: true, enum: [...FEEDBACK_KINDS] },
    source: { type: String, required: true, enum: ["site", "dashboard", "bot"] },
    message: { type: String, default: "", maxlength: FEEDBACK_MESSAGE_MAX },
    score: { type: Number, min: 0, max: 10 },
    contact: { type: String, maxlength: FEEDBACK_CONTACT_MAX },
    quoteOk: Boolean,
    userId: String,
    userName: String,
    guildId: String,
    context: String,
    locale: String,
    country: String,
    status: { type: String, required: true, enum: ["new", "read", "done"], default: "new" },
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { versionKey: false, minimize: true, collection: "feedbacks" }
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ kind: 1, createdAt: -1 });
feedbackSchema.index({ status: 1 });

export const Feedback = models.Feedback || model<FeedbackRecord>("Feedback", feedbackSchema);
export default Feedback;
