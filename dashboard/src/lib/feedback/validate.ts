/**
 * Validation for POST /api/public/feedback. Pure (no I/O, no server-only
 * imports) so the dialog can share the limits and vitest can cover it.
 */
import {
  FEEDBACK_CONTACT_MAX,
  FEEDBACK_KINDS,
  FEEDBACK_MESSAGE_MAX,
  type FeedbackKind,
} from "../../../../shared/growth";

export { FEEDBACK_CONTACT_MAX, FEEDBACK_MESSAGE_MAX };

export const FEEDBACK_MESSAGE_MIN = 3;
export const FEEDBACK_CONTEXT_MAX = 120;
/** Anything bigger than this is not a feedback form. */
export const FEEDBACK_BODY_MAX_BYTES = 8 * 1024;

/** Kinds the feedback dialog offers (NPS has its own survey). */
export const DIALOG_KINDS = ["idea", "bug", "praise", "other"] as const;
export type DialogKind = (typeof DIALOG_KINDS)[number];

export type WebFeedbackSource = "site" | "dashboard";

export interface FeedbackInput {
  kind: FeedbackKind;
  source: WebFeedbackSource;
  message: string;
  score?: number;
  contact?: string;
  quoteOk?: boolean;
  context?: string;
}

export type FeedbackValidation =
  | { ok: true; spam: false; value: FeedbackInput }
  /** Honeypot filled: answer 200 and drop it. */
  | { ok: true; spam: true }
  | { ok: false; error: string; field?: string };

/** Control characters other than tab and newline. */
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
/** A site path: starts with "/", URL path characters only. */
const PATH_LIKE = /^\/[A-Za-z0-9\-._~%!$&'()*+,;=:@/]*$/;

function cleanText(value: string): string {
  return value.replace(/\r\n?/g, "\n").replace(CONTROL, "").trim();
}

/** Page path without query or hash, or undefined when it doesn't look like one. */
export function cleanContext(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const path = value.split(/[?#]/)[0].trim();
  if (!path || path.length > FEEDBACK_CONTEXT_MAX || !PATH_LIKE.test(path)) return undefined;
  return path;
}

export function validateFeedback(body: unknown): FeedbackValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid request" };
  const b = body as Record<string, unknown>;

  if (typeof b.website === "string" && b.website.trim() !== "") return { ok: true, spam: true };

  const kind = b.kind;
  if (typeof kind !== "string" || !(FEEDBACK_KINDS as readonly string[]).includes(kind)) {
    return { ok: false, error: "Pick what kind of feedback this is", field: "kind" };
  }
  const source = b.source;
  if (source !== "site" && source !== "dashboard") return { ok: false, error: "Invalid source", field: "source" };

  const isNps = kind === "nps";
  if (b.message !== undefined && b.message !== null && typeof b.message !== "string") {
    return { ok: false, error: "Invalid message", field: "message" };
  }
  const message = typeof b.message === "string" ? cleanText(b.message) : "";
  if (message.length > FEEDBACK_MESSAGE_MAX) {
    return { ok: false, error: `Keep it under ${FEEDBACK_MESSAGE_MAX} characters`, field: "message" };
  }
  if (!isNps && message.length < FEEDBACK_MESSAGE_MIN) {
    return { ok: false, error: "Write a few words first", field: "message" };
  }

  let score: number | undefined;
  if (isNps) {
    const raw = b.score;
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 10) {
      return { ok: false, error: "Pick a score from 0 to 10", field: "score" };
    }
    score = raw;
  }

  let contact: string | undefined;
  if (b.contact !== undefined && b.contact !== null) {
    if (typeof b.contact !== "string") return { ok: false, error: "Invalid contact", field: "contact" };
    const c = cleanText(b.contact).replace(/\s+/g, " ");
    if (c.length > FEEDBACK_CONTACT_MAX) {
      return { ok: false, error: `Keep the contact under ${FEEDBACK_CONTACT_MAX} characters`, field: "contact" };
    }
    contact = c || undefined;
  }

  const value: FeedbackInput = { kind: kind as FeedbackKind, source, message };
  if (score !== undefined) value.score = score;
  if (contact) value.contact = contact;
  if (kind === "praise" && b.quoteOk === true) value.quoteOk = true;
  const context = cleanContext(b.context);
  if (context) value.context = context;
  return { ok: true, spam: false, value };
}

/** First language tag of an Accept-Language header ("es-ES,es;q=0.9" → "es-ES"). */
export function parseLocale(header: string | null | undefined): string | undefined {
  if (!header) return undefined;
  const tag = header.split(",")[0]?.split(";")[0]?.trim();
  if (!tag || tag === "*" || tag.length > 20) return undefined;
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/.test(tag) ? tag : undefined;
}

/** ISO country from Cloudflare's cf-ipcountry; drops "XX" (unknown) and "T1" (Tor). */
export function parseCountry(header: string | null | undefined): string | undefined {
  const value = header?.trim().toUpperCase();
  return value && /^[A-Z]{2}$/.test(value) && value !== "XX" ? value : undefined;
}

/** Client IP behind Cloudflare / the reverse proxy. */
export function clientIp(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  return headers.get("x-real-ip")?.trim() || null;
}
