import { describe, expect, it } from "vitest";
import {
  buildGrowthDigest,
  digestDays,
  digestDue,
  digestLockKey,
  digestPayload,
  digestStats,
  digestWebhookUrl,
  feedbackPreview,
  FEEDBACK_PREVIEW_MAX,
  formatDelta,
  formatHours,
  type DigestStats,
  type GrowthDigestInput,
  isoWeekKey,
  lookAtNotes,
  postGrowthDigest
} from "../../services/growth/digest";
import type { AcquisitionRow } from "../../shared/growthReport";

// Monday 13:05 UTC: current window 2026-11-23 → 11-29, previous 11-16 → 11-22.
const NOW = new Date("2026-11-30T13:05:00Z");
const REFERRAL = "u-123456789012345678";
const LONG_BUG = `Playback stops ${"after a few songs and ".repeat(20)}never resumes`;

let seq = 0;
const row = (over: Partial<AcquisitionRow>): AcquisitionRow => ({
  guildId: String(++seq),
  name: "Server",
  memberCount: 10,
  ref: "direct",
  joinedAt: "2026-11-24T10:00:00Z",
  ...over
});

const fixture = (): GrowthDigestInput => ({
  now: NOW,
  dailyClicks: [
    { date: "2026-11-18", counts: { topgg: 8, site: 4, "@site-hero": 3 } },
    { date: "2026-11-24", counts: { topgg: 10, site: 5, "@site-hero": 6, "@site-pricing": 2 } },
    { date: "2026-11-27", counts: { topgg: 10, [REFERRAL]: 2 } }
  ],
  acquisitions: [
    // Current week: 6 joins, 3 played a song (after 1 h, 3 h, 30 min).
    row({ ref: "topgg", joinedAt: "2026-11-24T10:00:00Z", firstPlayAt: "2026-11-24T11:00:00Z" }),
    row({ ref: "topgg", joinedAt: "2026-11-25T10:00:00Z", firstPlayAt: "2026-11-25T13:00:00Z" }),
    row({ ref: "topgg", joinedAt: "2026-11-26T10:00:00Z" }),
    row({ ref: "site", placement: "site-hero", joinedAt: "2026-11-27T08:00:00Z", firstPlayAt: "2026-11-27T08:30:00Z" }),
    row({ ref: REFERRAL, joinedAt: "2026-11-28T09:00:00Z" }),
    row({ ref: "direct", joinedAt: "2026-11-29T22:00:00Z", leftAt: "2026-11-29T23:00:00Z" }),
    // Servers from before tracking: one left this week (a removal, never a join), one still here.
    row({ ref: "pre-tracking", backfilled: true, joinedAt: "2025-01-01T00:00:00Z", leftAt: "2026-11-25T00:00:00Z" }),
    row({ ref: "pre-tracking", backfilled: true, joinedAt: "2025-01-01T00:00:00Z" }),
    // Previous week: 2 joins, both played (after 2 h and 4 h); the second left this week.
    row({ ref: "topgg", joinedAt: "2026-11-17T10:00:00Z", firstPlayAt: "2026-11-17T12:00:00Z" }),
    row({
      ref: "site",
      joinedAt: "2026-11-19T10:00:00Z",
      firstPlayAt: "2026-11-19T14:00:00Z",
      leftAt: "2026-11-26T12:00:00Z"
    })
  ],
  feedback: [
    { kind: "bug", source: "bot", message: LONG_BUG, createdAt: "2026-11-29T20:00:00Z" },
    { kind: "idea", source: "site", message: "Add a crossfade option", createdAt: "2026-11-28T10:00:00Z" },
    { kind: "nps", source: "dashboard", message: "", score: 9, createdAt: "2026-11-26T10:00:00Z" },
    { kind: "nps", source: "dashboard", message: "Too laggy", score: 3, createdAt: "2026-11-25T10:00:00Z" },
    { kind: "praise", source: "site", message: "Love it", createdAt: "2026-11-20T10:00:00Z" },
    { kind: "nps", source: "site", message: "", score: 10, createdAt: "2026-11-20T11:00:00Z" },
    // Older than 90 days: out of the NPS.
    { kind: "nps", source: "site", message: "", score: 0, createdAt: "2026-08-01T00:00:00Z" }
  ],
  sources: { redis: true, mongo: true }
});

