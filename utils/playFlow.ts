import { SearchQueryType } from "discord-player";
import {
  ContainerBuilder,
  Guild,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  RepliableInteraction,
  TextChannel,
  VoiceBasedChannel
} from "discord.js";
import { DiscordPlayerService, isGuessGameQueue, PlayError, PlayResult, QueueMetadata } from "../services/discordPlayer";
import { dispatchPlay } from "../services/fleet/dispatcher";
import { mention } from "../structs/commandRegistry";
import { GuildSettingsService } from "../services/guildSettings";
import { targetKbps } from "../services/audioEncoder";
import { getPlaybackSettings, getQualityBadge } from "./audioSettings";
import { formatDuration, isHttpUrl, linkLabel, safeText } from "./format";
import { i18n } from "./i18n";
import { hasPremiumFeature } from "./premiumCheck";
import { isChannelAllowedForInstance } from "../shared/permissions";
import { canUse, denialMessage, permissionConfigFor } from "./permissions";

const V2 = MessageFlags.IsComponentsV2;

export interface PlayRequest {
  interaction: RepliableInteraction<"cached">;
  query: string;
  next?: boolean;
  searchEngine?: SearchQueryType;
  /** Reply privately (used by context menus so the channel only sees the panel). */
  ephemeral?: boolean;
  /** /playnow: skip the current song once this is queued next (applied by a fleet instance it is handed to). */
  now?: boolean;
  /**
   * /radio: autoplay on afterwards; a RadioRequest also starts that radio
   * session (station anchors, AI batch). Applied by a fleet instance it is
   * handed to as well.
   */
  radio?: boolean | import("../services/radio").RadioRequest;
}

/**
 * Why the play pipeline refused a request before (or instead of) queueing
 * anything. Failures from the player itself (too long, duplicate, queue
 * full, extractor errors) stay `PlayError`s from services/discordPlayer.ts.
 */
export type PlayRejectCode =
  /** The requester is not in a voice channel (and none was chosen). */
  | "notInVoice"
  /** Nothing to search for. */
  | "emptyQuery"
  /** The player is still starting up. */
  | "initializing"
  /** The bot is playing for listeners in another channel. detail: channelId, channelName */
  | "botBusy"
  /** The bot lacks View/Connect/Speak in the target channel. detail: channelId, channelName */
  | "cantJoin"
  /** The server restricts music to other voice channels. */
  | "channelNotAllowed"
  /** The player found nothing to queue. */
  | "noResults"
  /** The requester is on the server's blacklist. */
  | "blacklisted"
  /** An admin turned the command off. detail: name */
  | "commandDisabled"
  /** A guess-the-song game owns the player in this server. */
  | "gameRunning"
  /** The server's "play" rule refuses this member. detail: message (already localized) */
  | "noPermission";

export class PlayRejection extends Error {
  constructor(public readonly code: PlayRejectCode, public readonly detail: Record<string, string> = {}) {
    super(code);
    this.name = "PlayRejection";
  }
}

/** How a channel is named in a refusal: a mention in Discord, a plain name elsewhere. */
export type ChannelLabel = (channelId: string, channelName: string) => string;
const mentionChannel: ChannelLabel = (channelId) => `<#${channelId}>`;

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

/** Localized message for a refusal from `enqueue` or `playGate`. */
export function playRejectionMessage(rejection: PlayRejection, query: string, channel: ChannelLabel = mentionChannel): string {
  const { code, detail } = rejection;
  switch (code) {
    case "notInVoice":
      return `🔇 ${i18n.__("play.errorNotChannel")}`;
    case "emptyQuery":
      return i18n.__mf("play.usageReply", { prefix: "/" });
    case "initializing":
      return `⏳ ${i18n.__("play.initializing")}`;
    case "botBusy":
      return `🎧 ${i18n.__mf("play.botNotInChannel", { channel: channel(detail.channelId, detail.channelName) })}`;
    case "cantJoin":
      return `🔒 ${i18n.__mf("play.cantJoin", { channel: channel(detail.channelId, detail.channelName) })}`;
    case "channelNotAllowed":
      return `🚫 ${i18n.__("play.notAllowedChannel")}`;
    case "noResults":
      return playErrorMessage(new PlayError("noResults"), query);
    case "blacklisted":
      return `❌ ${i18n.__("router.blacklisted")}`;
    case "commandDisabled":
      return `🚫 ${i18n.__mf("router.commandDisabled", { name: detail.name || "play" })}`;
    case "gameRunning":
      return `🎯 ${i18n.__mf("guess.blockedDuringGame", { stop: mention("guess", "stop") })}`;
    case "noPermission":
      return detail.message || `🔒 ${i18n.__("permissions.deny.hint")}`;
  }
}

