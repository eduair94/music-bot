import { describe, expect, it } from "vitest";
import { PREMIUM_TIERS, getTierFromPledge } from "../../shared/types";
import { buildPerksOverview } from "../../utils/perksEmbed";

describe("premium tiers", () => {
  it("gives the $3 paid tier everything the pricing page promises", () => {
    expect(getTierFromPledge(300)).toBe("basic");
    expect(PREMIUM_TIERS.basic).toMatchObject({ audioBitrate: 320, audioFilters: true, stayMode: true });
  });

  it("keeps the free tier at 128kbps", () => {
    expect(PREMIUM_TIERS.free).toMatchObject({ audioBitrate: 128, audioFilters: false, stayMode: false });
  });
});

describe("/perks view", () => {
  const embed = buildPerksOverview().toJSON();
  const text = JSON.stringify(embed);

  it("shows only the two plans that exist on Patreon", () => {
    expect(embed.fields?.map((f) => f.name)).toEqual(["Free — $0", "Founder / Beta Tester — $3/month"]);
  });

  it("quotes the real quality and the Patreon link", () => {
    expect(text).toContain("320kbps");
    expect(text).not.toContain("192kbps");
    expect(text).toContain("https://www.patreon.com/c/u36360623");
    expect(text).toContain("50");
  });
});
