import { describe, expect, it } from "vitest";
import { premiumUpsell } from "../../utils/upsell";

describe("premium upsell", () => {
  const reply = premiumUpsell("stay_24_7");
  const json = JSON.stringify(reply.embeds.map((e) => e.toJSON()));

  it("names the feature, the price and the scarcity", () => {
    expect(json).toContain("24/7 Mode");
    expect(json).toContain("$3");
    expect(json).toContain("50");
  });

  it("tells the user how to get it and how to link Discord", () => {
    expect(json).toContain("/premium link");
    expect(json).toMatch(/link your Discord/i);
  });

  it("offers a button straight to the campaign", () => {
    const row = reply.components[0].toJSON() as { components: Array<{ url?: string; label?: string }> };
    expect(row.components[0].url).toBe("https://www.patreon.com/c/u36360623");
  });

  it("works for every gated feature", () => {
    const playlists = JSON.stringify(premiumUpsell("unlimited_playlists").embeds.map((e) => e.toJSON()));
    expect(playlists).toContain("Unlimited Playlists");
  });
});
