import { describe, expect, it } from "vitest";
import { FLEET_FREE_INSTANCES } from "../../../shared/fleet";
import { bots, bypassCaveat, checkedOn, checkedOnShort, columns, homeColumns, retiredBots, sourceGroups } from "./comparison";

const competitors = bots.filter((b) => !b.isBypass);
const bypass = bots.find((b) => b.isBypass);

function isHttpsUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

describe("comparison data", () => {
  it("has a check date", () => {
    expect(checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(checkedOn))).toBe(false);
    expect(checkedOnShort).toBe("28 Nov 2026");
  });

  it("lists Bypass once and at least two competitors", () => {
    expect(bots.filter((b) => b.isBypass)).toHaveLength(1);
    expect(competitors.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bots.map((b) => b.id)).size).toBe(bots.length);
  });

  it("fills every column for every bot", () => {
    for (const bot of bots) {
      for (const column of columns) expect(bot.cells[column.key], `${bot.name} ${column.key}`).toBeDefined();
    }
    expect(homeColumns.length).toBeGreaterThan(0);
    expect(homeColumns.length).toBeLessThan(columns.length);
  });

  it("sources every competitor cell that states something (https)", () => {
    for (const bot of competitors) {
      for (const column of columns) {
        const cell = bot.cells[column.key];
        if (cell.value === null) continue;
        expect(isHttpsUrl(cell.source?.url), `${bot.name} ${column.key}`).toBe(true);
        expect(cell.source?.label.trim(), `${bot.name} ${column.key} label`).toBeTruthy();
      }
    }
  });

  it("sources every competitor note and every retired-bot note (https)", () => {
    for (const bot of [...competitors, ...retiredBots]) {
      expect(bot.notes.length, bot.name).toBeGreaterThan(0);
      for (const note of bot.notes) expect(isHttpsUrl(note.source?.url), `${bot.name}: ${note.text}`).toBe(true);
    }
  });

  it("puts every URL in the sources list", () => {
    const listed = new Set(sourceGroups.flatMap((g) => g.sources.map((s) => s.url)));
    for (const bot of [...competitors, ...retiredBots]) {
      const cellSources = "cells" in bot ? Object.values(bot.cells).map((c) => c.source) : [];
      for (const source of [...cellSources, ...bot.notes.map((n) => n.source)]) {
        if (source) expect(listed.has(source.url), source.url).toBe(true);
      }
    }
    for (const group of sourceGroups) {
      for (const source of group.sources) expect(isHttpsUrl(source.url), source.url).toBe(true);
    }
  });

  it("keeps Bypass claims inside what is true (PRODUCT.md)", () => {
    expect(bypass).toBeDefined();
    const text = [
      ...Object.values(bypass!.cells).map((c) => c.value ?? ""),
      ...bypass!.notes.map((n) => n.text),
      bypass!.fit,
      bypassCaveat,
    ].join("\n");
    expect(text).not.toMatch(/320/);
    expect(text).not.toMatch(/unlimited/i);
    expect(text).not.toMatch(/priority queue/i);
    // 256 kbps is tied to Premium, a vote or a boost; 128 is the standard rate.
    expect(bypass!.cells.audio.value).toMatch(/^128 kbps; up to 256 kbps with Premium/);
    expect(bypass!.cells.freeBots.value).toMatch(new RegExp(`^${FLEET_FREE_INSTANCES}\\b`));
  });
});