/**
 * Refusals about the requester or the voice channel rather than the song:
 * when queueing several songs, the rest would fail the same way.
 */
export function isRequesterRejection(error: unknown): error is PlayRejection {
  return error instanceof PlayRejection && error.code !== "noResults" && error.code !== "emptyQuery";
}

/**
 * The server rules Bot.ts applies to slash commands (blacklist, command
 * turned off for non-managers), for play requests that arrive another way:
 * the dashboard and persistent buttons. Returns the refusal, or null.
 */
export async function playGate(guildId: string, member: GuildMember, commandName = "play"): Promise<PlayRejection | null> {
  const settings = await GuildSettingsService.getInstance().getSettings(guildId);
  if (settings.blacklistedUsers?.includes(member.id)) return new PlayRejection("blacklisted");
  const isManager = member.permissions.has(PermissionFlagsBits.ManageGuild);
  if (!isManager && settings.disabledCommands?.includes(commandName)) {
    return new PlayRejection("commandDisabled", { name: commandName });
  }
  return null;
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

export interface EnqueueRequest {
  guild: Guild;
  /** Who asked: their quality setting and premium perks apply, and they show as the requester. */
  member: GuildMember;
  /** Where to play; null is refused with `notInVoice`. */
  voiceChannel: VoiceBasedChannel | null;
  /** Where the player panel goes if this starts a new session (null: no panel). */
  textChannel: TextChannel | null;
  query: string;
  next?: boolean;
  searchEngine?: SearchQueryType;
}

export interface EnqueueHooks {
  /**
   * Called once the instant checks pass (voice channel, query, player ready,
   * bot not busy elsewhere, voice permissions) and before anything slow.
   * The slash flow defers its reply here.
   */
  onAccepted?: () => unknown;
}

export interface EnqueueResult extends PlayResult {
  /** Quality line for the confirmation; null at standard quality. */
  qualityBadge: string | null;
}

/**
 * The play pipeline without an interaction: voice and permission checks,
 * server limits, the requester's quality and premium perks, then the player.
 * Throws a `PlayRejection` for refusals and a `PlayError` (or any other
 * error) from the player; `playRejectionMessage` / `playErrorMessage` turn
 * them into text.
 */
export async function enqueue(request: EnqueueRequest, hooks: EnqueueHooks = {}): Promise<EnqueueResult> {
  const { guild, member, voiceChannel, next, searchEngine } = request;
  const query = request.query.trim();
  const playerService = DiscordPlayerService.getInstance();

  if (!voiceChannel) throw new PlayRejection("notInVoice");
  if (!query) throw new PlayRejection("emptyQuery");
  if (!playerService.isInitialized()) throw new PlayRejection("initializing");
  // Buttons, history, collections, search picks and the dashboard all land
  // here; queueing music would end (or break) a guess-the-song round.
  if (isGuessGameQueue(playerService.getQueue(guild.id))) throw new PlayRejection("gameRunning");
  // Every way of adding songs (slash, context menu, search, history,
  // collections, dashboard) answers to the server's "play" rule.
  const verdict = await canUse(member, "play");
  if (!verdict.ok) throw new PlayRejection("noPermission", { message: denialMessage(verdict) });

  // Already playing for people in another channel: don't hijack it.
  const existing = playerService.getQueue(guild.id);
  const botChannel = guild.members.me?.voice.channel;
  if (botChannel && botChannel.id !== voiceChannel.id && existing && !existing.deleted && existing.currentTrack) {
    const listeners = botChannel.members.filter((m) => !m.user.bot).size;
    if (listeners > 0) throw new PlayRejection("botBusy", { channelId: botChannel.id, channelName: botChannel.name });
  }

  const me = guild.members.me;
  const perms = me ? voiceChannel.permissionsFor(me) : null;
  if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
    throw new PlayRejection("cantJoin", { channelId: voiceChannel.id, channelName: voiceChannel.name });
  }

  await hooks.onAccepted?.();

  const settingsService = GuildSettingsService.getInstance();
  if (!(await settingsService.isVoiceChannelAllowed(guild.id, voiceChannel.id))) {
    throw new PlayRejection("channelNotAllowed");
  }
  // Per-instance channel scope from the permission rules ([] = any channel).
  const instance = Number(process.env.BOT_INSTANCE) || 1;
  if (!isChannelAllowedForInstance(await permissionConfigFor(guild.id), instance, voiceChannel.id)) {
    throw new PlayRejection("channelNotAllowed");
  }

  const settings = await settingsService.getSettings(guild.id);
  const live = existing && !existing.deleted ? existing : null;
  if (live && live.tracks.size >= settings.maxQueueSize) {
    throw new PlayError("queueFull", { max: settings.maxQueueSize });
  }

  // Idle bot in another (empty) channel: follow the requester.
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
    getPlaybackSettings(member.id, guild.id),
    hasPremiumFeature(member.id, "longer_songs").catch(() => false)
  ]);
  const playlistLimit = Math.max(1, settings.maxQueueSize - (live?.tracks.size ?? 0));

  // play() only uses the text channel as a new queue's panel channel.
  const result = await playerService.play(voiceChannel, query, request.textChannel as TextChannel, quality.bitrate, playlistLimit, {
    requestedBy: member.user,
    next,
    searchEngine,
    ignoreDurationLimit: longer
  });
  if (!result) throw new PlayRejection("noResults");

  // The badge names what the encoder will send in this channel, not the tier's ceiling.
  const sendKbps = targetKbps(Math.max(quality.bitrate, (result.queue?.metadata as QueueMetadata | undefined)?.audioBitrate ?? 0), voiceChannel.bitrate);
  return { ...result, qualityBadge: quality.bitrate > 128 ? getQualityBadge(sendKbps) : null };
}

