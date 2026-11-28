/**
 * Delegated click tracking: which tracked event (if any) a click on a link
 * or a `data-track` element is, and where on the page it happened.
 *
 *   <a href="/invite?ref=site-hero" data-track-location="hero">   → add_bot_click {ref, location}
 *   <button data-track="login_start">                             → login_start {location}
 *   <button data-track="command_copy" data-track-command="/play"> → command_copy {command, location}
 */

import type { TrackEvent, TrackParams } from "./track";

export interface ClickHit {
  event: TrackEvent;
  params: TrackParams;
}

const EVENT_NAME = /^[a-z][a-z0-9_]{1,39}$/;

/** Bot lists whose links count as votes/reviews, by host → `site` param. */
const VOTE_SITES: Record<string, string> = {
  "top.gg": "topgg",
  "discordbotlist.com": "discordbotlist",
};

const hit = (event: TrackEvent, params: TrackParams = {}): ClickHit => ({ event, params });

/** A Discord OAuth link that adds a bot (scope bot/applications.commands, or Discord's default "Add App" with no scope). */
function isBotInvite(url: URL): boolean {
  if (!/^\/(api\/)?oauth2\/authorize$/.test(url.pathname.replace(/\/+$/, ""))) return false;
  const scope = url.searchParams.get("scope");
  return scope === null || /(^|\s)(bot|applications\.commands)(\s|$)/.test(scope);
}

/** The event for following `url` from a page on `origin`, or null when the link is not tracked. */
export function classifyUrl(url: URL, origin: string): ClickHit | null {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (url.origin === origin) {
    if (path === "/invite") return hit("add_bot_click", { ref: url.searchParams.get("ref") ?? undefined });
    if (path === "/support") return hit("support_click");
    if (path === "/login") return hit("login_start");
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "discord.com" || host === "discordapp.com") {
    if (isBotInvite(url)) return hit("add_bot_click", { ref: url.searchParams.get("ref") ?? undefined });
    if (path.startsWith("/invite/")) return hit("support_click");
    return null;
  }
  if (host === "discord.gg") return hit("support_click");
  if (host === "patreon.com" || host.endsWith(".patreon.com")) return hit("premium_click");
  if (VOTE_SITES[host]) return hit("vote_click", { site: VOTE_SITES[host] });
  if (host === "github.com") return hit("github_click");
  return null;
}

/** `data-track-*` attributes as params: data-track-site="topgg" → { site: "topgg" }. Location is resolved separately. */
export function paramsFromDataset(dataset: Record<string, string | undefined>): TrackParams {
  const params: TrackParams = {};
  for (const [key, value] of Object.entries(dataset)) {
    if (!key.startsWith("track") || key === "track" || key === "trackLocation" || value === undefined) continue;
    const name = key
      .slice(5)
      .replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      .replace(/^_/, "");
    if (name) params[name] = value;
  }
  return params;
}

/**
 * Where the click happened: the nearest `data-track-location`, else the
 * nearest `section[id]`, else the header/footer/nav landmark, else the path.
 */
export function trackLocation(el: Element, pathname: string): string {
  const tagged = el.closest("[data-track-location]");
  const label = tagged?.getAttribute("data-track-location");
  if (label) return label;
  const section = el.closest("section[id]");
  if (section) return section.id;
  const landmark = el.closest("header, footer") ?? el.closest("nav, aside");
  if (landmark) return landmark.tagName.toLowerCase();
  return pathname;
}

/** The tracked event for a click whose target is `target`, or null. */
export function clickEvent(target: EventTarget | null, loc: Location): ClickHit | null {
  if (!(target instanceof Element)) return null;
  const el = target.closest("[data-track], a[href]");
  if (!el) return null;

  const explicit = el.getAttribute("data-track");
  if (explicit) {
    if (!EVENT_NAME.test(explicit)) return null;
    const dataset = el instanceof HTMLElement || el instanceof SVGElement ? el.dataset : {};
    return hit(explicit as TrackEvent, { ...paramsFromDataset(dataset), location: trackLocation(el, loc.pathname) });
  }

  let url: URL;
  try {
    url = new URL(el.getAttribute("href") ?? "", loc.href);
  } catch {
    return null;
  }
  const found = classifyUrl(url, loc.origin);
  return found ? hit(found.event, { ...found.params, location: trackLocation(el, loc.pathname) }) : null;
}
