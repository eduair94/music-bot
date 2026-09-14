import { adminJson, requireOwnerAction } from "@/lib/admin-auth";
import { requestMeta, writeAudit } from "@/lib/admin/audit";
import { leaveGuild } from "@/lib/admin/discord-bot";
import { isSnowflake } from "@/lib/admin/guards";
import { getBotGuildData, removeBotGuild } from "@/lib/redis";
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
  if (!guild) return adminJson({ ok: false, error: "Bot is not in this server" } satisfies ActionResult, 404);

  const outcome = await leaveGuild(guildId);
  const meta = requestMeta(request);
  const actor = { actorId: gate.owner.discordId, actorName: gate.owner.name };
  if (outcome.ok) {
    await removeBotGuild(guildId).catch(() => undefined);
    await writeAudit({
      ...actor,
      action: "guild.leave",
      targetGuildId: guildId,
      targetName: guild.name,
      ok: true,
      result: "left",
      ...meta
    });
    return adminJson({ ok: true, result: `Left ${guild.name}` } satisfies ActionResult);
  }
  await writeAudit({
    ...actor,
    action: "guild.leave",
    targetGuildId: guildId,
    targetName: guild.name,
    ok: false,
    error: outcome.error,
    ...meta
  });
  return adminJson({ ok: false, error: outcome.error } satisfies ActionResult, outcome.status === 429 ? 429 : 502);
}
