import "server-only";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import {
  describeDenial,
  evaluate,
  isSnowflake,
  resolveConfig,
  type Group,
  type PermissionConfig,
  type PermissionContext,
  type PermissionResult
} from "../../../shared/permissions";
import { configuredInstances, inviteUrl, type LivePlaybackState } from "../../../shared/fleet";
import type { IGuildSettings } from "../../../shared/types";
import { isAloneWithBot } from "./dashboard-commands";
import { fetchUserGuilds } from "./discord";
import { isBotInGuild } from "./discord-server";
import { readPlayback } from "./fleet";
import { GuildSettingsModel } from "./models/GuildSettings";
import { connectToDatabase } from "./mongodb";

/**
 * Who is asking, in which server, and what the server's rules let them do.
 *
 * Access model (dashboard v2): any member of a server that has Bypass may
 * open it; every action is then decided by the permission rules
 * (shared/permissions.ts) with the member's roles fetched with the bot token,
 * never taken from the client.
 */

const DISCORD_API = "https://discord.com/api/v10";
const ADMINISTRATOR = BigInt(0x8);
const MANAGE_GUILD = BigInt(0x20);
const MEMBER_TTL_MS = 60_000;
const VOICE_TTL_MS = 10_000;

export interface GuildAccess {
  guildId: string;
  guild: { id: string; name: string; icon: string | null };
  userId: string;
  username: string;
  avatar: string | null;
  /** Server owner, Manage Server / Administrator, or the configured admin role. */
  isAdmin: boolean;
  roleIds: string[];
  voiceChannelId: string | null;
  config: PermissionConfig;
  /** The stored settings document (null when the server never saved any). */
  settings: (Partial<IGuildSettings> & Record<string, unknown>) | null;
}

export class GuildAccessError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Extra fields for the JSON error body (never secrets). */
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "GuildAccessError";
  }
}

interface DiscordMember {
  user?: { id: string; username: string; global_name?: string | null; avatar?: string | null };
  nick?: string | null;
  avatar?: string | null;
  roles: string[];
}

// ------------------------------------------------------------------ cache

type Entry = { value: unknown; expires: number };
const globalForAccess = globalThis as unknown as { guildAccessCache?: Map<string, Entry> };
const cache: Map<string, Entry> = globalForAccess.guildAccessCache ?? new Map();
globalForAccess.guildAccessCache = cache;

function fresh<T>(key: string): { hit: true; value: T } | { hit: false; stale?: T } {
  const entry = cache.get(key);
  if (!entry) return { hit: false };
  if (entry.expires > Date.now()) return { hit: true, value: entry.value as T };
  return { hit: false, stale: entry.value as T };
}

function remember(key: string, value: unknown, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
  if (cache.size > 5000) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
  }
}

async function botFetch(path: string): Promise<Response | null> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return null;
  try {
    return await fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bot ${token}` }, cache: "no-store" });
  } catch {
    return null;
  }
}

/**
 * The member as Discord knows them (roles, nickname, avatar), through the
 * bot token. `null` = not in the server; `undefined` = unknown right now (no
 * bot token or Discord error; the last known value is used when there is one).
 */
export async function fetchGuildMember(guildId: string, userId: string): Promise<DiscordMember | null | undefined> {
  const key = `member:${guildId}:${userId}`;
  const cached = fresh<DiscordMember | null>(key);
  if (cached.hit) return cached.value;
  const res = await botFetch(`/guilds/${guildId}/members/${userId}`);
  if (!res) return cached.stale;
  if (res.status === 404) {
    remember(key, null, MEMBER_TTL_MS / 2);
    return null;
  }
  if (!res.ok) {
    if (res.status !== 429) console.warn(`[guild-access] Member lookup failed (${res.status}) for ${guildId}`);
    return cached.stale;
  }
  const member = (await res.json()) as DiscordMember;
  remember(key, member, MEMBER_TTL_MS);
  return member;
}

/**
 * The voice channel the member is in. The bot does not publish members'
 * voice states, so this asks Discord (GET /guilds/{id}/voice-states/{user})
 * with the bot token; null when not in voice or unknown.
 */
export async function fetchVoiceChannelId(guildId: string, userId: string): Promise<string | null> {
  const key = `voice:${guildId}:${userId}`;
  const cached = fresh<string | null>(key);
  if (cached.hit) return cached.value;
  const res = await botFetch(`/guilds/${guildId}/voice-states/${userId}`);
  if (!res) return cached.stale ?? null;
  if (res.status === 404) {
    remember(key, null, VOICE_TTL_MS);
    return null;
  }
  if (!res.ok) return cached.stale ?? null;
  const state = (await res.json()) as { channel_id?: string | null };
  const channelId = isSnowflake(state.channel_id) ? state.channel_id : null;
  remember(key, channelId, VOICE_TTL_MS);
  return channelId;
}

function avatarUrl(guildId: string, userId: string, member: DiscordMember | null | undefined, fallback: string | null | undefined): string | null {
  if (member?.avatar) return `https://cdn.discordapp.com/guilds/${guildId}/users/${userId}/avatars/${member.avatar}.png?size=128`;
  if (member?.user?.avatar) return `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png?size=128`;
  return fallback ?? null;
}

function permissionBits(value: string | undefined): bigint {
  try {
    return BigInt(value ?? "0");
  } catch {
    return BigInt(0);
  }
}

