import { fleetInstances, guildSummary, isPremiumGuild, requireGuildMember } from "@/lib/fleet";
import { NextResponse } from "next/server";
import { FLEET_FREE_INSTANCES, FLEET_MAX_INSTANCES } from "../../../../../../../shared/fleet";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/**
 * GET /api/guilds/[guildId]/fleet — every Bypass instance that exists: in
 * this server or not (invite link), online, what it plays where, its channel
 * binding. Any member of the server may read it.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const access = await requireGuildMember(guildId);
  if (!access.ok) return access.response;

  try {
    const [instances, premiumActive] = await Promise.all([fleetInstances(guildId), isPremiumGuild(guildId).catch(() => false)]);
    return NextResponse.json({
      guild: guildSummary(access.guild),
      instances,
      limits: { free: FLEET_FREE_INSTANCES, max: FLEET_MAX_INSTANCES, premiumActive }
    });
  } catch (error) {
    console.error("[fleet] GET failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
