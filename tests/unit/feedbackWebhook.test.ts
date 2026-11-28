import { describe, expect, it, vi } from "vitest";
import { buildFeedbackWebhookPayload, forwardFeedback, npsBand } from "../../shared/feedbackWebhook";

const base = { kind: "idea" as const, source: "site" as const, message: "Add a crossfade option" };

describe("feedback webhook payload", () => {
  it("never pings and carries the message", () => {
    const body = buildFeedbackWebhookPayload({ ...base, message: "@everyone look" });
    expect(body.allowed_mentions).toEqual({ parse: [] });
    expect(body.embeds[0].description).toBe("@everyone look");
    expect(body.embeds[0].title).toBe("Idea");
  });

  it("truncates long messages", () => {
    const body = buildFeedbackWebhookPayload({ ...base, message: "x".repeat(2000) });
    expect(body.embeds[0].description.length).toBeLessThanOrEqual(1800);
    expect(body.embeds[0].description.endsWith("…")).toBe(true);
  });

  it("labels NPS answers with the score and band", () => {
    const body = buildFeedbackWebhookPayload({ kind: "nps", source: "dashboard", message: "", score: 10, context: "/servers" });
    expect(body.embeds[0].title).toBe("NPS 10/10 (promoter)");
    expect(body.embeds[0].description).toBe("*(no message)*");
    expect(npsBand(6)).toBe("detractor");
    expect(npsBand(7)).toBe("passive");
  });

  it("mentions known users and keeps typed values in inline code", () => {
    const body = buildFeedbackWebhookPayload({
      ...base,
      source: "bot",
      userId: "1066182746399055993",
      userName: "rook",
      guildId: "123456789012345678",
      contact: "[click](https://evil.test) `x`",
      context: "/feedback",
      country: "UY",
      locale: "es-ES",
      quoteOk: true
    });
    const fields = Object.fromEntries(body.embeds[0].fields.map((f) => [f.name, f.value]));
    expect(fields.User).toBe("<@1066182746399055993> `rook`");
    expect(fields["Reply to"]).toBe("`[click](https://evil.test) 'x'`");
    expect(fields.Source).toBe("bot · `/feedback`");
    expect(fields.Server).toBe("`123456789012345678`");
    expect(fields["Country · locale"]).toBe("`UY · es-ES`");
    expect(fields.Quote).toBeDefined();
  });

  it("drops a user id that is not a snowflake", () => {
    const body = buildFeedbackWebhookPayload({ ...base, userId: "<@&role>" });
    expect(body.embeds[0].fields.some((f) => f.name === "User")).toBe(false);
  });
});

describe("forwardFeedback", () => {
  it("does nothing without a webhook URL", async () => {
    const fetchImpl = vi.fn();
    expect(await forwardFeedback(base, { url: "", fetchImpl: fetchImpl as any })).toBe(false);
    expect(await forwardFeedback(base, { url: "http://insecure.test/hook", fetchImpl: fetchImpl as any })).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("posts JSON and reports success", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect(await forwardFeedback(base, { url: "https://discord.com/api/webhooks/1/abc", fetchImpl: fetchImpl as any })).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).allowed_mentions).toEqual({ parse: [] });
  });

  it("never throws on network errors, HTTP errors or timeouts", async () => {
    const url = "https://discord.com/api/webhooks/1/abc";
    const failing = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const rejected = vi.fn(async () => new Response("nope", { status: 400 }));
    const hanging = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }))))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await forwardFeedback(base, { url, fetchImpl: failing as any })).toBe(false);
    expect(await forwardFeedback(base, { url, fetchImpl: rejected as any })).toBe(false);
    expect(await forwardFeedback(base, { url, fetchImpl: hanging as any, timeoutMs: 20 })).toBe(false);
    warn.mockRestore();
  });
});
