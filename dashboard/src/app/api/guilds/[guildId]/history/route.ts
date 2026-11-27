import { parseLimit } from "@/lib/activity-shape";
import { guildHistory } from "@/lib/guild-activity";
import { getGuildAccess } from "@/lib/guild-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Songs that played here lately, newest first. `?limit=` 1-100, default 50. */
export async function GET(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  const limit = parseLimit(new URL(request.url).searchParams.get("limit"), 50, 100);
  try {
    return NextResponse.json({ items: await guildHistory(guildId, limit) });
  } catch (error) {
    console.error("[history] Read failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