const fieldsOf = (input: GrowthDigestInput) =>
  Object.fromEntries(buildGrowthDigest(input).fields.map((f) => [f.name, f.value]));

describe("digest schedule", () => {
  it("builds ISO 8601 week keys", () => {
    expect(isoWeekKey(new Date("2026-11-30T13:00:00Z"))).toBe("2026-W49");
    expect(isoWeekKey(new Date("2026-12-06T23:59:59Z"))).toBe("2026-W49");
    expect(isoWeekKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeekKey(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(isoWeekKey(new Date("2021-01-03T12:00:00Z"))).toBe("2020-W53");
    expect(isoWeekKey(new Date("2024-12-30T00:00:00Z"))).toBe("2025-W01");
    expect(digestLockKey("2026-W49")).toBe("growth:digest:2026-W49");
  });

  it("is due on Mondays from 13:00 UTC only", () => {
    expect(digestDue(new Date("2026-11-30T12:59:59Z"))).toBe(false);
    expect(digestDue(new Date("2026-11-30T13:00:00Z"))).toBe(true);
    expect(digestDue(new Date("2026-11-30T23:59:59Z"))).toBe(true);
    expect(digestDue(new Date("2026-12-01T13:00:00Z"))).toBe(false); // Tuesday
    expect(digestDue(new Date("2026-11-29T14:00:00Z"))).toBe(false); // Sunday
  });

  it("reads 14 full days of clicks, ending yesterday", () => {
    const days = digestDays(NOW);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-11-16");
    expect(days[13]).toBe("2026-11-29");
  });

  it("uses the digest webhook, else the feedback one, https only", () => {
    expect(
      digestWebhookUrl({
        GROWTH_DIGEST_WEBHOOK_URL: "https://discord.com/api/webhooks/1/a",
        FEEDBACK_WEBHOOK_URL: "https://discord.com/api/webhooks/2/b"
      })
    ).toBe("https://discord.com/api/webhooks/1/a");
    expect(
      digestWebhookUrl({ GROWTH_DIGEST_WEBHOOK_URL: "", FEEDBACK_WEBHOOK_URL: "https://discord.com/api/webhooks/2/b" })
    ).toBe("https://discord.com/api/webhooks/2/b");
    expect(digestWebhookUrl({ GROWTH_DIGEST_WEBHOOK_URL: "http://insecure.test/hook" })).toBeNull();
    expect(digestWebhookUrl({})).toBeNull();
  });

  it("posts nothing without a webhook URL and never throws", async () => {
    await expect(postGrowthDigest({ url: "" })).resolves.toBe(false);
  });
});

describe("digest numbers and deltas", () => {
  const stats = digestStats(fixture());

  it("matches the dashboard funnel definitions", () => {
    expect(stats.current).toMatchObject({
      from: "2026-11-23",
      to: "2026-11-29",
      clicks: 27, // website-button counters are not channels
      joins: 6, // backfilled servers are not joins
      activated: 3,
      activationRate: 50,
      medianHoursToFirstPlay: 1,
      removed: 3, // leftAt in the window, whenever the server joined
      net: 3,
      referralJoins: 1
    });
    expect(stats.previous).toMatchObject({
      clicks: 12,
      joins: 2,
      activated: 2,
      activationRate: 100,
      medianHoursToFirstPlay: 3,
      removed: 0,
      net: 2
    });
    expect(stats.installedNow).toBe(7);
    expect(stats.nps).toBe(33);
    expect(stats.npsResponses).toBe(3);
  });

  it("formats deltas", () => {
    expect(formatDelta(5, 3)).toBe(" (+2)");
    expect(formatDelta(3, 5)).toBe(" (-2)");
    expect(formatDelta(2, 2)).toBe(" (±0)");
    expect(formatDelta(62.5, 50, " pts")).toBe(" (+12.5 pts)");
    expect(formatDelta(null, 3)).toBe("");
    expect(formatDelta(3, null)).toBe("");
    expect(formatHours(0.25)).toBe("15 min");
    expect(formatHours(5.25)).toBe("5.3 h");
    expect(formatHours(72)).toBe("3 days");
  });

  it("shows every headline number against the week before", () => {
    const fields = fieldsOf(fixture());
    expect(fields["Invite clicks"]).toBe("27 (+15)");
    expect(fields["Servers joined"]).toBe("6 (+4)");
    expect(fields["Played a song"]).toBe("3 · 50% (-50 pts)");
    expect(fields["Median time to first song"]).toBe("1 h (-2 h)");
    expect(fields.Removed).toBe("3 (+3)");
    expect(fields["Net installs"]).toBe("+3 (+1)");
    expect(fields["Referral joins"]).toBe("1 (+1)");
    expect(fields["Servers with Bypass now"]).toBe("7");
    expect(fields["NPS (90 days)"]).toBe("+33 from 3 answers");
  });

  it("lists the top 3 sources (referral links merged, no user ids) and website buttons", () => {
    const fields = fieldsOf(fixture());
    expect(fields["Top sources"]).toBe(
      [
        "**top.gg**: 3 joins · 20 clicks · 15% join rate",
        "**Website (no campaign)**: 1 join · 5 clicks · 20% join rate",
        "**Referral links**: 1 join · 2 clicks · 50% join rate"
      ].join("\n")
    );
    expect(fields["Top sources"]).not.toContain("123456789012345678");
    expect(fields["Website buttons"]).toBe(
      [
        "**Website hero**: 1 join · 6 clicks · 16.7% join rate",
        "**Website pricing**: 0 joins · 2 clicks · 0% join rate"
      ].join("\n")
    );
  });

  it("summarizes feedback by kind with the latest messages", () => {
    const value = fieldsOf(fixture()).Feedback;
    const lines = value.split("\n");
    expect(lines[0]).toBe("4 (+2): 1 idea · 1 bug report · 2 NPS answers");
    expect(lines[1].startsWith("• **Bug** (bot): Playback stops after")).toBe(true);
    expect(lines[2]).toBe("• **Idea** (site): Add a crossfade option");
    expect(lines[3]).toBe("• **NPS 3** (dashboard): Too laggy");
    expect(lines).toHaveLength(4);
  });

  it("builds a webhook payload that never pings", () => {
    const payload = digestPayload(buildGrowthDigest(fixture()));
    expect(payload.allowed_mentions).toEqual({ parse: [] });
    expect(payload.embeds[0].title).toBe("Weekly growth digest · 2026-11-23 → 2026-11-29");
    expect(payload.embeds[0].timestamp).toBe(NOW.toISOString());
    expect(JSON.stringify(payload).length).toBeLessThan(6000);
  });
});

describe("look-at rules", () => {
  const withCurrent = (over: Partial<DigestStats["current"]>, sources = { redis: true, mongo: true }): DigestStats => {
    const stats = digestStats(fixture());
    return { ...stats, current: { ...stats.current, ...over }, sources };
  };

  it("flags activation under 60%", () => {
    const notes = lookAtNotes(withCurrent({ joins: 10, activated: 5, activationRate: 50, removed: 1 }));
    expect(notes).toEqual([
      "Fewer than 60% of new servers played a song: watch /install and first dashboard visits in Clarity, read the feedback"
    ]);
    expect(lookAtNotes(withCurrent({ joins: 10, activated: 6, activationRate: 60, removed: 1 }))).toEqual([]);
  });

  it("flags a week with no new servers", () => {
    expect(lookAtNotes(withCurrent({ joins: 0, activated: 0, activationRate: null, removed: 0 }))).toEqual([
      "No new servers: check the bot-list invite links carry `?ref=`"
    ]);
  });

  it("flags more removals than joins", () => {
    const notes = lookAtNotes(withCurrent({ joins: 2, activated: 2, activationRate: 100, removed: 5 }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("More servers removed the bot than added it (5 vs 2)");
  });

  it("judges nothing when MongoDB was unreachable", () => {
    expect(lookAtNotes(withCurrent({ joins: 0 }, { redis: true, mongo: false }))).toEqual([]);
  });

  it("puts the rules in the embed and colors it", () => {
    const embed = buildGrowthDigest(fixture());
    expect(embed.fields.find((f) => f.name === "Look at")?.value).toContain(
      "Fewer than 60% of new servers played a song"
    );
    expect(embed.color).toBe(0xf8aa2a);
  });
});

describe("empty and degraded weeks", () => {
  const empty: GrowthDigestInput = {
    now: NOW,
    dailyClicks: [],
    acquisitions: [],
    feedback: [],
    sources: { redis: true, mongo: true }
  };

  it("keeps an empty week short and still says what to look at", () => {
    const embed = buildGrowthDigest(empty);
    expect(embed.description).toContain("Quiet week: no invite clicks, new servers, removals or feedback.");
    expect(embed.fields).toEqual([
      { name: "Servers with Bypass now", value: "0", inline: true },
      { name: "Look at", value: "• No new servers: check the bot-list invite links carry `?ref=`" }
    ]);
    expect(JSON.stringify(embed).length).toBeLessThan(800);
  });

  it("mentions last week's activity in a quiet week", () => {
    const input = fixture();
    input.now = new Date("2026-12-14T13:00:00Z"); // two weeks later: nothing in the window
    input.dailyClicks.push({ date: "2026-12-02", counts: { topgg: 4 } });
    input.acquisitions.push(row({ ref: "topgg", joinedAt: "2026-12-02T10:00:00Z" }));
    expect(buildGrowthDigest(input).description).toContain("(the week before: 1 join, 4 clicks)");
  });

  it("warns instead of reporting zeroes when a store was unreachable", () => {
    const embed = buildGrowthDigest({ ...empty, sources: { redis: false, mongo: false } });
    expect(embed.description).toContain("Redis was unreachable");
    expect(embed.description).toContain("MongoDB was unreachable");
    expect(embed.description).not.toContain("Quiet week");
    expect(embed.fields.some((f) => f.name === "Look at")).toBe(false);
    expect(embed.color).toBe(0xff5a48);
  });
});

describe("feedback previews", () => {
  it("truncates to ~150 visible characters", () => {
    const preview = feedbackPreview("x".repeat(400));
    expect(preview).toHaveLength(FEEDBACK_PREVIEW_MAX);
    expect(preview.endsWith("…")).toBe(true);
    expect(feedbackPreview("short")).toBe("short");
  });

  it("collapses whitespace and escapes Markdown so links cannot be masked", () => {
    expect(feedbackPreview("  two\n\nlines  ")).toBe("two lines");
    expect(feedbackPreview("[free nitro](https://evil.test) **now**")).toBe(
      "\\[free nitro\\](https://evil.test) \\*\\*now\\*\\*"
    );
  });

  it("truncates long messages inside the embed and shows at most 3", () => {
    const input = fixture();
    for (let i = 0; i < 4; i++)
      input.feedback.push({ kind: "other", source: "site", message: `extra ${i}`, createdAt: "2026-11-23T10:00:00Z" });
    const value = fieldsOf(input).Feedback;
    const bug = value.split("\n")[1];
    expect(bug.length).toBeLessThanOrEqual("• **Bug** (bot): ".length + FEEDBACK_PREVIEW_MAX);
    expect(bug.endsWith("…")).toBe(true);
    expect(value).toContain("…and 4 more in /admin → Feedback");
    expect(value.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
  });
});
