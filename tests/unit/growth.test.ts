import { describe, expect, it } from "vitest";
import { pseudoClientId } from "../../shared/gaMeasurement";
import {
  ATTRIBUTION_WINDOW_MS,
  botSiteLink,
  memberBucket,
  netPromoterScore,
  normalizeRef,
  parseGaClientId,
  parseFirstTouch,
  parseGaSessionId,
  pickAttribution,
  serializeFirstTouch,
  sourceFromVisit,
  refLabel,
  trackedInviteUrl,
  type InviteClick
} from "../../shared/growth";

const click = (id: string, ts: number, ref = "topgg", instance?: number): InviteClick => ({ id, ts, ref, instance });

describe("normalizeRef", () => {
  it("keeps one spelling per source", () => {
    expect(normalizeRef("TopGG")).toBe("topgg");
    expect(normalizeRef(" site_hero ")).toBe("site-hero");
    expect(normalizeRef("discord.bots.gg")).toBe("discord-bots-gg");
    expect(normalizeRef("u-1066182746399055993")).toBe("u-1066182746399055993");
  });
  it("rejects junk", () => {
    expect(normalizeRef("")).toBeNull();
    expect(normalizeRef("---")).toBeNull();
    expect(normalizeRef(42)).toBeNull();
    expect(normalizeRef("<script>")).toBe("script");
    expect(normalizeRef("a".repeat(80))).toHaveLength(40);
  });
});

describe("pickAttribution", () => {
  const join = 1_800_000_000_000;
  it("takes the newest click inside the window", () => {
    const res = pickAttribution([click("a", join - 20 * 60_000, "topgg"), click("b", join - 2 * 60_000, "site-hero")], join);
    expect(res.ref).toBe("site-hero");
    expect(res.click?.id).toBe("b");
  });
  it("skips claimed clicks and clicks outside the window", () => {
    const clicks = [click("a", join - ATTRIBUTION_WINDOW_MS - 1), click("b", join - 60_000)];
    expect(pickAttribution(clicks, join, new Set(["b"])).ref).toBe("direct");
  });
  it("ignores clicks from the future beyond clock skew", () => {
    expect(pickAttribution([click("a", join + 5 * 60_000)], join).ref).toBe("direct");
    expect(pickAttribution([click("a", join + 30_000)], join).ref).toBe("topgg");
  });
  it("matches the instance the link was for", () => {
    const clicks = [click("a", join - 60_000, "site-hero", 2)];
    expect(pickAttribution(clicks, join).ref).toBe("direct");
    expect(pickAttribution(clicks, join, new Set(), 2).ref).toBe("site-hero");
  });
});

describe("GA cookies", () => {
  it("parses the client id", () => {
    expect(parseGaClientId("GA1.1.1234567890.1700000000")).toBe("1234567890.1700000000");
    expect(parseGaClientId("GA1.2.99.1")).toBe("99.1");
    expect(parseGaClientId("garbage")).toBeUndefined();
    expect(parseGaClientId(undefined)).toBeUndefined();
  });
  it("parses both session cookie formats", () => {
    expect(parseGaSessionId("GS1.1.1700000000.3.1.1700000100.0.0.0")).toBe("1700000000");
    expect(parseGaSessionId("GS2.1.s1700000000$o5$g1$t1700000100$j60$l0$h0")).toBe("1700000000");
    expect(parseGaSessionId("nope")).toBeUndefined();
  });
});

describe("links", () => {
  it("tags bot links with utm", () => {
    const url = new URL(botSiteLink("https://x.test/", "/servers/1", "welcome", "dashboard"));
    expect(url.pathname).toBe("/servers/1");
    expect(url.searchParams.get("utm_source")).toBe("discord");
    expect(url.searchParams.get("utm_medium")).toBe("bot");
    expect(url.searchParams.get("utm_campaign")).toBe("welcome");
    expect(url.searchParams.get("utm_content")).toBe("dashboard");
  });
  it("builds tracked invites", () => {
    expect(trackedInviteUrl("https://x.test/", "Bot Help")).toBe("https://x.test/invite?ref=bot-help");
  });
  it("labels refs", () => {
    expect(refLabel("topgg")).toBe("top.gg");
    expect(refLabel("u-1066182746399055993")).toContain("Referral");
    expect(refLabel("newsletter-x")).toBe("newsletter-x");
  });
});

describe("first touch", () => {
  it("round-trips and survives double encoding", () => {
    const ft = { s: "topgg", m: "referral", l: "/", t: 1 };
    expect(parseFirstTouch(serializeFirstTouch(ft))).toEqual({ ...ft, c: undefined });
    expect(parseFirstTouch(encodeURIComponent(serializeFirstTouch(ft)))?.s).toBe("topgg");
    expect(parseFirstTouch("not json")).toBeNull();
    expect(parseFirstTouch(serializeFirstTouch({ s: "!!", t: 1 }))).toBeNull();
  });
  it("derives the visit source", () => {
    const q = (s: string) => new URLSearchParams(s);
    expect(sourceFromVisit(q("ref=TopGG"), "", "bp.test").s).toBe("topgg");
    expect(sourceFromVisit(q("utm_source=reddit&utm_medium=social"), "", "bp.test")).toEqual({ s: "reddit", m: "social", c: undefined });
    expect(sourceFromVisit(q(""), "https://www.top.gg/bot/1", "bp.test")).toEqual({ s: "top-gg", m: "referral" });
    expect(sourceFromVisit(q(""), "https://bp.test/commands", "bp.test").s).toBe("direct");
    expect(sourceFromVisit(q(""), "", "bp.test").s).toBe("direct");
  });
});

describe("helpers", () => {
  it("buckets member counts", () => {
    expect(memberBucket(3)).toBe("1-9");
    expect(memberBucket(96171)).toBe("10k+");
    expect(memberBucket(undefined)).toBe("1-9");
  });
  it("computes NPS", () => {
    expect(netPromoterScore([])).toBeNull();
    expect(netPromoterScore([10, 9, 8, 3])).toBe(25);
    expect(netPromoterScore([0, 0])).toBe(-100);
  });
  it("makes stable pseudo client ids", () => {
    const a = pseudoClientId("guild.1");
    expect(a).toMatch(/^\d{1,10}\.\d{1,10}$/);
    expect(pseudoClientId("guild.1")).toBe(a);
    expect(pseudoClientId("guild.2")).not.toBe(a);
  });
});
