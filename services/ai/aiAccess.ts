import { AiQuota } from "../../models/AiQuota";
import { isOwner } from "../../utils/audioSettings";
import { hasPremiumFeature } from "../../utils/premiumCheck";
import { PremiumGuildService } from "../premiumGuild";

/**
 * Who may use the AI DJ, and how often.
 *
 * Premium (the `ai_dj` perk from Patreon or a support-server boost, or a
 * premium server) gets AI_PREMIUM_DAILY generations per server per day and
 * long AI radio sessions. Everyone else gets AI_FREE_DAILY per server per day
 * as a trial, with short AI radio sessions. The bot owner is never limited.
 *
 * A "generation" is one /ai playlist or the start of an AI radio. Radio
 * refills (the next batch when the queue runs out) count in their own,
 * larger bucket, so a long session doesn't eat the playlist allowance.
 */

function envInt(name: string, fallback: number): number {
  const n = parseInt(process.env[name] || "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const AI_FREE_DAILY = () => envInt("AI_FREE_DAILY", 3);
export const AI_PREMIUM_DAILY = () => envInt("AI_PREMIUM_DAILY", 50);
export const AI_REFILLS_DAILY = () => envInt("AI_REFILLS_DAILY", 150);
/** Batches (of AI_RADIO_BATCH songs) one AI radio session may ask for. */
export const AI_RADIO_BATCHES_FREE = () => envInt("AI_RADIO_BATCHES_FREE", 3);
export const AI_RADIO_BATCHES_PREMIUM = () => envInt("AI_RADIO_BATCHES_PREMIUM", 40);
export const AI_RADIO_BATCH = 10;

export interface AiAccess {
  premium: boolean;
  unlimited: boolean;
  daily: number;
  radioBatches: number;
}

export async function aiAccess(userId: string, guildId: string): Promise<AiAccess> {
  if (isOwner(userId)) return { premium: true, unlimited: true, daily: Infinity, radioBatches: AI_RADIO_BATCHES_PREMIUM() };
  const [perk, guild] = await Promise.all([
    hasPremiumFeature(userId, "ai_dj").catch(() => false),
    PremiumGuildService.getInstance()
      .isPremiumGuild(guildId)
      .catch(() => false)
  ]);
  const premium = perk || guild;
  return {
    premium,
    unlimited: false,
    daily: premium ? AI_PREMIUM_DAILY() : AI_FREE_DAILY(),
    radioBatches: premium ? AI_RADIO_BATCHES_PREMIUM() : AI_RADIO_BATCHES_FREE()
  };
}

/** "gen": free-trial uses, "genp": premium uses, "refill": AI radio batches. */
export type QuotaBucket = "gen" | "genp" | "refill";

/** The generation bucket for someone with this access (free trials don't share premium's counter). */
export function genBucket(access: AiAccess): QuotaBucket {
  return access.premium ? "genp" : "gen";
}

/** Pure: the counter id for a bucket, server and UTC day. */
export function quotaId(bucket: QuotaBucket, guildId: string, now = new Date()): string {
  return `${bucket}:${guildId}:${now.toISOString().slice(0, 10)}`;
}

/**
 * Take one use from today's bucket if it has room. Atomic across bot
 * instances: the update only matches while count < limit, and the upsert of
 * a full counter fails on the duplicate _id.
 */
export async function consumeQuota(bucket: QuotaBucket, guildId: string, limit: number): Promise<boolean> {
  if (limit === Infinity) return true;
  if (limit <= 0) return false;
  // Two first uses of the day can race on the insert: the loser retries once and
  // then matches the new counter (or the counter really is full).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await AiQuota.findOneAndUpdate(
        { _id: quotaId(bucket, guildId), count: { $lt: limit } },
        { $inc: { count: 1 }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true }
      );
      return true;
    } catch (error: any) {
      if (error?.code === 11000) continue;
      // The counter is a cost guard; if Mongo is down, AI is too risky to run blind.
      console.warn("[AI] quota check failed:", error?.message || error);
      return false;
    }
  }
  return false;
}

/** Give back a use when the generation failed (the user got nothing). Unlimited callers never took one. */
export async function refundQuota(bucket: QuotaBucket, guildId: string, access?: AiAccess): Promise<void> {
  if (access?.unlimited) return;
  await AiQuota.updateOne({ _id: quotaId(bucket, guildId), count: { $gt: 0 } }, { $inc: { count: -1 } }).catch(() => undefined);
}

/** Free-trial uses left today on this server. */
export async function remainingToday(guildId: string, limit: number): Promise<number> {
  if (limit === Infinity) return Infinity;
  const doc = await AiQuota.findById(quotaId("gen", guildId)).lean().catch(() => null);
  return Math.max(0, limit - (doc?.count ?? 0));
}
