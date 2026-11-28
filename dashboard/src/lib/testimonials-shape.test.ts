import { describe, expect, it } from "vitest";
import {
  captionParts,
  clampText,
  cleanQuoteText,
  DEFAULT_ATTRIBUTION,
  QUOTE_MAX,
  TESTIMONIALS_MAX,
  toTestimonial,
  toTestimonials,
} from "./testimonials-shape";

const doc = (over: Record<string, unknown> = {}) => ({
  kind: "praise",
  source: "site",
  message: "The web player is great, my friends queue songs from their phones.",
  quoteOk: true,
  featured: true,
  createdAt: new Date("2026-11-20T12:00:00Z"),
  ...over,
});

describe("cleanQuoteText", () => {
  it("trims and collapses every run of whitespace, newlines included", () => {
    expect(cleanQuoteText("  great \n\n bot\t\tthanks  ")).toBe("great bot thanks");
  });

  it("drops control and bidi characters but keeps emoji joiners", () => {
    expect(cleanQuoteText("a\u0000b\u202Ec\u2066d\u200Be\uFEFF")).toBe("abcde");
    const family = "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}";
    expect(cleanQuoteText(`love it ${family}`)).toBe(`love it ${family}`);
  });

  it("returns an empty string for non-strings", () => {
    expect(cleanQuoteText(undefined)).toBe("");
    expect(cleanQuoteText(42)).toBe("");
    expect(cleanQuoteText(null)).toBe("");
  });
});

describe("clampText", () => {
  it("leaves short text alone", () => {
    expect(clampText("short and sweet", 20)).toBe("short and sweet");
    expect(clampText("x".repeat(QUOTE_MAX), QUOTE_MAX)).toHaveLength(QUOTE_MAX);
  });

  it("cuts on a word boundary, drops trailing punctuation and adds an ellipsis within the limit", () => {
    const text = `${"word ".repeat(70)}end`; // 353 chars
    const out = clampText(text, QUOTE_MAX);
    expect(Array.from(out).length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(out.endsWith("word…")).toBe(true);
    expect(clampText("one two three, four", 16)).toBe("one two three…");
  });

  it("cuts a single giant word mid-word rather than returning almost nothing", () => {
    const out = clampText(`hi ${"a".repeat(400)}`, 50);
    expect(Array.from(out)).toHaveLength(50);
    expect(out.endsWith("a…")).toBe(true);
  });

  it("never splits an emoji", () => {
    const out = clampText("\u{1F3B5}".repeat(30), 10);
    expect(Array.from(out)).toEqual([...Array(9).fill("\u{1F3B5}"), "…"]);
  });
});

describe("toTestimonial", () => {
  it("builds the quote, default attribution, month and source from whitelisted fields only", () => {
    const t = toTestimonial(
      doc({ contact: "rook@example.com", userId: "123456789012345678", userName: "rook", guildId: "987654321098765432" })
    );
    expect(t).toEqual({
      quote: "The web player is great, my friends queue songs from their phones.",
      attribution: DEFAULT_ATTRIBUTION,
      month: "November 2026",
      monthIso: "2026-11",
      viaDiscord: false,
    });
    expect(Object.keys(t!).sort()).toEqual(["attribution", "month", "monthIso", "quote", "viaDiscord"]);
    expect(JSON.stringify(t)).not.toMatch(/rook|1234567890|9876543210/);
  });

  it("uses the owner's attribution, cleaned and clamped", () => {
    expect(toTestimonial(doc({ quoteAttribution: "  runs a 300-member\ngaming server " }))?.attribution).toBe(
      "runs a 300-member gaming server"
    );
    expect(toTestimonial(doc({ quoteAttribution: "   " }))?.attribution).toBe(DEFAULT_ATTRIBUTION);
    expect(Array.from(toTestimonial(doc({ quoteAttribution: "word ".repeat(40) }))!.attribution).length).toBeLessThanOrEqual(80);
  });

  it("marks bot feedback as via Discord and accepts ISO date strings", () => {
    const t = toTestimonial(doc({ source: "bot", createdAt: "2026-01-31T23:59:59Z" }));
    expect(t?.viaDiscord).toBe(true);
    expect(t?.month).toBe("January 2026");
    expect(t?.monthIso).toBe("2026-01");
  });

  it("keeps a quote with an unknown date, without the month", () => {
    const t = toTestimonial(doc({ createdAt: "not a date" }));
    expect(t?.month).toBeNull();
    expect(t?.monthIso).toBeNull();
  });

  it("drops empty quotes and non-objects", () => {
    expect(toTestimonial(doc({ message: " \n\t " }))).toBeNull();
    expect(toTestimonial(doc({ message: undefined }))).toBeNull();
    expect(toTestimonial(null)).toBeNull();
    expect(toTestimonial("praise")).toBeNull();
  });
});

describe("toTestimonials", () => {
  it("keeps only items that are both featured and quotable, strictly true", () => {
    const out = toTestimonials([
      doc({ message: "kept" }),
      doc({ message: "not featured", featured: false }),
      doc({ message: "featured, no consent", quoteOk: undefined }),
      doc({ message: "truthy is not true", quoteOk: "yes", featured: 1 }),
      null,
      "junk",
    ]);
    expect(out.map((t) => t.quote)).toEqual(["kept"]);
  });

  it("sorts newest first and returns at most six", () => {
    const docs = Array.from({ length: 9 }, (_, i) =>
      doc({ message: `quote ${i}`, createdAt: new Date(Date.UTC(2026, i, 10)) })
    );
    const shuffled = [3, 8, 0, 5, 1, 7, 2, 6, 4].map((i) => docs[i]);
    const out = toTestimonials(shuffled);
    expect(out).toHaveLength(TESTIMONIALS_MAX);
    expect(out.map((t) => t.quote)).toEqual(["quote 8", "quote 7", "quote 6", "quote 5", "quote 4", "quote 3"]);
  });

  it("drops items that are empty after cleaning", () => {
    expect(toTestimonials([doc({ message: "\u0000\u202E  " }), doc({ message: "real one" })]).map((t) => t.quote)).toEqual([
      "real one",
    ]);
  });

  it("clamps long quotes", () => {
    const [t] = toTestimonials([doc({ message: "great ".repeat(100) })]);
    expect(Array.from(t.quote).length).toBeLessThanOrEqual(QUOTE_MAX);
    expect(t.quote.endsWith("…")).toBe(true);
  });

  it("returns an empty list for no input", () => {
    expect(toTestimonials([])).toEqual([]);
  });
});

describe("captionParts", () => {
  it("lists attribution, month and the Discord source in order, skipping what is unknown", () => {
    expect(captionParts(toTestimonial(doc({ source: "bot" }))!)).toEqual([DEFAULT_ATTRIBUTION, "November 2026", "via Discord"]);
    expect(captionParts(toTestimonial(doc({ createdAt: null, quoteAttribution: "DJ in a study server" }))!)).toEqual([
      "DJ in a study server",
    ]);
  });
});
