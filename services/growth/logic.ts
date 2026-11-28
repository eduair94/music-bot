/**
 * Pure growth rules for the bot (no I/O): attribution candidates, activation
 * buckets, referral reward limits and share-nudge eligibility. Unit tested in
 * tests/unit/growthBot.test.ts.
 */
import { type InviteClick, pickAttribution } from "../../shared/growth";

/** Ref of servers that were already in the bot when tracking started. */
export const PRE_TRACKING_REF = "pre-tracking";

/**
 * `promise`, or `fallback` when it rejects or takes longer than `ms`. Growth
 * bookkeeping must never stall a Discord or player event on a slow Redis/Mongo.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    return await Promise.race([promise.catch(() => fallback), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Every click a join could have come from, best first (newest unclaimed
 * click inside the window). The caller claims them in order with SET NX:
 * the first one no other join took wins.
 */
export function attributionCandidates(clicks: InviteClick[], joinTs: number, instance = 1, max = 20): InviteClick[] {
  const out: InviteClick[] = [];
  const taken = new Set<string>();
  while (out.length < max) {
    const { click } = pickAttribution(clicks, joinTs, taken, instance);
    if (!click) break;
    out.push(click);
    taken.add(click.id);
  }
  return out;
}

/** JSON InviteClicks from the Redis list; unreadable entries are skipped. */
export function parseClicks(raw: string[]): InviteClick[] {
  const out: InviteClick[] = [];
  for (const entry of raw) {
    try {
      const click = JSON.parse(entry) as InviteClick;
      if (click && typeof click.id === "string" && typeof click.ts === "number" && typeof click.ref === "string") out.push(click);
    } catch {
      /* skip */
    }
  }
  return out;
}

export type FirstPlayBucket = "<1h" | "1-24h" | "1-7d" | "7d+";

/** Time from join to first song, bucketed for GA (never exact). */
export function hoursToFirstPlayBucket(ms: number): FirstPlayBucket {
  const hours = ms / 3_600_000;
  if (!(hours >= 1)) return "<1h";
  if (hours < 24) return "1-24h";
  if (hours < 24 * 7) return "1-7d";
  return "7d+";
}

/** Whole days between join and now (0 for anything under a day or clock skew). */
export function daysInstalled(joinedAt: Date | number | undefined, now = Date.now()): number {
  const t = joinedAt instanceof Date ? joinedAt.getTime() : Number(joinedAt);
  if (!Number.isFinite(t) || t <= 0) return 0;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

// ── Referrals ───────────────────────────────────────────────────────────────

/** A referred server must have at least this many members to earn a reward. */
export const REFERRAL_MIN_MEMBERS = 3;
/** Rewards per referrer per rolling window. */
export const REFERRAL_MAX_REWARDS = 5;
export const REFERRAL_WINDOW_MS = 7 * 86_400_000;
/** Vote "site" recorded for a referral reward (services/votes.ts). */
export const REFERRAL_VOTE_SITE = "referral";

/** Personal referral code for a Discord user, as `/invite` puts it in the link. */
export function referralRef(userId: string): string {
  return `u-${userId}`;
}

/** The referrer's Discord id from a `u-<id>` ref, or null. */
export function referrerIdFromRef(ref: string | undefined | null): string | null {
  const match = /^u-(\d{15,22})$/.exec(ref ?? "");
  return match ? match[1] : null;
}

export type ReferralDecision =
  | { reward: true; referrerId: string }
  | { reward: false; reason: "not-referral" | "backfilled" | "small-server" | "already-rewarded" | "weekly-limit" };

/**
 * Whether a server's first song earns its referrer vote perks: one reward
 * per referred server, only for servers with REFERRAL_MIN_MEMBERS+ members,
 * at most REFERRAL_MAX_REWARDS per referrer in REFERRAL_WINDOW_MS.
 */
export function referralRewardDecision(p: {
  ref: string;
  memberCount: number;
  alreadyRewarded: boolean;
  rewardsInWindow: number;
  backfilled?: boolean;
}): ReferralDecision {
  const referrerId = referrerIdFromRef(p.ref);
  if (!referrerId) return { reward: false, reason: "not-referral" };
  if (p.backfilled) return { reward: false, reason: "backfilled" };
  if (p.alreadyRewarded) return { reward: false, reason: "already-rewarded" };
  if (!(p.memberCount >= REFERRAL_MIN_MEMBERS)) return { reward: false, reason: "small-server" };
  if (p.rewardsInWindow >= REFERRAL_MAX_REWARDS) return { reward: false, reason: "weekly-limit" };
  return { reward: true, referrerId };
}

// ── Share nudge ─────────────────────────────────────────────────────────────

/** Songs a session must have played before the end-of-queue nudge appears. */
export const NUDGE_MIN_TRACKS = 5;
/** One nudge per server per this many seconds, across every Bypass instance. */
export const NUDGE_COOLDOWN_S = 14 * 86400;
/** The nudge deletes itself after this long. */
export const NUDGE_TTL_MS = 10 * 60 * 1000;
export const nudgeKey = (guildId: string) => `growth:nudge:${guildId}`;

/** Local checks before spending the server's 14-day nudge slot. */
export function nudgeEligible(p: { linked: boolean; tracksPlayed: number; guessGame?: boolean; announceDisabled?: boolean }): boolean {
  if (p.linked || p.guessGame || p.announceDisabled) return false;
  return p.tracksPlayed >= NUDGE_MIN_TRACKS;
}
