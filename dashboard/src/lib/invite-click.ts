/**
 * `/invite` click logging, pure part: turn the request (query, cookies,
 * headers) into the InviteClick the bot later matches against a server join
 * (see shared/growth.ts for the attribution design). No I/O here, so it is
 * unit tested; app/(landing)/invite/page.tsx does the Redis write.
 */
import {
  DIRECT_REF,
  FIRST_TOUCH_COOKIE,
  type InviteClick,
  normalizeRef,
  parseFirstTouch,
  parseGaClientId,
  parseGaSessionId,
} from "../../../shared/growth";
import { FLEET_FREE_INSTANCES, parseInstance } from "../../../shared/fleet";

export type SearchParamsLike = Record<string, string | string[] | undefined>;

export interface InviteRequest {
  searchParams: SearchParamsLike;
  /** Cookie name → value. */
  cookies: Record<string, string | undefined>;
  /** Lowercase header name → value. */
  headers: Record<string, string | null | undefined>;
  /** NEXT_PUBLIC_GA_ID, used to find the `_ga_<container>` cookie. */
  gaMeasurementId?: string;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Requests that are not a person clicking "Add": link unfurlers (Discordbot
 * fetches every `/invite?ref=u-…` pasted in chat, which would otherwise claim
 * the next real join), crawlers and router prefetches.
 */
const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|skype|headless|lighthouse|curl|wget|python-requests|axios|node-fetch/i;

export function isNonHumanRequest(headers: InviteRequest["headers"]): boolean {
  if (headers["next-router-prefetch"]) return true;
  const purpose = `${headers["purpose"] ?? ""} ${headers["sec-purpose"] ?? ""} ${headers["x-purpose"] ?? ""}`;
  if (/prefetch|prerender/i.test(purpose)) return true;
  const ua = headers["user-agent"] ?? "";
  // "CUBOT" is a phone brand, not a crawler.
  return !ua || BOT_UA.test(ua.replace(/cubot/gi, ""));
}

/** The `_ga_<container>` cookie: the configured property's, else the first `_ga_*` one. */
export function gaSessionCookie(cookies: InviteRequest["cookies"], gaMeasurementId?: string): string | undefined {
  const container = gaMeasurementId?.trim().replace(/^G-/i, "");
  if (container) {
    const own = cookies[`_ga_${container}`];
    if (own) return own;
  }
  const name = Object.keys(cookies).find((k) => k.startsWith("_ga_") && cookies[k]);
  return name ? cookies[name] : undefined;
}

/** Fleet instance the link asks for (`?bot=2..4`); 1 when absent or invalid. */
export function requestedInstance(searchParams: SearchParamsLike): number {
  const n = parseInstance(first(searchParams.bot));
  return n && n >= 2 && n <= FLEET_FREE_INSTANCES ? n : 1;
}

/** ISO country from Cloudflare; "XX" (unknown) and "T1" (Tor) are dropped. */
export function countryFrom(value: string | null | undefined): string | undefined {
  const code = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : undefined;
}

/**
 * ref = `?ref=` → `utm_source` → first-touch source → "site".
 * A first touch of "direct" (typed URL) says nothing about this click, so it
 * falls through to "site" too: "direct" stays reserved for joins with no click.
 */
export function buildInviteClick(req: InviteRequest, id: string, now: number, instance = 1): InviteClick {
  const sp = req.searchParams;
  const utmSource = normalizeRef(first(sp.utm_source)) ?? undefined;
  const utmMedium = normalizeRef(first(sp.utm_medium)) ?? undefined;
  const utmCampaign = normalizeRef(first(sp.utm_campaign)) ?? undefined;
  const firstTouch = parseFirstTouch(req.cookies[FIRST_TOUCH_COOKIE]);
  const touchRef = firstTouch && firstTouch.s !== DIRECT_REF ? firstTouch.s : null;

  const explicit = normalizeRef(first(sp.ref)) ?? utmSource ?? null;
  const ref = explicit ?? touchRef ?? "site";
  const fromTouch = !explicit && Boolean(touchRef);

  const click: InviteClick = {
    id,
    ts: now,
    ref,
    utmSource,
    utmMedium: utmMedium ?? (fromTouch ? firstTouch?.m : undefined),
    utmCampaign: utmCampaign ?? (fromTouch ? firstTouch?.c : undefined),
    gaClientId: parseGaClientId(req.cookies._ga),
    gaSessionId: parseGaSessionId(gaSessionCookie(req.cookies, req.gaMeasurementId)),
    country: countryFrom(req.headers["cf-ipcountry"]),
    instance,
  };
  // Drop undefined fields so the stored JSON stays small.
  for (const key of Object.keys(click) as (keyof InviteClick)[]) {
    if (click[key] === undefined) delete click[key];
  }
  return click;
}

/** UTC `yyyy-mm-dd` for the daily click hash. */
export function utcDayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}
