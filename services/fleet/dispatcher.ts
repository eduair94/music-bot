import { QueryType, SearchQueryType } from "discord-player";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ChatInputCommandInteraction,
  CommandInteraction,
  Guild,
  GuildMember,
  MessageFlags,
  PermissionFlagsBits,
  RepliableInteraction,
  VoiceBasedChannel
} from "discord.js";
import { GuildSettings } from "../../models/GuildSettings";
import {
  chooseInstance,
  configuredInstances,
  fleetEnabled,
  instanceName,
  inviteUrl,
  LivePlaybackState,
  RouteCandidate
} from "../../shared/fleet";
import {
  getInstancePlaybackState,
  getInstanceStatus,
  isInstanceInGuild,
  isRedisAvailable
} from "../../shared/services/redis";
import type { BotCommandParams, BusCollectionTrack, BusCommand } from "../../shared/types";
import { ActionType, logAction } from "../../utils/actionLog";
import { forwardedCommandGate } from "../../utils/permissions";
import { formatDuration, isHttpUrl, linkLabel, safeText } from "../../utils/format";
import { currentLocale, i18n } from "../../utils/i18n";
import { isPrimary } from "../../utils/instance";
import { DatabaseService } from "../database";
import { DiscordPlayerService, isGuessGameQueue } from "../discordPlayer";
import { EFFECT_FILTERS } from "../effects";
import { GuildSettingsService } from "../guildSettings";
import { PremiumGuildService } from "../premiumGuild";
import { sendToInstance, BusResult } from "./bus";

/**
 * The primary's side of the fleet: picks which Bypass instance serves a
 * voice channel, hands /play over to it, and forwards controls typed in the
 * primary to the instance playing in the member's channel. With no extra
 * instances configured every function here is a no-op.
 */

const EPHEMERAL = MessageFlags.Ephemeral;
const NO_MENTIONS = { parse: [] as never[] };

/** Slash controls forwarded to the instance in the member's channel. */
const FORWARDED = new Set([
  "skip", "pause", "resume", "stop", "volume", "loop", "shuffle", "previous", "seek",
  "clear", "remove", "move", "jump", "autoplay", "leave", "effects"
]);
/** Read-only commands answered from that instance's playback state. */
const INFO = new Set(["queue", "nowplaying"]);
/** Commands whose play request may be dispatched to another instance. */
const PLAY = new Set(["play", "playnext", "playnow", "radio", "search", "ai"]);

const ACTION_LOG: Partial<Record<string, ActionType>> = {
  skip: "skip", pause: "pause", resume: "resume", stop: "stop", volume: "volume_change", loop: "loop",
  shuffle: "shuffle", previous: "previous", seek: "seek", clear: "clear", jump: "jump", autoplay: "autoplay",
  leave: "leave", effects: "setting_change"
};

let active: boolean | null = null;
/** Fleet routing runs in the primary once at least one extra instance exists. */
export function fleetActive(): boolean {
  if (active === null) active = isPrimary && fleetEnabled();
  return active;
}

function humans(channel: VoiceBasedChannel | null | undefined): number {
  return channel ? channel.members.filter((m) => !m.user.bot).size : 0;
}

// ------------------------------------------------------------- fleet view

interface FleetSettings {
  bindings: Record<string, string | null>;
  instanceChannels: Record<string, string[]>;
}

/**
 * Bindings and per-instance channel scopes, read fresh (the settings cache
 * can be minutes old after a dashboard edit). `permissionConfig` comes from
 * the permissions work and may not exist yet.
 */
async function fleetSettings(guildId: string): Promise<FleetSettings> {
  if (!DatabaseService.getInstance().isConnected()) return { bindings: {}, instanceChannels: {} };
  const doc = await GuildSettings.findOne({ guildId }, { fleet: 1, permissionConfig: 1 })
    .lean<{ fleet?: { bindings?: Record<string, string | null> }; permissionConfig?: { instanceChannels?: Record<string, unknown> } }>()
    .catch(() => null);
  const instanceChannels: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(doc?.permissionConfig?.instanceChannels ?? {})) {
    if (Array.isArray(value)) instanceChannels[key] = value.filter((id): id is string => typeof id === "string");
  }
  return { bindings: doc?.fleet?.bindings ?? {}, instanceChannels };
}

