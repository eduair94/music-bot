import "server-only";
import { auth } from "@/auth";
import { isBotInGuild } from "@/lib/discord-server";
import { fetchUserGuilds, getGuildIconUrl, hasManagePermission } from "@/lib/discord";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getInstancePlaybackRaw, getInstanceStatus, getPlaybackState, isInstanceInGuild, isRedisAvailable } from "@/lib/redis";
import type { DiscordGuild } from "@/types/discord";
import { NextResponse } from "next/server";
import { configuredInstances, FleetInstanceInfo, idlePlaybackState, inviteUrl, LivePlaybackState } from "../../../shared/fleet";
import { normalizePlayback } from "./fleet-state";

// ----------------------------------------------------------------- access

export type GuildAccess =
  | { ok: true; userId: string; username: string; guild: DiscordGuild; canManage: boolean }
  | { ok: false; response: NextResponse };

/**
 * Session + "shares the guild" + "Bypass is in the guild" (401/403/404).
 * TODO(merge): replace with the guild-access helper from the permissions
 * work, which widens access to every member and resolves groups.
 */
export async function requireGuildMember(guildId: string): Promise<GuildAccess> {
  const session = await auth();
  if (!session?.accessToken || !session.user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  let guilds: DiscordGuild[];
  try {
    guilds = await fetchUserGuilds(session.accessToken);
  } catch (error) {
    console.error("[fleet] Could not list the user's servers:", error);
    return { ok: false, response: NextResponse.json({ error: "Could not reach Discord" }, { status: 502 }) };
  }
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };

  if (!(await isBotInGuild(guildId))) {
    return { ok: false, response: NextResponse.json({ error: "Bypass is not in this server" }, { status: 404 }) };
  }

  return {
    ok: true,
    userId: session.user.discordId || session.user.id || "unknown",
    username: session.user.name || "Dashboard User",
    guild,
    canManage: hasManagePermission(guild.permissions)
  };
}

// --------------------------------------------------------------- playback

/**
 * One instance's playback state, or null when it isn't connected in this
 * server. Redis is the source of truth (keys live 30 s, refreshed every 5 s);
 * the Mongo mirror is only read when Redis is unavailable.
 */
export async function readPlayback(guildId: string, instance: number): Promise<LivePlaybackState | null> {
  if (await isRedisAvailable()) {
    const raw = (await getInstancePlaybackRaw(guildId, instance)) ?? (instance === 1 ? await getPlaybackState(guildId) : null);
    return raw ? normalizePlayback(raw, guildId, instance) : null;
  }

  try {
    await connectToDatabase();
    const filter = instance === 1 ? { guildId, $or: [{ instance: 1 }, { instance: { $exists: false } }] } : { guildId, instance };
    const doc = await PlaybackState.findOne(filter).lean<Record<string, any>>();
    return doc ? normalizePlayback(doc, guildId, instance) : null;
  } catch (error) {
    console.error("[fleet] Could not read playback state:", error);
    return null;
  }
}

// ------------------------------------------------------------------ fleet

/** Channel bindings: instance number → voice channel id. */
export async function readBindings(guildId: string): Promise<Record<string, string | null>> {
  await connectToDatabase();
  const doc = await GuildSettingsModel.findOne({ guildId }, { fleet: 1 }).lean<{ fleet?: { bindings?: Record<string, string | null> } }>();
  return doc?.fleet?.bindings ?? {};
}

export async function isPremiumGuild(guildId: string): Promise<boolean> {
  await connectToDatabase();
  const now = new Date();
  const found = await PremiumGuild.exists({
    guildId,
    isActive: true,
    $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }]
  });
  return Boolean(found);
}

function avatarUrl(status: Record<string, unknown> | null, applicationId: string): string | undefined {
  const avatar = status && typeof status.avatar === "string" ? status.avatar : null;
  const id = status && typeof status.id === "string" ? status.id : applicationId;
  if (!avatar) return undefined;
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${avatar.startsWith("a_") ? "gif" : "png"}?size=128`;
}

/** Every created instance as `GET /fleet` lists it. */
export async function fleetInstances(guildId: string, bindings?: Record<string, string | null>): Promise<FleetInstanceInfo[]> {
  const boundTo = bindings ?? (await readBindings(guildId).catch(() => ({} as Record<string, string | null>)));
  return Promise.all(
    configuredInstances().map(async (member): Promise<FleetInstanceInfo> => {
      const [status, inGuild, playback] = await Promise.all([
        getInstanceStatus(member.instance),
        isInstanceInGuild(member.instance, guildId),
        readPlayback(guildId, member.instance)
      ]);
      return {
        instance: member.instance,
        name: member.name,
        applicationId: member.applicationId,
        avatarUrl: avatarUrl(status, member.applicationId),
        // The route already checked instance 1 is in the server.
        inGuild: member.instance === 1 ? true : Boolean(inGuild),
        online: Boolean(status && status.online !== false),
        premium: member.premium,
        inviteUrl: inviteUrl(member.instance, guildId) ?? "",
        binding: { voiceChannelId: boundTo[String(member.instance)] ?? null },
        playback
      };
    })
  );
}

/** `icon` is Discord's hash (as elsewhere in the dashboard); `iconUrl` the CDN link. */
export function guildSummary(guild: DiscordGuild) {
  return { id: guild.id, name: guild.name, icon: guild.icon, iconUrl: getGuildIconUrl(guild) };
}

export { idlePlaybackState, normalizePlayback };
