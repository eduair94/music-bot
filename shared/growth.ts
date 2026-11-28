/**
 * Growth measurement shared by the bot and the dashboard: invite attribution,
 * UTM-tagged links, GA cookie parsing and the feedback record shape.
 *
 * How a server join gets its source:
 *   1. Every "Add to Discord" link goes through the site's `/invite?ref=<code>`.
 *      That route stores an InviteClick (ref, UTMs, GA client id from the `_ga`
 *      cookie) in the Redis list INVITE_CLICKS_KEY, then redirects to Discord.
 *   2. When the primary bot joins a guild it calls `pickAttribution` on the
 *      recent clicks: the newest click inside ATTRIBUTION_WINDOW_MS that no
 *      other join has claimed is the source. At our volume (a few joins a day)
 *      the time match is reliable; a join with no click is "direct" (bot list
 *      buttons that skip our site, Discord's own "Add App", shared links).
 *   3. The bot sends `bot_added` to GA4 through the Measurement Protocol with
 *      that click's client id, so the conversion lands on the visitor's session.
 *
 * Pure module: no I/O, safe to import from client components.
 */

/** Redis list (LPUSH newest first) of JSON InviteClick, trimmed to INVITE_CLICKS_MAX. */
export const INVITE_CLICKS_KEY = "growth:invite_clicks";
export const INVITE_CLICKS_MAX = 500;
/** Redis hash per UTC day: field = ref code, value = click count. Kept 120 days. */
export const inviteDailyKey = (day: string) => `growth:invite_daily:${day}`;
export const INVITE_DAILY_TTL_S = 120 * 86400;
/** SET NX marker so two joins never claim the same click. */
export const inviteClaimKey = (clickId: string) => `growth:invite_claimed:${clickId}`;

/** A join this long after a click still counts as that click's conversion. */
export const ATTRIBUTION_WINDOW_MS = 30 * 60 * 1000;

/** Ref used when nothing better is known. */
export const DIRECT_REF = "direct";

/**
 * Known ref codes. Anything matching REF_PATTERN is accepted, these exist so
 * links stay consistent (one spelling per source) and the admin panel can
 * label them. Bot-list sites: set their "invite URL" field to
 * `${SITE_URL}/invite?ref=<code>`.
 */
export const REF_LABELS: Record<string, string> = {
  direct: "Direct / unknown",
  site: "Website (no campaign)",
  "site-header": "Website header",
  "site-hero": "Website hero",
  "site-pricing": "Website pricing",
  "site-install": "Install guide",
  "site-footer": "Website footer",
  "site-cta": "Website final CTA",
  "site-status": "Status page",
  "site-dashboard": "Dashboard",
  "bot-invite": "Bot /invite command",
  "bot-help": "Bot /help menu",
  "bot-welcome": "Bot welcome card",
  "bot-share": "Bot share nudge",
  topgg: "top.gg",
  discordbotlist: "discordbotlist.com",
  discordbotsgg: "discord.bots.gg",
  botlistme: "botlist.me",
  voidbots: "voidbots.net",
  discordlistgg: "discordlist.gg",
  discordplace: "discord.place",
  radarcord: "radarcord.net",
  "app-directory": "Discord App Directory",
  github: "GitHub README",
  support: "Support server",
  patreon: "Patreon page"
};

/** Lowercase letters, digits and hyphens; referral codes look like `u-<discord id>`. */
const REF_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Normalizes a ref/utm value into one spelling, or null when it is unusable. */
export function normalizeRef(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/[\s_.]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return REF_PATTERN.test(value) ? value : null;
}

/** Label for the admin panel: known code, referral, or the raw code. */
export function refLabel(ref: string): string {
  if (REF_LABELS[ref]) return REF_LABELS[ref];
  if (/^u-\d{15,22}$/.test(ref)) return `Referral (${ref.slice(2)})`;
  return ref;
}

export interface InviteClick {
  /** Random id, used for the claim marker. */
  id: string;
  /** ms epoch of the click. */
  ts: number;
  /** Normalized ref code (`?ref=`, else `utm_source`, else first-touch source, else "site"). */
  ref: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** GA4 client id parsed from `_ga` (only present when analytics consent allowed the cookie). */
  gaClientId?: string;
  /** GA4 session id parsed from `_ga_<container>`. */
  gaSessionId?: string;
  /** ISO country from Cloudflare (`cf-ipcountry`). */
  country?: string;
  /** Which Bypass bot the link was for (1 = primary). */
  instance?: number;
}

export interface Attribution {
  ref: string;
  click?: InviteClick;
}

