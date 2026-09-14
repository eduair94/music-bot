import { Schema, model, models } from "mongoose";

export type AdminAction = "guild.leave" | "guild.stop" | "bot.resync";

export interface IAdminAuditLog {
  ts: Date;
  actorId: string;
  actorName: string;
  action: AdminAction;
  targetGuildId?: string;
  targetName?: string;
  ok: boolean;
  result?: string;
  error?: string;
  ip?: string;
  userAgent?: string;
}

// Audit trail of owner actions. No TTL: retained indefinitely.
const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    ts: { type: Date, required: true, default: Date.now },
    actorId: { type: String, required: true },
    actorName: { type: String, required: true },
    action: { type: String, required: true },
    targetGuildId: String,
    targetName: String,
    ok: { type: Boolean, required: true },
    result: String,
    error: String,
    ip: String,
    userAgent: String
  },
  { versionKey: false }
);
adminAuditLogSchema.index({ ts: -1 });

export const AdminAuditLog = models.AdminAuditLog || model<IAdminAuditLog>("AdminAuditLog", adminAuditLogSchema);
export default AdminAuditLog;
