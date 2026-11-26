import { SearchQueryType } from "discord-player";
import {
  ContainerBuilder,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  RepliableInteraction,
  TextChannel
} from "discord.js";
import { DiscordPlayerService, PlayError, PlayResult } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { getPlaybackSettings } from "./audioSettings";
import { formatDuration, isHttpUrl, linkLabel, safeText } from "./format";
import { i18n } from "./i18n";
import { hasPremiumFeature } from "./premiumCheck";

const V2 = MessageFlags.IsComponentsV2;

export interface PlayRequest {
  interaction: RepliableInteraction<"cached">;
  query: string;
  next?: boolean;
  searchEngine?: SearchQueryType;
  /** Reply privately (used by context menus so the channel only sees the panel). */
  ephemeral?: boolean;
}

/** Localized message for a play failure. */
export function playErrorMessage(error: unknown, query: string): string {
  if (error instanceof PlayError) {
    switch (error.code) {
      case "noResults":
        return `🔍 ${i18n.__mf("play.noResults", { query: `\`${safeText(query, 80)}\`` })}`;
      case "tooLong":
        return `⏱️ ${i18n.__mf("play.tooLong", { max: formatDuration(Number(error.detail.max)) })}`;
      case "duplicate":
        return `🔁 ${i18n.__mf("play.duplicate", { title: safeText(String(error.detail.title), 80) })}`;
      case "queueFull":
        return `📜 ${i18n.__mf("play.queueFull", { max: error.detail.max })}`;
    }
  }
  const message = String((error as Error)?.message || "").toLowerCase();
  if (message.includes("no results") || message.includes("no result")) {
    return `🔍 ${i18n.__mf("play.noResults", { query: `\`${safeText(query, 80)}\`` })}`;
  }
  if (message.includes("sign in") && message.includes("age")) return `🔞 ${i18n.__("play.ageRestricted")}`;
  if (message.includes("age")) return `🔞 ${i18n.__("play.ageRestricted")}`;
  if (message.includes("private")) return `🔒 ${i18n.__("play.private")}`;
  if (message.includes("unavailable")) return `🚫 ${i18n.__("play.unavailable")}`;
  return `⚠️ ${i18n.__mf("play.genericError", { error: safeText((error as Error)?.message || "unknown error", 150) })}`;
}

async function send(interaction: RepliableInteraction, payload: Record<string, unknown>, ephemeral: boolean) {
  const flags = ((payload.flags as number) ?? 0) | (ephemeral ? MessageFlags.Ephemeral : 0);
  if (interaction.deferred || interaction.replied) {
    // Ephemerality is fixed when deferring; the Components V2 flag may be added on edit.
    const editFlags = flags & ~MessageFlags.Ephemeral;
    return interaction.editReply({ ...payload, flags: editFlags || undefined } as any).catch(console.error);
  }
  return interaction.reply({ ...payload, flags } as any).catch(console.error);
}

/** The confirmation shown after a successful /play. */
export function buildPlayReply(result: PlayResult, query: string, qualityBadge: string | null): ContainerBuilder {
  const { track, playlist, added, position } = result;
  const container = new ContainerBuilder().setAccentColor(0xf8aa2a);
  const link = (title: string, url: string) => (isHttpUrl(url) ? `[${linkLabel(title, 80)}](${url})` : safeText(title, 80));

  let header: string;
  let body: string;
  if (playlist && added > 1) {
    header = `📋 ${i18n.__("play.playlistTitle")}`;
    body = `**${link(playlist.title || "Playlist", playlist.url || query)}** · ${i18n.__mf("play.playlistTracks", { count: added })}`;
  } else if (position === 0) {
    header = `▶️ ${i18n.__("play.nowPlayingTitle")}`;
    body = `**${link(track.title, track.url)}** · ${safeText(track.author, 50)} · \`${formatDuration(track.durationMS)}\``;
  } else {
    header = `➕ ${i18n.__("play.addedTitle")}`;
    const where = position === 1 && result.queue.tracks.at(0)?.id === track.id ? i18n.__("play.positionNext") : i18n.__mf("play.position", { position });
    body = `**${link(track.title, track.url)}** · ${safeText(track.author, 50)} · \`${formatDuration(track.durationMS)}\` · ${where}`;
  }

  const text = `-# ${header}\n${body}` + (qualityBadge ? `\n-# ${qualityBadge}` : "");
  const thumb = playlist?.thumbnail || track.thumbnail;
  if (isHttpUrl(thumb) && position !== 0) {
    container.addSectionComponents((s) => s.addTextDisplayComponents((t) => t.setContent(text)).setThumbnailAccessory((th) => th.setURL(thumb)));
  } else {
    container.addTextDisplayComponents((t) => t.setContent(text));
  }
  return container;
}

