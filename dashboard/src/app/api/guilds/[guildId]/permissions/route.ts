import { isSameOrigin } from "@/lib/admin/guards";
import { getGuildAccess, requireGroup } from "@/lib/guild-access";
import { savePermissionConfig } from "@/lib/guild-settings";
import { NextResponse } from "next/server";
import { parsePermissionConfig } from "../../../../../../../shared/permissions";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** The rules in force (saved, or derived from the legacy DJ role). Readable by any member. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  return NextResponse.json(access.config);
}

/** Replace the rules (settings group). Body: a complete PermissionConfig. */
export async function PUT(request: Request, { params }: RouteContext) {
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
  const parsed = parsePermissionConfig(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, path: parsed.path }, { status: 400 });

  try {
    await savePermissionConfig(access, parsed.config);
    return NextResponse.json({ ok: true, config: parsed.config });
  } catch (error) {
    console.error("[permissions] Save failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
