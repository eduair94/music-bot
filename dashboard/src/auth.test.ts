import { NextRequest } from "next/server";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Drives the real Auth.js handlers through a Discord OAuth round trip
// (csrf -> signin -> callback). Discord's token and user endpoints are
// stubbed; the callback can carry the RFC 9207 `iss` parameter that Discord
// sends since it advertised authorization_response_iss_parameter_supported.

const ORIGIN = "http://localhost:4123";
const BASE = `${ORIGIN}/api/auth`;
const DISCORD_USER_ID = "80351110224678912";
const SUPPORT_MEMBER_URL = `https://discord.com/api/v10/guilds/1458199268564406487/members/${DISCORD_USER_ID}`;

// The support-server join records each attempt in Mongo; the model and the
// connection are stubbed so the once-only rule can be driven from here.
const db = vi.hoisted(() => ({ connect: vi.fn(), updateOne: vi.fn() }));
vi.mock("./lib/mongodb", () => ({ connectToDatabase: db.connect }));
vi.mock("./lib/models/SupportJoin", () => ({ SupportJoin: { updateOne: db.updateOne } }));

let handlers: (typeof import("./auth"))["handlers"];
let joinSupportServerOnce: (typeof import("./lib/support-join"))["joinSupportServerOnce"];

beforeAll(async () => {
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("NEXTAUTH_URL", "");
  vi.stubEnv("AUTH_SECRET", "test-secret-that-is-long-enough-for-jwe");
  vi.stubEnv("AUTH_DISCORD_ID", "1234567890");
  vi.stubEnv("AUTH_DISCORD_SECRET", "discord-secret");
  vi.stubEnv("DISCORD_BOT_TOKEN", "bot-token-for-tests");
  vi.stubEnv("SUPPORT_GUILD_ID", "");
  ({ handlers } = await import("./auth"));
  ({ joinSupportServerOnce } = await import("./lib/support-join"));
  // Transforming next-auth on first import is slow on a busy machine.
}, 60_000);