// ---------------------------------------------------------------- resolve

/**
 * Resolve the signed-in user's access to a server. Throws GuildAccessError:
 * 401 no session, 403 not a member, 404 unknown server or Bypass (instance 1)
 * not in it, 503 Discord unreachable.
 */
export async function resolveGuildAccess(session: Session | null, guildId: string): Promise<GuildAccess> {
  if (!session?.accessToken || !session.user) throw new GuildAccessError(401, "Unauthorized");
  const userId = session.user.discordId || session.user.id;
  if (!userId) throw new GuildAccessError(401, "Unauthorized");
  if (!isSnowflake(guildId)) throw new GuildAccessError(404, "Unknown server");

  let guilds;
  try {
    guilds = await fetchUserGuilds(session.accessToken);
  } catch (error) {
    console.warn("[guild-access] Could not list the user's servers:", (error as Error)?.message ?? error);
    throw new GuildAccessError(503, "Could not reach Discord, try again in a moment");
  }
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) throw new GuildAccessError(403, "You are not a member of this server");
  const bits = permissionBits(guild.permissions);
  if (!(await isBotInGuild(guildId))) {
    // The page can then offer the invite (to members who may add bots) and wait for Bypass to arrive.
    const canManage = Boolean(guild.owner) || (bits & ADMINISTRATOR) === ADMINISTRATOR || (bits & MANAGE_GUILD) === MANAGE_GUILD;
    throw new GuildAccessError(404, "Bypass is not in this server", {
      code: "bot_missing",
      guild: { id: guild.id, name: guild.name },
      canManage,
      inviteUrl: canManage ? inviteUrl(1, guildId) : null
    });
  }

  await connectToDatabase();
  const [settings, member, voiceChannelId] = await Promise.all([
    GuildSettingsModel.findOne({ guildId }).lean<Partial<IGuildSettings> & Record<string, unknown>>(),
    fetchGuildMember(guildId, userId),
    fetchVoiceChannelId(guildId, userId)
  ]);
  if (member === null) throw new GuildAccessError(403, "You are not a member of this server");

  const roleIds = Array.isArray(member?.roles) ? member!.roles.filter(isSnowflake) : [];
  const adminRoleId = settings?.adminRoleId ?? null;
  const isAdmin =
    Boolean(guild.owner) ||
    (bits & ADMINISTRATOR) === ADMINISTRATOR ||
    (bits & MANAGE_GUILD) === MANAGE_GUILD ||
    Boolean(adminRoleId && roleIds.includes(adminRoleId));

  return {
    guildId,
    guild: { id: guild.id, name: guild.name, icon: guild.icon },
    userId,
    username: member?.user?.global_name || member?.user?.username || session.user.name || "Unknown",
    avatar: avatarUrl(guildId, userId, member, session.user.image),
    isAdmin,
    roleIds,
    voiceChannelId,
    config: resolveConfig(settings),
    settings: settings ?? null
  };
}

/** Route helper: the access, or the error response to return as-is. */
export async function getGuildAccess(
  guildId: string
): Promise<{ access: GuildAccess; response?: undefined } | { access?: undefined; response: NextResponse }> {
  try {
    const session = await auth();
    return { access: await resolveGuildAccess(session, guildId) };
  } catch (error) {
    if (error instanceof GuildAccessError) {
      return { response: NextResponse.json({ ...error.details, error: error.message }, { status: error.status }) };
    }
    console.error("[guild-access] Failed to resolve access:", error);
    return { response: NextResponse.json({ error: "Internal server error" }, { status: 500 }) };
  }
}

// ------------------------------------------------------------------ check

/** The server's verdict for this member on a group. */
export function checkGroup(access: GuildAccess, group: Group, ctx: PermissionContext = {}): PermissionResult {
  return evaluate(access.config, { id: access.userId, roleIds: access.roleIds, isAdmin: access.isAdmin }, group, ctx);
}

/** null when allowed; otherwise the 403 `{ error, reason, group }` to return. */
export function requireGroup(access: GuildAccess, group: Group, ctx: PermissionContext = {}): NextResponse | null {
  const result = checkGroup(access, group, ctx);
  if (result.ok) return null;
  return NextResponse.json({ error: "Forbidden", reason: describeDenial(result), group }, { status: 403 });
}

// --------------------------------------------------------- playback context

/**
 * The bot's live state for an instance (Redis instance key, the legacy key
 * for instance 1, or the Mongo mirror without Redis), in the contract shape.
 */
export async function readPlaybackSnapshot(guildId: string, instance = 1): Promise<LivePlaybackState | null> {
  try {
    return await readPlayback(guildId, instance);
  } catch (error) {
    console.warn("[guild-access] Playback lookup failed:", (error as Error)?.message ?? error);
    return null;
  }
}

/**
 * Whether the member is alone with any Bypass instance in this server (for
 * GET /me, which is not tied to one instance). Only looked up while the
 * member is in a voice channel.
 */
export async function aloneWithAnyInstance(access: GuildAccess): Promise<boolean> {
  if (!access.voiceChannelId) return false;
  const states = await Promise.all(configuredInstances().map((m) => readPlaybackSnapshot(access.guildId, m.instance)));
  return states.some((state) => isAloneWithBot(access, state));
}
