import { parseDays } from "@/lib/activity-shape";
import { guildActivity } from "@/lib/guild-activity";
import { getGuildAccess } from "@/lib/guild-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Plays, listening time, top tracks/requesters, hours, sources and skips. `?days=7|30` (default 7). */
export async function GET(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  const days = parseDays(new URL(request.url).searchParams.get("days"));
  try {
    return NextResponse.json(await guildActivity(guildId, days));
  } catch (error) {
    console.error("[activity] Aggregation failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
