import { Schema, model } from "mongoose";
import type { IBotEventRecord } from "../shared/types";

/**
 * Bot telemetry events — one document per command execution, track lifecycle
 * event, guild join/leave, or error. Read by the dashboard admin console.
 *
 * Retention: TTL index on `ts`. To change BOT_EVENTS_TTL_DAYS after the index
 * exists, drop the `ts_1` index once (`db.botevents.dropIndex("ts_1")`) so
 * mongoose can recreate it with the new value.
 */
const TTL_DAYS = Math.max(1, Number(process.env.BOT_EVENTS_TTL_DAYS) || 90);

const botEventSchema = new Schema<IBotEventRecord>(
  {
    kind: { type: String, required: true, enum: ["command", "track", "guild", "error"] },
    ts: { type: Date, required: true, default: Date.now },
    guildId: String,
    // command
    userId: String,
    command: String,
    subcommand: String,
    ok: Boolean,
    durationMs: Number,
    error: String,
    // track / guild
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
    // error
    scope: String,
    message: String,
    stack: String,
    track: String
  },
  { versionKey: false, minimize: true }
);

botEventSchema.index({ kind: 1, ts: -1 });
botEventSchema.index({ guildId: 1, ts: -1 });
botEventSchema.index({ ts: 1 }, { expireAfterSeconds: TTL_DAYS * 86400 });

export const BotEvent = model<IBotEventRecord>("BotEvent", botEventSchema);
export default BotEvent;
