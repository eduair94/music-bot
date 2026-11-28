import type { Client, Guild } from "discord.js";
import { GuildAcquisition, type IGuildAcquisition } from "../../models/GuildAcquisition";
import { pseudoClientId, sendGaEvents } from "../../shared/gaMeasurement";
import {
  type Attribution,
  DIRECT_REF,
  INVITE_CLICKS_KEY,
  INVITE_CLICKS_MAX,
  inviteClaimKey,
  memberBucket
} from "../../shared/growth";
import { getRedis } from "../../shared/services/redis";
import { INSTANCE, isLinked, isPrimary } from "../../utils/instance";
import { DatabaseService } from "../database";
import { recordVote } from "../votes";
import {
  attributionCandidates,
  daysInstalled,
  hoursToFirstPlayBucket,
  parseClicks,
  PRE_TRACKING_REF,
  referralRef,
  referralRewardDecision,
  referrerIdFromRef,
  REFERRAL_VOTE_SITE,
  REFERRAL_WINDOW_MS,
  withTimeout
} from "./logic";

/**
 * Install attribution: where each server came from (the `/invite` click it
 * followed, see shared/growth.ts), whether it played a song, whether it left.
 * One Mongo document per server (`guildacquisitions`) plus GA4 server events
 * (`bot_added`, `first_play`, `bot_removed`). Joins, leaves and the backfill
 * run on the primary; first plays on every Bypass instance. Nothing here ever
 * throws into a Discord or player event handler.
 */

const CLAIM_TTL_S = 7 * 86400;
const REDIS_TIMEOUT_MS = 2000;

function dbReady(): boolean {
  return DatabaseService.getInstance().isConnected();
}

function warn(scope: string, error: unknown): void {
  console.warn(`[Growth] ${scope} failed:`, (error as Error)?.message ?? error);
}

/** The newest unclaimed invite click inside the window, claimed for this join; "direct" when none. */
async function claimAttribution(joinTs: number): Promise<Attribution> {
  const redis = getRedis();
  const raw = await withTimeout(redis.lrange(INVITE_CLICKS_KEY, 0, INVITE_CLICKS_MAX - 1), REDIS_TIMEOUT_MS, [] as string[]);
  for (const click of attributionCandidates(parseClicks(raw), joinTs, INSTANCE)) {
    const claimed = await withTimeout(redis.set(inviteClaimKey(click.id), "1", "EX", CLAIM_TTL_S, "NX"), REDIS_TIMEOUT_MS, null);
    if (claimed === "OK") return { ref: click.ref, click };
  }
  return { ref: DIRECT_REF };
}

/** Primary, GuildCreate: attribute the join, store it and tell GA. */
export async function onGuildJoin(guild: Guild): Promise<void> {
  if (!isPrimary) return;
  try {
    const joinTs = guild.joinedTimestamp || Date.now();
    const { ref, click } = await claimAttribution(joinTs);
    let rejoin = false;

    if (dbReady()) {
      const now = new Date(joinTs);
      const fresh: Partial<IGuildAcquisition> = {
        guildId: guild.id,
        name: guild.name,
        memberCount: guild.memberCount,
        ownerId: guild.ownerId,
        ref,
        placement: click?.placement,
        utmSource: click?.utmSource,
        utmMedium: click?.utmMedium,
        utmCampaign: click?.utmCampaign,
        country: click?.country,
        clickTs: click ? new Date(click.ts) : undefined,
        joinedAt: now,
        rejoins: 0
      };
      for (const key of Object.keys(fresh) as (keyof IGuildAcquisition)[]) if (fresh[key] === undefined) delete fresh[key];

      const previous = await GuildAcquisition.findOneAndUpdate(
        { guildId: guild.id },
        { $setOnInsert: fresh },
        { upsert: true, returnDocument: "before" }
      ).lean<IGuildAcquisition>();

      if (previous) {
        // Came back: the original source stays, the new one goes to lastRef.
        rejoin = true;
        await GuildAcquisition.updateOne(
          { guildId: guild.id },
          {
            $set: { name: guild.name, memberCount: guild.memberCount, ownerId: guild.ownerId, lastRef: ref, joinedAt: now },
            $unset: { leftAt: "" },
            $inc: { rejoins: 1 }
          }
        );
      }
    }

    console.log(`[Growth] ${guild.name} (${guild.id}) ${rejoin ? "rejoined" : "joined"} via ${ref}${click ? ` (click ${Math.round((joinTs - click.ts) / 1000)}s before)` : ""}`);
    await sendGaEvents(
      { clientId: click?.gaClientId ?? pseudoClientId(`guild.${guild.id}`), sessionId: click?.gaSessionId, timestampMs: joinTs },
      [
        {
          name: "bot_added",
          params: {
            source: ref,
            campaign: click?.utmCampaign,
            medium: click?.utmMedium,
            placement: click?.placement,
            member_bucket: memberBucket(guild.memberCount),
            rejoin: rejoin || undefined
          }
        }
      ]
    );
  } catch (error) {
    warn("join tracking", error);
  }
}

