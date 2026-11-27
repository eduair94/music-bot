import { describe, expect, it } from "vitest";
import { lineIndexAt, liveWindow, parseLrc, pickLrclibHit } from "../../utils/lyricsQuery";

const LRC = [
  "[ar:The Killers]",
  "[00:06.54] Comin' out of my cage and I've been doin' just fine",
  "[00:10.09] Gotta, gotta be down because I want it all",
  "[00:13.30] It started out with a kiss, how did it end up like this?",
  "[00:16.45] It was only a kiss, it was only a kiss",
  "[00:20.00]",
  "[01:02.5] Now I'm falling asleep"
].join("\n");

describe("parseLrc", () => {
  it("reads timed lines in order and skips tags", () => {
    const lines = parseLrc(LRC);
    expect(lines).toHaveLength(6);
    expect(lines[0]).toEqual({ timeMs: 6540, line: "Comin' out of my cage and I've been doin' just fine" });
    expect(lines[4]).toEqual({ timeMs: 20000, line: "" });
    expect(lines[5].timeMs).toBe(62500);
  });

  it("expands lines with several stamps and sorts them", () => {
    const lines = parseLrc("[00:30.00][00:05.00] chorus\n[00:10.00] verse");
    expect(lines.map((l) => [l.timeMs, l.line])).toEqual([
      [5000, "chorus"],
      [10000, "verse"],
      [30000, "chorus"]
    ]);
  });

  it("applies the offset tag (positive = sooner) and accepts CRLF and [mm:ss]", () => {
    const lines = parseLrc("[offset:+500]\r\n[00:10] one\r\n[00:12:50] two");
    expect(lines).toEqual([
      { timeMs: 9500, line: "one" },
      { timeMs: 12000, line: "two" }
    ]);
  });
});

describe("lineIndexAt", () => {
  const lines = parseLrc(LRC);

  it("is -1 before the first line", () => {
    expect(lineIndexAt(lines, 0)).toBe(-1);
    expect(lineIndexAt(lines, 6539)).toBe(-1);
  });

  it("returns the line being sung, inclusive of its start", () => {
    expect(lineIndexAt(lines, 6540)).toBe(0);
    expect(lineIndexAt(lines, 10_000)).toBe(0);
    expect(lineIndexAt(lines, 10_090)).toBe(1);
    expect(lineIndexAt(lines, 15_000)).toBe(2);
    expect(lineIndexAt(lines, 45_000)).toBe(4);
  });

  it("stays on the last line after the end, and handles no lines", () => {
    expect(lineIndexAt(lines, 600_000)).toBe(5);
    expect(lineIndexAt([], 1000)).toBe(-1);
  });

  it("follows a seek backwards", () => {
    expect(lineIndexAt(lines, 62_600)).toBe(5);
    expect(lineIndexAt(lines, 11_000)).toBe(1);
  });
});

describe("liveWindow", () => {
  const lines = parseLrc(LRC);

  it("shows the previous, current and next two lines", () => {
    expect(liveWindow(lines, 2)).toEqual({
      previous: "Gotta, gotta be down because I want it all",
      current: "It started out with a kiss, how did it end up like this?",
      next: ["It was only a kiss, it was only a kiss", ""]
    });
  });

  it("before the first line shows what comes next", () => {
    const view = liveWindow(lines, -1);
    expect(view.previous).toBeNull();
    expect(view.current).toBeNull();
    expect(view.next).toEqual([lines[0].line, lines[1].line]);
  });

  it("at the last line has nothing ahead", () => {
    expect(liveWindow(lines, 5)).toEqual({ previous: "", current: "Now I'm falling asleep", next: [] });
  });
});

describe("pickLrclibHit", () => {
  const hits = [
    { id: 1, syncedLyrics: null, duration: 222 },
    { id: 2, syncedLyrics: "[00:01.00] a", duration: 245 },
    { id: 3, syncedLyrics: "[00:01.00] a", duration: 223 }
  ];

  it("prefers synced hits, then the closest duration", () => {
    expect(pickLrclibHit(hits, 222)?.id).toBe(3);
    expect(pickLrclibHit(hits, 250)?.id).toBe(2);
  });

  it("keeps the first synced hit when no duration is known", () => {
    expect(pickLrclibHit(hits)?.id).toBe(2);
  });

  it("falls back to an unsynced hit unless synced is required", () => {
    const plain = [{ id: 9, syncedLyrics: null, duration: 100 }];
    expect(pickLrclibHit(plain, 100)?.id).toBe(9);
    expect(pickLrclibHit(plain, 100, true)).toBeNull();
    expect(pickLrclibHit([], 100)).toBeNull();
  });
});