/** Membership checks for instances Redis doesn't know about, cached 10 min. */
const memberCache = new Map<string, { inGuild: boolean; at: number }>();
async function memberExists(guild: Guild, userId: string): Promise<boolean> {
  if (guild.members.cache.has(userId)) return true;
  const key = `${guild.id}:${userId}`;
  const cached = memberCache.get(key);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.inGuild;
  const inGuild = await guild.members.fetch({ user: userId, cache: false }).then(() => true, () => false);
  memberCache.set(key, { inGuild, at: Date.now() });
  return inGuild;
}

export interface InstanceSnapshot extends RouteCandidate {
  name: string;
  applicationId: string;
  state: LivePlaybackState | null;
}

/** What the primary knows about every configured instance in `guild`. */
export async function fleetSnapshot(guild: Guild): Promise<InstanceSnapshot[]> {
  const settings = await fleetSettings(guild.id);
  const redisOk = await isRedisAvailable().catch(() => false);
  const snapshots: InstanceSnapshot[] = [];

  for (const member of configuredInstances()) {
    const key = String(member.instance);
    const base = {
      instance: member.instance,
      name: member.name,
      applicationId: member.applicationId,
      premium: member.premium,
      boundTo: settings.bindings[key] ?? null,
      allowedChannels: settings.instanceChannels[key] ?? []
    };

    if (member.instance === 1) {
      const queue = DiscordPlayerService.getInstance().getQueue(guild.id);
      const live = queue && !queue.deleted ? queue : null;
      const channel = guild.members.me?.voice.channel ?? null;
      // A guess-the-song round owns the primary: count it as busy wherever it runs.
      const game = isGuessGameQueue(live);
      snapshots.push({
        ...base,
        online: true,
        inGuild: true,
        voiceChannelId: channel?.id ?? null,
        hasTrack: game || Boolean(live?.currentTrack),
        listeners: game ? Math.max(1, humans(channel)) : humans(channel),
        state: null
      });
      continue;
    }

    const [status, state, inSet] = redisOk
      ? await Promise.all([
          getInstanceStatus(member.instance).catch(() => null),
          getInstancePlaybackState(guild.id, member.instance).catch(() => null),
          isInstanceInGuild(member.instance, guild.id).catch(() => false)
        ])
      : [null, null, false];
    const voiceState = guild.voiceStates.cache.get(member.applicationId);
    const voiceChannelId = voiceState?.channelId ?? (state?.isConnected ? (state.voiceChannelId ?? null) : null);
    const online = redisOk ? Boolean(status && status.online !== false) : Boolean(voiceState?.channelId);
    const inGuild =
      inSet || Boolean(voiceState) || guild.members.cache.has(member.applicationId) || (online && (await memberExists(guild, member.applicationId)));
    const channel = voiceChannelId ? guild.channels.cache.get(voiceChannelId) : null;

    snapshots.push({
      ...base,
      online,
      inGuild,
      voiceChannelId,
      hasTrack: Boolean(state?.currentTrack || state?.isPlaying || state?.isPaused),
      listeners: channel?.isVoiceBased() ? humans(channel) : (state?.listeners ?? 0),
      state
    });
  }
  return snapshots;
}

/** The instance (2+) connected to `voiceChannelId`, if any. */
export async function instanceInChannel(guild: Guild, voiceChannelId: string): Promise<number | null> {
  for (const member of configuredInstances()) {
    if (member.instance === 1) continue;
    if (guild.voiceStates.cache.get(member.applicationId)?.channelId === voiceChannelId) return member.instance;
  }
  // Voice states not cached yet: fall back to the instances' published state.
  if (!(await isRedisAvailable().catch(() => false))) return null;
  for (const member of configuredInstances()) {
    if (member.instance === 1) continue;
    const state = await getInstancePlaybackState(guild.id, member.instance).catch(() => null);
    if (state?.isConnected && state.voiceChannelId === voiceChannelId) return member.instance;
  }
  return null;
}

