/**
 * Browser event tracking for GA4 + Microsoft Clarity.
 *
 * One call fans out to both tools; every call is a no-op until the loader
 * (components/analytics/Analytics.tsx) has put `gtag`/`clarity` on window,
 * and on the server. Event names and params are the tracking plan in
 * docs/growth/TRACKING_PLAN.md: lowercase snake_case, no PII in params
 * (no usernames, emails or raw Discord ids).
 */

export type TrackEvent =
  /** Click on any "Add to Discord" link (`/invite`). Key event. */
  | "add_bot_click"
  /** Click on a support-server link (`/support`, discord.gg). */
  | "support_click"
  /** Click on Patreon / Premium. */
  | "premium_click"
  /** Click on a bot-list vote/review link. */
  | "vote_click"
  /** Click on "Log in with Discord". */
  | "login_start"
  /** Outbound click to GitHub. */
  | "github_click"
  /** Feedback dialog opened / sent. */
  | "feedback_open"
  | "feedback_submit"
  /** NPS survey shown / answered / dismissed; review prompt clicked. */
  | "nps_shown"
  | "nps_submit"
  | "nps_dismiss"
  | "review_prompt_click"
  /** Consent banner choice (EEA/UK/CH only). */
  | "consent_choice"
  /** Copy-to-clipboard of a command on /commands. */
  | "command_copy"
  /** Dashboard: a server's control room opened, a player control used. */
  | "server_open"
  | "player_control";

export type TrackParams = Record<string, string | number | boolean | undefined>;

type Gtag = (...args: unknown[]) => void;
type Clarity = ((...args: unknown[]) => void) & { q?: unknown[] };

declare global {
  interface Window {
    gtag?: Gtag;
    clarity?: Clarity;
    dataLayer?: unknown[];
  }
}

function clean(params: TrackParams): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    out[k] = typeof v === "string" ? v.slice(0, 100) : v;
  }
  return out;
}

export function track(event: TrackEvent, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  const p = clean(params);
  try {
    window.gtag?.("event", event, p);
  } catch {
    /* analytics must never break the page */
  }
  try {
    if (window.clarity) {
      window.clarity("event", event);
      // Clarity filters on tags, not event params: keep the useful dimension.
      if (typeof p.location === "string") window.clarity("set", `${event}_location`, p.location);
    }
  } catch {
    /* ignore */
  }
}

/** Clarity custom tag (filterable in recordings), e.g. setTag("page_group", "dashboard"). */
export function setTag(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.clarity?.("set", key, value);
  } catch {
    /* ignore */
  }
}