beforeEach(() => {
  db.connect.mockResolvedValue({});
  // Default: this member already had their one attempt, so no PUT goes out.
  db.updateOne.mockResolvedValue({ upsertedCount: 0 });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function cookieJar() {
  const jar = new Map<string, string>();
  return {
    store(res: Response) {
      for (const cookie of res.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const eq = pair.indexOf("=");
        jar.set(pair.slice(0, eq), pair.slice(eq + 1));
      }
    },
    header: () => [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
    has: (name: string) => jar.has(name) && jar.get(name) !== "",
  };
}

function stubDiscord({
  scope = "identify guilds email guilds.join",
  supportJoin = async () => new Response(null, { status: 201 }),
}: { scope?: string; supportJoin?: () => Promise<Response> } = {}) {
  // `init` is read back through mock.calls.
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({
        access_token: "access",
        token_type: "Bearer",
        expires_in: 604800,
        refresh_token: "refresh",
        scope,
      });
    }
    if (url === SUPPORT_MEMBER_URL) return supportJoin();
    if (url === "https://discord.com/api/users/@me") {
      return Response.json({
        id: DISCORD_USER_ID,
        username: "nelly",
        global_name: "Nelly",
        discriminator: "0",
        avatar: null,
        email: "nelly@example.com",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    /** The support-server PUTs that went out, as [url, init] pairs. */
    supportCalls: () => fetchMock.mock.calls.filter(([input]) => String(input) === SUPPORT_MEMBER_URL),
  };
}

async function signInThenCallback(extra: Record<string, string>) {
  const jar = cookieJar();

  const csrf = await handlers.GET(new NextRequest(`${BASE}/csrf`));
  jar.store(csrf);
  const { csrfToken } = await csrf.json();

  const signin = await handlers.POST(
    new NextRequest(`${BASE}/signin/discord`, {
      method: "POST",
      headers: {
        cookie: jar.header(),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken, callbackUrl: `${ORIGIN}/dashboard` }).toString(),
    }),
  );
  jar.store(signin);
  const authorize = new URL(signin.headers.get("location")!);
  expect(authorize.origin + authorize.pathname).toBe("https://discord.com/api/oauth2/authorize");

  // Discord answers with either a code or an error, never both.
  const params = new URLSearchParams("error" in extra ? extra : { code: "code-from-discord", ...extra });
  const state = authorize.searchParams.get("state");
  if (state) params.set("state", state);

  const callback = await handlers.GET(
    new NextRequest(`${BASE}/callback/discord?${params}`, {
      headers: { cookie: jar.header() },
    }),
  );
  jar.store(callback);
  return { location: callback.headers.get("location"), jar, authorize };
}

describe("Discord sign-in", () => {
  it("accepts the iss parameter Discord sends on the callback", async () => {
    stubDiscord();
    const { location, jar } = await signInThenCallback({ iss: "https://discord.com" });
    expect(location).toBe(`${ORIGIN}/dashboard`);
    expect(jar.has("authjs.session-token")).toBe(true);
  });

  it("still accepts a callback without iss", async () => {
    stubDiscord();
    const { location, jar } = await signInThenCallback({});
    expect(location).toBe(`${ORIGIN}/dashboard`);
    expect(jar.has("authjs.session-token")).toBe(true);
  });

  it("rejects a callback whose iss names another server", async () => {
    stubDiscord();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { location, jar } = await signInThenCallback({ iss: "https://evil.example" });
    expect(location).toBe(`${ORIGIN}/login?error=Configuration`);
    expect(jar.has("authjs.session-token")).toBe(false);
  });

  it("sends a cancelled Discord consent back to the login page", async () => {
    stubDiscord();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { location, jar } = await signInThenCallback({
      error: "access_denied",
      error_description: "The resource owner or authorization server denied the request",
      iss: "https://discord.com",
    });
    expect(location).toBe(`${ORIGIN}/login?error=OAuthCallbackError`);
    expect(jar.has("authjs.session-token")).toBe(false);
  });
});

describe("Support server join at sign-in", () => {
  /** The bookkeeping write that closes an attempt ($set outcome), once it has happened. */
  const outcomeWrite = () => db.updateOne.mock.calls.find(([, update]) => "$set" in (update as object));

  it("asks Discord for guilds.join alongside the existing scopes", async () => {
    stubDiscord();
    const { authorize } = await signInThenCallback({ iss: "https://discord.com" });
    expect(authorize.searchParams.get("scope")?.split(" ").sort()).toEqual(["email", "guilds", "guilds.join", "identify"]);
  });

  it("adds a first-time member with the bot token and their access token, and records it", async () => {
    db.updateOne.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValue({});
    const discord = stubDiscord();
    const { location } = await signInThenCallback({ iss: "https://discord.com" });
    expect(location).toBe(`${ORIGIN}/dashboard`);

    await vi.waitFor(() => expect(outcomeWrite()).toBeDefined());
    const calls = discord.supportCalls();
    expect(calls).toHaveLength(1);
    const init = calls[0][1]!;
    expect(init.method).toBe("PUT");
    expect(new Headers(init.headers).get("authorization")).toBe("Bot bot-token-for-tests");
    expect(JSON.parse(String(init.body))).toEqual({ access_token: "access" });

    // The attempt is claimed (insert-only upsert) before Discord is called.
    expect(db.updateOne.mock.calls[0]).toEqual([
      { discordId: DISCORD_USER_ID },
      { $setOnInsert: expect.objectContaining({ discordId: DISCORD_USER_ID, outcome: "pending" }) },
      { upsert: true },
    ]);
    expect(outcomeWrite()![1]).toEqual({ $set: expect.objectContaining({ outcome: "joined", httpStatus: 201 }) });
  });

  it("never adds the same member twice, even after they left the server", async () => {
    // upsertedCount 0: the row from their first sign-in is already there.
    const discord = stubDiscord();
    await signInThenCallback({ iss: "https://discord.com" });
    await vi.waitFor(() => expect(db.updateOne).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 20));
    expect(discord.supportCalls()).toHaveLength(0);
    expect(outcomeWrite()).toBeUndefined();
  });

  it("records 204 as already a member", async () => {
    db.updateOne.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValue({});
    stubDiscord({ supportJoin: async () => new Response(null, { status: 204 }) });
    await signInThenCallback({ iss: "https://discord.com" });
    await vi.waitFor(() => expect(outcomeWrite()).toBeDefined());
    expect(outcomeWrite()![1]).toEqual({ $set: expect.objectContaining({ outcome: "member", httpStatus: 204 }) });
  });

  it("warns and carries on when Discord refuses the join", async () => {
    db.updateOne.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValue({});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubDiscord({ supportJoin: async () => Response.json({ message: "Missing Access", code: 50001 }, { status: 403 }) });
    const { location, jar } = await signInThenCallback({ iss: "https://discord.com" });
    expect(location).toBe(`${ORIGIN}/dashboard`);
    expect(jar.has("authjs.session-token")).toBe(true);
    await vi.waitFor(() => expect(outcomeWrite()).toBeDefined());
    expect(warn).toHaveBeenCalledWith("[auth] support join failed", 403);
    expect(outcomeWrite()![1]).toEqual({ $set: expect.objectContaining({ outcome: "failed", httpStatus: 403 }) });
  });

  it("does not hold up sign-in while Discord is slow", async () => {
    db.updateOne.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValue({});
    const discord = stubDiscord({ supportJoin: () => new Promise<Response>(() => {}) });
    const { location, jar } = await signInThenCallback({ iss: "https://discord.com" });
    expect(location).toBe(`${ORIGIN}/dashboard`);
    expect(jar.has("authjs.session-token")).toBe(true);
    await vi.waitFor(() => expect(discord.supportCalls()).toHaveLength(1));
  });

  it("skips a grant that lacks guilds.join without spending the one attempt", async () => {
    const discord = stubDiscord({ scope: "identify guilds email" });
    await signInThenCallback({ iss: "https://discord.com" });
    await new Promise((r) => setTimeout(r, 20));
    expect(db.updateOne).not.toHaveBeenCalled();
    expect(discord.supportCalls()).toHaveLength(0);
  });

  it("makes no attempt when the attempt can't be recorded", async () => {
    db.connect.mockRejectedValue(new Error("mongo down"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const discord = stubDiscord();
    await expect(joinSupportServerOnce({ discordId: DISCORD_USER_ID, accessToken: "access", scope: "guilds.join" })).resolves.toBe("skipped");
    expect(discord.supportCalls()).toHaveLength(0);
  });

  it("counts a request that never answers as failed (status 0)", async () => {
    db.updateOne.mockResolvedValueOnce({ upsertedCount: 1 }).mockResolvedValue({});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubDiscord({ supportJoin: async () => Promise.reject(new DOMException("timed out", "TimeoutError")) });
    await expect(joinSupportServerOnce({ discordId: DISCORD_USER_ID, accessToken: "access" })).resolves.toBe("failed");
    expect(outcomeWrite()![1]).toEqual({ $set: expect.objectContaining({ outcome: "failed", httpStatus: 0 }) });
  });
});
