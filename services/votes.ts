import axios from "axios";
import { Vote } from "../models/Vote";
import { BOT_APPLICATION_ID } from "../shared/links";
import { DatabaseService } from "./database";

/**
 * Vote perks: a vote on a listing site unlocks 24/7 mode and studio quality
 * for 12 hours. Votes arrive through the dashboard webhook (Mongo `votes`);
 * when a top.gg token is configured the bot can also ask top.gg directly,
 * which covers votes cast while the webhook was down.
 */
export const VOTE_PERK_HOURS = 12;
export const VOTE_PERK_FEATURES = ["stay_24_7", "max_quality"] as const;

const cache = new Map<string, { at: number; until: number }>();
const CACHE_MS = 60_000;

/** When this user's vote perks end (epoch ms), or 0 if none are active. */
export async function votePerksUntil(userId: string): Promise<number> {
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.until > Date.now() ? cached.until : 0;

  let until = 0;
  if (DatabaseService.getInstance().isConnected()) {
    try {
      const latest = await Vote.findOne({ userId, perksUntil: { $gt: new Date() } })
        .sort({ perksUntil: -1 })
        .lean<{ perksUntil: Date }>();
      if (latest) until = new Date(latest.perksUntil).getTime();
    } catch (error) {
      console.warn("[Votes] Lookup failed:", (error as Error)?.message ?? error);
    }
  }

  if (!until && process.env.TOPGG_TOKEN) {
    // top.gg v1: 200 {created_at, expires_at} for an active vote, 404 otherwise.
    try {
      const token = process.env.TOPGG_TOKEN.replace(/^Bearer\s+/i, "");
      const { data } = await axios.get(`https://top.gg/api/v1/projects/@me/votes/${userId}`, {
        params: { source: "discord" },
        headers: { Authorization: `Bearer ${token}` },
        timeout: 4000,
        validateStatus: (s) => s === 200 || s === 404
      });
      const expires = data?.expires_at ? new Date(data.expires_at).getTime() : 0;
      if (expires > Date.now()) {
        until = expires;
        await recordVote(userId, "top.gg", new Date(data.created_at ?? Date.now()), false).catch(() => undefined);
      }
    } catch {
      /* top.gg unreachable: fall through */
    }
  } else if (!until && process.env.TOPGG_LEGACY_TOKEN) {
    try {
      const { data } = await axios.get(`https://top.gg/api/bots/${BOT_APPLICATION_ID}/check`, {
        params: { userId },
        headers: { Authorization: process.env.TOPGG_LEGACY_TOKEN },
        timeout: 4000
      });
      // v0 only says "voted in the last 12 h", not when: assume the full window from now.
      if (data?.voted === 1) {
        until = Date.now() + VOTE_PERK_HOURS * 60 * 60 * 1000;
        await recordVote(userId, "top.gg", new Date(), false).catch(() => undefined);
      }
    } catch {
      /* top.gg unreachable: fall through */
    }
  }

  cache.set(userId, { at: Date.now(), until });
  return until;
}

export async function hasActiveVote(userId: string): Promise<boolean> {
  return (await votePerksUntil(userId)) > Date.now();
}

/** Store a vote (used by the top.gg check fallback; the dashboard writes webhook votes). */
export async function recordVote(userId: string, site: string, votedAt: Date, isWeekend: boolean): Promise<void> {
  if (!DatabaseService.getInstance().isConnected()) return;
  const perksUntil = new Date(votedAt.getTime() + VOTE_PERK_HOURS * 60 * 60 * 1000);
  await Vote.updateOne(
    { userId, site, votedAt: { $gte: new Date(votedAt.getTime() - 60 * 60 * 1000) } },
    { $setOnInsert: { userId, site, votedAt, perksUntil, isWeekend } },
    { upsert: true }
  );
  cache.delete(userId);
}

export function isVotePerk(feature: string): boolean {
  return (VOTE_PERK_FEATURES as readonly string[]).includes(feature);
}
