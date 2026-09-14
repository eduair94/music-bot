import { describe, expect, it } from "vitest";
import { delta, errorRate, fillDailySeries, freshness, utcDay } from "./aggregate";

describe("fillDailySeries", () => {
  it("zero-fills missing days oldest→newest", () => {
    const now = new Date("2026-09-14T12:00:00Z");
    const out = fillDailySeries([{ date: "2026-09-13", commands: 5, tracks: 2, errors: 1 }], 3, now);
    expect(out.map((p) => p.date)).toEqual(["2026-09-12", "2026-09-13", "2026-09-14"]);
    expect(out[1]).toEqual({ date: "2026-09-13", commands: 5, tracks: 2, errors: 1 });
    expect(out[2]).toEqual({ date: "2026-09-14", commands: 0, tracks: 0, errors: 0 });
  });
  it("utcDay formats YYYY-MM-DD", () => {
    expect(utcDay(new Date("2026-01-02T23:59:59Z"))).toBe("2026-01-02");
  });
});

describe("delta / errorRate", () => {
  it("computes absolute and percent deltas", () => {
    expect(delta(120, 100)).toEqual({ abs: 20, pct: 20 });
    expect(delta(5, 0)).toEqual({ abs: 5, pct: null });
    expect(delta(33, 100).pct).toBe(-67);
  });
  it("errorRate is a rounded percent", () => {
    expect(errorRate(1, 8)).toBe(12.5);
    expect(errorRate(0, 0)).toBe(0);
  });
});

describe("freshness", () => {
  const now = Date.parse("2026-09-14T00:10:00Z");
  it("classifies by age", () => {
    expect(freshness("2026-09-14T00:09:30Z", now)).toEqual({ state: "fresh", ageSec: 30 });
    expect(freshness("2026-09-14T00:05:00Z", now)).toEqual({ state: "stale", ageSec: 300 });
    expect(freshness("2026-09-13T00:00:00Z", now).state).toBe("offline");
    expect(freshness(null, now)).toEqual({ state: "offline", ageSec: null });
    expect(freshness("garbage", now)).toEqual({ state: "offline", ageSec: null });
  });
});
