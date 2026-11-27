import "server-only";
import { getGuildIconUrl } from "@/lib/discord";
import { GuildSettingsModel } from "@/lib/models/GuildSettings";
import { PlaybackState } from "@/lib/models/PlaybackState";
import { PremiumGuild } from "@/lib/models/PremiumGuild";
import { connectToDatabase } from "@/lib/mongodb";
import { getInstancePlaybackRaw, getInstanceStatus, getPlaybackState, isInstanceInGuild, isRedisAvailable } from "@/lib/redis";
import type { DiscordGuild } from "@/types/discord";
import { configuredInstances, FleetInstanceInfo, idlePlaybackState, inviteUrl, LivePlaybackState } from "../../../shared/fleet";
import { normalizePlayback } from "./fleet-state";

/*
 * Fleet data for the dashboard routes. Access (session, membership, Bypass
 * in the server, permission groups) is decided by lib/guild-access.ts.
 */

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
export function guildSummary(guild: Pick<DiscordGuild, "id" | "name" | "icon">) {
  return { id: guild.id, name: guild.name, icon: guild.icon, iconUrl: getGuildIconUrl(guild as DiscordGuild) };
}

export { idlePlaybackState, normalizePlayback };
