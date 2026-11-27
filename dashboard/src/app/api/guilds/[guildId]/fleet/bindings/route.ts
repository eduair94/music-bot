import { isSameOrigin } from "@/lib/admin/guards";
import { fetchGuildChannels } from "@/lib/discord";
import { getGuildAccess, requireGroup } from "@/lib/guild-access";
import { writeGuildAudit } from "@/lib/guild-audit";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { connectToDatabase } from "@/lib/mongodb";
import { publishSettingsChanged } from "@/lib/settings-bus";
import { NextResponse } from "next/server";
import { configuredInstances, instanceName, parseInstance } from "../../../../../../../../shared/fleet";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

const SNOWFLAKE = /^\d{15,25}$/;
/** Discord channel types a bot can play in: voice and stage. */
const VOICE_TYPES = new Set([2, 13]);

/**
 * PUT /api/guilds/[guildId]/fleet/bindings — pin an instance to a voice
 * channel ("Bypass 2 serves #Gaming") or clear it with null (settings
 * group). A channel is bound to one instance at most. Body:
 * { instance, voiceChannelId | null }.
 */
export async function PUT(request: Request, { params }: RouteContext) {
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
  }
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;
  const denied = requireGroup(access, "settings");
  if (denied) return denied;

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

  // Best effort: when Discord answers, the channel must be a voice channel of this server.
  let channelName: string | undefined;
  if (voiceChannelId) {
    const channels = await fetchGuildChannels(guildId).catch(() => null);
    if (channels) {
      const channel = channels.find((c) => c.id === voiceChannelId && VOICE_TYPES.has(Number(c.type)));
      if (!channel) return NextResponse.json({ error: "Not a voice channel in this server" }, { status: 400 });
      channelName = channel.name;
    }
  }

  try {
    await connectToDatabase();
    const current = access.settings?.fleet?.bindings ?? {};
    const $set: Record<string, string> = {};
    const $unset: Record<string, ""> = {};
    const displaced: number[] = [];
    for (const [key, value] of Object.entries(current)) {
      if (voiceChannelId && value === voiceChannelId && key !== String(instance)) {
        $unset[`fleet.bindings.${key}`] = "";
        const other = parseInstance(key);
        if (other) displaced.push(other);
      }
    }
    if (voiceChannelId) $set[`fleet.bindings.${instance}`] = voiceChannelId;
    else $unset[`fleet.bindings.${instance}`] = "";

    const update: Record<string, unknown> = {};
    if (Object.keys($set).length) update.$set = $set;
    if (Object.keys($unset).length) update.$unset = $unset;
    await GuildSettingsModel.updateOne({ guildId }, update, { upsert: true, setDefaultsOnInsert: true });

    // The bot reads bindings fresh on every routing decision; this also
    // tells open dashboards (`event: settings`) and drops cached settings.
    await publishSettingsChanged(guildId, ["fleet.bindings"]);

    const name = instanceName(instance);
    let summary = voiceChannelId
      ? `${name} now serves ${channelName ? `#${channelName}` : voiceChannelId}`
      : `${name} no longer has a home channel`;
    if (displaced.length) summary += ` (replacing ${displaced.map(instanceName).join(", ")})`;
    await writeGuildAudit(access, "bindings.update", summary);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[fleet] PUT bindings failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
