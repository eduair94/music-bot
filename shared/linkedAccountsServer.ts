/**
 * Server-only helpers for connected accounts: token encryption and the OAuth
 * HTTP calls (code exchange, refresh, profile). Used by the dashboard's
 * /api/connect routes and by the bot's services/linkedAccounts.ts. Never
 * import this from client components.
 *
 * Env (same values on bot and dashboard):
 *   LINKED_ACCOUNTS_KEY          secret for token encryption (any long random string)
 *   SPOTIFY_OAUTH_CLIENT_ID      Spotify app (falls back to DP_SPOTIFY_CLIENT_ID)
 *   SPOTIFY_OAUTH_CLIENT_SECRET  (falls back to DP_SPOTIFY_CLIENT_SECRET)
 *   GOOGLE_OAUTH_CLIENT_ID       Google Cloud OAuth client (web application)
 *   GOOGLE_OAUTH_CLIENT_SECRET
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { LinkProvider, PROVIDER_OAUTH } from "./linkedAccounts";

// ------------------------------------------------------------ encryption

function encryptionKey(): Uint8Array {
  const secret = process.env.LINKED_ACCOUNTS_KEY;
  if (!secret || secret.length < 16) throw new Error("LINKED_ACCOUNTS_KEY is not set (16+ characters)");
  return new Uint8Array(createHash("sha256").update(secret).digest());
}

const bytes = (b64: string) => new Uint8Array(Buffer.from(b64, "base64url"));
const b64 = (data: Uint8Array) => Buffer.from(data).toString("base64url");

/** Whether tokens can be stored and read (the key is configured). */
export function linkedAccountsKeyConfigured(): boolean {
  const secret = process.env.LINKED_ACCOUNTS_KEY;
  return Boolean(secret && secret.length >= 16);
}

/** AES-256-GCM: "v1.<iv>.<tag>.<ciphertext>", each part base64url. */
export function encryptToken(plain: string): string {
  const iv = new Uint8Array(randomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const head = cipher.update(plain, "utf8", "base64url");
  const tail = cipher.final("base64url");
  // Two base64url chunks don't concatenate safely; re-encode the joined bytes.
  const data = Buffer.concat([new Uint8Array(Buffer.from(head, "base64url")), new Uint8Array(Buffer.from(tail, "base64url"))]);
  return ["v1", b64(iv), b64(new Uint8Array(cipher.getAuthTag())), b64(new Uint8Array(data))].join(".");
}

export function decryptToken(sealed: string): string {
  const [version, iv, tag, data] = String(sealed || "").split(".");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Unknown token format");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes(iv));
  decipher.setAuthTag(bytes(tag));
  return decipher.update(bytes(data), undefined, "utf8") + decipher.final("utf8");
}

// ----------------------------------------------------------------- OAuth

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
}

/** The provider's OAuth client from env, or null when it isn't configured. */
export function oauthClient(provider: LinkProvider): OAuthClient | null {
  const env = process.env;
  const pair =
    provider === "spotify"
      ? {
          clientId: env.SPOTIFY_OAUTH_CLIENT_ID || env.DP_SPOTIFY_CLIENT_ID,
          clientSecret: env.SPOTIFY_OAUTH_CLIENT_SECRET || env.DP_SPOTIFY_CLIENT_SECRET,
        }
      : { clientId: env.GOOGLE_OAUTH_CLIENT_ID, clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET };
  return pair.clientId && pair.clientSecret ? { clientId: pair.clientId, clientSecret: pair.clientSecret } : null;
}

/** Providers that can be connected right now (client configured + encryption key). */
export function availableProviders(): LinkProvider[] {
  if (!linkedAccountsKeyConfigured()) return [];
  return (Object.keys(PROVIDER_OAUTH) as LinkProvider[]).filter((p) => oauthClient(p) !== null);
}

export interface TokenSet {
  accessToken: string;
  /** Absent on a refresh that keeps the old refresh token (Google, sometimes Spotify). */
  refreshToken?: string;
  expiresAt: Date;
  scopes?: string[];
}

export class OAuthError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "OAuthError";
  }
}

async function tokenRequest(provider: LinkProvider, params: Record<string, string>): Promise<TokenSet> {
  const client = oauthClient(provider);
  if (!client) throw new OAuthError(`${provider} OAuth client is not configured`, 0, "not_configured");

  const body = new URLSearchParams(params);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (provider === "spotify") {
    headers.Authorization = `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", client.clientId);
    body.set("client_secret", client.clientSecret);
  }

  const res = await fetch(PROVIDER_OAUTH[provider].tokenUrl, { method: "POST", headers, body });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || typeof json.access_token !== "string") {
    const code = typeof json.error === "string" ? json.error : undefined;
    throw new OAuthError(`${provider} token request failed (${res.status}${code ? ` ${code}` : ""})`, res.status, code);
  }
  const expiresIn = Number(json.expires_in) || 3600;
  return {
    accessToken: json.access_token,
    refreshToken: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    // A minute early, so a token never expires mid-request.
    expiresAt: new Date(Date.now() + (expiresIn - 60) * 1000),
    scopes: typeof json.scope === "string" ? json.scope.split(/[\s,]+/).filter(Boolean) : undefined,
  };
}

/** Authorization code → tokens (dashboard callback). */
export function exchangeCode(provider: LinkProvider, code: string, redirectUri: string): Promise<TokenSet> {
  return tokenRequest(provider, { grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

/**
 * Refresh token → new access token. Throws OAuthError with code
 * "invalid_grant" when the user revoked access (the account must be
 * connected again).
 */
export function refreshTokens(provider: LinkProvider, refreshToken: string): Promise<TokenSet> {
  return tokenRequest(provider, { grant_type: "refresh_token", refresh_token: refreshToken });
}

export interface ProviderProfile {
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
}

/** Who the token belongs to. */
export async function fetchProfile(provider: LinkProvider, accessToken: string): Promise<ProviderProfile> {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (provider === "spotify") {
    const res = await fetch("https://api.spotify.com/v1/me", { headers });
    if (!res.ok) throw new OAuthError(`Spotify profile failed (${res.status})`, res.status);
    const me = (await res.json()) as { id: string; display_name?: string | null; images?: Array<{ url: string }> };
    return { providerUserId: me.id, displayName: me.display_name || me.id, avatarUrl: me.images?.[0]?.url };
  }
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers });
  if (!res.ok) throw new OAuthError(`YouTube profile failed (${res.status})`, res.status);
  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>;
  };
  const channel = data.items?.[0];
  // A Google account without a YouTube channel can still read nothing useful,
  // but connecting should not fail: liked videos and playlists need a channel.
  if (!channel) return { providerUserId: "no-channel", displayName: "YouTube" };
  return {
    providerUserId: channel.id,
    displayName: channel.snippet?.title || "YouTube",
    avatarUrl: channel.snippet?.thumbnails?.default?.url,
  };
}
