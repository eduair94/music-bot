import { describe, expect, it } from "vitest";
import { type AcquisitionRow, buildGrowthReport, clampDays, isTrackedJoin, joinRef, median, windowDays } from "./growth";

const NOW = new Date("2026-11-27T15:00:00Z");
const CONFIG = { gaServer: true, gaClient: true, clarity: false };
const SOURCES = { redis: true, mongo: true };
const REFERRER = "123456789012345678";

const row = (over: Partial<AcquisitionRow>): AcquisitionRow => ({
  guildId: Math.random().toString().slice(2),
  name: "Server",
  memberCount: 10,
  ref: "direct",
  joinedAt: "2026-11-26T10:00:00Z",
  ...over,
});

describe("helpers", () => {
  it("clamps ?days", () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays("7")).toBe(7);
    expect(clampDays("0")).toBe(30);
    expect(clampDays("999")).toBe(120);
    expect(clampDays("abc")).toBe(30);
  });

  it("lists window days oldest first", () => {
    expect(windowDays(3, NOW)).toEqual(["2026-11-25", "2026-11-26", "2026-11-27"]);
  });

  it("median of odd and even lists", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("uses the latest join's source and skips backfilled rows", () => {
    expect(joinRef(row({ ref: "topgg", lastRef: "site-hero", rejoins: 1 }))).toBe("site-hero");
    expect(joinRef(row({ ref: "topgg", lastRef: "site-hero", rejoins: 0 }))).toBe("topgg");
    expect(isTrackedJoin(row({ backfilled: true }))).toBe(false);
    expect(isTrackedJoin(row({ backfilled: true, rejoins: 2 }))).toBe(true);
  });
});

describe("buildGrowthReport", () => {
  const report = buildGrowthReport({
    days: 3,
    now: NOW,
    dailyClicks: [
      { date: "2026-11-26", counts: { "site-hero": 4, topgg: 2 } },
      { date: "2026-11-27", counts: { "site-hero": 1, junk: -3 as unknown as number } },
      { date: "2026-10-01", counts: { "site-hero": 50 } },
    ],
    acquisitions: [
      // Activated after 2 h, still installed.
      row({ ref: "site-hero", joinedAt: "2026-11-26T10:00:00Z", firstPlayAt: "2026-11-26T12:00:00Z" }),
      // Activated after 6 h, then removed.
      row({ ref: "site-hero", joinedAt: "2026-11-27T01:00:00Z", firstPlayAt: "2026-11-27T07:00:00Z", leftAt: "2026-11-27T09:00:00Z" }),
      // Never played.
      row({ ref: "topgg", joinedAt: "2026-11-26T11:00:00Z" }),
      // Direct join.
      row({ ref: "direct", joinedAt: "2026-11-25T08:00:00Z" }),
      // Outside the window.
      row({ ref: "topgg", joinedAt: "2026-10-01T08:00:00Z" }),
      // Before tracking (excluded from joins).
      row({ ref: "pre-tracking", backfilled: true, joinedAt: "2026-11-26T00:00:00Z" }),
      // Referral, rewarded.
      row({ ref: `u-${REFERRER}`, joinedAt: "2026-11-27T02:00:00Z", firstPlayAt: "2026-11-27T02:30:00Z", referralRewardedAt: "2026-11-27T02:30:00Z" }),
      // Rejoin via site-hero; its first song was in an earlier stay.
      row({ ref: "topgg", lastRef: "site-hero", rejoins: 1, joinedAt: "2026-11-27T05:00:00Z", firstPlayAt: "2026-09-01T00:00:00Z" }),
    ],
    config: CONFIG,
    sources: SOURCES,
  });

  it("zero-fills both daily series for the window", () => {
    expect(report.clicksByDay.map((d) => [d.date, d.total])).toEqual([
      ["2026-11-25", 0],
      ["2026-11-26", 6],
      ["2026-11-27", 1],
    ]);
    expect(report.joinsByDay.map((d) => d.total)).toEqual([1, 2, 3]);
    expect(report.joinsByDay[2].byRef).toEqual({ "site-hero": 2, [`u-${REFERRER}`]: 1 });
  });

  it("builds the per-source funnel", () => {
    const hero = report.funnel.find((f) => f.ref === "site-hero")!;
    expect(hero).toMatchObject({ clicks: 5, joins: 3, activated: 3, installed: 2, removed: 1, joinRate: 60, activationRate: 100 });
    // The rejoin's old first song doesn't count toward time to first play: median of 2 h and 6 h.
    expect(hero.medianHoursToFirstPlay).toBe(4);
    expect(hero.label).toBe("Website hero");

    const topgg = report.funnel.find((f) => f.ref === "topgg")!;
    expect(topgg).toMatchObject({ clicks: 2, joins: 1, activated: 0, joinRate: 50, activationRate: 0, medianHoursToFirstPlay: null });

    const direct = report.funnel.find((f) => f.ref === "direct")!;
    expect(direct).toMatchObject({ clicks: 0, joins: 1, joinRate: null });
    expect(report.funnel[0].ref).toBe("site-hero");
  });

  it("totals and pre-tracking count", () => {
    expect(report.totals).toMatchObject({ ref: "*", label: "All sources", clicks: 7, joins: 6, activated: 4, installed: 5, removed: 1 });
    expect(report.preTracking).toBe(1);
  });

  it("lists referrers by id and recent joins newest first", () => {
    expect(report.topReferrers).toEqual([{ userId: REFERRER, servers: 1, installed: 1, activated: 1, rewarded: 1 }]);
    expect(report.recent[0].joinedAt).toBe("2026-11-27T05:00:00.000Z");
    expect(report.recent[0]).toMatchObject({ ref: "site-hero", rejoin: true });
    expect(report.recent).toHaveLength(6);
  });

  it("counts website buttons apart from sources", () => {
    const report = buildGrowthReport({
      days: 7,
      now: NOW,
      dailyClicks: [{ date: "2026-11-26", counts: { topgg: 3, "@site-hero": 2, "@site-pricing": 1 } }],
      acquisitions: [
        row({ ref: "topgg", placement: "site-hero", firstPlayAt: "2026-11-26T11:00:00Z" }),
        row({ ref: "topgg" }),
      ],
      config: CONFIG,
      sources: SOURCES,
    });
    // "@" fields never become sources or inflate click totals.
    expect(report.funnel.map((f) => f.ref)).toEqual(["topgg"]);
    expect(report.totals.clicks).toBe(3);
    expect(report.placements).toEqual([
      { placement: "site-hero", label: "Website hero", clicks: 2, joins: 1, activated: 1, joinRate: 50 },
      { placement: "site-pricing", label: "Website pricing", clicks: 1, joins: 0, activated: 0, joinRate: 0 },
    ]);
  });

  it("passes config and source health through", () => {
    expect(report.config).toEqual(CONFIG);
    expect(report.sources).toEqual(SOURCES);
    expect(report.from).toBe("2026-11-25");
    expect(report.to).toBe("2026-11-27");
  });
});