/** Primary, GuildDelete: mark the server as gone and tell GA. */
export async function onGuildLeave(guild: Guild): Promise<void> {
  if (!isPrimary) return;
  try {
    let source: string = PRE_TRACKING_REF;
    let days = daysInstalled(guild.joinedTimestamp ?? undefined);
    if (dbReady()) {
      const now = new Date();
      const previous = await GuildAcquisition.findOneAndUpdate(
        { guildId: guild.id },
        {
          $set: { leftAt: now },
          // Left before it was ever tracked: keep a row so removals still count.
          $setOnInsert: {
            guildId: guild.id,
            name: guild.name ?? "",
            memberCount: guild.memberCount ?? 0,
            ref: PRE_TRACKING_REF,
            joinedAt: new Date(guild.joinedTimestamp || now.getTime()),
            rejoins: 0,
            backfilled: true
          }
        },
        { upsert: true, returnDocument: "before" }
      ).lean<IGuildAcquisition>();
      if (previous) {
        source = previous.lastRef ?? previous.ref;
        days = daysInstalled(previous.joinedAt);
      }
    }
    await sendGaEvents({ clientId: pseudoClientId(`guild.${guild.id}`) }, [
      { name: "bot_removed", params: { source, days_installed: days } }
    ]);
  } catch (error) {
    warn("leave tracking", error);
  }
}

/** Servers whose first song is already recorded (or that have no row), so later songs cost nothing. */
const activated = new Set<string>();

/**
 * playerStart on any Bypass instance: the first song ever played in a server
 * marks it activated (GA `first_play`) and may reward its referrer.
 */
export async function onFirstPlay(guild: Guild): Promise<void> {
  if (isLinked || activated.has(guild.id) || !dbReady()) return;
  activated.add(guild.id);
  try {
    const now = new Date();
    const previous = await GuildAcquisition.findOneAndUpdate(
      { guildId: guild.id, firstPlayAt: { $exists: false } },
      { $set: { firstPlayAt: now } },
      { returnDocument: "before" }
    ).lean<IGuildAcquisition>();
    // Already activated, or a server with no row (it joined while Mongo was down).
    if (!previous) {
      // A song in the first minute can beat the join's own write: look again on the next song.
      if (Date.now() - (guild.joinedTimestamp ?? 0) < 60_000) activated.delete(guild.id);
      return;
    }
    // Servers that were here before tracking get their first tracked song stored, not counted.
    if (previous.backfilled) return;

    await sendGaEvents({ clientId: pseudoClientId(`guild.${guild.id}`) }, [
      {
        name: "first_play",
        params: {
          source: previous.ref,
          hours_to_first_play: hoursToFirstPlayBucket(now.getTime() - new Date(previous.joinedAt).getTime())
        }
      }
    ]);
    await rewardReferrer(guild, previous);
  } catch (error) {
    activated.delete(guild.id);
    warn("first play tracking", error);
  }
}

