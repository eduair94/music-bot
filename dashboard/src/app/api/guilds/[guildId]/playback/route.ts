import { idlePlaybackState, readPlayback, requireGuildMember } from "@/lib/fleet";
import { NextResponse } from "next/server";
import { parseInstance } from "../../../../../../../shared/fleet";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/**
 * GET /api/guilds/[guildId]/playback?instance=n — one instance's playback
 * state (default instance 1); an idle state when it isn't connected.
 * Positions are measured at `positionAt`; clients interpolate.
 */
export async function GET(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const raw = new URL(request.url).searchParams.get("instance");
  const instance = raw === null ? 1 : parseInstance(raw);
  if (!instance) return NextResponse.json({ error: "instance must be 1-8" }, { status: 400 });

  const access = await requireGuildMember(guildId);
  if (!access.ok) return access.response;

  try {
    return NextResponse.json((await readPlayback(guildId, instance)) ?? idlePlaybackState(guildId, instance));
  } catch (error) {
    console.error("Error fetching playback state:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
