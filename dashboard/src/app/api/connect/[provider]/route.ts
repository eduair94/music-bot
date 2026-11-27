import { auth } from "@/auth";
import { createState, STATE_MAX_AGE_MS, stateCookieName } from "@/lib/connect-state";
import { connectStateSecret, loginUrl, redirectUriFor } from "@/lib/connections";
import { LinkedAccount } from "@/lib/models/LinkedAccount";
import { connectToDatabase } from "@/lib/mongodb";
import { NextResponse } from "next/server";
import { isLinkProvider, PROVIDER_OAUTH } from "../../../../../../shared/linkedAccounts";
import { availableProviders, decryptToken, oauthClient } from "../../../../../../shared/linkedAccountsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ provider: string }>;
}

/**
 * GET /api/connect/[provider]
 * Start connecting a Spotify or YouTube account: a plain link from the
 * profile page. Signs a CSRF state bound to the Discord user, keeps it in a
 * short-lived httpOnly cookie, and sends the browser to the provider's
 * consent screen. The provider calls back /api/connect/[provider]/callback.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isLinkProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.discordId;
  // A browser navigation, so an expired session goes to sign-in rather than a JSON 401.
  if (!userId) return NextResponse.redirect(loginUrl());

  const config = PROVIDER_OAUTH[provider];
  const client = oauthClient(provider);
  const secret = connectStateSecret();
  if (!client || !secret || !availableProviders().includes(provider)) {
    return NextResponse.json({ error: `${config.label} isn't configured on this dashboard` }, { status: 503 });
  }

  const state = createState(userId, provider, secret);
  const authorize = new URL(config.authorizeUrl);
  authorize.search = new URLSearchParams({
    client_id: client.clientId,
    response_type: "code",
    redirect_uri: redirectUriFor(provider),
    scope: config.scopes.join(" "),
    state,
    ...config.authorizeParams,
  }).toString();

  const res = NextResponse.redirect(authorize);
  res.headers.set("Cache-Control", "no-store");
  res.cookies.set(stateCookieName(provider), state, {
    httpOnly: true,
    // Browsers treat http://localhost as secure too, so dev keeps working.
    secure: true,
    // Lax: the provider's redirect back is a top-level GET, which still carries it.
    sameSite: "lax",
    path: "/api/connect",
    maxAge: STATE_MAX_AGE_MS / 1000,
  });
  return res;
}

/** Best effort: tell Google to drop the grant. Spotify has no revoke API. */
async function revokeGoogleGrant(sealedRefreshToken: string | undefined): Promise<void> {
  if (!sealedRefreshToken) return;
  try {
    const token = decryptToken(sealedRefreshToken);
    const res = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(5000),
    });
    // 400 invalid_token: already revoked or expired, which is the goal anyway.
    if (!res.ok && res.status !== 400) console.warn(`[connect] youtube revoke returned ${res.status}`);
  } catch (error) {
    console.warn("[connect] youtube revoke failed:", error instanceof Error ? error.message : "unknown error");
  }
}

/**
 * DELETE /api/connect/[provider]
 * Disconnect: delete the stored account (and its tokens). For YouTube the
 * grant is also revoked at Google, best effort.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { provider } = await params;
  if (!isLinkProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }

  const session = await auth();
  const userId = session?.user?.discordId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const removed = await LinkedAccount.findOneAndDelete({ userId, provider })
      .select("+refreshToken")
      .lean<{ refreshToken?: string }>();
    if (removed && provider === "youtube") await revokeGoogleGrant(removed.refreshToken);
    return NextResponse.json({ success: true, removed: Boolean(removed) });
  } catch (error) {
    console.error(`[connect] ${provider} disconnect failed:`, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
