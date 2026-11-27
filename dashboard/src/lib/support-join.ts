import { SupportJoin, type SupportJoinOutcome } from "./models/SupportJoin";
import { connectToDatabase } from "./mongodb";
import { SUPPORT_GUILD_ID } from "./support-guild";

/*
 * Sign-in adds the member to the Bypass support server (Discord's "Join
 * servers for you" on the consent screen). Discord requires the `guilds.join`
 * scope on the member's token, a bot token from the same application as the
 * OAuth client (the main Bypass app), and that bot in the support server.
 */

const DISCORD_API = "https://discord.com/api/v10";

/** Sign-in never waits on this; the cap only stops a hung request from lingering. */
export const SUPPORT_JOIN_TIMEOUT_MS = 5000;

export type SupportJoinResult = Exclude<SupportJoinOutcome, "pending"> | "already" | "skipped";

export interface SupportJoinInput {
  discordId: string | undefined;
  /** The member's OAuth access token, straight from the sign-in. Never logged or stored. */
  accessToken: string | undefined;
  /** Scopes Discord granted ("identify guilds email guilds.join"), when it says. */
  scope?: string | null;
}

/**
 * Add a member who just signed in to the support server, once ever. The
 * attempt is recorded in Mongo before Discord is called, so a member who left
 * is never re-added and two sign-ins racing each other make one request.
 * Without a record (Mongo down) nothing is attempted. Never throws.
 */
export async function joinSupportServerOnce({ discordId, accessToken, scope }: SupportJoinInput): Promise<SupportJoinResult> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken || !discordId || !accessToken) return "skipped";
  // A grant without guilds.join (consent from before the scope was added) can't be used.
  if (scope && !scope.split(/\s+/).includes("guilds.join")) return "skipped";

  try {
    await connectToDatabase();
    const claim = await SupportJoin.updateOne(
      { discordId },
      { $setOnInsert: { discordId, outcome: "pending", attemptedAt: new Date() } },
      { upsert: true }
    );
    if (!claim.upsertedCount) return "already";
  } catch (error) {
    // A racing sign-in that inserted first lands here too (duplicate key).
    console.warn("[auth] support join skipped, attempt not recorded:", (error as Error)?.name ?? "error");
    return "skipped";
  }

  let httpStatus = 0;
  try {
    const res = await fetch(`${DISCORD_API}/guilds/${SUPPORT_GUILD_ID}/members/${discordId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
      signal: AbortSignal.timeout(SUPPORT_JOIN_TIMEOUT_MS),
      cache: "no-store",
    });
    httpStatus = res.status;
  } catch {
    httpStatus = 0;
  }

  const outcome: SupportJoinResult = httpStatus === 201 ? "joined" : httpStatus === 204 ? "member" : "failed";
  if (outcome === "failed") console.warn("[auth] support join failed", httpStatus);

  try {
    await SupportJoin.updateOne({ discordId }, { $set: { outcome, httpStatus, finishedAt: new Date() } });
  } catch {
    // The pending row already blocks a second attempt; the outcome is only bookkeeping.
  }
  return outcome;
}
