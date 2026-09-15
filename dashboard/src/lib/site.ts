/**
 * Public site constants — single source of truth for URLs and identity
 * used across metadata, structured data, and landing components.
 */

import { SUPPORT_INVITE_URL } from "../../../shared/links";

export const SITE_NAME = "Bypass";

/**
 * Absolute origin used for canonical URLs, Open Graph images, and the sitemap.
 * Deliberately not derived from NEXTAUTH_URL so a localhost dev value can never
 * leak into prerendered metadata.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://music-bot.checkleaked.com"
).replace(/\/+$/, "");

export const SITE_TAGLINE = "Studio-Grade Discord Music Bot";

export const SITE_DESCRIPTION =
  "Studio-grade music for your Discord server. Audio up to 320kbps, instant queueing, playlists from YouTube and Spotify, audio filters, and a full web dashboard. Free to add.";

export const DISCORD_INVITE = process.env.NEXT_PUBLIC_DISCORD_INVITE || SUPPORT_INVITE_URL;

export { FOUNDER_PRICE_USD, FOUNDER_SPOTS, PATREON_URL } from "../../../shared/links";
export const GITHUB_URL = "https://github.com/eduair94/music-bot";
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;

/** Number of bot locales shipped in /locales. */
export const LANGUAGE_COUNT = 28;
