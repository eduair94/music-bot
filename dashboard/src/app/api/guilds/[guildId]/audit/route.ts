import { parseLimit } from "@/lib/activity-shape";
import { getGuildAccess, requireGroup } from "@/lib/guild-access";
import { listGuildAudit } from "@/lib/guild-audit";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Recent dashboard changes to this server (settings group). `?limit=` 1-100, default 50. */
export async function GET(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  const denied = requireGroup(access, "settings");
  if (denied) return denied;

  const limit = parseLimit(new URL(request.url).searchParams.get("limit"), 50, 100);
  try {
    return NextResponse.json({ items: await listGuildAudit(guildId, limit) });
  } catch (error) {
    console.error("[audit] Read failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
