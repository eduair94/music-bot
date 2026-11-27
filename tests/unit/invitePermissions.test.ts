import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";
import { INVITE_PERMISSION_LIST, NEVER_REQUESTED } from "../../shared/invitePermissions";
import { INVITE_PERMISSIONS } from "../../shared/links";

const bitOf = (key: string) => (PermissionFlagsBits as Record<string, bigint>)[key];

describe("invite permissions", () => {
  it("lists exactly the bits the invite link asks for", () => {
    const listed = INVITE_PERMISSION_LIST.reduce((acc, p) => acc | bitOf(p.key), BigInt(0));
    expect(listed.toString()).toBe(INVITE_PERMISSIONS);
  });

  it("names real discord.js flags, each once", () => {
    const keys = INVITE_PERMISSION_LIST.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of [...keys, ...NEVER_REQUESTED.map((p) => p.key)]) {
      expect(bitOf(key), key).toBeTypeOf("bigint");
    }
  });

  it("never asks for admin or moderation powers", () => {
    const value = BigInt(INVITE_PERMISSIONS);
    for (const p of NEVER_REQUESTED) {
      expect(value & bitOf(p.key), p.name).toBe(BigInt(0));
    }
  });

  it("explains every permission", () => {
    for (const p of INVITE_PERMISSION_LIST) expect(p.why.length, p.name).toBeGreaterThan(10);
  });
});
