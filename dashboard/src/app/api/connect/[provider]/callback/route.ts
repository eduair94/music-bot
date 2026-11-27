import { auth } from "@/auth";
import { stateCookieName, verifyState } from "@/lib/connect-state";
import { connectionsPageUrl, connectStateSecret, loginUrl, redirectUriFor, type ConnectErrorCode } from "@/lib/connections";
import { LinkedAccount } from "@/lib/models/LinkedAccount";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse, type NextRequest } from "next/server";
import { isLinkProvider, PROVIDER_OAUTH, type LinkProvider } from "../../../../../../../shared/linkedAccounts";
import {
  availableProviders,
  encryptToken,
  exchangeCode,
  fetchProfile,
  OAuthError,
  type ProviderProfile,
} from "../../../../../../../shared/linkedAccountsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

/** Redirect and drop the one-time state cookie, whatever the outcome. */
function finish(provider: LinkProvider, url: string): NextResponse {
  const res = NextResponse.redirect(url);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(stateCookieName(provider), "", { httpOnly: true, secure: true, sameSite: "lax", path: "/api/connect", maxAge: 0 });
  return res;
}

/** Error text safe to log: provider status and error code, never tokens or the code. */
function describe(error: unknown): string {
  if (error instanceof OAuthError) return `${error.message}${error.code ? ` [${error.code}]` : ""}`;
  return error instanceof Error ? error.message : "unknown error";
}

/**
 * GET /api/connect/[provider]/callback
 * The provider sends the browser back here with ?code&state (or ?error).
 * Checks the state against the cookie, the signature, its age and the signed-in
 * Discord user; exchanges the code; reads the account's name; stores the
 * account with encrypted tokens; and returns to /profile#connections with
 * ?connected=<p> or ?connectError=<code>&provider=<p>.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const { provider } = await params;
  if (!isLinkProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const fail = (code: ConnectErrorCode) => finish(provider, connectionsPageUrl({ error: code, provider }));

  const session = await auth();
  const userId = session?.user?.discordId;
  if (!userId) return finish(provider, loginUrl());

  const query = request.nextUrl.searchParams;
  const check = verifyState(query.get("state"), request.cookies.get(stateCookieName(provider))?.value, {
    userId,
    provider,
    secret: connectStateSecret(),
  });
  if (!check.ok) {
    console.warn(`[connect] ${provider} callback: state rejected (${check.reason})`);
    return fail("state");
  }

  const providerError = query.get("error");
  if (providerError) return fail(providerError === "access_denied" ? "denied" : "failed");

  const code = query.get("code");
  if (!code) return fail("failed");
  if (!availableProviders().includes(provider)) return fail("not_configured");

  try {
    const tokens = await exchangeCode(provider, code, redirectUriFor(provider));

    let profile: ProviderProfile;
    try {
      profile = await fetchProfile(provider, tokens.accessToken);
    } catch (error) {
      // Spotify apps in development mode answer 403 for accounts not on the app's allowlist.
      if (provider === "spotify" && error instanceof OAuthError && error.status === 403) {
        console.warn("[connect] spotify callback: account not on the app's allowlist");
        return fail("not_allowlisted");
      }
      throw error;
    }

    await connectToDatabase();
    const refreshToken = await sealedRefreshToken(userId, provider, profile, tokens.refreshToken);
    if (!refreshToken) return fail("no_refresh_token");

    await LinkedAccount.updateOne(
      { userId, provider },
      {
        $set: {
          providerUserId: profile.providerUserId,
          displayName: profile.displayName,
          scopes: tokens.scopes?.length ? tokens.scopes : PROVIDER_OAUTH[provider].scopes,
          accessToken: encryptToken(tokens.accessToken),
          refreshToken,
          expiresAt: tokens.expiresAt,
          ...(profile.avatarUrl ? { avatarUrl: profile.avatarUrl } : {}),
        },
        ...(profile.avatarUrl ? {} : { $unset: { avatarUrl: 1 } }),
      },
      { upsert: true, runValidators: true },
    );

    return finish(provider, connectionsPageUrl({ connected: provider }));
  } catch (error) {
    console.error(`[connect] ${provider} callback failed:`, describe(error));
    return fail("failed");
  }
}

/**
 * The refresh token to store, encrypted. Google and Spotify can leave it out
 * when the user re-consents; then the stored one is kept, but only if it
 * belongs to the same provider account. Null when there is none at all.
 */
async function sealedRefreshToken(
  userId: string,
  provider: LinkProvider,
  profile: ProviderProfile,
  fresh: string | undefined,
): Promise<string | null> {
  if (fresh) return encryptToken(fresh);
  const existing = await LinkedAccount.findOne({ userId, provider })
    .select("providerUserId +refreshToken")
    .lean<{ providerUserId?: string; refreshToken?: string }>();
  return existing?.refreshToken && existing.providerUserId === profile.providerUserId ? existing.refreshToken : null;
}
