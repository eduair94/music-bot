import type { GuildQueue } from "discord-player";
import { ButtonBuilder, ButtonStyle, ContainerBuilder, MessageFlags, PermissionFlagsBits, type TextBasedChannel } from "discord.js";
import { trackedInviteUrl } from "../../shared/growth";
import { SITE_URL, TOPGG_VOTE_URL } from "../../shared/links";
import { getRedis } from "../../shared/services/redis";
import { mention } from "../../structs/commandRegistry";
import { localeForGuild } from "../../utils/guildLocale";
import { i18n, runWithLocale } from "../../utils/i18n";
import { isLinked } from "../../utils/instance";
import type { QueueMetadata } from "../discordPlayer";
import { GuildSettingsService } from "../guildSettings";
import { NUDGE_COOLDOWN_S, NUDGE_TTL_MS, nudgeEligible, nudgeKey, withTimeout } from "./logic";

/**
 * Share nudge: when a good session (NUDGE_MIN_TRACKS+ songs) reaches the end
 * of its queue, post one compact "thanks, vote / add me elsewhere / tell us"
 * card in the player's channel. At most once per server every 14 days across
 * all Bypass instances (Redis NX key); never from private bots; never pings;
 * deletes itself after 10 minutes.
 */

/** Songs started in the current session, per server (this process only). */
const sessionTracks = new Map<string, number>();

/** playerStart: one more song in this server's session. */
export function countSessionTrack(guildId: string): void {
  sessionTracks.set(guildId, (sessionTracks.get(guildId) ?? 0) + 1);
}

/** The session ended without reaching the end of the queue (stop, disconnect). */
export function endSession(guildId: string): void {
  sessionTracks.delete(guildId);
}

function voteListed(): boolean {
  // The top.gg page 404s until the listing is approved (TOPGG_TOKEN is issued then).
  return Boolean(process.env.TOPGG_TOKEN || process.env.TOPGG_VOTE_URL);
}

export function buildShareNudge(tracksPlayed: number): ContainerBuilder {
  const text = [
    `### 🎶 ${i18n.__mf("growth.nudge.title", { count: tracksPlayed })}`,
    i18n.__("growth.nudge.body"),
    `-# ${i18n.__mf("growth.nudge.feedback", { command: mention("feedback") })}`
  ].join("\n");
  const buttons: ButtonBuilder[] = [];
  if (voteListed()) {
    buttons.push(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(process.env.TOPGG_VOTE_URL || TOPGG_VOTE_URL)
        .setEmoji("⭐")
        .setLabel(i18n.__("growth.nudge.vote"))
    );
  }
  buttons.push(
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setURL(trackedInviteUrl(SITE_URL, "bot-share"))
      .setEmoji("➕")
      .setLabel(i18n.__("growth.nudge.invite"))
  );
  return new ContainerBuilder()
    .setAccentColor(0xf8aa2a)
    .addTextDisplayComponents((t) => t.setContent(text))
    .addActionRowComponents((row) => row.setComponents(...buttons));
}

function writableChannel(queue: GuildQueue): TextBasedChannel | null {
  const channel = ((queue.metadata || {}) as QueueMetadata).channel as TextBasedChannel | undefined;
  if (!channel || !("send" in channel)) return null;
  const me = queue.guild.members.me;
  if (!me || !("permissionsFor" in channel)) return null;
  const perms = (channel as any).permissionsFor(me);
  return perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]) ? channel : null;
}

/** emptyQueue (the queue really ran out): maybe post the share nudge, then start a new session count. */
export async function maybeShareNudge(queue: GuildQueue): Promise<void> {
  const guildId = queue.guild.id;
  const tracksPlayed = sessionTracks.get(guildId) ?? 0;
  sessionTracks.delete(guildId);
  try {
    const metadata = (queue.metadata || {}) as QueueMetadata;
    if (!nudgeEligible({ linked: isLinked, tracksPlayed, guessGame: Boolean(metadata.guessGame) })) return;
    const settings = await GuildSettingsService.getInstance()
      .getSettings(guildId)
      .catch(() => null);
    // Servers that turned off the now-playing card don't want extra bot posts either.
    if (settings?.announceNowPlaying === false) return;
    const channel = writableChannel(queue);
    if (!channel || !("send" in channel)) return;

    // Spend the server's 14-day slot only once we know we can post.
    const slot = await withTimeout(getRedis().set(nudgeKey(guildId), "1", "EX", NUDGE_COOLDOWN_S, "NX"), 2000, null);
    if (slot !== "OK") return;

    const locale = await localeForGuild(queue.guild);
    const container = runWithLocale(locale, () => buildShareNudge(tracksPlayed));
    const sent = await (channel as any).send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      allowedMentions: { parse: [] }
    });
    setTimeout(() => void sent?.delete?.().catch(() => undefined), NUDGE_TTL_MS).unref();
    console.log(`[Growth] Share nudge posted in ${queue.guild.name} (${guildId}) after ${tracksPlayed} songs`);
  } catch (error) {
    console.warn(`[Growth] Share nudge failed for ${guildId}:`, (error as Error)?.message ?? error);
  }
}
