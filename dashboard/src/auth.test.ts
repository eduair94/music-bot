import { NextRequest } from "next/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Drives the real Auth.js handlers through a Discord OAuth round trip
// (csrf -> signin -> callback). Discord's token and user endpoints are
// stubbed; the callback can carry the RFC 9207 `iss` parameter that Discord
// sends since it advertised authorization_response_iss_parameter_supported.

const ORIGIN = "http://localhost:4123";
const BASE = `${ORIGIN}/api/auth`;

let handlers: (typeof import("./auth"))["handlers"];

beforeAll(async () => {
  vi.stubEnv("AUTH_URL", "");
  vi.stubEnv("NEXTAUTH_URL", "");
  vi.stubEnv("AUTH_SECRET", "test-secret-that-is-long-enough-for-jwe");
  vi.stubEnv("AUTH_DISCORD_ID", "1234567890");
  vi.stubEnv("AUTH_DISCORD_SECRET", "discord-secret");
  ({ handlers } = await import("./auth"));
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

function stubDiscord() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url === "https://discord.com/api/oauth2/token") {
        return Response.json({
          access_token: "access",
          token_type: "Bearer",
          expires_in: 604800,
          refresh_token: "refresh",
          scope: "identify guilds email",
        });
      }
      if (url === "https://discord.com/api/users/@me") {
        return Response.json({
          id: "80351110224678912",
          username: "nelly",
          global_name: "Nelly",
          discriminator: "0",
          avatar: null,
          email: "nelly@example.com",
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
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
  return { location: callback.headers.get("location"), jar };
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
