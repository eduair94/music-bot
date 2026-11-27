import { fetchGuildChannels, fetchGuildRoles } from "@/lib/discord";
import { getGuildAccess } from "@/lib/guild-access";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

interface Overwrite {
  id: string;
  type: number; // 0 role, 1 member
  allow: string;
  deny: string;
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites?: Overwrite[];
}

const VIEW_CHANNEL = BigInt(0x400);
const ADMINISTRATOR = BigInt(0x8);
const ZERO = BigInt(0);
const TEXT_TYPES = new Set([0, 5]); // text, announcement
const VOICE_TYPES = new Set([2, 13]); // voice, stage
const CATEGORY = 4;

function bits(value: string | undefined): bigint {
  try {
    return BigInt(value ?? "0");
  } catch {
    return ZERO;
  }
}

/**
 * Whether a member can see a channel: base permissions from @everyone and
 * their roles, then the channel's overwrites (@everyone, roles, member).
 */
function canView(channel: RawChannel, base: bigint, guildId: string, roleIds: Set<string>, userId: string): boolean {
  if ((base & ADMINISTRATOR) === ADMINISTRATOR) return true;
  let perms = base;
  const overwrites = channel.permission_overwrites ?? [];
  const everyone = overwrites.find((o) => o.id === guildId);
  if (everyone) perms = (perms & ~bits(everyone.deny)) | bits(everyone.allow);
  let allow = ZERO;
  let deny = ZERO;
  for (const o of overwrites) {
    if (o.type === 0 && o.id !== guildId && roleIds.has(o.id)) {
      allow |= bits(o.allow);
      deny |= bits(o.deny);
    }
  }
  perms = (perms & ~deny) | allow;
  const own = overwrites.find((o) => o.type === 1 && o.id === userId);
  if (own) perms = (perms & ~bits(own.deny)) | bits(own.allow);
  return (perms & VIEW_CHANNEL) === VIEW_CHANNEL;
}

/** Roles and channels for pickers. Admins see every channel; other members only the ones they can see. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  let roles;
  let channels: RawChannel[];
  try {
    [roles, channels] = await Promise.all([fetchGuildRoles(guildId), fetchGuildChannels(guildId) as Promise<unknown> as Promise<RawChannel[]>]);
  } catch (error) {
    console.warn("[meta] Discord lookup failed:", (error as Error)?.message ?? error);
    return NextResponse.json({ error: "Could not load roles and channels from Discord" }, { status: 502 });
  }

  const memberRoles = new Set(access.roleIds);
  let base = ZERO;
  for (const role of roles) {
    if (role.id === guildId || memberRoles.has(role.id)) base |= bits(role.permissions);
  }
  const visible = (c: RawChannel) => access.isAdmin || canView(c, base, guildId, memberRoles, access.userId);

  const categories = new Map(channels.filter((c) => c.type === CATEGORY).map((c) => [c.id, c]));
  const order = (c: RawChannel) => [categories.get(c.parent_id ?? "")?.position ?? -1, c.position] as const;
  const byPosition = (a: RawChannel, b: RawChannel) => {
    const [ca, pa] = order(a);
    const [cb, pb] = order(b);
    return ca - cb || pa - pb;
  };

  return NextResponse.json({
    roles: [...roles]
      .sort((a, b) => b.position - a.position)
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position, managed: r.managed })),
    voiceChannels: channels
      .filter((c) => VOICE_TYPES.has(c.type) && visible(c))
      .sort(byPosition)
      .map((c) => {
        const parentName = c.parent_id ? categories.get(c.parent_id)?.name : undefined;
        return parentName ? { id: c.id, name: c.name, parentName } : { id: c.id, name: c.name };
      }),
    textChannels: channels
      .filter((c) => TEXT_TYPES.has(c.type) && visible(c))
      .sort(byPosition)
      .map((c) => ({ id: c.id, name: c.name }))
  });
}
