import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { enqueueAndWait } from "@/lib/bot-commands";
import type { ActionResult } from "@/types/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const gate = await requireOwnerAction(request);
  if (!gate.ok) return gate.response;
  const meta = requestMeta(request);
  const actor = { actorId: gate.owner.discordId, actorName: gate.owner.name };
  try {
    const outcome = await enqueueAndWait({
      type: "admin_resync",
      requestedBy: { id: gate.owner.discordId, username: gate.owner.name }
    });
    const ok = outcome.status !== "failed";
    await writeAudit({
      ...actor,
      action: "bot.resync",
      ok,
      result: outcome.result ?? outcome.status,
      error: outcome.error,
      ...meta
    });
    if (!ok) return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, 400);
    return adminJson({
      ok: true,
      result: outcome.status === "pending" ? "Queued (bot did not answer in 5 s)" : outcome.result
    } satisfies ActionResult);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await writeAudit({ ...actor, action: "bot.resync", ok: false, error: message, ...meta });
    return adminJson({ ok: false, error: message } satisfies ActionResult, 500);
  }
}