/** One lookup per interaction: the router, the permission gate and forwardSlash all ask. */
const servingMemo = new WeakMap<object, Promise<number | null>>();

/**
 * The other instance (2+) playing in the member's voice channel, or null: no
 * fleet, not in voice, or in the primary's own channel.
 */
export function servingInstance(interaction: CommandInteraction | RepliableInteraction): Promise<number | null> {
  if (!fleetActive() || !interaction.inCachedGuild()) return Promise.resolve(null);
  const memo = servingMemo.get(interaction);
  if (memo) return memo;
  const guild = interaction.guild;
  const voiceId = (interaction.member as GuildMember).voice?.channelId;
  const lookup =
    !voiceId || voiceId === guild.members.me?.voice.channelId ? Promise.resolve(null) : instanceInChannel(guild, voiceId).catch(() => null);
  servingMemo.set(interaction, lookup);
  return lookup;
}

/**
 * For commands only the primary runs in voice (/join, /say, /guess): the
 * refusal to send when another instance already plays in the member's
 * channel, so the primary never joins it on top of that instance.
 */
export async function servedByOtherInstance(interaction: CommandInteraction | RepliableInteraction): Promise<string | null> {
  const instance = await servingInstance(interaction);
  if (!instance || !interaction.inCachedGuild()) return null;
  const channelId = (interaction.member as GuildMember).voice.channelId;
  return `🎧 ${i18n.__mf("fleet.dispatch.servedHere", { bot: `**${instanceName(instance)}**`, channel: `<#${channelId}>` })}`;
}

/** The instance a slash control or info command will be forwarded to (see forwardSlash), or null. */
export async function forwardTarget(interaction: CommandInteraction): Promise<number | null> {
  if (!interaction.isChatInputCommand()) return null;
  const command = interaction.commandName;
  if (!FORWARDED.has(command) && !INFO.has(command)) return null;
  return servingInstance(interaction);
}

async function premiumActive(guildId: string): Promise<boolean> {
  return PremiumGuildService.getInstance().isPremiumGuild(guildId).catch(() => false);
}

// ----------------------------------------------------------------- replies

async function reply(interaction: RepliableInteraction, payload: { content: string; components?: ActionRowBuilder<ButtonBuilder>[] }, ephemeral: boolean) {
  const body = { content: payload.content, components: payload.components ?? [], allowedMentions: NO_MENTIONS };
  try {
    if (interaction.deferred || interaction.replied) await interaction.editReply(body);
    else await interaction.reply({ ...body, flags: ephemeral ? EPHEMERAL : undefined });
  } catch (error) {
    console.error("[Fleet] Could not reply:", (error as Error)?.message ?? error);
  }
}

/** A private note even after a public reply was deferred or sent. */
async function privately(interaction: RepliableInteraction, content: string, components: ActionRowBuilder<ButtonBuilder>[] = []) {
  const body = { content, components, flags: EPHEMERAL, allowedMentions: NO_MENTIONS } as const;
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(body);
    else await interaction.reply(body);
  } catch (error) {
    console.error("[Fleet] Could not reply:", (error as Error)?.message ?? error);
  }
}

/** The bus never throws into a reply: a database hiccup reads as "didn't answer". */
async function safeSend(options: Parameters<typeof sendToInstance>[0]): Promise<BusResult> {
  try {
    return await sendToInstance(options);
  } catch (error) {
    console.error(`[Fleet] Could not hand ${options.command} to instance ${options.instance}:`, (error as Error)?.message ?? error);
    return { status: "unclaimed" };
  }
}

function resultLine(name: string, result: BusResult, okEmoji: string): string {
  const bot = `**${name}**`;
  switch (result.status) {
    case "completed":
      return `${okEmoji} ${bot} · ${result.message}`;
    case "failed":
      return `⚠️ ${bot} · ${result.message}`;
    case "processing":
      return `⏳ ${i18n.__mf("fleet.dispatch.slow", { bot })}`;
    case "unclaimed":
      return `⚠️ ${i18n.__mf("fleet.dispatch.noAnswer", { bot })}`;
  }
}

// -------------------------------------------------------------- dispatch

