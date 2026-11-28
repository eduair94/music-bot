/**
 * Landing-page testimonials from feedback the owner featured. Pure: the
 * server read (lib/testimonials.ts) hands raw Mongo documents here, and the
 * owner console uses the same functions to preview how a quote will look.
 *
 * Only quotes whose author ticked "you can quote this" (quoteOk) AND that
 * the owner featured are ever returned, and the output is built field by
 * field from a whitelist: contact, userId, userName and guildId never leave
 * this module, whatever the input holds.
 */

/** At most this many quotes on the page. */
export const TESTIMONIALS_MAX = 6;
/** Quotes longer than this are cut on a word boundary and end with "…". */
export const QUOTE_MAX = 280;
/** Owner-written attribution line, same limit as the admin API. */
export const ATTRIBUTION_MAX = 80;
/** Shown when the owner wrote no attribution. */
export const DEFAULT_ATTRIBUTION = "Bypass user";

export interface Testimonial {
  quote: string;
  /** The owner's attribution line, or DEFAULT_ATTRIBUTION. */
  attribution: string;
  /** "November 2026" (UTC month the feedback was sent); null when unknown. */
  month: string | null;
  /** "2026-11" for <time dateTime>; null when unknown. */
  monthIso: string | null;
  /** Sent with /feedback in Discord rather than on the website. */
  viaDiscord: boolean;
}

const monthFormat = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Characters that are invisible or reorder text: C0/C1 controls (whitespace
 * is collapsed before this runs), zero-width space, BOM and the bidi
 * embedding/override/isolate marks. The zero-width joiner stays: emoji need it.
 */
const INVISIBLE = /[\u0000-\u001F\u007F-\u009F\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Trims, turns every run of whitespace (newlines included) into one space, drops invisible characters. */
export function cleanQuoteText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").replace(INVISIBLE, "").replace(/ {2,}/g, " ").trim();
}

/**
 * Clamps to `max` characters (code points, so emoji are never split). A cut
 * ends on the last word boundary, without trailing punctuation, plus "…";
 * the ellipsis counts toward `max`. A single very long word is cut mid-word.
 */
export function clampText(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  const room = chars.slice(0, max - 1).join("");
  const lastSpace = room.lastIndexOf(" ");
  const cut = lastSpace >= room.length * 0.6 ? room.slice(0, lastSpace) : room;
  // Trailing spaces and punctuation (including en and em dashes) before the ellipsis.
  const tidy = cut.replace(/[\s.,;:!?\-–—]+$/u, "");
  return `${tidy || cut}…`;
}

function toDate(value: unknown): Date | null {
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * One feedback document as a testimonial, or null when there is nothing to
 * quote. Does not check featured/quoteOk (the owner console previews quotes
 * before featuring them); toTestimonials does.
 */
export function toTestimonial(doc: unknown): Testimonial | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;
  const quote = clampText(cleanQuoteText(d.message), QUOTE_MAX);
  if (!quote) return null;
  const attribution = clampText(cleanQuoteText(d.quoteAttribution), ATTRIBUTION_MAX) || DEFAULT_ATTRIBUTION;
  const date = toDate(d.createdAt);
  return {
    quote,
    attribution,
    month: date ? monthFormat.format(date) : null,
    monthIso: date ? date.toISOString().slice(0, 7) : null,
    viaDiscord: d.source === "bot",
  };
}

/**
 * The quotes for the landing page: featured AND quoteOk (both strictly true),
 * non-empty after cleaning, newest first, at most `limit`.
 */
export function toTestimonials(docs: readonly unknown[], limit = TESTIMONIALS_MAX): Testimonial[] {
  return docs
    .filter((doc): doc is Record<string, unknown> => !!doc && typeof doc === "object")
    .filter((doc) => doc.featured === true && doc.quoteOk === true)
    .map((doc) => ({ doc, at: toDate(doc.createdAt)?.getTime() ?? 0 }))
    .sort((a, b) => b.at - a.at)
    .map(({ doc }) => toTestimonial(doc))
    .filter((t): t is Testimonial => t !== null)
    .slice(0, Math.max(0, limit));
}

/** Caption pieces in display order: attribution, month, "via Discord". */
export function captionParts(t: Testimonial): string[] {
  return [t.attribution, t.month, t.viaDiscord ? "via Discord" : null].filter((p): p is string => !!p);
}
