/**
 * Bot Invite Page
 *
 * Logs the click (source attribution, see shared/growth.ts) and redirects to
 * the Discord OAuth2 authorization URL.
 *
 * Rendered per request on purpose: the client id comes from the container's
 * runtime env (docker `env_file`), which is NOT present during `docker build`.
 * A static prerender would bake `client_id=undefined` into the redirect.
 *
 * Query: `ref` (source code, e.g. `site-hero`, `topgg`, `u-<discord id>`),
 * `utm_source` / `utm_medium` / `utm_campaign`, `bot=2..4` (a fleet instance).
 */

import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { inviteUrl } from "../../../../../shared/fleet";
import {
  INVITE_CLICKS_KEY,
  INVITE_CLICKS_MAX,
  INVITE_DAILY_TTL_S,
  inviteDailyKey,
  type InviteClick,
} from "../../../../../shared/growth";
import { INVITE_PERMISSIONS } from "../../../../../shared/links";
import { buildInviteClick, isNonHumanRequest, requestedInstance, utcDayKey } from "@/lib/invite-click";
import { getRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

// View/send in text channels (player panel), connect + speak in voice and
// stage channels, and set the voice channel status. See shared/links.ts.
const PERMISSIONS = INVITE_PERMISSIONS;
const SCOPES = "bot applications.commands";

/** Clicks older than this can't match a join anyway (window is 30 min); the list just ages out. */
const CLICKS_TTL_S = 30 * 86400;
/** The redirect never waits longer than this for Redis. */
const REDIS_BUDGET_MS = 300;

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Drop clicks older than CLICKS_TTL_S from the tail of the list (oldest end).
 * The list's own EXPIRE renews on every push and the 500-entry trim can take
 * months at our volume, so this is what keeps the privacy policy's "at most
 * 30 days" true. Bounded to a few round trips; never throws.
 */
async function pruneOldClicks(redis: NonNullable<ReturnType<typeof getRedis>>): Promise<void> {
  const cutoff = Date.now() - CLICKS_TTL_S * 1000;
  try {
    for (let i = 0; i < 25; i++) {
      const tail = await redis.lindex(INVITE_CLICKS_KEY, -1);
      if (!tail) return;
      let ts = 0;
      try {
        ts = Number((JSON.parse(tail) as Partial<InviteClick>).ts) || 0;
      } catch {
        /* unparsable entry: drop it */
      }
      if (ts >= cutoff) return;
      await redis.rpop(INVITE_CLICKS_KEY);
    }
  } catch {
    /* best effort */
  }
}

/** Store the click for join attribution and the daily per-source counter. Never throws. */
async function recordClick(click: InviteClick): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const daily = inviteDailyKey(utcDayKey(click.ts));
  const tx = redis
    .multi()
    .lpush(INVITE_CLICKS_KEY, JSON.stringify(click))
    .ltrim(INVITE_CLICKS_KEY, 0, INVITE_CLICKS_MAX - 1)
    .expire(INVITE_CLICKS_KEY, CLICKS_TTL_S)
    .hincrby(daily, click.ref, 1);
  // Website button counts share the hash under "@<placement>" (see lib/admin/growth.ts).
  if (click.placement) tx.hincrby(daily, `@${click.placement}`, 1);
  const write = tx
    .expire(daily, INVITE_DAILY_TTL_S)
    .exec()
    .catch((error: Error) => console.warn("[invite] click not logged:", error.message));
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, REDIS_BUDGET_MS);
  });
  await Promise.race([write, budget]);
  // Retention cleanup runs after the write and never delays the redirect.
  void write.then(() => pruneOldClicks(redis));
  if (timer) clearTimeout(timer);
}

async function logInvite(searchParams: SearchParams, instance: number): Promise<void> {
  try {
    const headerStore = await headers();
    const headerMap: Record<string, string | null> = {
      "user-agent": headerStore.get("user-agent"),
      "cf-ipcountry": headerStore.get("cf-ipcountry"),
      "next-router-prefetch": headerStore.get("next-router-prefetch"),
      purpose: headerStore.get("purpose"),
      "sec-purpose": headerStore.get("sec-purpose"),
      "x-purpose": headerStore.get("x-purpose"),
    };
    if (isNonHumanRequest(headerMap)) return;
    const cookieStore = await cookies();
    const cookieMap = Object.fromEntries(cookieStore.getAll().map((c) => [c.name, c.value]));
    const click = buildInviteClick(
      { searchParams, cookies: cookieMap, headers: headerMap, gaMeasurementId: process.env.NEXT_PUBLIC_GA_ID },
      randomUUID(),
      Date.now(),
      instance
    );
    await recordClick(click);
  } catch (error) {
    // Logging is best effort: the visitor always gets their redirect.
    console.warn("[invite] click logging failed:", (error as Error)?.message ?? error);
  }
}

export default async function InvitePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams.catch(() => ({}) as SearchParams);

  // `?bot=2..4`: invite that fleet instance when its application exists.
  const wanted = requestedInstance(params);
  const fleetTarget = wanted > 1 ? inviteUrl(wanted) : null;
  const instance = fleetTarget ? wanted : 1;

  await logInvite(params, instance);

  if (fleetTarget) redirect(fleetTarget);

  const clientId =
    process.env.DISCORD_BOT_CLIENT_ID ||
    process.env.NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID ||
    process.env.AUTH_DISCORD_ID;

  if (!clientId) {
    console.error(
      "[invite] No Discord client id in env (DISCORD_BOT_CLIENT_ID / NEXT_PUBLIC_DISCORD_BOT_CLIENT_ID / AUTH_DISCORD_ID); sending visitor to the support server instead."
    );
    redirect("/support");
  }

  const oauth = new URLSearchParams({
    client_id: clientId,
    permissions: PERMISSIONS,
    scope: SCOPES,
    integration_type: "0",
  });

  redirect(`https://discord.com/api/oauth2/authorize?${oauth.toString()}`);
}