export interface DispatchRequest {
  interaction: RepliableInteraction<"cached">;
  query: string;
  next?: boolean;
  searchEngine?: SearchQueryType;
  ephemeral?: boolean;
  /** /playnow: skip the current song once queued next. */
  now?: boolean;
  /** /radio: turn autoplay on afterwards; a RadioRequest also starts that radio session. */
  radio?: boolean | import("../radio").RadioRequest;
  /** Several songs (a saved collection, history picks): `query` is the first, these follow it on the same instance. */
  collection?: { name: string; tracks: BusCollectionTrack[] };
  /**
   * The interaction's message isn't ours to edit (a menu on another message):
   * answer only with a private follow-up once the instance has answered.
   */
  followUp?: boolean;
}

/**
 * Route a play request: returns false when the primary should play it (the
 * caller continues as before), true when it was handed to another instance
 * or refused (the reply is sent here).
 */
export async function dispatchPlay(request: DispatchRequest): Promise<boolean> {
  if (!fleetActive()) return false;
  const { interaction } = request;
  const guild = interaction.guild;
  const voice = (interaction.member as GuildMember | null)?.voice?.channel ?? null;
  const query = request.query.trim();
  if (!voice || !query) return false;
  if (guild.members.me?.voice.channelId === voice.id) return false;

  const snapshot = await fleetSnapshot(guild);
  const premium = snapshot.some((s) => s.premium) ? await premiumActive(guild.id) : false;
  const decision = chooseInstance({ voiceChannelId: voice.id, candidates: snapshot, premiumActive: premium });

  if (decision.kind === "instance" && decision.instance === 1) return false;
  if (decision.kind === "none") {
    await refuse(interaction, voice, snapshot, premium);
    return true;
  }
  await handOff(request, decision.instance, voice);
  return true;
}

async function handOff(request: DispatchRequest, instance: number, voice: VoiceBasedChannel): Promise<void> {
  const { interaction } = request;
  const name = instanceName(instance);
  const ephemeral = Boolean(request.ephemeral);
  const followUp = Boolean(request.followUp);
  if (!followUp) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply(ephemeral ? { flags: EPHEMERAL } : {}).catch(console.error);
    }
    await reply(interaction, { content: `🔊 ${i18n.__mf("fleet.dispatch.joining", { bot: `**${name}**`, channel: `<#${voice.id}>` })}` }, ephemeral);
  }

  const result = await safeSend({
    guildId: interaction.guildId,
    instance,
    command: "play",
    params: {
      query: request.query.trim(),
      voiceChannelId: voice.id,
      textChannelId: interaction.channelId ?? undefined,
      next: request.next || undefined,
      now: request.now || undefined,
      autoplay: request.radio ? true : undefined,
      radio: typeof request.radio === "object" ? { ...request.radio } : undefined,
      source: request.searchEngine === QueryType.SOUNDCLOUD_SEARCH ? "soundcloud" : undefined,
      savedCollection: request.collection
        ? {
            name: request.collection.name,
            tracks: request.collection.tracks.map(({ title, author, url, thumbnail, duration }) => ({ title, author, url, thumbnail, duration }))
          }
        : undefined,
      locale: currentLocale()
    },
    user: { id: interaction.user.id, username: interaction.user.username },
    // A play searches, may expand a playlist and joins voice.
    timeoutMs: 25_000
  });

  let content = resultLine(name, result, "🎶");
  if (result.status === "completed" && request.radio) content += `\n-# 📻 ${i18n.__("player.autoplayEnabled")}`;
  if (followUp) await privately(interaction, content);
  else await reply(interaction, { content }, ephemeral);
}

/**
 * /247 for the channel another instance serves: that instance turns its own
 * 24/7 on or off (the caller already checked the Premium entitlement).
 */
export async function handStay247(
  interaction: ChatInputCommandInteraction<"cached">,
  instance: number,
  enabled: boolean
): Promise<void> {
  const channel = interaction.channel;
  await interaction.deferReply().catch(console.error);
  const result = await safeSend({
    guildId: interaction.guildId,
    instance,
    command: "stay247",
    params: {
      enabled,
      voiceChannelId: (interaction.member as GuildMember).voice.channelId ?? undefined,
      textChannelId: channel && channel.type === ChannelType.GuildText ? channel.id : undefined,
      locale: currentLocale()
    },
    user: { id: interaction.user.id, username: interaction.user.username }
  });
  await reply(interaction, { content: resultLine(instanceName(instance), result, "🌙") }, false);
}

