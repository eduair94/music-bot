import { describe, expect, it } from "vitest";
import { buildInviteClick, countryFrom, gaSessionCookie, isNonHumanRequest, requestedInstance, utcDayKey } from "./invite-click";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const NOW = Date.parse("2026-11-27T12:00:00Z");

function req(over: Partial<Parameters<typeof buildInviteClick>[0]> = {}) {
  return { searchParams: {}, cookies: {}, headers: { "user-agent": CHROME }, ...over };
}

describe("buildInviteClick", () => {
  it("prefers ?ref, normalized", () => {
    const c = buildInviteClick(req({ searchParams: { ref: "Site_Hero", utm_source: "topgg" } }), "id1", NOW);
    expect(c).toMatchObject({ id: "id1", ts: NOW, ref: "site-hero", utmSource: "topgg", instance: 1 });
  });

  it("falls back to utm_source, then first touch, then site", () => {
    expect(buildInviteClick(req({ searchParams: { utm_source: "Reddit" } }), "a", NOW).ref).toBe("reddit");
    const ft = encodeURIComponent(JSON.stringify({ s: "top-gg", m: "referral", c: "launch", t: NOW - 1000 }));
    const fromTouch = buildInviteClick(req({ cookies: { bp_ft: ft } }), "b", NOW);
    expect(fromTouch).toMatchObject({ ref: "top-gg", utmMedium: "referral", utmCampaign: "launch" });
    expect(buildInviteClick(req(), "c", NOW).ref).toBe("site");
  });

  it("treats a direct first touch as no information", () => {
    const ft = encodeURIComponent(JSON.stringify({ s: "direct", m: "none", t: NOW }));
    expect(buildInviteClick(req({ cookies: { bp_ft: ft } }), "d", NOW).ref).toBe("site");
  });

  it("reads GA client and session ids and the country", () => {
    const c = buildInviteClick(
      req({
        cookies: { _ga: "GA1.1.123456789.1700000000", _ga_ABC123: "GS2.1.s1764240000$o3$g1$t1764240100$j0$l0$h0" },
        headers: { "user-agent": CHROME, "cf-ipcountry": "uy" },
        gaMeasurementId: "G-ABC123",
      }),
      "e",
      NOW
    );
    expect(c).toMatchObject({ gaClientId: "123456789.1700000000", gaSessionId: "1764240000", country: "UY" });
  });

  it("omits unknown fields entirely", () => {
    const c = buildInviteClick(req(), "f", NOW);
    expect(Object.keys(c).sort()).toEqual(["id", "instance", "ref", "ts"]);
  });
});

describe("helpers", () => {
  it("finds the GA session cookie for the property, else any _ga_*", () => {
    expect(gaSessionCookie({ _ga_X1: "a", _ga_Y2: "b" }, "G-Y2")).toBe("b");
    expect(gaSessionCookie({ _ga_X1: "a" }, "G-Y2")).toBe("a");
    expect(gaSessionCookie({ _ga: "x" })).toBeUndefined();
  });

  it("accepts ?bot=2..4 only", () => {
    expect(requestedInstance({ bot: "3" })).toBe(3);
    expect(requestedInstance({ bot: "1" })).toBe(1);
    expect(requestedInstance({ bot: "7" })).toBe(1);
    expect(requestedInstance({ bot: "nope" })).toBe(1);
    expect(requestedInstance({})).toBe(1);
  });

  it("filters link unfurlers, crawlers and prefetches", () => {
    expect(isNonHumanRequest({ "user-agent": CHROME })).toBe(false);
    expect(isNonHumanRequest({ "user-agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" })).toBe(true);
    expect(isNonHumanRequest({ "user-agent": "Mozilla/5.0 (Linux; Android 9; CUBOT X19) Chrome/120 Mobile" })).toBe(false);
    expect(isNonHumanRequest({ "user-agent": CHROME, "next-router-prefetch": "1" })).toBe(true);
    expect(isNonHumanRequest({ "user-agent": CHROME, "sec-purpose": "prefetch;prerender" })).toBe(true);
    expect(isNonHumanRequest({})).toBe(true);
  });

  it("country and day keys", () => {
    expect(countryFrom("XX")).toBeUndefined();
    expect(countryFrom("T1")).toBeUndefined();
    expect(countryFrom("de")).toBe("DE");
    expect(utcDayKey(Date.parse("2026-11-27T23:59:59Z"))).toBe("2026-11-27");
  });
});