/** Vote perks for whoever brought this server, within the limits in ./logic. */
async function rewardReferrer(guild: Guild, acquisition: IGuildAcquisition): Promise<void> {
  if (!referrerIdFromRef(acquisition.ref)) return;
  const since = new Date(Date.now() - REFERRAL_WINDOW_MS);
  const rewardsInWindow = await GuildAcquisition.countDocuments({ ref: acquisition.ref, referralRewardedAt: { $gte: since } });
  const decision = referralRewardDecision({
    ref: acquisition.ref,
    memberCount: guild.memberCount ?? acquisition.memberCount,
    alreadyRewarded: Boolean(acquisition.referralRewardedAt),
    rewardsInWindow,
    backfilled: acquisition.backfilled
  });
  if (!decision.reward) {
    console.log(`[Growth] No referral reward for ${guild.id}: ${decision.reason}`);
    return;
  }
  const now = new Date();
  const claim = await GuildAcquisition.updateOne(
    { guildId: guild.id, referralRewardedAt: { $exists: false } },
    { $set: { referralRewardedAt: now } }
  );
  if (claim.modifiedCount !== 1) return;
  await recordVote(decision.referrerId, REFERRAL_VOTE_SITE, now, false);
  console.log(`[Growth] Referral reward: ${decision.referrerId} brought ${guild.name} (${guild.id})`);
}

/** Servers a user brought with their personal `/invite` link that still have the bot. */
export async function referralCount(userId: string): Promise<number> {
  if (!dbReady()) return 0;
  try {
    return await withTimeout(
      GuildAcquisition.countDocuments({ ref: referralRef(userId), leftAt: { $exists: false } }).exec(),
      1500,
      0
    );
  } catch {
    return 0;
  }
}

/** A server with no row that joined this recently was a join missed during a restart, not a pre-tracking one. */
const MISSED_JOIN_MS = 6 * 3_600_000;

/**
 * Primary ready: give every current server a row (servers from before
 * tracking get ref "pre-tracking"), refresh names and member counts, and
 * reconcile joins/leaves/rejoins that happened while the bot was offline.
 */
export async function backfillAcquisitions(client: Client): Promise<void> {
  if (!isPrimary || !dbReady()) return;
  try {
    const all = [...client.guilds.cache.values()].filter((g) => g.available !== false);
    if (!all.length) return;

    // Joined during a restart (no GuildCreate seen): attribute like a live join.
    const recent = all.filter((g) => Date.now() - (g.joinedTimestamp || 0) < MISSED_JOIN_MS);
    const known = recent.length
      ? new Set(
          (await GuildAcquisition.find({ guildId: { $in: recent.map((g) => g.id) } }).select("guildId").lean<{ guildId: string }[]>()).map(
            (d) => d.guildId
          )
        )
      : new Set<string>();
    const missed = recent.filter((g) => !known.has(g.id));
    for (const guild of missed) await onGuildJoin(guild);

    const missedIds = new Set(missed.map((g) => g.id));
    const guilds = all.filter((g) => !missedIds.has(g.id));
    const ops = guilds.map((g) => ({
      updateOne: {
        filter: { guildId: g.id },
        update: {
          $set: { name: g.name, memberCount: g.memberCount },
          $unset: { leftAt: "" as const },
          $setOnInsert: {
            guildId: g.id,
            ownerId: g.ownerId,
            ref: PRE_TRACKING_REF,
            joinedAt: new Date(g.joinedTimestamp || Date.now()),
            rejoins: 0,
            backfilled: true
          }
        },
        upsert: true
      }
    }));
    const result = ops.length ? await GuildAcquisition.bulkWrite(ops, { ordered: false }) : null;
    const gone = await GuildAcquisition.updateMany(
      { guildId: { $nin: [...client.guilds.cache.keys()] }, leftAt: { $exists: false } },
      { $set: { leftAt: new Date() } }
    );
    console.log(
      `[Growth] Acquisitions: ${result?.upsertedCount ?? 0} backfilled, ${missed.length} joins attributed after a restart, ${gone.modifiedCount} marked as left while offline`
    );
  } catch (error) {
    warn("acquisition backfill", error);
  }
}