/**
 * The click a join at `joinTs` came from: the newest unclaimed click no older
 * than the window (and not from the future, with 60 s of clock skew allowed).
 * `clicks` may be in any order; `claimed` holds ids already used by other joins.
 */
export function pickAttribution(
  clicks: InviteClick[],
  joinTs: number,
  claimed: ReadonlySet<string> = new Set(),
  instance = 1
): Attribution {
  const candidates = clicks
    .filter((c) => c && typeof c.ts === "number" && typeof c.id === "string")
    .filter((c) => (c.instance ?? 1) === instance)
    .filter((c) => !claimed.has(c.id))
    .filter((c) => c.ts <= joinTs + 60_000 && joinTs - c.ts <= ATTRIBUTION_WINDOW_MS)
    .sort((a, b) => b.ts - a.ts);
  const click = candidates[0];
  return click ? { ref: click.ref, click } : { ref: DIRECT_REF };
}

/** `_ga` = `GA1.1.<random>.<timestamp>` → client id `<random>.<timestamp>`. */
export function parseGaClientId(cookie: string | undefined | null): string | undefined {
  if (!cookie) return undefined;
  const parts = cookie.split(".");
  if (parts.length < 4) return undefined;
  const id = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  return /^\d+\.\d+$/.test(id) ? id : undefined;
}

/**
 * `_ga_<container>` holds the session id in two formats:
 *   GS1.1.<session_id>.<count>.<engaged>.<last>…   (legacy)
 *   GS2.1.s<session_id>$o<count>$g<engaged>$t<last>… (2025+)
 */
export function parseGaSessionId(cookie: string | undefined | null): string | undefined {
  if (!cookie) return undefined;
  const gs2 = /(?:^|[.$])s(\d{9,11})(?:\$|$)/.exec(cookie);
  if (cookie.startsWith("GS2") && gs2) return gs2[1];
  const parts = cookie.split(".");
  if (cookie.startsWith("GS1") && parts.length >= 3 && /^\d{9,11}$/.test(parts[2])) return parts[2];
  return undefined;
}

/** Bucket for member counts, so GA never sees exact server sizes. */
export function memberBucket(count: number | undefined): string {
  const n = Number(count) || 0;
  if (n < 10) return "1-9";
  if (n < 50) return "10-49";
  if (n < 250) return "50-249";
  if (n < 1000) return "250-999";
  if (n < 10000) return "1k-10k";
  return "10k+";
}

/**
 * A site link opened from Discord, tagged so GA shows which bot surface sent
 * the visit: `utm_source=discord&utm_medium=bot&utm_campaign=<surface>`.
 */
export function botSiteLink(siteUrl: string, path: string, campaign: string, content?: string): string {
  const url = new URL(path.startsWith("http") ? path : `${siteUrl.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("utm_source", "discord");
  url.searchParams.set("utm_medium", "bot");
  url.searchParams.set("utm_campaign", campaign);
  if (content) url.searchParams.set("utm_content", content);
  return url.toString();
}

/** `${site}/invite?ref=<ref>`: the tracked way to send someone to Discord's add-bot screen. */
export function trackedInviteUrl(siteUrl: string, ref: string): string {
  const code = normalizeRef(ref) ?? "site";
  return `${siteUrl.replace(/\/+$/, "")}/invite?ref=${encodeURIComponent(code)}`;
}

// ── Feedback ────────────────────────────────────────────────────────────────

export const FEEDBACK_KINDS = ["idea", "bug", "praise", "other", "nps"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackSource = "site" | "dashboard" | "bot";

/** Mongo collection `feedbacks` (shared by bot and dashboard). */
export interface FeedbackRecord {
  kind: FeedbackKind;
  source: FeedbackSource;
  message: string;
  /** 0-10 for NPS, 1-5 for ratings; absent otherwise. */
  score?: number;
  /** Optional reply channel the person typed (Discord tag or email). */
  contact?: string;
  /** The person allowed us to quote the message publicly (testimonials). */
  quoteOk?: boolean;
  /** Discord ids when known (logged-in dashboard user or bot interaction). */
  userId?: string;
  userName?: string;
  guildId?: string;
  /** Page path or bot command the feedback came from. */
  context?: string;
  locale?: string;
  country?: string;
  status: "new" | "read" | "done";
  createdAt: Date;
}

export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_CONTACT_MAX = 120;

/** Net Promoter Score from 0-10 scores: % promoters (9-10) minus % detractors (0-6). */
export function netPromoterScore(scores: number[]): number | null {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10);
  if (!valid.length) return null;
  const promoters = valid.filter((s) => s >= 9).length;
  const detractors = valid.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / valid.length) * 100);
}
