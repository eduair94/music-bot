import { Client } from "discord.js";

/**
 * Boosting the official support server unlocks Founder perks in Bypass for as
 * long as the boost lasts. Discord ends the boost (and clears premium_since)
 * when it lapses, so the check is live: one member fetch per user, cached.
 *
 * Works without the privileged GuildMembers intent: a single-member REST fetch
 * is allowed, listing members is not.
 */
export const SUPPORT_GUILD_ID = process.env.SUPPORT_GUILD_ID || "1458199268564406487";

/** What a support-server booster gets. Same as Founder, minus the Patreon-only role. */
export const BOOSTER_PERK_FEATURES = [
  "audio_filters",
  "stay_24_7",
  "max_quality",
  "priority_queue",
  "unlimited_playlists",
  "longer_songs",
  "direct_support"
] as const;

const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; boosting: boolean }>();
let client: Client | null = null;

export function setBoosterClient(c: Client): void {
  client = c;
}

export function isBoosterPerk(feature: string): boolean {
  return (BOOSTER_PERK_FEATURES as readonly string[]).includes(feature);
}

/** Whether this user currently boosts the support server. Never throws. */
export async function isSupportBooster(userId: string): Promise<boolean> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.boosting;

  let boosting = false;
  const guild = client?.guilds.cache.get(SUPPORT_GUILD_ID);
  if (guild) {
    // Unknown Member (not in the support server) is the common, cheap answer.
    const member = await guild.members.fetch({ user: userId, cache: false }).catch(() => null);
    boosting = Boolean(member?.premiumSinceTimestamp);
  }
  cache.set(userId, { at: Date.now(), boosting });
  return boosting;
}

/** Drop a cached answer, e.g. right after the booster role changes. */
export function forgetBooster(userId: string): void {
  cache.delete(userId);
}
