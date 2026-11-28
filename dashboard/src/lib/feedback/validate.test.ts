import { describe, expect, it } from "vitest";
import { cleanContext, clientIp, parseCountry, parseLocale, validateFeedback } from "./validate";

const ok = { kind: "idea", source: "site", message: "Please add crossfade" };

describe("validateFeedback", () => {
  it("accepts a normal idea and trims it", () => {
    const r = validateFeedback({ ...ok, message: "  Please add crossfade \r\n" });
    expect(r).toEqual({ ok: true, spam: false, value: { kind: "idea", source: "site", message: "Please add crossfade" } });
  });

  it("drops honeypot submissions without an error", () => {
    expect(validateFeedback({ ...ok, website: "http://spam.test" })).toEqual({ ok: true, spam: true });
    expect(validateFeedback({ website: "x" })).toEqual({ ok: true, spam: true });
    expect(validateFeedback({ ...ok, website: "   " })).toMatchObject({ ok: true, spam: false });
  });

  it("rejects bad shapes, kinds and sources", () => {
    expect(validateFeedback(null)).toMatchObject({ ok: false });
    expect(validateFeedback([ok])).toMatchObject({ ok: false });
    expect(validateFeedback({ ...ok, kind: "rant" })).toMatchObject({ ok: false, field: "kind" });
    expect(validateFeedback({ ...ok, source: "bot" })).toMatchObject({ ok: false, field: "source" });
    expect(validateFeedback({ ...ok, message: 42 })).toMatchObject({ ok: false, field: "message" });
  });

  it("enforces message length after trimming", () => {
    expect(validateFeedback({ ...ok, message: "  hi   " })).toMatchObject({ ok: false, field: "message" });
    expect(validateFeedback({ ...ok, message: "hey" })).toMatchObject({ ok: true });
    expect(validateFeedback({ ...ok, message: "x".repeat(2000) })).toMatchObject({ ok: true });
    expect(validateFeedback({ ...ok, message: "x".repeat(2001) })).toMatchObject({ ok: false, field: "message" });
  });

  it("strips control characters but keeps newlines", () => {
    const r = validateFeedback({ ...ok, message: "line one\u0000\nline two\u0007" });
    expect(r.ok && !r.spam && r.value.message).toBe("line one\nline two");
  });

  it("requires an integer 0-10 score for NPS, message optional", () => {
    expect(validateFeedback({ kind: "nps", source: "dashboard", score: 9 })).toEqual({
      ok: true,
      spam: false,
      value: { kind: "nps", source: "dashboard", message: "", score: 9 },
    });
    expect(validateFeedback({ kind: "nps", source: "dashboard", score: 0, message: "too slow" })).toMatchObject({ ok: true });
    for (const score of [undefined, -1, 11, 7.5, "9"]) {
      expect(validateFeedback({ kind: "nps", source: "dashboard", score })).toMatchObject({ ok: false, field: "score" });
    }
  });

  it("ignores a score on non-NPS feedback", () => {
    const r = validateFeedback({ ...ok, score: 3 });
    expect(r.ok && !r.spam && r.value.score).toBeUndefined();
  });

  it("validates the optional contact", () => {
    const r = validateFeedback({ ...ok, contact: "  rook#0001  " });
    expect(r.ok && !r.spam && r.value.contact).toBe("rook#0001");
    const empty = validateFeedback({ ...ok, contact: "   " });
    expect(empty.ok && !empty.spam && "contact" in empty.value).toBe(false);
    expect(validateFeedback({ ...ok, contact: "x".repeat(121) })).toMatchObject({ ok: false, field: "contact" });
    expect(validateFeedback({ ...ok, contact: 5 })).toMatchObject({ ok: false, field: "contact" });
  });

  it("keeps quoteOk only on praise", () => {
    const praise = validateFeedback({ ...ok, kind: "praise", quoteOk: true });
    expect(praise.ok && !praise.spam && praise.value.quoteOk).toBe(true);
    const idea = validateFeedback({ ...ok, quoteOk: true });
    expect(idea.ok && !idea.spam && idea.value.quoteOk).toBeUndefined();
    const truthy = validateFeedback({ ...ok, kind: "praise", quoteOk: "yes" });
    expect(truthy.ok && !truthy.spam && truthy.value.quoteOk).toBeUndefined();
  });

  it("keeps a path-like context and drops anything else", () => {
    const r = validateFeedback({ ...ok, context: "/servers/123/player?tab=queue#x" });
    expect(r.ok && !r.spam && r.value.context).toBe("/servers/123/player");
    expect(cleanContext("https://evil.test/")).toBeUndefined();
    expect(cleanContext("/a b")).toBeUndefined();
    expect(cleanContext("/" + "a".repeat(120))).toBeUndefined();
    expect(cleanContext("<script>")).toBeUndefined();
    expect(cleanContext(7)).toBeUndefined();
  });
});

describe("request metadata", () => {
  it("reads the first Accept-Language tag", () => {
    expect(parseLocale("es-ES,es;q=0.9,en;q=0.8")).toBe("es-ES");
    expect(parseLocale("pt-BR")).toBe("pt-BR");
    expect(parseLocale("*")).toBeUndefined();
    expect(parseLocale("<x>")).toBeUndefined();
    expect(parseLocale(null)).toBeUndefined();
  });

  it("reads Cloudflare's country", () => {
    expect(parseCountry("uy")).toBe("UY");
    expect(parseCountry("XX")).toBeUndefined();
    expect(parseCountry("T1")).toBeUndefined();
    expect(parseCountry(undefined)).toBeUndefined();
  });

  it("prefers cf-connecting-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers())).toBeNull();
  });
});
