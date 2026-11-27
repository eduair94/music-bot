import { checkGroup, getGuildAccess, readPlaybackSnapshot } from "@/lib/guild-access";
import { NextResponse } from "next/server";
import { GROUPS, describeDenial, type Group } from "../../../../../../../shared/permissions";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ guildId: string }>;
}

/** Who I am in this server and what each action group lets me do. */
export async function GET(_request: Request, { params }: RouteContext) {
  const { guildId } = await params;
  const { access, response } = await getGuildAccess(guildId);
  if (!access) return response;

  // "Alone with the bot counts as DJ" needs the bot's channel and listener count.
  const playback = await readPlaybackSnapshot(guildId);
  const aloneWithBot = Boolean(
    access.voiceChannelId && playback?.voiceChannelId === access.voiceChannelId && playback?.listeners === 1
  );

  const groups = {} as Record<Group, { ok: boolean; reason?: string }>;
  for (const group of GROUPS) {
    const result = checkGroup(access, group, { aloneWithBot });
    groups[group] = result.ok ? { ok: true } : { ok: false, reason: describeDenial(result) };
  }

  return NextResponse.json({
    userId: access.userId,
    username: access.username,
    avatar: access.avatar,
    isAdmin: access.isAdmin,
    voiceChannelId: access.voiceChannelId,
    groups
  });
}
