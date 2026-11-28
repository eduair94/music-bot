import { describe, expect, it } from "vitest";
import type { InviteClick } from "../../shared/growth";
import {
  attributionCandidates,
  daysInstalled,
  hoursToFirstPlayBucket,
  nudgeEligible,
  nudgeKey,
  NUDGE_MIN_TRACKS,
  parseClicks,
  referralRef,
  referralRewardDecision,
  referrerIdFromRef,
  REFERRAL_MAX_REWARDS,
  withTimeout
} from "../../services/growth/logic";

const JOIN = Date.parse("2026-11-27T12:00:00Z");
const click = (id: string, agoMs: number, extra: Partial<InviteClick> = {}): InviteClick => ({ id, ts: JOIN - agoMs, ref: `r-${id}`, ...extra });

describe("attributionCandidates", () => {
  it("lists claimable clicks newest first, inside the window, for this instance", () => {
    const clicks = [click("old", 45 * 60_000), click("a", 10 * 60_000), click("b", 60_000), click("fleet", 30_000, { instance: 2 }), click("future", -5 * 60_000)];
    expect(attributionCandidates(clicks, JOIN).map((c) => c.id)).toEqual(["b", "a"]);
    expect(attributionCandidates(clicks, JOIN, 2).map((c) => c.id)).toEqual(["fleet"]);
  });

  it("caps the number of candidates", () => {
    const clicks = Array.from({ length: 30 }, (_, i) => click(`c${i}`, i * 1000));
    expect(attributionCandidates(clicks, JOIN, 1, 5)).toHaveLength(5);
  });

  it("is empty with no clicks", () => {
    expect(attributionCandidates([], JOIN)).toEqual([]);
  });
});

describe("parseClicks", () => {
  it("skips junk entries", () => {
    const good = JSON.stringify(click("x", 1000));
    expect(parseClicks([good, "not json", JSON.stringify({ id: 1 }), "null"]).map((c) => c.id)).toEqual(["x"]);
  });
});

describe("hoursToFirstPlayBucket", () => {
  it("buckets the delay", () => {
    expect(hoursToFirstPlayBucket(0)).toBe("<1h");
    expect(hoursToFirstPlayBucket(-5000)).toBe("<1h");
    expect(hoursToFirstPlayBucket(NaN)).toBe("<1h");
    expect(hoursToFirstPlayBucket(59 * 60_000)).toBe("<1h");
    expect(hoursToFirstPlayBucket(60 * 60_000)).toBe("1-24h");
    expect(hoursToFirstPlayBucket(23.9 * 3_600_000)).toBe("1-24h");
    expect(hoursToFirstPlayBucket(24 * 3_600_000)).toBe("1-7d");
    expect(hoursToFirstPlayBucket(7 * 24 * 3_600_000)).toBe("7d+");
  });

  it("counts whole days installed", () => {
    expect(daysInstalled(new Date(JOIN), JOIN + 36 * 3_600_000)).toBe(1);
    expect(daysInstalled(JOIN, JOIN - 1000)).toBe(0);
    expect(daysInstalled(undefined, JOIN)).toBe(0);
  });
});

describe("referrals", () => {
  const ID = "123456789012345678";

  it("round-trips the referral code", () => {
    expect(referralRef(ID)).toBe(`u-${ID}`);
    expect(referrerIdFromRef(`u-${ID}`)).toBe(ID);
    expect(referrerIdFromRef("site-hero")).toBeNull();
    expect(referrerIdFromRef("u-123")).toBeNull();
    expect(referrerIdFromRef(undefined)).toBeNull();
  });

  const base = { ref: `u-${ID}`, memberCount: 10, alreadyRewarded: false, rewardsInWindow: 0 };

  it("rewards a referred server once", () => {
    expect(referralRewardDecision(base)).toEqual({ reward: true, referrerId: ID });
    expect(referralRewardDecision({ ...base, alreadyRewarded: true })).toEqual({ reward: false, reason: "already-rewarded" });
  });

  it("needs a real referral of a non-tiny, tracked server", () => {
    expect(referralRewardDecision({ ...base, ref: "topgg" })).toMatchObject({ reward: false, reason: "not-referral" });
    expect(referralRewardDecision({ ...base, memberCount: 2 })).toMatchObject({ reward: false, reason: "small-server" });
    expect(referralRewardDecision({ ...base, memberCount: 3 })).toMatchObject({ reward: true });
    expect(referralRewardDecision({ ...base, backfilled: true })).toMatchObject({ reward: false, reason: "backfilled" });
  });

  it("stops at the weekly limit", () => {
    expect(referralRewardDecision({ ...base, rewardsInWindow: REFERRAL_MAX_REWARDS - 1 })).toMatchObject({ reward: true });
    expect(referralRewardDecision({ ...base, rewardsInWindow: REFERRAL_MAX_REWARDS })).toMatchObject({ reward: false, reason: "weekly-limit" });
  });
});

describe("share nudge", () => {
  it("needs a long enough session on a Bypass bot", () => {
    expect(nudgeEligible({ linked: false, tracksPlayed: NUDGE_MIN_TRACKS })).toBe(true);
    expect(nudgeEligible({ linked: false, tracksPlayed: NUDGE_MIN_TRACKS - 1 })).toBe(false);
    expect(nudgeEligible({ linked: true, tracksPlayed: 50 })).toBe(false);
    expect(nudgeEligible({ linked: false, tracksPlayed: 50, guessGame: true })).toBe(false);
    expect(nudgeEligible({ linked: false, tracksPlayed: 50, announceDisabled: true })).toBe(false);
  });

  it("keys the cooldown per server", () => {
    expect(nudgeKey("42")).toBe("growth:nudge:42");
  });
});

describe("withTimeout", () => {
  it("returns the value, or the fallback on rejection or delay", async () => {
    expect(await withTimeout(Promise.resolve(1), 50, 0)).toBe(1);
    expect(await withTimeout(Promise.reject(new Error("x")), 50, 0)).toBe(0);
    expect(await withTimeout(new Promise<number>((r) => setTimeout(() => r(1), 200)), 10, 0)).toBe(0);
  });
});
