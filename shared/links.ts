/**
 * Public links and commercial facts shared by the bot and the dashboard.
 *
 * The support invite is permanent (max_age 0, max_uses 0) and lands in
 * #welcome. The older permanent invite hjJQKp5zDU still works (bot lists link
 * it) but lands in #tickets, so new links use this one.
 */

export const SUPPORT_INVITE_URL = "https://discord.gg/KwKwtasGZE";

export const PATREON_URL = "https://www.patreon.com/c/u36360623";

/** Founder / Beta Tester tier, as charged on Patreon. */
export const FOUNDER_PRICE_USD = 3;

/** Member limit set on the Patreon tier. */
export const FOUNDER_SPOTS = 50;

/** Public website (landing + dashboard). */
export const SITE_URL = "https://music-bot.checkleaked.com";

/** Production application id (used for listing and vote links). */
export const BOT_APPLICATION_ID = "1315125264786653225";

export const TOPGG_URL = `https://top.gg/bot/${BOT_APPLICATION_ID}`;
export const TOPGG_VOTE_URL = `${TOPGG_URL}/vote`;

/**
 * Bot permissions requested on invite: see and post in text channels (player
 * panel, embeds, files, threads, external emojis, history), join and speak in
 * voice and stage channels, and set the voice channel status ("♪ Song").
 * Computed from discord.js PermissionFlagsBits; keep in sync with
 * scripts/syncAppProfile.ts.
 */
export const INVITE_PERMISSIONS = "281754186664960";

export function botInviteUrl(clientId: string = BOT_APPLICATION_ID, guildId?: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: INVITE_PERMISSIONS,
    scope: "bot applications.commands",
    integration_type: "0"
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
