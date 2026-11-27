import "server-only";

import { Vote } from "@/lib/models/Vote";
import { PatreonUserModel } from "@/lib/models/PatreonUser";
import { connectToDatabase } from "@/lib/mongodb";
import { SUPPORT_GUILD_ID } from "@/lib/support-guild";

/**
 * What a signed-in member really has, read from the same records the bot
 * checks (utils/premiumCheck.ts): the Patreon membership, an active top.gg
 * vote (12 h of 24/7), and a live boost of the support server.
 */
export interface PlanStatus {
  /** Paid Patreon membership: the Founder tier, or another paid tier. */
  patreon: { founder: boolean; tierTitle: string | null } | null;
  /** Epoch ms when vote perks run out, if a vote is active. */
  voteUntil: number | null;
  /** Boosting the support server (Founder perks while it lasts). */
  booster: boolean;
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function readMongo(discordId: string): Promise<Pick<PlanStatus, "patreon" | "voteUntil">> {
  await connectToDatabase();
  const [patron, vote] = await Promise.all([
    PatreonUserModel.findOne({ discordId }).select("isPremium isFounder tierTitle").lean() as Promise<{
      isPremium?: boolean;
      isFounder?: boolean;
      tierTitle?: string;
    } | null>,
    Vote.findOne({ userId: discordId, perksUntil: { $gt: new Date() } })
      .sort({ perksUntil: -1 })
      .select("perksUntil")
      .lean() as Promise<{ perksUntil?: Date } | null>,
  ]);
  return {
    patreon: patron?.isPremium ? { founder: Boolean(patron.isFounder), tierTitle: patron.tierTitle ?? null } : null,
    voteUntil: vote?.perksUntil ? new Date(vote.perksUntil).getTime() : null,
  };
}

async function readBoost(discordId: string): Promise<boolean> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) return false;
  const res = await fetch(`https://discord.com/api/v10/guilds/${SUPPORT_GUILD_ID}/members/${discordId}`, {
    headers: { Authorization: `Bot ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const member = (await res.json()) as { premium_since?: string | null };
  return Boolean(member.premium_since);
}

/** Returns null when the records can't be read right now (never guesses "Free"). */
export async function getPlanStatus(discordId: string): Promise<PlanStatus | null> {
  try {
    const [mongo, booster] = await Promise.all([
      timeout(readMongo(discordId), 3500),
      timeout(readBoost(discordId), 2500).catch(() => false),
    ]);
    return { ...mongo, booster };
  } catch {
    return null;
  }
}

/** The plan's display name: "Founder", another tier's title, or "Free". */
export function planName(s: PlanStatus): string {
  if (s.patreon?.founder) return "Founder";
  if (s.patreon) return s.patreon.tierTitle || "Patron";
  return "Free";
}

/** "about 7 more hours" / "under an hour". */
export function hoursLeft(until: number, now = Date.now()): string {
  const h = Math.floor((until - now) / 3_600_000);
  if (h < 1) return "under an hour";
  return h === 1 ? "about 1 more hour" : `about ${h} more hours`;
}
