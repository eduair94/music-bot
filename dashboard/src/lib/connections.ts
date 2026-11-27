import "server-only";

import { LinkedAccount } from "@/lib/models/LinkedAccount";
import { connectToDatabase } from "@/lib/mongodb";
import { SITE_URL } from "@/lib/site";
import { callbackPath, LINK_PROVIDERS, PROVIDER_OAUTH, type LinkProvider } from "../../../shared/linkedAccounts";
import { availableProviders } from "../../../shared/linkedAccountsServer";

/**
 * Connected music accounts as the dashboard shows them: one row per provider,
 * never the tokens. Shared by GET /api/connect and the profile page.
 */
export interface ConnectionView {
  provider: LinkProvider;
  label: string;
  /** The provider's OAuth client and the encryption key are configured. */
  available: boolean;
  connected: boolean;
  displayName?: string;
  avatarUrl?: string;
  /** ISO time the account was first connected. */
  connectedAt?: string;
}

/** `connectError` codes the callback sends back to the profile page. */
export const CONNECT_ERRORS = ["denied", "not_allowlisted", "no_refresh_token", "state", "not_configured", "failed"] as const;
export type ConnectErrorCode = (typeof CONNECT_ERRORS)[number];

export function isConnectErrorCode(value: unknown): value is ConnectErrorCode {
  return typeof value === "string" && (CONNECT_ERRORS as readonly string[]).includes(value);
}

/** Rows for every provider, without touching the database (demo, or no session). */
export function emptyConnections(): ConnectionView[] {
  const available = new Set(availableProviders());
  return LINK_PROVIDERS.map((provider) => ({
    provider,
    label: PROVIDER_OAUTH[provider].label,
    available: available.has(provider),
    connected: false,
  }));
}

/** The user's connections, one row per provider. */
export async function listConnections(userId: string): Promise<ConnectionView[]> {
  await connectToDatabase();
  const docs = await LinkedAccount.find({ userId })
    .select("provider displayName avatarUrl createdAt")
    .lean<Array<{ provider: LinkProvider; displayName: string; avatarUrl?: string; createdAt?: Date }>>();
  const byProvider = new Map(docs.map((d) => [d.provider, d]));
  return emptyConnections().map((row) => {
    const doc = byProvider.get(row.provider);
    if (!doc) return row;
    return {
      ...row,
      connected: true,
      displayName: doc.displayName,
      avatarUrl: doc.avatarUrl || undefined,
      connectedAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
    };
  });
}

/** The redirect URI registered with the provider (public site URL, never NEXTAUTH_URL). */
export function redirectUriFor(provider: LinkProvider): string {
  return `${SITE_URL}${callbackPath(provider)}`;
}

/** Profile page URL with the outcome of a connection attempt, landing on the Connections section. */
export function connectionsPageUrl(
  outcome: { connected: LinkProvider } | { error: ConnectErrorCode; provider: LinkProvider },
): string {
  const params = new URLSearchParams(
    "connected" in outcome ? { connected: outcome.connected } : { connectError: outcome.error, provider: outcome.provider },
  );
  return `${SITE_URL}/profile?${params.toString()}#connections`;
}

/** Sign-in page that returns to the profile page afterwards. */
export function loginUrl(): string {
  return `${SITE_URL}/login?${new URLSearchParams({ callbackUrl: "/profile" }).toString()}`;
}

/** Secret for the CSRF state HMAC: the same one Auth.js signs sessions with. */
export function connectStateSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}