/** No instance can take the channel: say who is busy where, offer the missing bots. */
async function refuse(interaction: RepliableInteraction<"cached">, voice: VoiceBasedChannel, snapshot: InstanceSnapshot[], premium: boolean) {
  const lines = [`🎧 ${i18n.__mf("fleet.dispatch.noneFree", { channel: `<#${voice.id}>` })}`];
  for (const s of snapshot) {
    if (!s.inGuild) continue;
    const bot = `**${s.name}**`;
    if (!s.online) lines.push(`• ${i18n.__mf("fleet.dispatch.offline", { bot })}`);
    else if (s.voiceChannelId && s.voiceChannelId !== voice.id && s.hasTrack && s.listeners > 0) {
      lines.push(`• ${i18n.__mf("fleet.dispatch.busyIn", { bot, channel: `<#${s.voiceChannelId}>` })}`);
    } else if (s.allowedChannels.length > 0 && !s.allowedChannels.includes(voice.id)) {
      lines.push(`• ${i18n.__mf("fleet.dispatch.notAllowed", { bot })}`);
    }
  }

  const missing = snapshot.filter((s) => !s.inGuild && (!s.premium || premium));
  const buttons = missing
    .map((s) => ({ s, url: inviteUrl(s.instance, interaction.guildId) }))
    .filter((m): m is { s: InstanceSnapshot; url: string } => Boolean(m.url))
    .slice(0, 5)
    .map(({ s, url }) =>
      new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setEmoji("➕").setLabel(i18n.__mf("fleet.dispatch.add", { bot: s.name }))
    );
  if (buttons.length) lines.push("", i18n.__("fleet.dispatch.invite"));
  // Only once the Premium bots exist (claims follow production).
  if (!premium && snapshot.some((s) => s.premium)) lines.push(`-# 💎 ${i18n.__("fleet.dispatch.premium")}`);

  const components = buttons.length ? [new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)] : [];
  await privately(interaction, lines.join("\n"), components);
}

// ------------------------------------------------------- forwarded slash

/**
 * A guess-the-song round blocks music commands in the primary, but a member
 * in another voice channel is routed to another instance: let those through.
 */
export async function routesAwayFromPrimary(interaction: CommandInteraction, commandName: string): Promise<boolean> {
  if (!fleetActive() || !interaction.inCachedGuild()) return false;
  // Controls only leave the primary when an instance plays in the member's channel.
  if (FORWARDED.has(commandName) || INFO.has(commandName)) return Boolean(await forwardTarget(interaction));
  if (!interaction.isContextMenuCommand() && !PLAY.has(commandName)) return false;
  // Play requests from another channel are routed (dispatchPlay) to a free instance.
  const voiceId = (interaction.member as GuildMember).voice?.channelId;
  return Boolean(voiceId && voiceId !== interaction.guild.members.me?.voice.channelId);
}

type BusRequest = { command: BusCommand; params?: BotCommandParams } | { info: true } | { error: string };

/** Slash options → bus command for the instance (positions are 1-based in Discord, 0-based on the bus). */
async function toBusRequest(interaction: ChatInputCommandInteraction<"cached">, state: LivePlaybackState | null): Promise<BusRequest> {
  const name = interaction.commandName;
  const options = interaction.options;
  switch (name) {
    case "skip":
    case "pause":
    case "resume":
    case "stop":
    case "shuffle":
    case "previous":
    case "clear":
    case "leave":
      return { command: name };

    case "volume": {
      const volume = options.getInteger("volume");
      if (volume === null) return { info: true };
      const settings = await GuildSettingsService.getInstance().getSettings(interaction.guildId);
      const max = settings.maxVolume ?? 100;
      if (volume < 0 || volume > max) return { error: `❌ ${i18n.__mf("volume.errorRange", { max })}` };
      return { command: "volume", params: { volume } };
    }

    case "loop": {
      const order = ["off", "track", "queue"] as const;
      const requested = options.getString("mode") as (typeof order)[number] | null;
      const current = state?.loopMode ?? "off";
      return { command: "loop", params: { loopMode: requested ?? order[(order.indexOf(current) + 1) % order.length] } };
    }

    case "seek": {
      const { parseTimeToMs } = await import("../../commands/seek");
      const ms = parseTimeToMs(options.getString("time", true));
      if (ms === null) return { error: i18n.__("seek.errorInvalidTime") };
      return { command: "seek", params: { position: ms } };
    }

    case "remove": {
      const slot = options.getString("slot") ?? "";
      const positions = slot.split(",").map((part) => Number(part.trim()));
      if (!slot.trim() || positions.some((n) => !Number.isInteger(n) || n < 1)) {
        return { error: i18n.__mf("remove.usageReply", { prefix: "/" }) };
      }
      return { command: "remove", params: { positions: positions.map((n) => n - 1) } };
    }

    case "move": {
      const from = options.getInteger("movefrom");
      const to = options.getInteger("moveto");
      if (!from || !to || from < 1 || to < 1) return { error: i18n.__mf("move.usagesReply", { prefix: "/" }) };
      // A target past the end means "last", as /move does on the primary.
      const last = state?.queueSize ? state.queueSize : to;
      return { command: "move", params: { from: from - 1, to: Math.min(to, last) - 1 } };
    }

    case "jump": {
      const position = options.getInteger("position", true);
      if (position < 1) return { error: i18n.__mf("fleet.bus.badPosition", { max: Math.max(1, state?.queueSize ?? 1) }) };
      return { command: "skipto", params: { position: position - 1 } };
    }

    case "autoplay": {
      const enabled = options.getBoolean("enabled") ?? !state?.autoplay;
      if (options.getBoolean("default")) {
        if (!(interaction.member as GuildMember).permissions.has(PermissionFlagsBits.ManageGuild)) {
          return { error: `🔒 ${i18n.__("language.needManage")}` };
        }
        await GuildSettingsService.getInstance().updateSettings(interaction.guildId, { autoplay: enabled });
      }
      return { command: "autoplay", params: { enabled } };
    }

    case "effects": {
      const sub = options.getSubcommand();
      if (sub === "list") return { info: true };
      if (sub === "clear") return { command: "filter", params: { name: "clear" } };
      if (sub === "bassboost") {
        const level = (options.getString("level") || "medium") as NonNullable<BotCommandParams["level"]>;
        return { command: "filter", params: { name: "bassboost", level } };
      }
      const enabled = options.getBoolean("enabled");
      return { command: "filter", params: { name: sub, ...(enabled === null ? {} : { enabled }) } };
    }
  }
  return { error: `⚠️ ${i18n.__("router.error")}` };
}

function effectLabel(effect: string): string {
  if (effect === "bassboost") return i18n.__("fleet.bus.bassBoostName");
  return EFFECT_FILTERS[effect] ? i18n.__(`effects.${effect}.name`) : effect;
}

/** Position now, interpolated from the published state. */
function positionOf(state: LivePlaybackState): number {
  const elapsed = state.isPlaying && !state.isPaused ? Date.now() - state.positionAt : 0;
  const position = state.currentPosition + Math.max(0, elapsed);
  const duration = state.currentTrack?.durationMs ?? 0;
  return duration > 0 ? Math.min(position, duration) : position;
}

/** /queue, /nowplaying, /volume and /effects list for another instance, from its playback state. */
function describe(interaction: ChatInputCommandInteraction<"cached">, name: string, state: LivePlaybackState | null): string {
  const bot = `**${name}**`;
  const command = interaction.commandName;
  if (!state?.isConnected) return `🔇 ${i18n.__mf("fleet.info.nothing", { bot })}`;

  if (command === "volume") return i18n.__mf("volume.currentVolume", { volume: state.volume });
  if (command === "effects") {
    const effects = state.filters ?? [];
    return `🎛️ ${bot} · ${effects.length ? effects.map(effectLabel).join(", ") : i18n.__("effects.list.empty")}`;
  }

  const lines = [`🎶 ${i18n.__mf("fleet.info.header", { bot, channel: `<#${state.voiceChannelId}>` })}`];
  const track = state.currentTrack;
  if (!track) {
    lines.push(i18n.__("player.nothingPlaying"));
  } else {
    const title = isHttpUrl(track.url) ? `[${linkLabel(track.title, 80)}](${track.url})` : safeText(track.title, 80);
    const time = track.durationMs ? `\`${formatDuration(positionOf(state))} / ${formatDuration(track.durationMs)}\`` : `🔴 ${i18n.__("player.live")}`;
    lines.push(`${state.isPaused ? "⏸" : "▶"} ${title} · ${safeText(track.author, 50)} · ${time}`);
  }

  if (command === "queue" && state.queue.length > 0) {
    lines.push("", `**${i18n.__("fleet.info.upNext")}**`);
    state.queue.slice(0, 10).forEach((t, i) => {
      lines.push(`${i + 1}. ${safeText(t.title, 70)} · ${safeText(t.author, 40)}${t.duration ? ` \`${t.duration}\`` : ""}`);
    });
    if (state.queueSize > 10) lines.push(`-# ${i18n.__mf("fleet.info.more", { count: state.queueSize - 10 })}`);
  }
  if (state.textChannelId) lines.push(`-# ${i18n.__mf("fleet.info.card", { channel: `<#${state.textChannelId}>` })}`);
  return lines.join("\n");
}

/**
 * A control or info command typed in the primary while the member's voice
 * channel is served by another instance: run it there (through the bus) and
 * answer with its result. Returns true when handled.
 */
export async function forwardSlash(interaction: ChatInputCommandInteraction<"cached">): Promise<boolean> {
  if (!fleetActive()) return false;
  const command = interaction.commandName;
  if (!FORWARDED.has(command) && !INFO.has(command)) return false;

  const guild = interaction.guild;
  const instance = await forwardTarget(interaction);
  if (!instance) return false;

  const name = instanceName(instance);
  const state = await getInstancePlaybackState(guild.id, instance).catch(() => null);

  // The server's rule for the command, judged against that instance's session
  // (Bot.guildGate leaves forwarded commands to this check): alone with that
  // bot, requester of its current song, owner of the songs /remove targets.
  const member = interaction.member as GuildMember;
  const userId = interaction.user.id;
  const ownsAt = (position: number) => state?.queue[position - 1]?.requestedBy?.id === userId;
  let isRequester: boolean | undefined;
  if (command === "skip") isRequester = state?.currentTrack?.requestedBy?.id === userId;
  if (command === "remove") {
    const slots = (interaction.options.getString("slot") ?? "").split(",").map((part) => Number(part.trim()));
    isRequester = slots.length > 0 && slots.every((n) => Number.isInteger(n) && n >= 1 && ownsAt(n));
  }
  const channel = member.voice.channel;
  const aloneWithBot = Boolean(channel && channel.members.filter((m) => !m.user.bot).size === 1);
  const refusal = await forwardedCommandGate(interaction, { aloneWithBot, isRequester });
  if (refusal) {
    await reply(interaction, { content: refusal }, true);
    return true;
  }

  if (INFO.has(command)) {
    await reply(interaction, { content: describe(interaction, name, state) }, false);
    return true;
  }

  const request = await toBusRequest(interaction, state);
  if ("error" in request) {
    await reply(interaction, { content: request.error }, true);
    return true;
  }
  if ("info" in request) {
    await reply(interaction, { content: describe(interaction, name, state) }, false);
    return true;
  }

  await interaction.deferReply().catch(console.error);
  const result = await safeSend({
    guildId: guild.id,
    instance,
    command: request.command,
    params: { ...request.params, locale: currentLocale() },
    user: { id: interaction.user.id, username: interaction.user.username }
  });
  await reply(interaction, { content: resultLine(name, result, "🎛️") }, false);

  const action = ACTION_LOG[command];
  if (action && result.status === "completed") {
    await logAction(guild, interaction.user, action, `${name}: ${result.message}`);
  }
  return true;
}
