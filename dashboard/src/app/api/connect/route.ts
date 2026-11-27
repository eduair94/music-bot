import { auth } from "@/auth";
import { listConnections } from "@/lib/connections";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/connect
 * The signed-in user's connected music accounts, one row per provider:
 * [{ provider, label, available, connected, displayName?, avatarUrl?, connectedAt? }].
 * Tokens never leave the server.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.discordId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await listConnections(userId);
    return NextResponse.json(connections, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[connect] list failed:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
