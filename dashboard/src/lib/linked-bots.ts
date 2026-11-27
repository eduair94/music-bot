import { configuredInstances } from "../../../shared/fleet";
import { linkedBotAllowance } from "../../../shared/types";
import { LinkedBotModel } from "@/lib/models/LinkedBot";
import { PatreonUserModel } from "@/lib/models/PatreonUser";

/**
 * Premium users' private bots, dashboard side. The bot process
 * (services/botManager.ts) runs them and applies the same allowance rule
 * (shared/types `linkedBotAllowance`) when it starts or sweeps them.
 */

const DISCORD_API = "https://discord.com/api/v10";

function isBotOwner(discordId: string): boolean {
  const ownerId = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
  return Boolean(ownerId) && ownerId === discordId;
}

/** How many private bots `discordId` may have: 0 without Premium, more on higher pledges. */
export async function linkedBotAllowanceFor(discordId: string): Promise<number> {
  if (isBotOwner(discordId)) return linkedBotAllowance(null, true);
  const patron = await PatreonUserModel.findOne({ discordId }, { isPremium: 1, pledgeAmountCents: 1 }).lean<{
    isPremium?: boolean;
    pledgeAmountCents?: number;
  }>();
  return linkedBotAllowance(patron ? { isPremium: Boolean(patron.isPremium), pledgeAmountCents: patron.pledgeAmountCents ?? 0 } : null);
}

/** The owner's oldest bots fill the allowance; can this one run? */
export async function canRunLinkedBot(ownerId: string, botId: string): Promise<boolean> {
  const allowance = await linkedBotAllowanceFor(ownerId);
  if (allowance <= 0) return false;
  const mine = await LinkedBotModel.find({ ownerId }, { botId: 1 }).sort({ createdAt: 1 }).lean<{ botId: string }[]>();
  const position = mine.findIndex((b) => b.botId === botId);
  return position >= 0 && position < allowance;
}

export type TokenCheck =
  | { ok: true; botId: string; username: string; avatar: string | null; isPublic: boolean }
  | { ok: false; error: string };

/**
 * Ask Discord who a token belongs to. Refuses user tokens and Bypass's own
 * applications (a private bot on Bypass's token would answer twice).
 */
export async function inspectBotToken(token: string): Promise<TokenCheck> {
  const headers = { Authorization: `Bot ${token}` };
  let me: Response;
  try {
    me = await fetch(`${DISCORD_API}/users/@me`, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    return { ok: false, error: "Couldn't reach Discord to check the token" };
  }
  if (me.status === 401) return { ok: false, error: "Discord says that token is not valid. Reset it on the Bot page and paste the new one" };
  if (!me.ok) return { ok: false, error: `Discord couldn't check the token (${me.status})` };
  const user = (await me.json()) as { id: string; username: string; avatar: string | null; bot?: boolean };
  if (!user.bot) return { ok: false, error: "That is not a bot token. Copy it from the Bot page of your application" };
  if (configuredInstances().some((m) => m.applicationId === user.id)) {
    return { ok: false, error: "That token belongs to a Bypass bot. Use a bot from your own application" };
  }

  // Public or not decides who else can add it; a failure here doesn't block linking.
  let isPublic = true;
  try {
    const app = await fetch(`${DISCORD_API}/applications/@me`, { headers, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (app.ok) isPublic = Boolean(((await app.json()) as { bot_public?: boolean }).bot_public);
  } catch {
    // keep the default
  }
  return { ok: true, botId: user.id, username: user.username, avatar: user.avatar, isPublic };
}
