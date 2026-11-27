import { afterEach, describe, expect, it, vi } from "vitest";
import { missingInstances } from "../../shared/fleet";
import { linkedBotAllowance, OWNER_LINKED_BOTS } from "../../shared/types";

const ENV_KEYS = ["LINKED_BOT_ID", "LINKED_BOT_NAME", "LINKED_ALLOWED_GUILDS", "BOT_INSTANCE"] as const;
const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));

/** utils/instance.ts reads the environment once, at import. */
async function loadInstance(env: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, env);
  vi.resetModules();
  return import("../../utils/instance");
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.resetModules();
});

describe("private bot mode (utils/instance)", () => {
  it("is off for Bypass and its fleet", async () => {
    const primary = await loadInstance({});
    expect(primary.isLinked).toBe(false);
    expect(primary.isPrimary).toBe(true);
    expect(primary.ownsSlashCommands).toBe(true);
    expect(primary.STAY247_SLOT).toBe(1);

    const second = await loadInstance({ BOT_INSTANCE: "2" });
    expect(second.isLinked).toBe(false);
    expect(second.isPrimary).toBe(false);
    expect(second.ownsSlashCommands).toBe(false);
  });

  it("runs as instance 0 with its own commands, name and 24/7 slot", async () => {
    const linked = await loadInstance({ LINKED_BOT_ID: "123456789012345678", LINKED_BOT_NAME: "DJ Nova", BOT_INSTANCE: "1" });
    expect(linked.isLinked).toBe(true);
    // Never the primary, whatever BOT_INSTANCE says: that would write Bypass's state.
    expect(linked.INSTANCE).toBe(0);
    expect(linked.isPrimary).toBe(false);
    expect(linked.ownsSlashCommands).toBe(true);
    expect(linked.INSTANCE_NAME).toBe("DJ Nova");
    expect(linked.STAY247_SLOT).toBe("L123456789012345678");
  });

  it("keeps a private bot's 24/7 apart from Bypass's", async () => {
    const linked = await loadInstance({ LINKED_BOT_ID: "42" });
    const settings = {
      stay247: { enabled: true, voiceChannelId: "bypass-channel" },
      fleet: { stay247: { L42: { enabled: true, voiceChannelId: "private-channel" } } }
    } as never;
    expect(linked.stay247Of(settings)?.voiceChannelId).toBe("private-channel");
    expect(linked.stay247Update({ enabled: false } as never)).toEqual({ "fleet.stay247.L42": { enabled: false } });
    // Bypass itself still reads and writes the top-level state.
    expect(linked.stay247Of(settings, 1)?.voiceChannelId).toBe("bypass-channel");
    expect(linked.stay247Update({ enabled: false } as never, 1)).toEqual({ stay247: { enabled: false } });
  });

  it("parses the allowed servers", async () => {
    const linked = await loadInstance({ LINKED_BOT_ID: "42", LINKED_ALLOWED_GUILDS: " 111, 222 ,," });
    expect([...linked.LINKED_ALLOWED_GUILDS]).toEqual(["111", "222"]);
    const open = await loadInstance({ LINKED_BOT_ID: "42" });
    expect(open.LINKED_ALLOWED_GUILDS.size).toBe(0);
  });
});

describe("linkedBotAllowance", () => {
  it("needs an active Premium membership", () => {
    expect(linkedBotAllowance(null)).toBe(0);
    expect(linkedBotAllowance({ isPremium: false, pledgeAmountCents: 1000 })).toBe(0);
  });

  it("gives every paid tier at least one bot and more on higher pledges", () => {
    expect(linkedBotAllowance({ isPremium: true, pledgeAmountCents: 300 })).toBe(1);
    // Premium granted without a pledge (gift, manual grant) still gets one.
    expect(linkedBotAllowance({ isPremium: true, pledgeAmountCents: 0 })).toBe(1);
    expect(linkedBotAllowance({ isPremium: true, pledgeAmountCents: 1000 })).toBe(3);
    expect(linkedBotAllowance({ isPremium: true, pledgeAmountCents: 2500 })).toBe(10);
  });

  it("lets the bot owner run several for testing", () => {
    expect(linkedBotAllowance(null, true)).toBe(OWNER_LINKED_BOTS);
  });
});

describe("missingInstances", () => {
  const c = (instance: number, inGuild: boolean, premium = false) => ({ instance, inGuild, premium });

  it("lists the free bots the server never added, in order", () => {
    expect(missingInstances([c(4, false), c(1, true), c(2, true), c(3, false)], false).map((m) => m.instance)).toEqual([3, 4]);
  });

  it("never offers the primary, and offers Premium bots only to Premium servers", () => {
    expect(missingInstances([c(1, false), c(5, false, true)], false)).toEqual([]);
    expect(missingInstances([c(5, false, true)], true).map((m) => m.instance)).toEqual([5]);
  });
});
