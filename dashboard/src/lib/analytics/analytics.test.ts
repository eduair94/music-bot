import { describe, expect, it } from "vitest";
import { classifyUrl, paramsFromDataset } from "./clicks";
import { CONSENT_COUNTRIES, countryRequiresConsent, isExcludedPath, pageGroup, timeZoneRequiresConsent } from "./config";
import { analyticsUserHash } from "./identity";
import { clarityScript, gtagInitScript } from "./scripts";

const ORIGIN = "https://music-bot.checkleaked.com";
const at = (href: string) => classifyUrl(new URL(href, `${ORIGIN}/`), ORIGIN);

describe("classifyUrl", () => {
  it("tracks site invite links with their ref", () => {
    expect(at("/invite?ref=site-hero")).toEqual({ event: "add_bot_click", params: { ref: "site-hero" } });
    expect(at("/invite")).toEqual({ event: "add_bot_click", params: { ref: undefined } });
  });

  it("tracks Discord bot authorize links but not login-style OAuth", () => {
    expect(at("https://discord.com/api/oauth2/authorize?client_id=1&scope=bot+applications.commands")?.event).toBe("add_bot_click");
    expect(at("https://discord.com/oauth2/authorize?client_id=1&scope=bot%20applications.commands")?.event).toBe("add_bot_click");
    expect(at("https://discord.com/oauth2/authorize?client_id=1")?.event).toBe("add_bot_click");
    expect(at("https://discord.com/oauth2/authorize?client_id=1&scope=identify")).toBeNull();
  });

  it("maps support, premium, vote, github and login links", () => {
    expect(at("/support")?.event).toBe("support_click");
    expect(at("https://discord.gg/KwKwtasGZE")?.event).toBe("support_click");
    expect(at("https://discord.com/invite/KwKwtasGZE")?.event).toBe("support_click");
    expect(at("https://www.patreon.com/c/u36360623")?.event).toBe("premium_click");
    expect(at("https://top.gg/bot/1/vote")).toEqual({ event: "vote_click", params: { site: "topgg" } });
    expect(at("https://discordbotlist.com/bots/bypass")).toEqual({ event: "vote_click", params: { site: "discordbotlist" } });
    expect(at("https://github.com/eduair94/music-bot")?.event).toBe("github_click");
    expect(at("/login")?.event).toBe("login_start");
  });

  it("ignores everything else", () => {
    expect(at("/commands")).toBeNull();
    expect(at("https://example.com/invite")).toBeNull();
    expect(at("mailto:someone@example.com")).toBeNull();
  });
});

describe("paramsFromDataset", () => {
  it("turns data-track-* into snake_case params and skips the event and location", () => {
    expect(paramsFromDataset({ track: "command_copy", trackLocation: "hero", trackCommand: "/play", trackSomeThing: "x" })).toEqual({
      command: "/play",
      some_thing: "x",
    });
  });
});

describe("page groups and exclusions", () => {
  it("groups paths", () => {
    expect(pageGroup("/")).toBe("landing");
    expect(pageGroup("/commands")).toBe("landing");
    expect(pageGroup("/login")).toBe("auth");
    expect(pageGroup("/servers/123/player")).toBe("dashboard");
    expect(pageGroup("/profile")).toBe("dashboard");
    expect(pageGroup("/serverside")).toBe("landing");
  });

  it("excludes the owner pages only", () => {
    expect(isExcludedPath("/admin")).toBe(true);
    expect(isExcludedPath("/insights/login")).toBe(true);
    expect(isExcludedPath("/administration")).toBe(false);
    expect(isExcludedPath("/servers")).toBe(false);
  });
});

describe("consent regions", () => {
  it("covers the EEA, UK and Switzerland", () => {
    expect(CONSENT_COUNTRIES).toHaveLength(32);
    for (const c of ["DE", "FR", "IE", "GR", "NO", "IS", "LI", "GB", "CH", "de"]) expect(countryRequiresConsent(c)).toBe(true);
    for (const c of ["US", "UY", "BR", "TR", "RU"]) expect(countryRequiresConsent(c)).toBe(false);
  });

  it("falls back to European time zones", () => {
    expect(timeZoneRequiresConsent("Europe/Madrid")).toBe(true);
    expect(timeZoneRequiresConsent("Atlantic/Canary")).toBe(true);
    expect(timeZoneRequiresConsent("Atlantic/Reykjavik")).toBe(true);
    expect(timeZoneRequiresConsent("America/Montevideo")).toBe(false);
    expect(timeZoneRequiresConsent("Atlantic/Bermuda")).toBe(false);
    expect(timeZoneRequiresConsent(undefined)).toBe(false);
  });
});

describe("analyticsUserHash", () => {
  it("is a stable 16-hex hash that never contains the id", () => {
    const hash = analyticsUserHash("123456789012345678");
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(analyticsUserHash("123456789012345678")).toBe(hash);
    expect(analyticsUserHash("223456789012345678")).not.toBe(hash);
    expect(analyticsUserHash(null)).toBeNull();
  });
});

describe("bootstrap scripts", () => {
  it("sets consent defaults before config and parses as JavaScript", () => {
    const script = gtagInitScript("G-TEST000000", "landing");
    expect(() => new Function(script)).not.toThrow();
    const defaults = script.indexOf("'consent','default'");
    expect(defaults).toBeGreaterThan(-1);
    expect(defaults).toBeLessThan(script.indexOf("'config'"));
    expect(script.indexOf("'consent','update'")).toBeLessThan(script.indexOf("'config'"));
    expect(script).toContain('"GB","CH"');
    expect(script).toContain("wait_for_update:500");
    // A cached "must ask" from our own geo lookup makes the global default denied as well.
    expect(script).toContain("analytics_storage:g&&g.r===true?'denied':'granted'");
    expect(script.indexOf('"bp_geo"')).toBeLessThan(script.indexOf("g&&g.r===true"));
    expect(script).toContain("traffic_type='internal'");
    // gtag.js is injected after config, not preloaded by next/script.
    expect(script.indexOf("googletagmanager.com/gtag/js?id=G-TEST000000")).toBeGreaterThan(script.indexOf("'config'"));
  });

  it("sends Clarity a denied signal only while an asked visitor has no choice", () => {
    const asked = clarityScript("testclarity", "landing", true);
    const notAsked = clarityScript("testclarity", "dashboard", false);
    expect(() => new Function(asked)).not.toThrow();
    expect(asked).toContain("&&true)k='denied'");
    expect(notAsked).toContain("&&false)k='denied'");
    expect(notAsked).toContain('"dashboard"');
    expect(asked).toContain('https://www.clarity.ms/tag/');
  });
});
