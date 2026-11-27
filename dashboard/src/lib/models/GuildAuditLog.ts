import { Schema, model, models } from "mongoose";

/** Server-level changes made from the dashboard: settings, permissions, bot bindings. */
export type GuildAuditAction = "settings.update" | "permissions.update" | "bindings.update" | (string & {});

export interface IGuildAuditLog {
  guildId: string;
  ts: Date;
  userId: string;
  username: string;
  action: GuildAuditAction;
  summary: string;
}

export const GUILD_AUDIT_TTL_SECONDS = 180 * 24 * 60 * 60;

const guildAuditLogSchema = new Schema<IGuildAuditLog>(
  {
    guildId: { type: String, required: true },
    ts: { type: Date, required: true, default: Date.now },
    userId: { type: String, required: true },
    username: { type: String, default: "" },
    action: { type: String, required: true },
    summary: { type: String, default: "" }
  },
  { versionKey: false, collection: "guildauditlogs" }
);

guildAuditLogSchema.index({ guildId: 1, ts: -1 });
guildAuditLogSchema.index({ ts: 1 }, { expireAfterSeconds: GUILD_AUDIT_TTL_SECONDS });

export const GuildAuditLog = models.GuildAuditLog || model<IGuildAuditLog>("GuildAuditLog", guildAuditLogSchema);
export default GuildAuditLog;
