/**
 * Public site constants — single source of truth for URLs and identity
 * used across metadata, structured data, and landing components.
 */

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

export const DISCORD_INVITE =
  process.env.NEXT_PUBLIC_DISCORD_INVITE || "https://discord.gg/5w6PErKpyK";

export const PATREON_URL = "https://www.patreon.com/c/u36360623";
export const GITHUB_URL = "https://github.com/eduair94/music-bot";
export const GITHUB_ISSUES_URL = `${GITHUB_URL}/issues`;

/** Founder tier price shown on the landing page. */
export const FOUNDER_PRICE_USD = 1.5;

/** Number of bot locales shipped in /locales. */
export const LANGUAGE_COUNT = 28;
