import { describe, expect, it } from "vitest";
import {
  chooseInstance,
  configuredInstances,
  fleetEnabled,
  fleetRegistry,
  inviteUrl,
  parseFleetApplicationIds,
  parseInstance,
  RouteCandidate
} from "../../shared/fleet";
import { BOT_APPLICATION_ID } from "../../shared/links";

const ID2 = "111111111111111111";
const ID3 = "222222222222222222";
const ID5 = "555555555555555555";

describe("fleet registry", () => {
  it("parses instance numbers 1-8 only", () => {
    expect(parseInstance("2")).toBe(2);
    expect(parseInstance(8)).toBe(8);
    expect(parseInstance("0")).toBeNull();
    expect(parseInstance("9")).toBeNull();
    expect(parseInstance("x")).toBeNull();
    expect(parseInstance("")).toBeNull();
  });

  it("reads FLEET_APPLICATION_IDS and ignores junk", () => {
    expect(parseFleetApplicationIds(`2:${ID2}, 3:${ID3},9:${ID2},4:abc,bad`)).toEqual({ 2: ID2, 3: ID3 });
    expect(parseFleetApplicationIds(undefined)).toEqual({});
  });

  it("is just Bypass without fleet env", () => {
    const env = {};
    expect(fleetEnabled(env)).toBe(false);
    expect(configuredInstances(env).map((m) => m.instance)).toEqual([1]);
    expect(fleetRegistry(env)[0]).toMatchObject({ instance: 1, name: "Bypass", applicationId: BOT_APPLICATION_ID, premium: false });
    expect(inviteUrl(2, undefined, env)).toBeNull();
  });

  it("lists created instances, premium above four", () => {
    const env = { FLEET_APPLICATION_IDS: `2:${ID2},5:${ID5}` };
    expect(fleetEnabled(env)).toBe(true);
    const members = configuredInstances(env);
    expect(members.map((m) => [m.instance, m.name, m.premium])).toEqual([
      [1, "Bypass", false],
      [2, "Bypass 2", false],
      [5, "Bypass 5", true]
    ]);
    const url = inviteUrl(2, "123456789012345678", env)!;
    expect(url).toContain(`client_id=${ID2}`);
    expect(url).toContain("guild_id=123456789012345678");
  });
});

const V = "900000000000000001";
const OTHER = "900000000000000002";

function candidate(instance: number, over: Partial<RouteCandidate> = {}): RouteCandidate {
  return {
    instance,
    online: true,
    inGuild: true,
    premium: instance > 4,
    voiceChannelId: null,
    hasTrack: false,
    listeners: 0,
    boundTo: null,
    allowedChannels: [],
    ...over
  };
}

describe("chooseInstance", () => {
  const busyPrimary = candidate(1, { voiceChannelId: OTHER, hasTrack: true, listeners: 3 });

  it("keeps the primary when it is free", () => {
    expect(chooseInstance({ voiceChannelId: V, premiumActive: false, candidates: [candidate(1), candidate(2)] })).toEqual({
      kind: "instance",
      instance: 1,
      reason: "primary"
    });
  });

  it("prefers an instance already in the channel", () => {
    const decision = chooseInstance({
      voiceChannelId: V,
      premiumActive: false,
      candidates: [candidate(1), candidate(3, { voiceChannelId: V, hasTrack: true, listeners: 2 })]
    });
    expect(decision).toEqual({ kind: "instance", instance: 3, reason: "inChannel" });
  });

  it("follows a channel binding even when the primary is free", () => {
    const decision = chooseInstance({ voiceChannelId: V, premiumActive: false, candidates: [candidate(1), candidate(2), candidate(3, { boundTo: V })] });
    expect(decision).toEqual({ kind: "instance", instance: 3, reason: "binding" });
  });

  it("sends the first idle instance when the primary is busy", () => {
    const decision = chooseInstance({
      voiceChannelId: V,
      premiumActive: false,
      candidates: [busyPrimary, candidate(2, { voiceChannelId: "x", hasTrack: true, listeners: 1 }), candidate(3), candidate(4)]
    });
    expect(decision).toEqual({ kind: "instance", instance: 3, reason: "idle" });
  });

  it("skips offline, missing, restricted, premium and other-bound instances", () => {
    const decision = chooseInstance({
      voiceChannelId: V,
      premiumActive: false,
      candidates: [
        busyPrimary,
        candidate(2, { online: false }),
        candidate(3, { inGuild: false }),
        candidate(4, { allowedChannels: [OTHER] }),
        candidate(5)
      ]
    });
    expect(decision).toEqual({ kind: "none" });
  });

  it("uses an instance bound elsewhere only as a last resort", () => {
    const decision = chooseInstance({
      voiceChannelId: V,
      premiumActive: true,
      candidates: [busyPrimary, candidate(2, { boundTo: OTHER }), candidate(5)]
    });
    expect(decision).toEqual({ kind: "instance", instance: 5, reason: "idle" });
  });

  it("refuses when every instance is busy", () => {
    const decision = chooseInstance({
      voiceChannelId: V,
      premiumActive: false,
      candidates: [busyPrimary, candidate(2, { voiceChannelId: OTHER, hasTrack: true, listeners: 1 })]
    });
    expect(decision).toEqual({ kind: "none" });
  });
});
