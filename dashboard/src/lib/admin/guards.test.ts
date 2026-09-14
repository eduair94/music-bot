import { describe, expect, it } from "vitest";
import { isSameOrigin, isSnowflake, RateLimiter } from "./guards";

describe("isSnowflake", () => {
  it("accepts 17-20 digit ids", () => {
    expect(isSnowflake("1066182746399055993")).toBe(true);
    expect(isSnowflake("12345")).toBe(false);
    expect(isSnowflake("abc")).toBe(false);
    expect(isSnowflake(123)).toBe(false);
  });
});

describe("isSameOrigin", () => {
  it("trusts sec-fetch-site same-origin/none", () => {
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "same-origin" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "none" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ "sec-fetch-site": "cross-site", origin: "https://a.com" }), "a.com")).toBe(false);
  });
  it("falls back to Origin host comparison", () => {
    expect(isSameOrigin(new Headers({ origin: "https://a.com" }), "a.com")).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://evil.com" }), "a.com")).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "not a url" }), "a.com")).toBe(false);
    expect(isSameOrigin(new Headers(), "a.com")).toBe(false);
  });
});

describe("RateLimiter", () => {
  it("allows up to limit per window then blocks, and recovers", () => {
    const rl = new RateLimiter(2, 1000);
    expect(rl.allow("k", 0)).toBe(true);
    expect(rl.allow("k", 10)).toBe(true);
    expect(rl.allow("k", 20)).toBe(false);
    expect(rl.allow("other", 20)).toBe(true);
    expect(rl.allow("k", 1001)).toBe(true);
  });
});
