import "server-only";
import type { AuditEntry } from "@/types/admin";
import { AdminAuditLog, IAdminAuditLog } from "../models/AdminAuditLog";
import { connectToDatabase } from "../mongodb";

/** Persist an owner action (success or failure). Never throws. */
export async function writeAudit(entry: Omit<IAdminAuditLog, "ts">): Promise<void> {
  try {
    await connectToDatabase();
    await AdminAuditLog.create({ ...entry, ts: new Date() });
  } catch (error) {
    console.error("[admin/audit] write failed:", error);
  }
}

export function requestMeta(request: Request): { ip?: string; userAgent?: string } {
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined;
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) || undefined;
  return { ip, userAgent };
}

export async function listAudit(limit = 50): Promise<AuditEntry[]> {
  await connectToDatabase();
  const rows = await AdminAuditLog.find({}).sort({ ts: -1 }).limit(limit).lean<IAdminAuditLog[]>();
  return rows.map((r) => ({
    ts: new Date(r.ts).toISOString(),
    actorId: r.actorId,
    actorName: r.actorName,
    action: r.action,
    targetGuildId: r.targetGuildId,
    targetName: r.targetName,
    ok: r.ok,
    result: r.result,
    error: r.error
  }));
}
