import { GuildQueue, QueueRepeatMode, Track } from "discord-player";
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ContainerBuilder,
  GuildMember,
  Message,
  MessageFlags,
  PermissionFlagsBits,
  SeparatorSpacingSize,
  TextBasedChannel
} from "discord.js";
import { registerComponentHandler } from "../structs/componentRouter";
import { hasDJPermission } from "../utils/djPermission";
import { formatDuration, isHttpUrl, linkLabel, progressBar, safeText, truncate } from "../utils/format";
import { localeForGuild, localeForInteraction } from "../utils/guildLocale";
import { i18n, runWithLocale } from "../utils/i18n";
import { ensureAutoplayNext, isAutoplayTrack } from "./autoplay";
import { DiscordPlayerService, QueueMetadata } from "./discordPlayer";
import { GuildSettingsService } from "./guildSettings";
import { findLyrics } from "./lyrics";
import { buildQueueView } from "./queueView";
import { clearVoiceStatus, nowPlayingStatus, setVoiceStatus } from "./voiceStatus";

const DEFAULT_ACCENT = 0xf8aa2a;
const V2 = MessageFlags.IsComponentsV2;
const NO_MENTIONS = { parse: [] as never[] };
const FROZEN_PANEL_TTL_MS = 3 * 60 * 1000;

interface PanelRef {
  channelId: string;
  messageId: string;
}

function accentFrom(hex: string | undefined | null): number {
  const parsed = parseInt((hex || "").replace("#", ""), 16);
  return Number.isNaN(parsed) ? DEFAULT_ACCENT : parsed;
}

function currentTrackOf(queue: GuildQueue): Track | null {
  const metadata = (queue.metadata || {}) as QueueMetadata;
  return queue.currentTrack ?? metadata.currentTrack ?? null;
}

function loopLabel(mode: QueueRepeatMode): string {
  if (mode === QueueRepeatMode.TRACK) return i18n.__("player.loopTrack");
  if (mode === QueueRepeatMode.QUEUE) return i18n.__("player.loopQueue");
  return i18n.__("player.loopOff");
}

/**
 * One live "now playing" panel per server: a Components V2 message whose
 * buttons keep working for as long as the bot runs (and after restarts,
 * because they are routed by custom id rather than a collector).
 */
export class PlayerPanelService {
  private static instance: PlayerPanelService;
  private panels = new Map<string, PanelRef>();
  private chains = new Map<string, Promise<unknown>>();
  private refreshTimers = new Map<string, NodeJS.Timeout>();

  public static getInstance(): PlayerPanelService {
    if (!this.instance) this.instance = new PlayerPanelService();
    return this.instance;
  }

  private constructor() {
    registerComponentHandler("player", (interaction, args) => {
      if (!interaction.isButton()) return;
      return this.handleButton(interaction, args[0]);
    });
  }

  /** Serialize panel work per guild so rapid skips never produce two panels. */
  private enqueue<T>(guildId: string, task: () => Promise<T>): Promise<T | undefined> {
    const previous = this.chains.get(guildId) ?? Promise.resolve();
    const next = previous.then(task, task).catch((error) => {
      console.error("[PlayerPanel] Task failed:", error);
      return undefined;
    });
    this.chains.set(guildId, next);
    void next.finally(() => {
      if (this.chains.get(guildId) === next) this.chains.delete(guildId);
    });
    return next;
  }

  // ---------------------------------------------------------------- render

  /** Build the panel for the queue's current state, in the server's language. */
  public async render(queue: GuildQueue): Promise<ContainerBuilder> {
    const locale = await localeForGuild(queue.guild);
    let accent = DEFAULT_ACCENT;
    try {
      accent = accentFrom((await GuildSettingsService.getInstance().getSettings(queue.guild.id)).embedColor);
    } catch {
      /* default accent */
    }
    return runWithLocale(locale, () => this.buildContainer(queue, accent));
  }

