import "server-only";
import type { GuildAccess } from "./guild-access";
import { GuildAuditLog, type GuildAuditAction, type IGuildAuditLog } from "./models/GuildAuditLog";

/** Record a dashboard change to a server (never throws: the change itself already happened). */
export async function writeGuildAudit(access: GuildAccess, action: GuildAuditAction, summary: string): Promise<void> {
  try {
    await GuildAuditLog.create({
      guildId: access.guildId,
      ts: new Date(),
      userId: access.userId,
      username: access.username,
      action,
      summary: summary.slice(0, 1000)
    });
  } catch (error) {
    console.error("[guild-audit] Could not record", action, "for", access.guildId, (error as Error)?.message ?? error);
  }
}

export async function listGuildAudit(guildId: string, limit: number) {
  const rows = (await GuildAuditLog.find({ guildId }).sort({ ts: -1 }).limit(limit).lean()) as unknown as IGuildAuditLog[];
  return rows.map((row) => ({
    ts: row.ts,
    userId: row.userId,
    username: row.username,
    action: row.action,
    summary: row.summary
  }));
}

/** "maxVolume 100 → 80, autoplay off → on" style summary of a settings change. */
export function summarizeChanges(before: Record<string, unknown> | null, updates: Record<string, unknown>): string {
  const show = (value: unknown): string => {
    if (value === null || value === undefined) return "none";
    if (typeof value === "boolean") return value ? "on" : "off";
    if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
    const text = String(value);
    return text.length > 40 ? `${text.slice(0, 39)}…` : text;
  };
  return Object.entries(updates)
    .map(([key, value]) => `${key} ${show(before?.[key])} → ${show(value)}`)
    .join(", ");
}
