import { describe, expect, it } from "vitest";
import {
  artistKey,
  buildChoices,
  CHOICES_PER_ROUND,
  dedupeTracks,
  displayTitle,
  pickRoundTracks,
  PreviewTrack,
  rankScores,
  scoreFor,
  titleKey
} from "../../services/guessLogic";

/** Deterministic RNG (mulberry32) so shuffles are reproducible. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const track = (id: number, title: string, artist: string): PreviewTrack => ({
  id: `dz:${id}`,
  title,
  artist,
  preview: `https://cdn.example/${id}.mp3`,
  source: "deezer",
  deezerId: id
});

const POOL: PreviewTrack[] = [
  track(1, "Sussudio (2016 Remaster)", "Phil Collins"),
  track(2, "In the Air Tonight", "Phil Collins"),
  track(3, "Shout", "Tears for Fears"),
  track(4, "Karma Chameleon (Remastered 2002)", "Culture Club"),
  track(5, "Drown (feat. Clinton Kane)", "Martin Garrix"),
  track(6, "Don't Stop Believin' - 2024 Remaster", "Journey"),
  track(7, "Under Pressure", "Queen"),
  track(8, "Take On Me", "a-ha"),
  track(9, "Africa", "TOTO"),
  track(10, "Billie Jean", "Michael Jackson")
];

describe("displayTitle", () => {
  it("drops guests and version tags", () => {
    expect(displayTitle("Drown (feat. Clinton Kane)")).toBe("Drown");
    expect(displayTitle("Sussudio (2016 Remaster)")).toBe("Sussudio");
    expect(displayTitle("Don't Stop Believin' - 2024 Remaster")).toBe("Don't Stop Believin'");
    expect(displayTitle("Flower In A Hurricane [From GTAVI: Original Score]")).toBe("Flower In A Hurricane");
    expect(displayTitle("Who Knew (Edit)")).toBe("Who Knew");
  });

  it("keeps titles that are only a tag, and plain titles", () => {
    expect(displayTitle("(I Just) Died In Your Arms")).toBe("(I Just) Died In Your Arms");
    expect(displayTitle("Africa")).toBe("Africa");
  });
});

describe("dedupeTracks", () => {
  it("drops repeats of the same song and tracks without previews", () => {
    const list = [
      track(1, "Shout", "Tears for Fears"),
      track(2, "Shout (Remastered)", "Tears For Fears"),
      { ...track(3, "Africa", "TOTO"), preview: "" },
      track(4, "Shout", "Isley Brothers")
    ];
    expect(dedupeTracks(list).map((t) => t.id)).toEqual(["dz:1", "dz:4"]);
  });
});

describe("pickRoundTracks", () => {
  it("picks the requested number of distinct songs, distinct artists first", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const picks = pickRoundTracks(POOL, 5, seeded(seed));
      expect(picks).toHaveLength(5);
      expect(new Set(picks.map((t) => t.id)).size).toBe(5);
      expect(new Set(picks.map(artistKey)).size).toBe(5);
    }
  });

  it("repeats an artist only when the pool runs out of new ones", () => {
    const picks = pickRoundTracks(POOL, 10, seeded(3));
    expect(new Set(picks.map((t) => t.id)).size).toBe(10);
  });
});

describe("buildChoices", () => {
  it("returns four shuffled options with the answer at correctIndex", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      const correct = POOL[seed % POOL.length];
      const { options, correctIndex } = buildChoices(correct, POOL, seeded(seed));
      expect(options).toHaveLength(CHOICES_PER_ROUND);
      expect(options[correctIndex]).toBe(correct);
      expect(options.filter((o) => o === correct)).toHaveLength(1);
      // distinct titles and distinct artists across all four buttons
      expect(new Set(options.map(titleKey)).size).toBe(CHOICES_PER_ROUND);
      expect(new Set(options.map(artistKey)).size).toBe(CHOICES_PER_ROUND);
      positions.add(correctIndex);
    }
    // the answer is not always on the same button
    expect(positions.size).toBeGreaterThan(2);
  });

  it("never uses the same artist as a decoy when others exist", () => {
    const correct = POOL[0]; // Phil Collins
    for (let seed = 1; seed <= 20; seed++) {
      const { options } = buildChoices(correct, POOL, seeded(seed));
      expect(options.filter((o) => o.artist === "Phil Collins")).toHaveLength(1);
    }
  });

  it("keeps other rounds' answers out of the decoys when it can", () => {
    const correct = POOL[2];
    const avoid = new Set(POOL.slice(3, 6).map((t) => t.id));
    for (let seed = 1; seed <= 20; seed++) {
      const { options } = buildChoices(correct, POOL, seeded(seed), avoid);
      expect(options.some((o) => avoid.has(o.id))).toBe(false);
    }
  });

  it("prefers distinct artists over avoiding other rounds' answers", () => {
    const correct = POOL[2];
    // Only Phil Collins and Michael Jackson are left outside `avoid`.
    const avoid = new Set(POOL.slice(3, 9).map((t) => t.id));
    const { options } = buildChoices(correct, POOL, seeded(5), avoid);
    expect(new Set(options.map(artistKey)).size).toBe(CHOICES_PER_ROUND);
    expect(options.filter((o) => avoid.has(o.id))).toHaveLength(1);
  });

  it("allows a repeated artist rather than fewer buttons in a tiny pool", () => {
    const tiny = [track(1, "A", "Same"), track(2, "B", "Same"), track(3, "C", "Same"), track(4, "D", "Other")];
    const { options, correctIndex } = buildChoices(tiny[0], tiny, seeded(7));
    expect(options).toHaveLength(4);
    expect(options[correctIndex]).toBe(tiny[0]);
    expect(new Set(options.map(titleKey)).size).toBe(4);
  });
});

describe("scoreFor", () => {
  it("gives 100 for an instant answer and 50 at the buzzer", () => {
    expect(scoreFor(0, 25_000)).toBe(100);
    expect(scoreFor(25_000, 25_000)).toBe(50);
    expect(scoreFor(12_500, 25_000)).toBe(75);
  });

  it("is monotonic and clamped", () => {
    expect(scoreFor(2_000, 25_000)).toBeGreaterThan(scoreFor(10_000, 25_000));
    expect(scoreFor(-500, 25_000)).toBe(100);
    expect(scoreFor(60_000, 25_000)).toBe(50);
  });
});

describe("rankScores", () => {
  it("orders by points, then correct answers, then who scored first", () => {
    const scores = new Map([
      ["first", { points: 150, correct: 2 }],
      ["second", { points: 180, correct: 2 }],
      ["third", { points: 150, correct: 2 }],
      ["fourth", { points: 150, correct: 3 }]
    ]);
    expect(rankScores(scores).map((s) => s.userId)).toEqual(["second", "fourth", "first", "third"]);
  });
});