  private buildContainer(queue: GuildQueue, accent: number): ContainerBuilder {
    const track = currentTrackOf(queue);
    const metadata = (queue.metadata || {}) as QueueMetadata;
    const container = new ContainerBuilder().setAccentColor(accent);

    if (!track) {
      container.addTextDisplayComponents((t) => t.setContent(i18n.__("player.nothingPlaying")));
      return container;
    }

    const paused = queue.node.isPaused();
    const isLive = !track.durationMS;
    const title = isHttpUrl(track.url) ? `[${linkLabel(track.title, 90)}](${track.url})` : safeText(track.title, 90);
    const by = isAutoplayTrack(track)
      ? i18n.__("player.autoplayPick")
      : track.requestedBy && !track.requestedBy.bot
        ? i18n.__mf("player.requestedBy", { user: `<@${track.requestedBy.id}>` })
        : "";
    const meta = [safeText(track.author, 60), isLive ? `🔴 ${i18n.__("player.live")}` : `\`${formatDuration(track.durationMS)}\``, by]
      .filter(Boolean)
      .join(" · ");

    const header = [`-# ${paused ? "⏸" : "▶"} ${paused ? i18n.__("player.paused") : i18n.__("player.nowPlaying")}`, `### ${title}`, meta].join("\n");

    if (isHttpUrl(track.thumbnail)) {
      container.addSectionComponents((section) =>
        section
          .addTextDisplayComponents((t) => t.setContent(header))
          .setThumbnailAccessory((thumb) => thumb.setURL(track.thumbnail).setDescription(truncate(track.title, 200)))
      );
    } else {
      container.addTextDisplayComponents((t) => t.setContent(header));
    }

    // Progress + state line
    const lines: string[] = [];
    if (!isLive) {
      const stamp = queue.node.getTimestamp();
      const current = stamp?.current.value ?? 0;
      lines.push(`\`${formatDuration(current)}\` ${progressBar(current, track.durationMS, 18)} \`${formatDuration(track.durationMS)}\``);
    }
    const state = [`🔊 ${i18n.__mf("player.volume", { volume: queue.node.volume })}`];
    if (queue.repeatMode !== QueueRepeatMode.OFF) state.push(`🔁 ${loopLabel(queue.repeatMode)}`);
    if (metadata.autoplay) state.push(`♾️ ${i18n.__("player.autoplayOn")}`);
    if (metadata.stay247) state.push(`🌙 ${i18n.__("player.stay247On")}`);
    lines.push(state.join(" · "));

    const next = queue.tracks.at(0);
    if (next) {
      const nextTitle = linkLabel(next.title, 60);
      lines.push(
        "-# " +
          (queue.tracks.size > 1
            ? i18n.__mf("player.upNextMore", { title: nextTitle, count: queue.tracks.size - 1 })
            : i18n.__mf("player.upNext", { title: nextTitle }))
      );
    } else {
      lines.push("-# " + (metadata.autoplay ? i18n.__("player.upNextAutoplay") : i18n.__("player.queueEmpty")));
    }
    container.addTextDisplayComponents((t) => t.setContent(lines.join("\n")));
    container.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    const loopOn = queue.repeatMode !== QueueRepeatMode.OFF;
    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId("player:prev").setEmoji("⏮️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("player:toggle")
          .setEmoji(paused ? "▶️" : "⏸️")
          .setStyle(paused ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder().setCustomId("player:skip").setEmoji("⏭️").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("player:stop").setEmoji("⏹️").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId("player:queue").setEmoji("📜").setStyle(ButtonStyle.Secondary)
      )
    );
    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder()
          .setCustomId("player:loop")
          .setEmoji(queue.repeatMode === QueueRepeatMode.TRACK ? "🔂" : "🔁")
          .setStyle(loopOn ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("player:shuffle").setEmoji("🔀").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("player:voldown").setEmoji("🔉").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("player:volup").setEmoji("🔊").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("player:autoplay")
          .setEmoji("♾️")
          .setStyle(metadata.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
      )
    );
    container.addActionRowComponents((row) =>
      row.setComponents(
        new ButtonBuilder().setCustomId("player:lyrics").setEmoji("🎤").setLabel(i18n.__("player.lyricsButton")).setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("player:save").setEmoji("💾").setLabel(i18n.__("player.saveButton")).setStyle(ButtonStyle.Secondary)
      )
    );

    return container;
  }

  private finalContainer(text: string, accent = DEFAULT_ACCENT): ContainerBuilder {
    return new ContainerBuilder().setAccentColor(accent).addTextDisplayComponents((t) => t.setContent(text));
  }

  // ------------------------------------------------------------ lifecycle

