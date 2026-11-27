import { describe, expect, it } from "vitest";
import { validateSettingsPatch } from "./settings-schema";

const ID = "123456789012345678";
const stored = { guildId: ID, maxVolume: 100, defaultVolume: 80, totalSongsPlayed: 42, autoplay: false, embedColor: "#F8AA2A" };

describe("validateSettingsPatch", () => {
  it("keeps only changed, valid values", () => {
    const r = validateSettingsPatch({ autoplay: true, embedColor: "#f8aa2a", maxVolume: 100 }, stored, { strict: true });
    expect(r).toMatchObject({ ok: true, errors: {} });
    expect(r.updates).toEqual({ autoplay: true });
  });

  it("caps volume at 100 like the bot", () => {
    const r = validateSettingsPatch({ maxVolume: 200 }, stored, { strict: true });
    expect(r.ok).toBe(false);
    expect(r.errors.maxVolume).toMatch(/1 to 100/);
    expect(r.updates).toEqual({});
  });

  it("never writes counters: strict mode refuses them, lenient mode drops them", () => {
    const strict = validateSettingsPatch({ totalSongsPlayed: 0 }, stored, { strict: true });
    expect(strict.ok).toBe(false);
    expect(strict.errors.totalSongsPlayed).toBeDefined();

    const lenient = validateSettingsPatch({ ...stored, totalSongsPlayed: 0, _id: "x", autoplay: true }, stored, { strict: false });
    expect(lenient.ok).toBe(true);
    expect(lenient.updates).toEqual({ autoplay: true });
    expect(lenient.ignored).toEqual(expect.arrayContaining(["totalSongsPlayed", "_id", "guildId"]));
  });

  it("rejects unknown fields in strict mode", () => {
    expect(validateSettingsPatch({ bogus: 1 }, stored, { strict: true }).errors.bogus).toBe("Unknown setting");
  });

  it("never writes fleet bindings (PUT /fleet/bindings only)", () => {
    const fleet = { bindings: { "2": ID } };
    const strict = validateSettingsPatch({ fleet }, stored, { strict: true });
    expect(strict.ok).toBe(false);
    expect(strict.errors.fleet).toBe("This setting cannot be changed here");

    const lenient = validateSettingsPatch({ ...stored, fleet, autoplay: true }, stored, { strict: false });
    expect(lenient.updates).toEqual({ autoplay: true });
    expect(lenient.ignored).toContain("fleet");
  });

  it("validates ids, lists and enums", () => {
    const r = validateSettingsPatch(
      { djRoleId: "abc", allowedVoiceChannels: [ID, "1"], language: "xx", disabledCommands: ["Play!"] },
      stored,
      { strict: true }
    );
    expect(Object.keys(r.errors).sort()).toEqual(["allowedVoiceChannels", "disabledCommands", "djRoleId", "language"]);

    const good = validateSettingsPatch(
      { djRoleId: null, allowedVoiceChannels: [ID, ID], language: "pt_br", logChannelId: "disabled", blacklistedSongs: [" a ", "a", ""] },
      stored,
      { strict: true }
    );
    expect(good.ok).toBe(true);
    // djRoleId null equals the unset stored value, so it is not a change.
    expect(good.updates).toEqual({ allowedVoiceChannels: [ID], language: "pt_br", logChannelId: "disabled", blacklistedSongs: ["a"] });
  });

  it("keeps defaultVolume within maxVolume", () => {
    expect(validateSettingsPatch({ maxVolume: 50 }, stored, { strict: true }).updates).toEqual({ maxVolume: 50, defaultVolume: 50 });
    const both = validateSettingsPatch({ maxVolume: 50, defaultVolume: 70 }, stored, { strict: true });
    expect(both.ok).toBe(false);
    expect(both.errors.defaultVolume).toMatch(/50/);
  });

  it("rejects non-objects", () => {
    expect(validateSettingsPatch([1], stored, { strict: true }).ok).toBe(false);
    expect(validateSettingsPatch(null, stored, { strict: false }).ok).toBe(false);
  });
});
