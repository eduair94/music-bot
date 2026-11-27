import { isSameOrigin } from "@/lib/admin/guards";
import { getGuildAccess, requireGroup } from "@/lib/guild-access";
import { applySettingsPatch } from "@/lib/guild-settings";
import { NextResponse } from "next/server";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/**
 * Legacy settings endpoint (the v1 settings form). Kept working until the
 * new UI ships; new code uses /settings. Both need the "settings" group.
 */

// GET guild settings
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  const denied = requireGroup(access, "settings");
  if (denied) return denied;

  if (!access.settings) return NextResponse.json({ guildId, exists: false });
  return NextResponse.json(access.settings);
}

// PATCH update guild settings: partial and validated. The form posts the
// whole document; read-only fields (counters, premium, ids) are ignored and
// only changed values are written.
export async function PATCH(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  const denied = requireGroup(access, "settings");
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const outcome = await applySettingsPatch(access, body, { strict: false });
    if (!outcome.ok) return NextResponse.json({ error: "Invalid settings", fields: outcome.errors }, { status: 400 });
    return NextResponse.json(outcome.settings);
  } catch (error) {
    console.error("Error updating guild settings:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
