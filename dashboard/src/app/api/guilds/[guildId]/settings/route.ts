import { isSameOrigin } from "@/lib/admin/guards";
import { getGuildAccess, requireGroup } from "@/lib/guild-access";
import { applySettingsPatch, settingsDocument } from "@/lib/guild-settings";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Every bot setting for this server (settings group). */
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  const denied = requireGroup(access, "settings");
  if (denied) return denied;
  return NextResponse.json(settingsDocument(access));
}

/**
 * Change some settings (settings group). Body: `{ field: value }`; each field
 * is validated, read-only fields are refused, counters are never written.
 * The bot drops its cached copy right away (Redis `bypass:settings`).
 */
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
    const outcome = await applySettingsPatch(access, body, { strict: true });
    if (!outcome.ok) return NextResponse.json({ error: "Invalid settings", fields: outcome.errors }, { status: 400 });
    return NextResponse.json({ ok: true, settings: outcome.settings });
  } catch (error) {
    console.error("[settings] Update failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
