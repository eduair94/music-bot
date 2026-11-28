/**
 * Web analytics configuration shared by server and client code.
 *
 * The ids are NEXT_PUBLIC_* values, inlined at `next build` (the Docker
 * build gets them as build args). Unset, or not shaped like a real id, means
 * that tool is off; with both off nothing analytics-related renders.
 */

const rawGa = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
const rawClarity = (process.env.NEXT_PUBLIC_CLARITY_ID || "").trim();

/** GA4 measurement id (`G-XXXXXXX`), or "" when off. Validated because it is written into an inline script. */
export const GA_ID = /^G-[A-Z0-9]{4,20}$/.test(rawGa) ? rawGa : "";
/** Microsoft Clarity project id, or "" when off. */
export const CLARITY_ID = /^[a-z0-9]{4,20}$/i.test(rawClarity) ? rawClarity : "";
export const ANALYTICS_ENABLED = Boolean(GA_ID || CLARITY_ID);

/** localStorage: the visitor's consent choice, "granted" | "denied". */
export const CONSENT_KEY = "bp_consent";
/** localStorage: "1" on the owner's browsers, so their visits are tagged internal. */
export const INTERNAL_KEY = "bp_internal";
/** localStorage: cached /api/public/geo answer `{ c, r, t }` (30 days). */
export const GEO_KEY = "bp_geo";
export const GEO_MAX_AGE_MS = 30 * 86400 * 1000;

/** Window event that opens the consent banner ("Cookie settings"). */
export const CONSENT_OPEN_EVENT = "bp:consent-open";
/** Window event fired after a choice is applied; `detail` is the choice. */
export const CONSENT_CHANGE_EVENT = "bp:consent";

export type ConsentChoice = "granted" | "denied";

/**
 * Where analytics needs opt-in consent: the EEA (EU 27 + Iceland,
 * Liechtenstein, Norway), the United Kingdom and Switzerland. ISO 3166-1
 * alpha-2, the format of Cloudflare's `cf-ipcountry` and of gtag's `region`.
 */
export const CONSENT_COUNTRIES: readonly string[] = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO",
  "GB", "CH",
];

export function countryRequiresConsent(country: string): boolean {
  return CONSENT_COUNTRIES.includes(country.toUpperCase());
}

/**
 * Fallback when the country is unknown (local dev, no Cloudflare): a European
 * time zone, or one of the Atlantic zones of Iceland, Spain and Portugal.
 */
export function timeZoneRequiresConsent(timeZone: string | undefined): boolean {
  if (!timeZone) return false;
  return timeZone.startsWith("Europe/") || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores)$/.test(timeZone);
}

export type PageGroup = "landing" | "dashboard" | "auth";

const DASHBOARD_ROOTS = ["/servers", "/collections", "/premium", "/profile", "/my-bots", "/help", "/dashboard", "/admin"];

const under = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

/** GA `page_group` / `content_group` and Clarity tag for a path. */
export function pageGroup(pathname: string): PageGroup {
  if (under(pathname, "/login")) return "auth";
  if (DASHBOARD_ROOTS.some((root) => under(pathname, root))) return "dashboard";
  return "landing";
}

/** Owner-only pages: GA and Clarity never load or report there. */
export function isExcludedPath(pathname: string): boolean {
  return under(pathname, "/admin") || under(pathname, "/insights");
}