/**
 * The one play pipeline behind /play, /playnext, search picks and the
 * "Play in voice channel" context menu: voice/permission checks, server
 * limits, premium quality, then a compact confirmation. The player panel
 * (services/playerPanel.ts) shows the controls.
 */
export async function runPlay(request: PlayRequest): Promise<PlayResult | null> {
  const { interaction, next, searchEngine } = request;
  const ephemeral = Boolean(request.ephemeral);
  const query = request.query.trim();
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  const voiceChannel = member?.voice?.channel;
  const playerService = DiscordPlayerService.getInstance();

  if (!voiceChannel) {
    await send(interaction, { content: `🔇 ${i18n.__("play.errorNotChannel")}` }, true);
    return null;
  }
  if (!query) {
    await send(interaction, { content: i18n.__mf("play.usageReply", { prefix: "/" }) }, true);
    return null;
  }
  if (!playerService.isInitialized()) {
    await send(interaction, { content: `⏳ ${i18n.__("play.initializing")}` }, true);
    return null;
  }

  // Already playing for people in another channel: don't hijack it.
  const existing = playerService.getQueue(guild.id);
  const botChannel = guild.members.me?.voice.channel;
  if (botChannel && botChannel.id !== voiceChannel.id && existing && !existing.deleted && existing.currentTrack) {
    const listeners = botChannel.members.filter((m) => !m.user.bot).size;
    if (listeners > 0) {
      await send(interaction, { content: `🎧 ${i18n.__mf("play.botNotInChannel", { channel: `<#${botChannel.id}>` })}` }, true);
      return null;
    }
  }

  const me = guild.members.me;
  const perms = me ? voiceChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    await send(interaction, { content: `🔒 ${i18n.__mf("play.cantJoin", { channel: `<#${voiceChannel.id}>` })}` }, true);
    return null;
  }

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {}).catch(console.error);
  }

  try {
    const settingsService = GuildSettingsService.getInstance();
    if (!(await settingsService.isVoiceChannelAllowed(guild.id, voiceChannel.id))) {
      await send(interaction, { content: `🚫 ${i18n.__("play.notAllowedChannel")}` }, ephemeral);
      return null;
    }

    const settings = await settingsService.getSettings(guild.id);
    const live = existing && !existing.deleted ? existing : null;
    if (live && live.tracks.size >= settings.maxQueueSize) {
      throw new PlayError("queueFull", { max: settings.maxQueueSize });
    }

    // Idle bot in another (empty) channel: follow the user.
    if (live?.channel && live.channel.id !== voiceChannel.id) {
      try {
        await live.connect(voiceChannel);
      } catch {
        try {
          live.delete();
        } catch {
          /* already gone */
        }
      }
    }

    const [{ quality }, longer] = await Promise.all([
      getPlaybackSettings(interaction.user.id, guild.id),
      hasPremiumFeature(interaction.user.id, "longer_songs").catch(() => false)
    ]);
    const playlistLimit = Math.max(1, settings.maxQueueSize - (live?.tracks.size ?? 0));

    const textChannel = (interaction.channel ?? guild.systemChannel) as TextChannel;
    const result = await playerService.play(voiceChannel, query, textChannel, quality.bitrate, playlistLimit, {
      requestedBy: interaction.user,
      next,
      searchEngine,
      ignoreDurationLimit: longer
    });

    if (!result) {
      await send(interaction, { content: playErrorMessage(new PlayError("noResults"), query) }, ephemeral);
      return null;
    }

    const badge = quality.bitrate > 128 ? quality.qualityBadge : null;
    await send(
      interaction,
      { components: [buildPlayReply(result, query, badge)], flags: V2, allowedMentions: { parse: [] } },
      ephemeral
    );
    return result;
  } catch (error) {
    if (!(error instanceof PlayError)) console.error("[play] ❌ Error:", error);
    await send(interaction, { content: playErrorMessage(error, query), components: [] }, ephemeral);
    return null;
  }
}
