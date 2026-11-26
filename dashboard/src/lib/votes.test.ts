import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { authorize, parseVote, verifyTopggSignature } from "./votes";

const SECRET = "whs_test_secret";
const sign = (body: string, t: number) => `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;

describe("top.gg v1 signature", () => {
  const body = JSON.stringify({ type: "vote.create", data: { user: { platform_id: "1066182746399055993" } } });
  const now = 1_790_000_000_000;
  const t = Math.floor(now / 1000);

  it("accepts a fresh, correct signature", () => {
    expect(verifyTopggSignature(sign(body, t), body, SECRET, now)).toBe(true);
  });
  it("rejects a tampered body, a wrong secret and a stale timestamp", () => {
    expect(verifyTopggSignature(sign(body, t), body + " ", SECRET, now)).toBe(false);
    expect(verifyTopggSignature(sign(body, t), body, "whs_other", now)).toBe(false);
    expect(verifyTopggSignature(sign(body, t - 600), body, SECRET, now)).toBe(false);
    expect(verifyTopggSignature("garbage", body, SECRET, now)).toBe(false);
  });
});

describe("plain secret auth", () => {
  it("compares the Authorization header", () => {
    expect(authorize("discordbotlist", new Headers({ authorization: "s3cret" }), "{}", "s3cret")).toBe("ok");
    expect(authorize("discordbotlist", new Headers({ authorization: "nope" }), "{}", "s3cret")).toBe("unauthorized");
    expect(authorize("botlistme", new Headers(), "{}", "s3cret")).toBe("unauthorized");
  });
});

describe("parseVote", () => {
  const now = new Date("2026-11-26T12:00:00Z");
  it("reads top.gg v1 with expiry and weekend weight", () => {
    const vote = parseVote("topgg", {
      type: "vote.create",
      data: { created_at: "2026-11-26T11:00:00Z", expires_at: "2026-11-26T23:00:00Z", weight: 2, user: { platform_id: "1066182746399055993" } }
    }, now)!;
    expect(vote.userId).toBe("1066182746399055993");
    expect(vote.perksUntil.toISOString()).toBe("2026-11-26T23:00:00.000Z");
    expect(vote.isWeekend).toBe(true);
    expect(vote.test).toBe(false);
  });
  it("reads top.gg v0, dbl, discords and flags tests", () => {
    expect(parseVote("topgg", { user: "1066182746399055993", type: "test" }, now)!.test).toBe(true);
    expect(parseVote("discordbotlist", { id: "1066182746399055993", username: "x" }, now)!.perksUntil.toISOString()).toBe("2026-11-27T00:00:00.000Z");
    expect(parseVote("discords", { user: "1066182746399055993", type: "review" }, now)).toBeNull();
    expect(parseVote("botlistme", { user: "not-an-id" }, now)).toBeNull();
  });
});
