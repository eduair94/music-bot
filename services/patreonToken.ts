import crypto from "crypto";

/**
 * The Patreon creator's OAuth token pair. A refresh rotates both tokens, so
 * the current pair is persisted instead of being re-read from .env.
 */
export interface PatreonTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
  /** Fingerprint of the .env access token this pair descends from. */
  seededFrom: string;
}

export interface PatreonTokenStore {
  load(): Promise<PatreonTokens | null>;
  save(tokens: PatreonTokens): Promise<void>;
}

export type FetchLike = (
  url: string,
  init?: { method?: string; headers?: Record<string, string> }
) => Promise<{ ok: boolean; status: number; json(): Promise<any>; text(): Promise<string> }>;

export interface PatreonTokenManagerOptions {
  envAccessToken: string;
  envRefreshToken: string;
  clientId: string;
  clientSecret: string;
  store: PatreonTokenStore;
  fetch?: FetchLike;
  now?: () => number;
}

const TOKEN_URL = "https://www.patreon.com/api/oauth2/token";
// Refresh this long before a known expiry so a sync never starts with a dying token.
const REFRESH_MARGIN_MS = 3 * 24 * 60 * 60 * 1000;

function fingerprint(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
}

/**
 * Keeps the Patreon creator access token alive. Creator tokens from the portal
 * expire after about a month; this refreshes them on a 401 (or shortly before a
 * known expiry) and persists the rotated pair, because a refresh token stops
 * working once it has been used.
 */
export class PatreonTokenManager {
  private current: PatreonTokens | null = null;
  private loading: Promise<PatreonTokens | null> | null = null;
  private refreshing: Promise<string | null> | null = null;
  private readonly fetch: FetchLike;
  private readonly now: () => number;

  constructor(private readonly options: PatreonTokenManagerOptions) {
    this.fetch = options.fetch ?? ((url, init) => fetch(url, init));
    this.now = options.now ?? Date.now;
  }

  /** The access token to use now, refreshed first when it is about to expire. */
  public async getAccessToken(): Promise<string | null> {
    const tokens = await this.load();
    if (!tokens) return null;
    if (tokens.expiresAt && tokens.expiresAt.getTime() - this.now() < REFRESH_MARGIN_MS) {
      return (await this.refresh()) ?? tokens.accessToken;
    }
    return tokens.accessToken;
  }

  /** Exchange the refresh token for a new pair. Concurrent callers share one request. */
  public refresh(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.exchangeRefreshToken().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async exchangeRefreshToken(): Promise<string | null> {
    const tokens = await this.load();
    const { clientId, clientSecret } = this.options;
    if (!tokens?.refreshToken || !clientId || !clientSecret) {
      console.error("[Patreon] Cannot refresh the creator token: refresh token or client ID/secret not configured");
      return null;
    }

    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    try {
      const response = await this.fetch(`${TOKEN_URL}?${params}`, {
        method: "POST",
        headers: { "User-Agent": "MusicBot-Patreon-Integration" },
      });
      if (!response.ok) {
        console.error(`[Patreon] Creator token refresh failed: ${response.status} ${await response.text()}`);
        return null;
      }

      const data = await response.json();
      const next: PatreonTokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || tokens.refreshToken,
        expiresAt: data.expires_in ? new Date(this.now() + data.expires_in * 1000) : undefined,
        seededFrom: tokens.seededFrom,
      };
      this.current = next;
      await this.options.store.save(next).catch((error) => {
        console.error("[Patreon] Could not persist the refreshed creator token:", error);
      });
      console.log(`[Patreon] Creator token refreshed (valid until ${next.expiresAt?.toISOString() ?? "unknown"})`);
      return next.accessToken;
    } catch (error) {
      // The request URL carries the client secret, so log only the message.
      console.error("[Patreon] Creator token refresh failed:", (error as Error)?.message);
      return null;
    }
  }

  private load(): Promise<PatreonTokens | null> {
    if (this.current) return Promise.resolve(this.current);
    if (!this.loading) {
      this.loading = this.loadOrSeed().finally(() => {
        this.loading = null;
      });
    }
    return this.loading;
  }

  private async loadOrSeed(): Promise<PatreonTokens | null> {
    const { envAccessToken, envRefreshToken, store } = this.options;
    if (!envAccessToken) return null;
    const seed = fingerprint(envAccessToken);
    const fromEnv: PatreonTokens = { accessToken: envAccessToken, refreshToken: envRefreshToken, seededFrom: seed };

    let stored: PatreonTokens | null;
    try {
      stored = await store.load();
    } catch {
      // Store unreachable: serve the .env pair without caching it, so a pair
      // rotated by an earlier run is picked up once the store is back.
      return fromEnv;
    }

    // A pair rotated by an earlier run wins, unless .env was given a new token since.
    if (stored?.seededFrom === seed) {
      this.current = stored;
      return stored;
    }

    await store.save(fromEnv).catch((error) => {
      console.error("[Patreon] Could not persist the creator token:", error);
    });
    this.current = fromEnv;
    return fromEnv;
  }
}
