import { describe, expect, it } from "vitest";
import { dominantInstance, fillDaily, fillHours, instanceKey, parseDays, parseLimit, splitByInstance } from "./activity-shape";

describe("activity shaping", () => {
  it("zero-fills every day of the window, oldest first", () => {
    const now = new Date("2026-11-27T15:00:00Z");
    const daily = fillDaily(
      7,
      [
        { _id: "2026-11-25", plays: 3, listeningMs: 600000, byInstance: { "1": 2, "2": 1 } },
        { _id: "2026-11-26", plays: 2, listeningMs: 400000 }
      ],
      now
    );
    expect(daily).toHaveLength(7);
    expect(daily[0].date).toBe("2026-11-21");
    expect(daily[6].date).toBe("2026-11-27");
    expect(daily[4]).toEqual({ date: "2026-11-25", plays: 3, listeningMs: 600000, byInstance: { "1": 2, "2": 1 } });
    // A day without a split is all Bypass; an empty day has no split.
    expect(daily[5].byInstance).toEqual({ "1": 2 });
    expect(daily[6]).toEqual({ date: "2026-11-27", plays: 0, listeningMs: 0, byInstance: {} });
  });

  it("splits plays by the bot that played them; old rows count as Bypass", () => {
    expect(instanceKey(2)).toBe("2");
    expect(instanceKey(null)).toBe("1");
    expect(instanceKey(undefined)).toBe("1");
    expect(instanceKey(9)).toBe("1");
    const split = splitByInstance([
      { instance: 1, plays: 4 },
      { instance: null, plays: 3 },
      { instance: 3, plays: 2 },
      { instance: 2, plays: 0 }
    ]);
    expect(split).toEqual({ "1": 7, "3": 2 });
    expect(dominantInstance(split)).toBe(1);
    expect(dominantInstance({ "2": 5, "3": 5 })).toBe(2);
    expect(dominantInstance({ "3": 6, "2": 5 })).toBe(3);
    expect(dominantInstance({})).toBe(1);
  });

  it("builds a 24-hour histogram", () => {
    const hours = fillHours([{ _id: 0, plays: 2 }, { _id: 23, plays: 5 }, { _id: 99, plays: 1 }]);
    expect(hours).toHaveLength(24);
    expect(hours[0]).toBe(2);
    expect(hours[23]).toBe(5);
    expect(hours.reduce((a, b) => a + b, 0)).toBe(7);
  });

  it("parses query parameters", () => {
    expect(parseDays("30")).toBe(30);
    expect(parseDays("90")).toBe(7);
    expect(parseDays(null)).toBe(7);
    expect(parseLimit(null, 50, 100)).toBe(50);
    expect(parseLimit("500", 50, 100)).toBe(100);
    expect(parseLimit("0", 50, 100)).toBe(1);
    expect(parseLimit("abc", 50, 100)).toBe(50);
  });
});
