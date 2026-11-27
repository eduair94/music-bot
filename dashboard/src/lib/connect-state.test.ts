import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { createState, STATE_MAX_AGE_MS, verifyState } from "./connect-state";

const SECRET = "test-auth-secret-long-enough";
const USER = "1066182746399055993";
const NOW = 1_790_000_000_000;

const expected = (over: Partial<{ userId: string; provider: string; secret: string; now: number }> = {}) => ({
  userId: USER,
  provider: "spotify",
  secret: SECRET,
  now: NOW + 30_000,
  ...over,
});

/** Swap one character of a base64url string for a different valid one. */
function flip(s: string, at: number): string {
  const c = s[at] === "A" ? "B" : "A";
  return s.slice(0, at) + c + s.slice(at + 1);
}

describe("connect state", () => {
  it("accepts a fresh state from the same user and provider when the cookie matches", () => {
    const state = createState(USER, "spotify", SECRET, NOW);
    expect(verifyState(state, state, expected())).toEqual({ ok: true });
    // Right up to the 10-minute limit.
    expect(verifyState(state, state, expected({ now: NOW + STATE_MAX_AGE_MS }))).toEqual({ ok: true });
  });

  it("never issues the same state twice", () => {
    expect(createState(USER, "spotify", SECRET, NOW)).not.toBe(createState(USER, "spotify", SECRET, NOW));
  });

  it("rejects a tampered payload or signature", () => {
    const state = createState(USER, "spotify", SECRET, NOW);
    const [payload, signature] = state.split(".");

    const badPayload = `${flip(payload, 3)}.${signature}`;
    expect(verifyState(badPayload, badPayload, expected())).toEqual({ ok: false, reason: "signature" });

    const badSignature = `${payload}.${flip(signature, 5)}`;
    expect(verifyState(badSignature, badSignature, expected())).toEqual({ ok: false, reason: "signature" });

    // A payload re-signed for another user without the secret.
    const forged = Buffer.from(JSON.stringify({ u: "1", p: "spotify", t: NOW, n: "x" })).toString("base64url");
    const forgedState = `${forged}.${signature}`;
    expect(verifyState(forgedState, forgedState, expected({ userId: "1" }))).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a state signed with another secret", () => {
    const state = createState(USER, "spotify", "some-other-secret-value", NOW);
    expect(verifyState(state, state, expected())).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects an expired state and one stamped far in the future", () => {
    const state = createState(USER, "spotify", SECRET, NOW);
    expect(verifyState(state, state, expected({ now: NOW + STATE_MAX_AGE_MS + 1 }))).toEqual({ ok: false, reason: "expired" });

    const future = createState(USER, "spotify", SECRET, NOW + 5 * 60_000);
    expect(verifyState(future, future, expected({ now: NOW }))).toEqual({ ok: false, reason: "expired" });
  });

  it("rejects a state issued to another Discord user", () => {
    const state = createState(USER, "spotify", SECRET, NOW);
    expect(verifyState(state, state, expected({ userId: "222222222222222222" }))).toEqual({ ok: false, reason: "user" });
  });

  it("rejects a state started for the other provider", () => {
    const state = createState(USER, "youtube", SECRET, NOW);
    expect(verifyState(state, state, expected())).toEqual({ ok: false, reason: "provider" });
  });

  it("requires the cookie copy to be present and identical", () => {
    const state = createState(USER, "spotify", SECRET, NOW);
    const other = createState(USER, "spotify", SECRET, NOW);
    expect(verifyState(state, undefined, expected())).toEqual({ ok: false, reason: "missing" });
    expect(verifyState(null, state, expected())).toEqual({ ok: false, reason: "missing" });
    expect(verifyState(state, other, expected())).toEqual({ ok: false, reason: "mismatch" });
  });

  it("rejects garbage", () => {
    for (const junk of ["nodot", "a.b.c", ".sig", "payload."]) {
      expect(verifyState(junk, junk, expected())).toMatchObject({ ok: false });
    }
    // Valid signature over a payload that isn't JSON.
    const payload = Buffer.from("not json").toString("base64url");
    const sig = createHmac("sha256", SECRET).update(`bypass.connect-state.v1.${payload}`).digest("base64url");
    expect(verifyState(`${payload}.${sig}`, `${payload}.${sig}`, expected())).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses to sign with an empty secret", () => {
    expect(() => createState(USER, "spotify", "", NOW)).toThrow();
  });
});
