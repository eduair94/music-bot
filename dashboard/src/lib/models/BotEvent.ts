import { Schema, model, models } from "mongoose";
import type { IBotEventRecord } from "../../../../shared/types";

export type { IBotEventRecord };

// Read model. The bot owns index creation (including the TTL index), so the
// dashboard must not try to (re)create indexes with possibly different options.
const botEventSchema = new Schema<IBotEventRecord>(
  {
    kind: { type: String, required: true },
    ts: { type: Date, required: true },
    guildId: String,
    userId: String,
    command: String,
    subcommand: String,
    ok: Boolean,
    durationMs: Number,
    error: String,
    event: String,
    title: String,
    author: String,
    url: String,
    source: String,
    trackDurationMs: Number,
    requestedById: String,
    reason: String,
    name: String,
    memberCount: Number,
    scope: String,
    message: String,
    stack: String,
    track: String
  },
  { versionKey: false, autoIndex: false, collection: "botevents" }
);

export const BotEventModel = models.BotEvent || model<IBotEventRecord>("BotEvent", botEventSchema);
export default BotEventModel;
