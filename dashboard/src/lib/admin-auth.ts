import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import "server-only";
import { auth } from "@/auth";
import { isSameOrigin, RateLimiter } from "./admin/guards";

/**
 * Password-based admin gate for the /insights analytics area.
 *
 * The password (ADMIN_PASSWORD) is never stored in the cookie. The cookie holds
 * an HMAC token derived from a fixed marker keyed by the password, so it cannot
 * be forged without knowing the password, and the password never leaves the
 * server. Access is also granted to the Discord bot owner (OWNER_ID).
 */

const COOKIE_NAME = "bypass_admin";
const TOKEN_MARKER = "bypass-insights-v1";

function adminPassword(): string | null {
  return process.env.ADMIN_PASSWORD || null;
}

/** Deterministic token for the configured password. */
export function expectedToken(): string | null {
  const password = adminPassword();
  if (!password) return null;
  return createHmac("sha256", password).update(TOKEN_MARKER).digest("hex");
}

/** Constant-time compare of a candidate token against the expected one. */
function tokenMatches(candidate: string): boolean {
  const expected = expectedToken();
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Validate a submitted password and return the cookie token if correct. */
export function verifyPassword(password: string): string | null {
  const expected = adminPassword();
  if (!expected) return null;
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return expectedToken();
}

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** True if the current request carries a valid admin cookie. */
export async function hasAdminCookie(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return !!token && tokenMatches(token);
}

/** True if the current session belongs to the Discord bot owner. */
export async function isOwnerSession(): Promise<boolean> {
  const ownerId = process.env.OWNER_ID || process.env.DISCORD_OWNER_ID;
  if (!ownerId) return false;
  const session = await auth();
  return session?.user?.discordId === ownerId;
}

/** Admin access = valid password cookie OR Discord owner session. */
export async function hasAdminAccess(): Promise<boolean> {
  if (await hasAdminCookie()) return true;
  return isOwnerSession();
}

// ── Owner console gates (/admin and /api/admin/*) ─────────────────────────

export interface OwnerIdentity {
  discordId: string;
  name: string;
}
export type OwnerGate = { ok: true; owner: OwnerIdentity } | { ok: false; response: NextResponse };

/** JSON response that must never be cached by browsers or proxies. */
export function adminJson(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function configuredOwnerId(): string | null {
  return process.env.OWNER_ID || process.env.DISCORD_OWNER_ID || null;
}

/** Read gate: Discord session whose id equals OWNER_ID. */
export async function requireOwner(): Promise<OwnerGate> {
  const session = await auth();
  const discordId = session?.user?.discordId;
  if (!discordId) return { ok: false, response: adminJson({ error: "Unauthorized" }, 401) };
  const ownerId = configuredOwnerId();
  if (!ownerId || discordId !== ownerId) return { ok: false, response: adminJson({ error: "Forbidden" }, 403) };
  return { ok: true, owner: { discordId, name: session?.user?.name ?? "owner" } };
}

const actionLimiter = new RateLimiter(10, 60_000);

/** Action gate: owner + same-origin + 10 actions per minute. */
export async function requireOwnerAction(request: Request): Promise<OwnerGate> {
  const gate = await requireOwner();
  if (!gate.ok) return gate;
  if (!isSameOrigin(request.headers, request.headers.get("host"))) {
    return { ok: false, response: adminJson({ error: "Cross-origin request rejected" }, 403) };
  }
  if (!actionLimiter.allow(gate.owner.discordId)) {
    return { ok: false, response: adminJson({ error: "Rate limited, retry in a minute" }, 429) };
  }
  return gate;
}
