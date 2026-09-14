import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { isSnowflake } from "@/lib/admin/guards";
import { enqueueAndWait } from "@/lib/bot-commands";
import { getBotGuildData } from "@/lib/redis";
import type { ActionResult } from "@/types/admin";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

export async function POST(request: Request, { params }: RouteContext) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;
  const { guildId } = await params;
  if (!isSnowflake(guildId)) return adminJson({ ok: false, error: "Invalid guild id" } satisfies ActionResult, 400);

  const guild = await getBotGuildData(guildId);
  const meta = requestMeta(request);
  const actor = { actorId: gate.owner.discordId, actorName: gate.owner.name };
  try {
    const outcome = await enqueueAndWait({
      guildId,
      command: "stop",
      params: {},
      userId: gate.owner.discordId,
      requestedBy: { id: gate.owner.discordId, username: gate.owner.name }
    });
    const ok = outcome.status !== "failed";
    await writeAudit({
      ...actor,
      action: "guild.stop",
      targetGuildId: guildId,
      targetName: guild?.name,
      ok,
      result: outcome.result ?? outcome.status,
      error: outcome.error,
      ...meta
    });
    if (!ok) return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, 400);
    return adminJson({
      ok: true,
      result: outcome.status === "pending" ? "Queued (bot busy)" : outcome.result || "Stopped"
    } satisfies ActionResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeAudit({
      ...actor,
      action: "guild.stop",
      targetGuildId: guildId,
      targetName: guild?.name,
      ok: false,
      error: message,
      ...meta
    });
    return adminJson({ ok: false, error: message } satisfies ActionResult, 500);
  }
}
