import { describe, expect, it } from "vitest";
import { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL, SUPPORT_INVITE_URL } from "../../shared/links";

describe("public links", () => {
  it("points at a support invite that is not the expired one", () => {
    expect(SUPPORT_INVITE_URL).toMatch(/^https:\/\/discord\.gg\/[A-Za-z0-9]+$/);
    expect(SUPPORT_INVITE_URL).not.toContain("5w6PErKpyK");
  });

  it("states the Patreon campaign and the Founder offer", () => {
    expect(PATREON_URL).toBe("https://www.patreon.com/c/u36360623");
    expect(FOUNDER_PRICE_USD).toBe(3);
    expect(FOUNDER_SPOTS).toBe(50);
  });
});
