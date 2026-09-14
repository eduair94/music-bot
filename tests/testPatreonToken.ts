import { FetchLike, PatreonTokenManager, PatreonTokens, PatreonTokenStore } from "../services/patreonToken";

let failed = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (!ok) failed++;
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok && detail !== undefined) console.log(`   got: ${JSON.stringify(detail)}`);
}

class MemoryStore implements PatreonTokenStore {
  saves = 0;
  constructor(public tokens: PatreonTokens | null = null) {}
  async load() {
    return this.tokens ? { ...this.tokens } : null;
  }
  async save(tokens: PatreonTokens) {
    this.saves++;
    this.tokens = { ...tokens };
  }
}

function fakeFetch(responses: Array<{ status: number; body: unknown }>) {
  const calls: Array<{ url: string; method?: string }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method });
    const next = responses.shift();
    if (!next) throw new Error(`unexpected request to ${url}`);
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body,
      text: async () => JSON.stringify(next.body)
    };
  };
  return { fetch, calls };
}

const NOW = Date.UTC(2026, 8, 14);
const base = {
  envAccessToken: "env-access",
  envRefreshToken: "env-refresh",
  clientId: "client-id",
  clientSecret: "client-secret",
  now: () => NOW
};

async function main() {
  // First run: the .env tokens are the seed and get persisted
  {
    const store = new MemoryStore();
    const manager = new PatreonTokenManager({ ...base, store, fetch: fakeFetch([]).fetch });
    check("first run uses the .env token", (await manager.getAccessToken()) === "env-access");
    check("first run persists the seed", store.tokens?.refreshToken === "env-refresh" && store.saves === 1, store.tokens);
  }

  // Tokens rotated by an earlier run win over the now-stale .env token
  {
    const store = new MemoryStore();
    await new PatreonTokenManager({ ...base, store, fetch: fakeFetch([]).fetch }).getAccessToken();
    store.tokens = { ...store.tokens!, accessToken: "rotated-access", refreshToken: "rotated-refresh" };
    const manager = new PatreonTokenManager({ ...base, store, fetch: fakeFetch([]).fetch });
    check("stored rotated token wins over .env", (await manager.getAccessToken()) === "rotated-access");
  }

  // A new token put in .env replaces whatever was stored
  {
    const store = new MemoryStore({ accessToken: "old-rotated", refreshToken: "old-refresh", seededFrom: "another-seed" });
    const manager = new PatreonTokenManager({ ...base, store, fetch: fakeFetch([]).fetch });
    check(
      "a new .env token reseeds the store",
      (await manager.getAccessToken()) === "env-access" && store.tokens?.refreshToken === "env-refresh",
      store.tokens
    );
  }

  // refresh() exchanges the refresh token and stores the rotated pair
  {
    const store = new MemoryStore();
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { access_token: "new-access", refresh_token: "new-refresh", expires_in: 2678400, token_type: "Bearer" } }
    ]);
    const manager = new PatreonTokenManager({ ...base, store, fetch });
    const token = await manager.refresh();
    const url = new URL(calls[0]?.url ?? "http://invalid");
    check("refresh returns the new access token", token === "new-access", token);
    check(
      "refresh POSTs to Patreon's token endpoint",
      calls[0]?.method === "POST" && `${url.origin}${url.pathname}` === "https://www.patreon.com/api/oauth2/token",
      calls[0]
    );
    check(
      "refresh sends the grant, refresh token and client credentials",
      url.searchParams.get("grant_type") === "refresh_token" &&
        url.searchParams.get("refresh_token") === "env-refresh" &&
        url.searchParams.get("client_id") === "client-id" &&
        url.searchParams.get("client_secret") === "client-secret"
    );
    check(
      "refresh stores the rotated pair and its expiry",
      store.tokens?.accessToken === "new-access" &&
        store.tokens?.refreshToken === "new-refresh" &&
        store.tokens?.expiresAt?.getTime() === NOW + 2678400 * 1000,
      store.tokens
    );
    check("later calls use the new token", (await manager.getAccessToken()) === "new-access");
  }

  // Concurrent 401s share a single refresh
  {
    const { fetch, calls } = fakeFetch([{ status: 200, body: { access_token: "a2", refresh_token: "r2", expires_in: 100 } }]);
    const manager = new PatreonTokenManager({ ...base, store: new MemoryStore(), fetch });
    const [first, second] = await Promise.all([manager.refresh(), manager.refresh()]);
    check("concurrent refreshes share one request", calls.length === 1 && first === "a2" && second === "a2", {
      calls: calls.length,
      first,
      second
    });
  }

  // A rejected refresh leaves the current tokens alone
  {
    const store = new MemoryStore();
    const { fetch } = fakeFetch([{ status: 400, body: { error: "invalid_grant" } }]);
    const manager = new PatreonTokenManager({ ...base, store, fetch });
    check("failed refresh returns null", (await manager.refresh()) === null);
    check(
      "failed refresh keeps the current token",
      (await manager.getAccessToken()) === "env-access" && store.tokens?.refreshToken === "env-refresh",
      store.tokens
    );
  }

  // A token about to expire is refreshed before it is used
  {
    const store = new MemoryStore();
    await new PatreonTokenManager({ ...base, store, fetch: fakeFetch([]).fetch }).getAccessToken();
    store.tokens = { ...store.tokens!, expiresAt: new Date(NOW + 60 * 60 * 1000) };
    const { fetch, calls } = fakeFetch([
      { status: 200, body: { access_token: "fresh", refresh_token: "fresh-refresh", expires_in: 2678400 } }
    ]);
    const manager = new PatreonTokenManager({ ...base, store, fetch });
    check("a near-expiry token is refreshed first", (await manager.getAccessToken()) === "fresh" && calls.length === 1);
  }

  // An unreachable store falls back to .env without caching it, and is read again later
  {
    const memory = new MemoryStore();
    await new PatreonTokenManager({ ...base, store: memory, fetch: fakeFetch([]).fetch }).getAccessToken();
    memory.tokens = { ...memory.tokens!, accessToken: "rotated-access" };
    let loads = 0;
    const flaky: PatreonTokenStore = {
      load: async () => {
        loads++;
        if (loads === 1) throw new Error("database not connected");
        return memory.load();
      },
      save: (tokens) => memory.save(tokens)
    };
    const manager = new PatreonTokenManager({ ...base, store: flaky, fetch: fakeFetch([]).fetch });
    const first = await manager.getAccessToken();
    const second = await manager.getAccessToken();
    check("an unreachable store falls back to .env, then is read again", first === "env-access" && second === "rotated-access", {
      first,
      second
    });
  }

  // Without client credentials there is nothing to refresh with
  {
    const { fetch, calls } = fakeFetch([]);
    const manager = new PatreonTokenManager({ ...base, clientId: "", store: new MemoryStore(), fetch });
    check("missing client credentials skip the refresh", (await manager.refresh()) === null && calls.length === 0);
  }

  console.log(`\n${failed === 0 ? "all passed" : `${failed} failed`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
