import { fetchGuildChannels } from "@/lib/discord";
import { readBindings, requireGuildMember } from "@/lib/fleet";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { connectToDatabase } from "@/lib/mongodb";
import { publishGuildEvent } from "@/lib/redis";
import { NextResponse } from "next/server";
import { configuredInstances, parseInstance } from "../../../../../../../../shared/fleet";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

const SNOWFLAKE = /^\d{15,25}$/;
/** Discord channel types a bot can play in: voice and stage. */
const VOICE_TYPES = new Set([2, 13]);

/**
 * PUT /api/guilds/[guildId]/fleet/bindings — pin an instance to a voice
 * channel ("Bypass 2 serves #Gaming") or clear it with null. A channel is
 * bound to one instance at most. Body: { instance, voiceChannelId | null }.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const access = await requireGuildMember(guildId);
  if (!access.ok) return access.response;

  // TODO(merge): requireGroup(access, "settings")
  if (!access.canManage) {
    return NextResponse.json({ error: "Forbidden", reason: "You need Manage Server to change bindings", group: "settings" }, { status: 403 });
  }

  let body: { instance?: unknown; voiceChannelId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const instance = parseInstance(body.instance);
  if (!instance || !configuredInstances().some((m) => m.instance === instance)) {
    return NextResponse.json({ error: "Unknown instance" }, { status: 400 });
  }
  const voiceChannelId = body.voiceChannelId === null || body.voiceChannelId === undefined ? null : body.voiceChannelId;
  if (voiceChannelId !== null && (typeof voiceChannelId !== "string" || !SNOWFLAKE.test(voiceChannelId))) {
    return NextResponse.json({ error: "voiceChannelId must be a channel id or null" }, { status: 400 });
  }

  if (voiceChannelId) {
    // Best effort: when Discord answers, the channel must be a voice channel of this server.
    const channels = await fetchGuildChannels(guildId).catch(() => null);
    if (channels && !channels.some((c) => c.id === voiceChannelId && VOICE_TYPES.has(Number(c.type)))) {
      return NextResponse.json({ error: "Not a voice channel in this server" }, { status: 400 });
    }
  }

  try {
    await connectToDatabase();
    const current = await readBindings(guildId);
    const $set: Record<string, string> = {};
    const $unset: Record<string, ""> = {};
    for (const [key, value] of Object.entries(current)) {
      if (voiceChannelId && value === voiceChannelId && key !== String(instance)) $unset[`fleet.bindings.${key}`] = "";
    }
    if (voiceChannelId) $set[`fleet.bindings.${instance}`] = voiceChannelId;
    else $unset[`fleet.bindings.${instance}`] = "";

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    // strict: false — the dashboard schema doesn't declare `fleet` (the bot's does).
    await GuildSettingsModel.updateOne({ guildId }, update, { upsert: true, strict: false });

    // TODO(merge): audit entry ("bindings" change) once the audit log lands.
    await publishGuildEvent(guildId, { type: "settings", keys: ["fleet.bindings"] }).catch((error) =>
      console.warn("[fleet] Could not publish the bindings change:", error)
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fleet] PUT bindings failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
