import { describe, expect, it } from "vitest";
import { fillDaily, fillHours, parseDays, parseLimit } from "./activity-shape";

describe("activity shaping", () => {
  it("zero-fills every day of the window, oldest first", () => {
    const now = new Date("2026-11-27T15:00:00Z");
    const daily = fillDaily(7, [{ _id: "2026-11-25", plays: 3, listeningMs: 600000 }], now);
    expect(daily).toHaveLength(7);
    expect(daily[0].date).toBe("2026-11-21");
    expect(daily[6].date).toBe("2026-11-27");
    expect(daily[4]).toEqual({ date: "2026-11-25", plays: 3, listeningMs: 600000 });
    expect(daily[5].plays).toBe(0);
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
