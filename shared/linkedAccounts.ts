/**
 * Connected music accounts (Spotify, YouTube) shared by the bot and the
 * dashboard. Browser-safe: no Node imports here. Token crypto and the OAuth
 * HTTP calls live in shared/linkedAccountsServer.ts (server code only).
 *
 * The dashboard runs the OAuth flow (it owns the public redirect URL) and
 * stores one document per (userId, provider) in the Mongo collection
 * `linkedaccounts`. The bot reads those documents to list and play the
 * user's own playlists, refreshing the access token when it expires.
 *
 * Both sides must share the same Mongo database, the same OAuth client
 * credentials and the same LINKED_ACCOUNTS_KEY.
 */

export const LINK_PROVIDERS = ["spotify", "youtube"] as const;
export type LinkProvider = (typeof LINK_PROVIDERS)[number];

export function isLinkProvider(value: unknown): value is LinkProvider {
  return typeof value === "string" && (LINK_PROVIDERS as readonly string[]).includes(value);
}

/** Mongo collection both sides read and write. */
export const LINKED_ACCOUNTS_COLLECTION = "linkedaccounts";

/** One connected account. Tokens are encrypted (see encryptToken). */
export interface LinkedAccountDoc {
  /** Discord user id. Unique together with `provider`. */
  userId: string;
  provider: LinkProvider;
  /** The account id on the provider (Spotify user id, YouTube channel id). */
  providerUserId: string;
  displayName: string;
  avatarUrl?: string;
  /** Scopes the user granted. */
  scopes: string[];
  /** Encrypted access token ("v1.<iv>.<tag>.<ciphertext>"). */
  accessToken: string;
  /** Encrypted refresh token. */
  refreshToken: string;
  /** When the access token stops working. */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderOAuthConfig {
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Extra query parameters on the authorize URL. */
  authorizeParams?: Record<string, string>;
}

export const PROVIDER_OAUTH: Record<LinkProvider, ProviderOAuthConfig> = {
  spotify: {
    label: "Spotify",
    authorizeUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    scopes: ["playlist-read-private", "playlist-read-collaborative", "user-library-read", "user-read-private"],
    // Always show Spotify's consent screen, so people can switch to another Spotify account.
    authorizeParams: { show_dialog: "true" },
  },
  youtube: {
    label: "YouTube",
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    // offline + consent: Google only returns a refresh token on these terms.
    authorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
};

/** Dashboard path the provider redirects back to (append to SITE_URL). */
export function callbackPath(provider: LinkProvider): string {
  return `/api/connect/${provider}/callback`;
}

/** Dashboard page where users connect and disconnect accounts. */
export const CONNECTIONS_PAGE_PATH = "/profile#connections";
