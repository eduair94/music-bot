/**
 * PATCH /api/admin/feedback: what the owner can change on one item (triage
 * status, landing-page feature, attribution line). Pure, so the route and
 * the console share the rules and vitest covers them.
 */
import { FEEDBACK_ATTRIBUTION_MAX } from "../../../../shared/growth";
import { FEEDBACK_STATUSES, type FeedbackStatus } from "./admin-shape";

export { FEEDBACK_ATTRIBUTION_MAX };

export interface AdminFeedbackPatch {
  id: string;
  status?: FeedbackStatus;
  /** true puts it on the landing page (only allowed when quoteOk), false takes it off. */
  featured?: boolean;
  /** Cleaned attribution line; "" clears it. */
  quoteAttribution?: string;
}

export type AdminFeedbackPatchResult = { ok: true; value: AdminFeedbackPatch } | { ok: false; error: string };

export const NOT_QUOTABLE_ERROR = "Only feedback whose author allowed quoting can be featured on the site";

/** Control characters other than whitespace, which is collapsed. */
const CONTROL = /[\u0000-\u001F\u007F]/g;

/** One line: whitespace collapsed, control characters dropped, trimmed. */
export function cleanAttribution(value: string): string {
  return value.replace(/\s+/g, " ").replace(CONTROL, "").trim();
}

export function parseAdminFeedbackPatch(body: unknown): AdminFeedbackPatchResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid request" };
  const b = body as Record<string, unknown>;

  if (typeof b.id !== "string" || !/^[a-f0-9]{24}$/i.test(b.id)) return { ok: false, error: "Invalid id" };
  const value: AdminFeedbackPatch = { id: b.id };

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !(FEEDBACK_STATUSES as readonly string[]).includes(b.status)) {
      return { ok: false, error: "Invalid status" };
    }
    value.status = b.status as FeedbackStatus;
  }

  if (b.featured !== undefined) {
    if (typeof b.featured !== "boolean") return { ok: false, error: "featured must be true or false" };
    value.featured = b.featured;
  }

  if (b.quoteAttribution !== undefined) {
    if (b.quoteAttribution !== null && typeof b.quoteAttribution !== "string") {
      return { ok: false, error: "Invalid attribution" };
    }
    const line = cleanAttribution(b.quoteAttribution ?? "");
    if (line.length > FEEDBACK_ATTRIBUTION_MAX) {
      return { ok: false, error: `Keep the attribution under ${FEEDBACK_ATTRIBUTION_MAX} characters` };
    }
    value.quoteAttribution = line;
  }

  if (value.status === undefined && value.featured === undefined && value.quoteAttribution === undefined) {
    return { ok: false, error: "Nothing to update" };
  }
  return { ok: true, value };
}

/**
 * Mongo filter and update for a parsed patch. Featuring adds `quoteOk: true`
 * to the filter, so an item without the author's consent can never be
 * featured, even if it changed between the check and the write.
 */
export function feedbackUpdate(patch: AdminFeedbackPatch, now: Date) {
  const filter: Record<string, unknown> = { _id: patch.id };
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  if (patch.status) $set.status = patch.status;
  if (patch.featured === true) {
    filter.quoteOk = true;
    $set.featured = true;
    $set.featuredAt = now;
  } else if (patch.featured === false) {
    $unset.featured = "";
    $unset.featuredAt = "";
  }
  if (patch.quoteAttribution !== undefined) {
    if (patch.quoteAttribution) $set.quoteAttribution = patch.quoteAttribution;
    else $unset.quoteAttribution = "";
  }

  const update: { $set?: Record<string, unknown>; $unset?: Record<string, ""> } = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  return { filter, update };
}
