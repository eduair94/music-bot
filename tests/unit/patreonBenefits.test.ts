import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/config", () => ({ config: { PATREON_FOUNDER_TIER_ID: "27651691" } }));
// Echo back what would be written, so the test sees the computed benefits
vi.mock("../../models/PatreonUser", () => ({
  PatreonUser: { findOneAndUpdate: vi.fn(async (_filter: unknown, update: { $set: Record<string, unknown> }) => update.$set) },
}));

import { PatreonService } from "../../services/patreon";

const FOUNDER_TIER = "27651691";

function benefits(input: { patronStatus: string; pledgeAmountCents: number; tierId?: string; tierTitle?: string }) {
  return (PatreonService.getInstance() as any).updatePatronData({
    discordId: "123",
    patreonId: "456",
    lifetimeSupportCents: 0,
    ...input,
  });
}

describe("patron benefits", () => {
  it("gives the $3 Founder tier 320kbps and the founder flag, as the pricing page promises", async () => {
    const patron = await benefits({ patronStatus: "active_patron", pledgeAmountCents: 300, tierId: FOUNDER_TIER, tierTitle: "Founder / Beta Tester" });
    expect(patron).toMatchObject({ isPremium: true, isFounder: true, audioBitrate: 320 });
    expect(patron.customBotName).toBeUndefined();
  });

  it("keeps a $0 free membership on the free plan", async () => {
    const patron = await benefits({ patronStatus: "active_patron", pledgeAmountCents: 0, tierId: "14881364", tierTitle: "Free" });
    expect(patron).toMatchObject({ isPremium: false, isFounder: false, audioBitrate: 128 });
  });

  it("drops a former patron back to free", async () => {
    const patron = await benefits({ patronStatus: "former_patron", pledgeAmountCents: 0, tierId: FOUNDER_TIER });
    expect(patron).toMatchObject({ isPremium: false, isFounder: false, audioBitrate: 128 });
  });

  it("keeps identity branding for the $5+ tiers", async () => {
    expect(await benefits({ patronStatus: "active_patron", pledgeAmountCents: 500 })).toMatchObject({ audioBitrate: 320, customBotName: "indie" });
    expect(await benefits({ patronStatus: "active_patron", pledgeAmountCents: 1000, tierTitle: "Studio" })).toMatchObject({
      audioBitrate: 320,
      customBotName: "Studio",
    });
  });
});