  private async channelFor(queue: GuildQueue): Promise<TextBasedChannel | null> {
    const channel = ((queue.metadata || {}) as QueueMetadata).channel as TextBasedChannel | undefined;
    if (!channel || !("send" in channel)) return null;
    const me = queue.guild.members.me;
    if (me && "permissionsFor" in channel) {
      const perms = (channel as any).permissionsFor(me);
      if (!perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return null;
    }
    return channel;
  }

  private async fetchPanel(queue: GuildQueue): Promise<Message | null> {
    const ref = this.panels.get(queue.guild.id);
    if (!ref) return null;
    const channel = queue.guild.channels.cache.get(ref.channelId);
    if (!channel || !channel.isTextBased()) return null;
    return channel.messages.fetch(ref.messageId).catch(() => null);
  }

  /** A new song started: move the panel to the bottom of the channel (or edit it in place). */
  public announce(queue: GuildQueue): Promise<unknown> {
    const guildId = queue.guild.id;
    const track = currentTrackOf(queue);
    if (track) {
      void setVoiceStatus(queue.player.client, queue.channel?.id, nowPlayingStatus(track.title, track.author));
    }

    return this.enqueue(guildId, async () => {
      const settings = await GuildSettingsService.getInstance().getSettings(guildId).catch(() => null);
      if (settings && settings.announceNowPlaying === false) return;

      const channel = await this.channelFor(queue);
      if (!channel || !("send" in channel)) return;

      const container = await this.render(queue);
      const existing = this.panels.get(guildId);

      if (existing && existing.channelId === channel.id && (channel as any).lastMessageId === existing.messageId) {
        const message = await this.fetchPanel(queue);
        if (message) {
          await message.edit({ components: [container], flags: V2, allowedMentions: NO_MENTIONS });
          return;
        }
      }

      if (existing) {
        const old = await this.fetchPanel(queue);
        await old?.delete().catch(() => undefined);
      }

      const sent = await channel.send({ components: [container], flags: V2, allowedMentions: NO_MENTIONS });
      this.panels.set(guildId, { channelId: sent.channelId, messageId: sent.id });
    });
  }

  /**
   * /nowplaying: answer with a fresh panel and make it the live one, so the
   * controls sit at the bottom of the channel again.
   */
  public async repost(queue: GuildQueue, interaction: import("discord.js").ChatInputCommandInteraction<"cached">): Promise<unknown> {
    const guildId = queue.guild.id;
    return this.enqueue(guildId, async () => {
      const container = await this.render(queue);
      const response = await interaction.reply({
        components: [container],
        flags: V2,
        allowedMentions: NO_MENTIONS,
        withResponse: true
      });
      const message = response.resource?.message;
      if (!message) return;
      const old = await this.fetchPanel(queue);
      if (old && old.id !== message.id) await old.delete().catch(() => undefined);
      this.panels.set(guildId, { channelId: message.channelId, messageId: message.id });
    });
  }

  /** State changed (pause, volume, queue…): edit the panel, at most every ~1.5 s. */
  public refresh(queue: GuildQueue, immediate = false): void {
    const guildId = queue.guild.id;
    if (!this.panels.has(guildId)) return;
    const run = () => {
      this.refreshTimers.delete(guildId);
      void this.enqueue(guildId, async () => {
        if (queue.deleted) return;
        const message = await this.fetchPanel(queue);
        if (!message) return;
        await message.edit({ components: [await this.render(queue)], flags: V2, allowedMentions: NO_MENTIONS });
      });
    };
    if (immediate) return run();
    if (this.refreshTimers.has(guildId)) return;
    this.refreshTimers.set(guildId, setTimeout(run, 1500).unref());
  }

  /** Playback ended: freeze the panel into a one-line summary. */
  public end(queue: GuildQueue, reason: "ended" | "stopped" | "disconnected"): Promise<unknown> {
    const guildId = queue.guild.id;
    void clearVoiceStatus(queue.player.client, queue.channel?.id ?? queue.connection?.joinConfig.channelId);
    const timer = this.refreshTimers.get(guildId);
    if (timer) clearTimeout(timer);
    this.refreshTimers.delete(guildId);

    return this.enqueue(guildId, async () => {
      const message = await this.fetchPanel(queue);
      this.panels.delete(guildId);
      if (!message) return;
      const locale = await localeForGuild(queue.guild);
      const text = runWithLocale(locale, () => {
        if (reason === "stopped") return `⏹️ ${i18n.__("player.stopped")}`;
        if (reason === "disconnected") return `👋 ${i18n.__("player.disconnected")}`;
        return `🏁 ${i18n.__("player.ended")}\n-# ${i18n.__("player.endedAutoplayHint")}`;
      });
      const edited = await message.edit({ components: [this.finalContainer(text)], flags: V2, allowedMentions: NO_MENTIONS }).catch(() => null);
      // The summary is only useful for a moment; don't let finished sessions pile up in the channel.
      if (edited) setTimeout(() => void edited.delete().catch(() => undefined), FROZEN_PANEL_TTL_MS).unref();
    });
  }

  /** Wire the panel to player events. Call once after the player exists. */
  public attach(): void {
    const player = DiscordPlayerService.getInstance().getPlayer();
    if (!player) return;

    player.events.on("playerStart", (queue) => {
      void this.announce(queue);
      void ensureAutoplayNext(queue).then((added) => added && this.refresh(queue));
    });
    player.events.on("playerPause", (queue) => this.refresh(queue, true));
    player.events.on("playerResume", (queue) => this.refresh(queue, true));
    player.events.on("volumeChange", (queue) => this.refresh(queue));
    player.events.on("audioTrackAdd", (queue) => this.refresh(queue));
    player.events.on("audioTracksAdd", (queue) => this.refresh(queue));
    player.events.on("audioTrackRemove", (queue) => this.refresh(queue));
    player.events.on("emptyQueue", (queue) => {
      const metadata = (queue.metadata || {}) as QueueMetadata;
      if (metadata.autoplay) {
        // The prefetch missed (lookup failed or the song was skipped early): try once more.
        void ensureAutoplayNext(queue).then((added) => {
          if (!added) void this.end(queue, "ended");
        });
        return;
      }
      void this.end(queue, "ended");
    });
    player.events.on("queueDelete", (queue) => void this.end(queue, "stopped"));
    player.events.on("disconnect", (queue) => void this.end(queue, "disconnected"));
  }

  // -------------------------------------------------------------- buttons

  private async handleButton(interaction: ButtonInteraction, action: string): Promise<unknown> {
    if (!interaction.inCachedGuild()) return;
    const ephemeral = MessageFlags.Ephemeral;
    const queue = DiscordPlayerService.getInstance().getQueue(interaction.guildId);
    const track = queue ? currentTrackOf(queue) : null;

    if (!queue || queue.deleted || !track) {
      return interaction.reply({ content: `❌ ${i18n.__("player.nothingPlaying")}`, flags: ephemeral });
    }

    // Read-only actions: anyone can use them.
    if (action === "queue") {
      return interaction.reply({ ...(await buildQueueView(queue, 0)), flags: ephemeral | V2, allowedMentions: NO_MENTIONS });
    }
    if (action === "lyrics") return this.replyLyrics(interaction, track);
    if (action === "save") return this.saveToDm(interaction, track);

    // Controls: same voice channel + DJ.
    const member = interaction.member as GuildMember;
    const botChannelId = interaction.guild.members.me?.voice.channelId;
    if (!botChannelId || member.voice.channelId !== botChannelId) {
      return interaction.reply({ content: `🔇 ${i18n.__("player.notInVoice")}`, flags: ephemeral });
    }
    if (!(await hasDJPermission(member))) {
      return interaction.reply({ content: `🎧 ${i18n.__("player.needDj")}`, flags: ephemeral });
    }

    const metadata = (queue.metadata || {}) as QueueMetadata;
    const update = async () =>
      interaction.update({ components: [await this.render(queue)], allowedMentions: NO_MENTIONS } as any);

    switch (action) {
      case "toggle":
        queue.node.setPaused(!queue.node.isPaused());
        return update();
      case "skip":
        queue.node.skip();
        return interaction.deferUpdate();
      case "prev":
        if (queue.history.isEmpty()) {
          return interaction.reply({ content: `⏮️ ${i18n.__("player.noPrevious")}`, flags: ephemeral });
        }
        await interaction.deferUpdate();
        return queue.history.previous().catch(() => undefined);
      case "stop":
        await interaction.deferUpdate();
        metadata.autoplay = false;
        if (metadata.stay247) {
          // 24/7 keeps the bot in the channel; just clear and stop the music.
          queue.tracks.clear();
          queue.node.stop();
          return this.end(queue, "stopped");
        }
        return queue.delete();
      case "loop": {
        // OFF → TRACK → QUEUE → OFF (AUTOPLAY is our own metadata flag, not a repeat mode here)
        const order: number[] = [QueueRepeatMode.OFF, QueueRepeatMode.TRACK, QueueRepeatMode.QUEUE];
        const nextMode = order[(order.indexOf(queue.repeatMode) + 1) % order.length] ?? QueueRepeatMode.OFF;
        queue.setRepeatMode(nextMode as any);
        return update();
      }
      case "shuffle":
        if (queue.tracks.size < 2) {
          return interaction.reply({ content: `🔀 ${i18n.__("player.nothingToShuffle")}`, flags: ephemeral });
        }
        queue.tracks.shuffle();
        return update();
      case "voldown":
      case "volup": {
        const settings = await GuildSettingsService.getInstance().getSettings(interaction.guildId);
        const max = settings.maxVolume ?? 100;
        const step = action === "volup" ? 10 : -10;
        const target = Math.max(0, Math.min(max, queue.node.volume + step));
        if (action === "volup" && queue.node.volume >= max) {
          return interaction.reply({ content: `🔊 ${i18n.__mf("player.volumeLimit", { max })}`, flags: ephemeral });
        }
        queue.node.setVolume(target);
        return update();
      }
      case "autoplay": {
        metadata.autoplay = !metadata.autoplay;
        queue.metadata = metadata;
        await update();
        if (metadata.autoplay) {
          void ensureAutoplayNext(queue).then((added) => added && this.refresh(queue));
        } else {
          // Drop the song autoplay already lined up, if it's the only one queued.
          const lined = queue.tracks.toArray().filter(isAutoplayTrack);
          for (const t of lined) queue.removeTrack(t);
        }
        return;
      }
      default:
        return interaction.reply({ content: i18n.__("router.expired"), flags: ephemeral });
    }
  }

  private async replyLyrics(interaction: ButtonInteraction, track: Track): Promise<unknown> {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await findLyrics(track.title, track.author || "");
    if (!result) {
      return interaction.editReply({ content: `🎤 ${i18n.__mf("player.lyricsNotFound", { title: safeText(track.title, 80) })}` });
    }
    const container = new ContainerBuilder()
      .setAccentColor(DEFAULT_ACCENT)
      .addTextDisplayComponents((t) => t.setContent(`### 🎤 ${safeText(result.title, 80)} — ${safeText(result.artist, 60)}`))
      .addTextDisplayComponents((t) => t.setContent(truncate(result.text, 3700)))
      .addTextDisplayComponents((t) => t.setContent(`-# ${i18n.__mf("lyricsCmd.source", { source: result.source })}`));
    return interaction.editReply({ components: [container], flags: V2 } as any);
  }

  private async saveToDm(interaction: ButtonInteraction, track: Track): Promise<unknown> {
    const locale = await localeForInteraction(interaction);
    const card = runWithLocale(locale, () => {
      const container = new ContainerBuilder().setAccentColor(DEFAULT_ACCENT);
      const text = [
        `### 💾 ${isHttpUrl(track.url) ? `[${linkLabel(track.title, 90)}](${track.url})` : safeText(track.title, 90)}`,
        `${safeText(track.author, 60)} · \`${formatDuration(track.durationMS)}\``,
        `-# ${i18n.__mf("player.savedFrom", { guild: safeText(interaction.guild?.name, 60) })}`
      ].join("\n");
      if (isHttpUrl(track.thumbnail)) {
        container.addSectionComponents((s) =>
          s.addTextDisplayComponents((t) => t.setContent(text)).setThumbnailAccessory((th) => th.setURL(track.thumbnail))
        );
      } else {
        container.addTextDisplayComponents((t) => t.setContent(text));
      }
      return container;
    });

    try {
      await interaction.user.send({ components: [card], flags: V2 });
      return interaction.reply({ content: `📬 ${i18n.__("player.dmSent")}`, flags: MessageFlags.Ephemeral });
    } catch {
      return interaction.reply({
        components: [card.addTextDisplayComponents((t) => t.setContent(`-# ${i18n.__("player.dmClosed")}`))],
        flags: MessageFlags.Ephemeral | V2
      });
    }
  }
}