/**
 * The one play pipeline behind /play, /playnext, search picks and the
 * "Play in voice channel" context menu: `enqueue` plus the replies. The
 * player panel (services/playerPanel.ts) shows the controls.
 */
export async function runPlay(request: PlayRequest): Promise<PlayResult | null> {
  const { interaction, next, searchEngine } = request;
  const ephemeral = Boolean(request.ephemeral);
  const query = request.query.trim();
  const guild = interaction.guild;
  const member = interaction.member as GuildMember;
  let accepted = false;

  // Fleet: another Bypass instance may serve the requester's channel; then
  // the request is handed over (or refused) and answered there.
  if (await dispatchPlay(request)) return null;

  try {
    const result = await enqueue(
      {
        guild,
        member,
        voiceChannel: member?.voice?.channel ?? null,
        textChannel: (interaction.channel ?? guild.systemChannel) as TextChannel | null,
        query,
        next,
        searchEngine
      },
      {
        onAccepted: async () => {
          accepted = true;
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply(ephemeral ? { flags: MessageFlags.Ephemeral } : {}).catch(console.error);
          }
        }
      }
    );

    await send(
      interaction,
      { components: [buildPlayReply(result, query, result.qualityBadge)], flags: V2, allowedMentions: { parse: [] } },
      ephemeral
    );
    return result;
  } catch (error) {
    // Instant refusals are always private and come before the reply is deferred.
    if (!accepted) {
      if (error instanceof PlayRejection) {
        await send(interaction, { content: playRejectionMessage(error, query) }, true);
        return null;
      }
      throw error;
    }
    if (error instanceof PlayRejection) {
      await send(interaction, { content: playRejectionMessage(error, query) }, ephemeral);
      return null;
    }
    if (!(error instanceof PlayError)) console.error("[play] ❌ Error:", error);
    await send(interaction, { content: playErrorMessage(error, query), components: [] }, ephemeral);
    return null;
  }
}
