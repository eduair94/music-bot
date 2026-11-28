import { describe, expect, it } from "vitest";
import { localDay, npsBandOf, parseDays, parseLast, shouldShowNps, withVisit } from "./nps";

const DAY = 86400_000;

describe("NPS visit days", () => {
  it("formats the local day", () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("counts each day once and keeps a bounded list", () => {
    let days: string[] = [];
    days = withVisit(days, "2026-11-01");
    days = withVisit(days, "2026-11-01");
    days = withVisit(days, "2026-11-03");
    expect(days).toEqual(["2026-11-01", "2026-11-03"]);
    const many = Array.from({ length: 40 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
    expect(withVisit(many, "2026-12-01")).toHaveLength(30);
    expect(withVisit(many, "2026-12-01").at(-1)).toBe("2026-12-01");
  });

  it("reads stored values defensively", () => {
    expect(parseDays(null)).toEqual([]);
    expect(parseDays("not json")).toEqual([]);
    expect(parseDays('{"a":1}')).toEqual([]);
    expect(parseDays('["2026-11-01", 5, "junk"]')).toEqual(["2026-11-01"]);
    expect(parseLast('{"at":5,"action":"answered"}')).toEqual({ at: 5, action: "answered" });
    expect(parseLast('{"at":"x"}')).toBeNull();
    expect(parseLast("{")).toBeNull();
  });
});

describe("shouldShowNps", () => {
  const now = Date.UTC(2026, 10, 27);
  const three = ["2026-11-20", "2026-11-22", "2026-11-27"];

  it("waits for three distinct days", () => {
    expect(shouldShowNps(three.slice(0, 2), null, now)).toBe(false);
    expect(shouldShowNps(three, null, now)).toBe(true);
  });

  it("stays quiet for 90 days after an answer or dismissal", () => {
    expect(shouldShowNps(three, now - 10 * DAY, now)).toBe(false);
    expect(shouldShowNps(three, now - 89 * DAY, now)).toBe(false);
    expect(shouldShowNps(three, now - 90 * DAY, now)).toBe(true);
  });
});

describe("npsBandOf", () => {
  it("splits promoters, passives and detractors", () => {
    expect([0, 6, 7, 8, 9, 10].map(npsBandOf)).toEqual(["detractor", "detractor", "passive", "passive", "promoter", "promoter"]);
  });
});
