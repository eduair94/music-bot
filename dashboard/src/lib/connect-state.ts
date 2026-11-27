import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * CSRF `state` for the connect-an-account OAuth flow (/api/connect/<p>).
 * Pure (no I/O, no env) so it can be unit tested; the routes pass in the
 * secret and the session's Discord user id.
 *
 * Format: "<payload>.<signature>", both base64url. The payload is JSON with
 * the Discord user id, the provider, the issue time and a random nonce; the
 * signature is HMAC-SHA256 over a context label plus the payload. The same
 * value goes in a short-lived httpOnly cookie and in the provider's `state`
 * parameter, and the callback accepts it only when the two match, the
 * signature checks out, it is under 10 minutes old, and it was issued to the
 * user who is signed in now, for the provider being called back.
 */

/** How long a started connection stays valid. */
export const STATE_MAX_AGE_MS = 10 * 60_000;

/**
 * Cookie holding the state between the start route and the callback. One per
 * provider, so connecting Spotify and YouTube in two tabs doesn't collide.
 */
export function stateCookieName(provider: string): string {
  return `bypass_connect_${provider}`;
}

/** Clock skew tolerated for a state stamped slightly in the future. */
const FUTURE_SKEW_MS = 60_000;

/** Signed-message prefix, so this HMAC can't be confused with another use of the secret. */
const CONTEXT = "bypass.connect-state.v1";

interface StatePayload {
  /** Discord user id. */
  u: string;
  /** Provider (spotify | youtube). */
  p: string;
  /** Issued at, epoch ms. */
  t: number;
  /** Random nonce, so two states are never equal. */
  n: string;
}

export type StateFailure = "missing" | "mismatch" | "malformed" | "signature" | "expired" | "user" | "provider";

export type StateCheck = { ok: true } | { ok: false; reason: StateFailure };

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`${CONTEXT}.${payload}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(new Uint8Array(left), new Uint8Array(right));
}

/** A new signed state for `userId` connecting `provider`. */
export function createState(userId: string, provider: string, secret: string, now = Date.now()): string {
  if (!secret) throw new Error("connect state secret is empty");
  const body: StatePayload = { u: userId, p: provider, t: now, n: randomBytes(16).toString("base64url") };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  return `${payload}.${sign(payload, secret)}`;
}

/**
 * Check the state the provider sent back against the cookie copy, the
 * signature, its age, and who is asking.
 */
export function verifyState(
  query: string | null | undefined,
  cookie: string | null | undefined,
  expected: { userId: string; provider: string; secret: string; now?: number },
): StateCheck {
  if (!query || !cookie) return { ok: false, reason: "missing" };
  if (!safeEqual(query, cookie)) return { ok: false, reason: "mismatch" };
  if (!expected.secret) return { ok: false, reason: "signature" };

  const parts = query.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [payload, signature] = parts;
  if (!safeEqual(sign(payload, expected.secret), signature)) return { ok: false, reason: "signature" };

  let body: Partial<StatePayload>;
  try {
    body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!body || typeof body.u !== "string" || typeof body.p !== "string" || typeof body.t !== "number") {
    return { ok: false, reason: "malformed" };
  }

  const now = expected.now ?? Date.now();
  if (now - body.t > STATE_MAX_AGE_MS || body.t - now > FUTURE_SKEW_MS) return { ok: false, reason: "expired" };
  if (body.u !== expected.userId) return { ok: false, reason: "user" };
  if (body.p !== expected.provider) return { ok: false, reason: "provider" };
  return { ok: true };
}
