import { GuildQueue, Player, QueryType, QueueRepeatMode, SearchQueryType, Track } from "discord-player";
import {
    ChannelType,
    Client,
    Guild,
    GuildMember,
    PermissionFlagsBits,
    TextChannel,
    VoiceBasedChannel
} from "discord.js";
import { Types } from "mongoose";
import { BotCommand, BotCommandParams, IBotCommand } from "../models/BotCommand";
import type { LiveTrack } from "../shared/fleet";
import { canUse, denialMessage } from "../utils/permissions";
import { formatDuration, truncate } from "../utils/format";
import { localeForGuild } from "../utils/guildLocale";
import { i18n, runWithLocale, toBotLocale } from "../utils/i18n";
import { INSTANCE, INSTANCE_NAME, isPrimary, stay247Of } from "../utils/instance";
import {
    ChannelLabel,
    enqueue,
    EnqueueResult,
    playErrorMessage,
    playGate,
    PlayRejection,
    playRejectionMessage
} from "../utils/playFlow";
import { ensureAutoplayNext, isAutoplayTrack } from "./autoplay";
import { COLLECTION_FIRST_ATTEMPTS, playQueryFor, queueCollectionRest } from "./collectionPlayback";
import { RadioRequest, startRadio } from "./radio";
import { DiscordPlayerService, isGuessGameQueue, PlayError, QueueMetadata } from "./discordPlayer";
import { clearEffects, resolveEffect, setBassBoost, setEffect } from "./effects";
import { clearPlayback, ensurePlaybackIndexes, publishPlayback, startPlaybackRefresher, toLiveTrack } from "./fleet/playbackState";
import { GuildSettingsService } from "./guildSettings";
import { PlayerPanelService } from "./playerPanel";
import { searchYouTube } from "./youtubeSearch";

/** Outcome of a bus command, already in the requester's (or server's) language. */
interface BusOutcome {
  ok: boolean;
  message: string;
  /** Structured result written to the command's `data` (search results, play position). */
  data?: unknown;
  /** Queue to republish afterwards. */
  queue?: GuildQueue | null;
}

/** `play {source}` → search engine for plain-text queries. */
const SEARCH_SOURCES: Record<string, SearchQueryType> = {
  youtube: QueryType.YOUTUBE_SEARCH,
  soundcloud: QueryType.SOUNDCLOUD_SEARCH
};

/** The dashboard shows plain text: drop Discord markdown from bot messages. */
function plainText(text: string): string {
  return text
    .replace(/(?<!\\)\*\*|(?<!\\)`/g, "")
    .replace(/\\([\\*_~`|])/g, "$1")
    .trim();
}

/** Channels are named, not mentioned, outside Discord. */
const channelName: ChannelLabel = (_id, name) => `#${name}`;

/**
 * DashboardSyncService - Syncs bot state with the dashboard via MongoDB
 * 
 * This service handles:
 * 1. Publishing this instance's playback state (Redis + live stream on every
 *    player event and every 5 s while connected; Mongo mirror on events)
 * 2. Polling for commands addressed to this instance and executing them
 */
export class DashboardSyncService {
  private static instance: DashboardSyncService;
  private client: Client | null = null;
  private player: Player | null = null;
  private playerService: DiscordPlayerService | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): DashboardSyncService {
    if (!this.instance) {
      this.instance = new DashboardSyncService();
    }
    return this.instance;
  }

  /**
   * Initialize the dashboard sync service
   */
  public async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      console.log("[DashboardSync] Already initialized");
      return;
    }

    console.log("[DashboardSync] 🚀 Initializing dashboard sync service...");

    this.client = client;
    this.playerService = DiscordPlayerService.getInstance();
    this.player = this.playerService.getPlayer();

    if (!this.player) {
      console.warn("[DashboardSync] ⚠️ Player not initialized yet, will retry after events are set up");
    }

    // Set up player event listeners for state sync
    this.setupPlayerEventListeners();
    this.refreshTimer = startPlaybackRefresher(() => this.playerService?.getPlayer() ?? null);
    void this.migratePlaybackIndexes();

    // Start polling for dashboard commands
    this.startCommandPolling();

    this.initialized = true;
    console.log("[DashboardSync] ✅ Dashboard sync service initialized");
  }

  /**
   * Set up player event listeners to sync state to MongoDB
   */
  private setupPlayerEventListeners(): void {
    const checkAndSetup = () => {
      const player = this.playerService?.getPlayer();
      if (!player) {
        setTimeout(checkAndSetup, 1000);
        return;
      }

      this.player = player;

      // Track start
      player.events.on("playerStart", async (queue: GuildQueue, _track: Track) => {
        await this.updatePlaybackState(queue);
      });

      // Track end
      player.events.on("playerFinish", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      // Track skip
      player.events.on("playerSkip", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      // Queue update
      player.events.on("audioTrackAdd", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      player.events.on("audioTracksAdd", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      // Pause/Resume
      player.events.on("playerPause", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      player.events.on("playerResume", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      // Connection events
      player.events.on("connection", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      player.events.on("disconnect", async (queue: GuildQueue) => {
        await this.clearPlaybackState(queue.guild?.id);
      });

      // Queue events
      player.events.on("emptyQueue", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      player.events.on("queueDelete", async (queue: GuildQueue) => {
        await this.clearPlaybackState(queue.guild?.id);
      });

      // Volume change
      player.events.on("volumeChange", async (queue: GuildQueue) => {
        await this.updatePlaybackState(queue);
      });

      console.log("[DashboardSync] ✅ Player event listeners set up");
    };

    checkAndSetup();
  }

  /** Key `playbackstates` by (guildId, instance); retried until the database is up. */
  private async migratePlaybackIndexes(attempt = 0): Promise<void> {
    if (await ensurePlaybackIndexes()) return;
    if (attempt >= 20) return;
    setTimeout(() => void this.migratePlaybackIndexes(attempt + 1), 30_000).unref();
  }

  /** Publish this instance's state for the queue (Redis, live stream, Mongo mirror). */
  private async updatePlaybackState(queue: GuildQueue): Promise<void> {
    await publishPlayback(queue, true);
  }

  /** This instance left the server's voice channel: drop its state. */
  private async clearPlaybackState(guildId?: string): Promise<void> {
    await clearPlayback(guildId);
  }

  /**
   * Start polling for dashboard commands
   */
  private startCommandPolling(): void {
    this.pollInterval = setInterval(async () => {
      await this.processCommands();
    }, 500);

    console.log("[DashboardSync] ✅ Started command polling");
  }

  /** Commands addressed to this instance (pre-fleet documents have no instance = 1). */
  private instanceFilter(): Record<string, unknown> {
    return INSTANCE === 1
      ? { $or: [{ instance: 1 }, { instance: { $exists: false } }, { instance: null }] }
      : { instance: INSTANCE };
  }

  /**
   * Process pending commands from the dashboard (and, on secondaries, the jobs
   * the primary hands over)
   */
  private async processCommands(): Promise<void> {
    try {
      // Process regular player commands
      const commands = await BotCommand.find({
        status: "pending",
        guildId: { $exists: true }, // Regular commands have guildId
        ...this.instanceFilter()
      })
        .sort({ createdAt: 1 })
        .limit(10);

      for (const command of commands) {
        await this.executeCommand(command as IBotCommand);
      }

      // Linked bots and owner actions belong to the primary.
      if (!isPrimary) return;

      // Process linked bot commands
      const linkedBotCommands = await BotCommand.find({
        status: "pending",
        type: { $in: ["linked_bot_start", "linked_bot_stop", "linked_bot_restart", "admin_resync"] }
      })
        .sort({ createdAt: 1 })
        .limit(10);

      for (const command of linkedBotCommands) {
        await this.executeLinkedBotCommand(command as IBotCommand);
      }
    } catch (error) {
      if ((error as Error).message?.includes("buffering timed out")) {
        return;
      }
      // Don't spam logs if DB not connected
      if ((error as Error).message?.includes("MongooseError")) {
        return;
      }
    }
  }

  /**
   * Take a pending command and mark it processing. Poll ticks overlap when a
   * command is slow (a play can take seconds), so two ticks can load the same
   * command; only the one that flips it from "pending" runs it.
   */
  private async claim(_id: Types.ObjectId): Promise<boolean> {
    const claimed = await BotCommand.findOneAndUpdate(
      { _id, status: "pending" },
      { status: "processing" },
      { projection: { _id: 1 } }
    ).lean();
    return Boolean(claimed);
  }

  /**
   * Execute a linked bot command (start/stop/restart)
   */
  private async executeLinkedBotCommand(command: IBotCommand): Promise<void> {
    const { type, botId, _id } = command;

    if (!_id || !type) return;
    if (type === "admin_resync") {
      await this.executeAdminCommand(command);
      return;
    }
    if (!botId) return;

    try {
      // Mark as processing
      if (!(await this.claim(_id))) return;

      console.log(`[DashboardSync] 🤖 Executing linked bot command: ${type} for bot ${botId}`);

      // Dynamically import BotManagerService to avoid circular dependencies
      const { BotManagerService } = await import("./botManager");
      const botManager = BotManagerService.getInstance();

      let result: string = "Command executed";

      switch (type) {
        case "linked_bot_start": {
          const startResult = await botManager.startBot(botId);
          if (!startResult.success) {
            throw new Error(startResult.error || "Failed to start bot");
          }
          result = "Bot started";
          break;
        }

        case "linked_bot_stop": {
          const stopResult = await botManager.stopBot(botId);
          if (!stopResult.success) {
            throw new Error(stopResult.error || "Failed to stop bot");
          }
          result = "Bot stopped";
          break;
        }

        case "linked_bot_restart": {
          const restartResult = await botManager.restartBot(botId);
          if (!restartResult.success) {
            throw new Error(restartResult.error || "Failed to restart bot");
          }
          result = "Bot restarted";
          break;
        }

        default:
          throw new Error(`Unknown linked bot command: ${type}`);
      }

      // Mark as completed
      await BotCommand.updateOne(
        { _id },
        { status: "completed", result, processedAt: new Date() }
      );

      console.log(`[DashboardSync] ✅ Linked bot command completed: ${type} - ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DashboardSync] ❌ Linked bot command failed: ${type} - ${errorMessage}`);

      await BotCommand.updateOne(
        { _id },
        { status: "failed", error: errorMessage, processedAt: new Date() }
      );
    }
  }

  /** Owner action from the dashboard: republish guild data + heartbeat. */
  private async executeAdminCommand(command: IBotCommand): Promise<void> {
    const { _id, type } = command;
    if (!_id) return;
    try {
      if (!(await this.claim(_id))) return;
      const { TelemetryService } = await import("./telemetry");
      const { guilds } = await TelemetryService.getInstance().resyncNow();
      const result = `Resynced ${guilds} guilds`;
      await BotCommand.updateOne({ _id }, { status: "completed", result, processedAt: new Date() });
      console.log(`[DashboardSync] ✅ Admin command completed: ${type} - ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DashboardSync] ❌ Admin command failed: ${type} - ${errorMessage}`);
      await BotCommand.updateOne({ _id }, { status: "failed", error: errorMessage, processedAt: new Date() });
    }
  }

  /**
   * Execute a single player command (from the dashboard or forwarded by the
   * primary). The result is written back in plain text, in the requester's
   * language when the command carries one, else the server's.
   */
  private async executeCommand(command: IBotCommand): Promise<void> {
    const { guildId, command: cmd, _id } = command;

    if (!_id || !guildId || !cmd) return;
    if (!(await this.claim(_id))) return;

    console.log(`[DashboardSync] 🎵 Executing command: ${cmd} for guild ${guildId}`);

    const guild = this.client?.guilds.cache.get(guildId) ?? null;
    const locale = toBotLocale(command.params?.locale) ?? (await localeForGuild(guild));
    let outcome: BusOutcome;
    try {
      outcome = guild
        ? await runWithLocale(locale, () => this.runCommand(command, guild))
        : { ok: false, message: runWithLocale(locale, () => i18n.__("fleet.bus.notInGuild")) };
    } catch (error) {
      if (!(error instanceof PlayError)) console.error(`[DashboardSync] ❌ Command ${cmd} crashed:`, error);
      outcome = { ok: false, message: error instanceof Error ? error.message : "Unknown error" };
    }

    const message = plainText(outcome.message);
    await BotCommand.updateOne(
      { _id },
      outcome.ok
        ? { status: "completed", result: message, data: outcome.data, processedAt: new Date() }
        : { status: "failed", error: message, processedAt: new Date() }
    );

    if (outcome.ok) console.log(`[DashboardSync] ✅ Command completed: ${cmd} - ${message}`);
    else console.log(`[DashboardSync] ⛔ Command ${cmd} refused in guild ${guildId}: ${message}`);

    const queue = outcome.queue ?? this.playerService?.getQueue(guildId);
    if (queue && !queue.deleted) await this.updatePlaybackState(queue);
  }

  /** One bus command against this instance's queue in `guild`. */
  private async runCommand(command: IBotCommand, guild: Guild): Promise<BusOutcome> {
    const cmd = command.command;
    const params = command.params ?? {};
    const ok = (message: string, queue?: GuildQueue | null, data?: unknown): BusOutcome => ({ ok: true, message, queue, data });
    const fail = (message: string): BusOutcome => ({ ok: false, message });

    // Commands that don't need a running queue.
    if (cmd === "play") return this.busPlay(command, guild);
    if (cmd === "search") return this.busSearch(params.query);
    if (cmd === "stay247") return this.busStay247(command, guild);

    const player = this.playerService?.getPlayer();
    if (!player) return fail(i18n.__("play.initializing"));
    const queue = player.nodes.get(guild.id);

    // A guess-the-song round owns the player: skip/pause/seek/previous from
    // the web would silence or end it. /guess stop ends the game.
    if (isGuessGameQueue(queue)) return fail(i18n.__mf("guess.blockedDuringGame", { stop: "/guess stop" }));

    if (cmd === "join") return this.busJoin(command, guild);
    if (cmd === "leave") {
      if (!queue || queue.deleted || !queue.connection) return fail(i18n.__("leave.errorNotInChannel"));
      const name = queue.channel?.name ?? i18n.__("common.voiceChannel");
      queue.delete();
      return ok(i18n.__mf("fleet.bus.left", { channel: `#${name}` }));
    }

    if (!queue || queue.deleted) return fail(i18n.__("fleet.bus.nothingPlaying"));
    const panel = PlayerPanelService.getInstance();
    const size = queue.tracks.size;
    const badPosition = () => fail(i18n.__mf("fleet.bus.badPosition", { max: Math.max(1, size) }));
    const inRange = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < size;

    switch (cmd) {
      case "pause":
        queue.node.pause();
        return ok(i18n.__("fleet.bus.paused"), queue);

      case "resume":
        queue.node.resume();
        return ok(i18n.__("fleet.bus.resumed"), queue);

      case "skip": {
        const current = queue.currentTrack;
        if (!current && size === 0) return fail(i18n.__("fleet.bus.nothingPlaying"));
        queue.node.skip();
        return ok(i18n.__mf("fleet.bus.skipped", { title: truncate(current?.title ?? "", 100) }), queue);
      }

      case "previous":
        if (queue.history.isEmpty()) return fail(i18n.__("fleet.bus.noPrevious"));
        await queue.history.previous();
        return ok(i18n.__("fleet.bus.previous"), queue);

      case "stop":
        queue.delete();
        return ok(i18n.__("fleet.bus.stopped"));

      case "volume": {
        if (typeof params.volume !== "number" || !Number.isFinite(params.volume)) return fail(i18n.__mf("fleet.bus.badVolume", { max: 100 }));
        // The dashboard obeys the server's maximum like /volume does.
        const settings = await GuildSettingsService.getInstance().getSettings(guild.id);
        const max = Math.min(100, settings.maxVolume ?? 100);
        const volume = Math.round(Math.min(max, Math.max(0, params.volume)));
        queue.node.setVolume(volume);
        panel.refresh(queue);
        return ok(i18n.__mf(volume < params.volume ? "fleet.bus.volumeCapped" : "fleet.bus.volume", { volume }), queue);
      }

      case "shuffle":
        queue.tracks.shuffle();
        panel.refresh(queue);
        return ok(i18n.__("fleet.bus.shuffled"), queue);

      case "loop": {
        const modes: Record<string, QueueRepeatMode> = { off: QueueRepeatMode.OFF, track: QueueRepeatMode.TRACK, queue: QueueRepeatMode.QUEUE };
        const mode = params.loopMode ? modes[params.loopMode] : undefined;
        if (mode === undefined) return fail(i18n.__("fleet.bus.badLoop"));
        queue.setRepeatMode(mode);
        panel.refresh(queue, true);
        const label = mode === QueueRepeatMode.TRACK ? "player.loopTrack" : mode === QueueRepeatMode.QUEUE ? "player.loopQueue" : "player.loopOff";
        return ok(i18n.__(label), queue);
      }

      case "autoplay": {
        const metadata = (queue.metadata || {}) as QueueMetadata;
        const enabled = typeof params.enabled === "boolean" ? params.enabled : !metadata.autoplay;
        metadata.autoplay = enabled;
        queue.metadata = metadata;
        if (enabled) {
          void ensureAutoplayNext(queue).then((added) => added && panel.refresh(queue));
        } else {
          delete metadata.radio;
          for (const t of queue.tracks.toArray().filter(isAutoplayTrack)) queue.removeTrack(t);
        }
        panel.refresh(queue, true);
        return ok(i18n.__(enabled ? "player.autoplayEnabled" : "player.autoplayDisabled"), queue);
      }

      case "filter": {
        if (!queue.currentTrack) return fail(i18n.__("effects.nothingPlaying"));
        if ((params.name ?? "").toLowerCase() === "clear") {
          await clearEffects(queue);
          return ok(i18n.__("effects.clear.done"), queue);
        }
        const effect = resolveEffect(params.name);
        if (!effect) return fail(i18n.__("effects.unknown"));
        if (effect === "bassboost" && params.level) {
          await setBassBoost(queue, params.level);
          return ok(i18n.__mf("fleet.bus.bassBoost", { level: i18n.__(`effects.bassboost.level.${params.level}`) }), queue);
        }
        const on = await setEffect(queue, effect, typeof params.enabled === "boolean" ? params.enabled : null);
        const name = effect === "bassboost" ? i18n.__("fleet.bus.bassBoostName") : i18n.__(`effects.${effect}.name`);
        return ok(i18n.__mf(on ? "fleet.bus.effectOn" : "fleet.bus.effectOff", { effect: name }), queue);
      }

      case "remove": {
        const positions = [...new Set(params.positions?.length ? params.positions : [params.position])];
        if (!positions.every(inRange)) return badPosition();
        const tracks = queue.tracks.toArray();
        const removed = (positions as number[]).sort((a, b) => b - a).map((index) => {
          queue.removeTrack(index);
          return tracks[index].title;
        });
        return ok(i18n.__mf("fleet.bus.removed", { title: truncate(removed.reverse().join(", "), 200) }), queue);
      }

      case "move": {
        if (!inRange(params.from) || !inRange(params.to)) return badPosition();
        const track = queue.tracks.at(params.from)!;
        queue.moveTrack(params.from, params.to);
        return ok(i18n.__mf("fleet.bus.moved", { title: truncate(track.title, 100), position: params.to + 1 }), queue);
      }

      case "skipto": {
        if (!inRange(params.position)) return badPosition();
        const track = queue.tracks.at(params.position)!;
        queue.node.skipTo(params.position);
        return ok(i18n.__mf("fleet.bus.skippedTo", { title: truncate(track.title, 100) }), queue);
      }

      case "clear":
        queue.tracks.clear();
        return ok(i18n.__("fleet.bus.cleared"), queue);

      case "seek": {
        const track = queue.currentTrack;
        if (!track) return fail(i18n.__("fleet.bus.nothingPlaying"));
        // Contract: position in ms; older dashboards send seconds.
        const ms = typeof params.position === "number" ? params.position : typeof params.seconds === "number" ? params.seconds * 1000 : NaN;
        if (!Number.isFinite(ms) || ms < 0 || (track.durationMS > 0 && ms >= track.durationMS)) {
          return fail(i18n.__mf("fleet.bus.badSeek", { duration: formatDuration(track.durationMS) }));
        }
        await queue.node.seek(Math.round(ms));
        panel.refresh(queue, true);
        return ok(i18n.__mf("fleet.bus.seeked", { time: formatDuration(ms) }), queue);
      }

      default:
        return fail(i18n.__mf("fleet.bus.unknownCommand", { command: String(cmd) }));
    }
  }

  /** "search": YouTube results as contract tracks, no queue change. */
  private async busSearch(rawQuery: string | undefined): Promise<BusOutcome> {
    const query = rawQuery?.trim() ?? "";
    if (!query) return { ok: false, message: i18n.__("dashboardPlay.noQuery") };

    let results: LiveTrack[] = [];
    if (/^https?:\/\//i.test(query)) {
      const found = await this.playerService?.search(query);
      results = (found?.tracks ?? []).slice(0, 10).map(toLiveTrack);
    } else {
      const videos = await searchYouTube(query, 10).catch(() => null);
      if (!videos) return { ok: false, message: i18n.__("fleet.bus.searchFailed") };
      results = videos.map((v) => ({
        title: v.title,
        author: v.author,
        url: v.url,
        thumbnail: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
        duration: v.isLive ? "" : (v.durationText ?? ""),
        durationMs: v.durationSec ? v.durationSec * 1000 : 0,
        source: "youtube"
      }));
    }
    return { ok: true, message: i18n.__mf("fleet.bus.searchResults", { count: results.length }), data: { results } };
  }

  /** "join": connect to a voice channel without playing (like /join). */
  private async busJoin(command: IBotCommand, guild: Guild): Promise<BusOutcome> {
    const fail = (message: string): BusOutcome => ({ ok: false, message });
    const member = await this.memberOf(command, guild);
    const target = await this.dashboardVoiceChannel(guild, member, command.params?.voiceChannelId, !command.params?.voiceChannelId);
    if (typeof target === "string") return fail(target);

    const me = guild.members.me;
    if (!me || !target.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      return fail(i18n.__mf("play.cantJoin", { channel: channelName(target.id, target.name) }));
    }

    const playerService = this.playerService!;
    const existing = playerService.getQueue(guild.id);
    const live = existing && !existing.deleted ? existing : null;
    if (live?.channel && live.channel.id !== target.id) {
      const listeners = live.channel.members.filter((m) => !m.user.bot).size;
      if (live.currentTrack && listeners > 0) {
        return fail(i18n.__mf("play.botNotInChannel", { channel: channelName(live.channel.id, live.channel.name) }));
      }
      await live.connect(target);
      return { ok: true, message: i18n.__mf("fleet.bus.joined", { channel: channelName(target.id, target.name) }), queue: live };
    }

    const queue = await playerService.createQueue(guild, await this.panelChannel(guild, command.params?.textChannelId));
    if (!queue.connection) await queue.connect(target, { deaf: true });
    return { ok: true, message: i18n.__mf("fleet.bus.joined", { channel: channelName(target.id, target.name) }), queue };
  }

  /**
   * /247 typed in the primary for a channel this instance serves (the primary
   * already checked the Premium entitlement). Writes this instance's own 24/7
   * state (fleet.stay247.<n>), so restarts and the entitlement sweep follow it.
   */
  private async busStay247(command: IBotCommand, guild: Guild): Promise<BusOutcome> {
    const params = command.params ?? {};
    const member = await this.memberOf(command, guild);
    if (!member) return { ok: false, message: i18n.__("dashboardPlay.notMember") };
    const { Stay247Service } = await import("./stay247");
    const service = Stay247Service.getInstance();

    if (params.enabled === false) {
      await service.disable(guild);
      const queue = this.playerService?.getQueue(guild.id);
      if (queue && !queue.deleted) PlayerPanelService.getInstance().refresh(queue, true);
      return { ok: true, message: i18n.__mf("fleet.dispatch.stay247Off", { bot: INSTANCE_NAME }) };
    }

    const voice = params.voiceChannelId ? guild.channels.cache.get(params.voiceChannelId) : null;
    if (!voice || !voice.isVoiceBased()) return { ok: false, message: i18n.__("dashboardPlay.channelGone") };
    const textRaw = params.textChannelId ? guild.channels.cache.get(params.textChannelId) : null;
    const text = textRaw && textRaw.type === ChannelType.GuildText ? (textRaw as TextChannel) : null;
    await service.enable(guild, voice, text, member.id);
    const queue = this.playerService?.getQueue(guild.id);
    if (queue && !queue.deleted) PlayerPanelService.getInstance().refresh(queue, true);
    return { ok: true, message: i18n.__mf("fleet.dispatch.stay247On", { bot: INSTANCE_NAME, channel: channelName(voice.id, voice.name) }) };
  }

  /** The member behind a command (dashboard user or forwarded requester), if still in the server. */
  private async memberOf(command: IBotCommand, guild: Guild): Promise<GuildMember | null> {
    const userId = command.userId ?? command.requestedBy?.id ?? "";
    return /^\d{15,25}$/.test(userId) ? await guild.members.fetch(userId).catch(() => null) : null;
  }

  /**
   * "play" from the dashboard or the primary's dispatcher: the same pipeline
   * as /play (limits, quality, requester), with the outcome in plain text.
   */
  private async busPlay(command: IBotCommand, guild: Guild): Promise<BusOutcome> {
    const params = command.params ?? {};
    const query = params.query?.trim() ?? "";
    const fail = (message: string): BusOutcome => ({ ok: false, message });

    try {
      if (!query) return fail(i18n.__("dashboardPlay.noQuery"));

      const member = await this.memberOf(command, guild);
      if (!member) return fail(i18n.__("dashboardPlay.notMember"));

      const gate = await playGate(guild.id, member);
      if (gate) return fail(playRejectionMessage(gate, query, channelName));

      // A play is for this bot's stage: the channel the request names (the
      // primary's hand-off, or the channel picked for an idle stage in the
      // dashboard), else the channel it already plays in, else the requester's.
      // Never the requester's channel over its own session: that would put two
      // bots in one channel, or refuse adding songs from another channel.
      const target = await this.dashboardVoiceChannel(guild, member, params.voiceChannelId, false);
      if (typeof target === "string") return fail(target);

      // /playnow: replacing what plays is a DJ action.
      const before = this.playerService?.getQueue(guild.id);
      const replacing = Boolean(params.now && before && !before.deleted && before.currentTrack);
      if (replacing) {
        const verdict = await canUse(member, "skip");
        if (!verdict.ok) return fail(denialMessage(verdict));
      }

      const collection = params.savedCollection;
      const wasActive = Boolean(before && !before.deleted && (before.currentTrack || before.node.isPlaying()));
      const textChannel = await this.panelChannel(guild, params.textChannelId);
      const play = (q: string) =>
        enqueue({
          guild,
          member,
          voiceChannel: target,
          textChannel,
          query: q,
          next: Boolean(params.next || params.now),
          searchEngine: params.source ? SEARCH_SOURCES[params.source] : undefined
        });

      if (collection) return await this.busPlayCollection(play, query, collection, member, Boolean(params.next) && wasActive);

      const result = await play(query);

      if (replacing && result.position === 1) result.queue.node.skip();
      if (params.radio && typeof params.radio === "object") {
        // /radio station or AI DJ handed over by the primary: start the same session here.
        startRadio(result.queue, params.radio as unknown as RadioRequest, result.track, member.user);
        void ensureAutoplayNext(result.queue).then((added) => added && PlayerPanelService.getInstance().refresh(result.queue));
      } else if (params.autoplay) {
        // /radio: keep going with related songs.
        const metadata = (result.queue.metadata || {}) as QueueMetadata;
        metadata.autoplay = true;
        result.queue.metadata = metadata;
        void ensureAutoplayNext(result.queue).then((added) => added && PlayerPanelService.getInstance().refresh(result.queue));
      }
      return { ok: true, message: this.describePlay(result), queue: result.queue, data: { position: result.position, added: result.added } };
    } catch (error) {
      if (error instanceof PlayRejection) return fail(playRejectionMessage(error, query, channelName));
      if (!(error instanceof PlayError)) console.error("[DashboardSync] ❌ Dashboard play failed:", error);
      return fail(playErrorMessage(error, query));
    }
  }

  /**
   * A saved collection the primary handed over: the first song that plays
   * goes through the play pipeline (a song that can't be found is replaced by
   * the next one, up to three tries, as on the primary); the rest are queued
   * behind it without searching up front.
   */
  private async busPlayCollection(
    play: (query: string) => Promise<EnqueueResult>,
    firstQuery: string,
    collection: NonNullable<BotCommandParams["savedCollection"]>,
    member: GuildMember,
    behindFirst: boolean
  ): Promise<BusOutcome> {
    const tracks = collection.tracks ?? [];
    const candidates = [firstQuery, ...tracks.map(playQueryFor)];
    let result: EnqueueResult | null = null;
    let index = 0;
    let lastError: unknown = null;
    for (; index < Math.min(candidates.length, COLLECTION_FIRST_ATTEMPTS); index++) {
      try {
        result = await play(candidates[index]);
        break;
      } catch (error) {
        lastError = error;
        // Only a song-specific failure is worth another try.
        const songSpecific = error instanceof PlayError || (error instanceof PlayRejection && error.code === "noResults");
        if (!songSpecific) throw error;
      }
    }
    if (!result) throw lastError ?? new PlayRejection("noResults");

    const settings = await GuildSettingsService.getInstance().getSettings(member.guild.id);
    const room = Math.max(0, settings.maxQueueSize - result.queue.tracks.size);
    // candidates[i] is tracks[i - 1]; the songs after the one that played follow it.
    const added = 1 + queueCollectionRest(result.queue, tracks.slice(index), member.user, behindFirst, room);
    PlayerPanelService.getInstance().refresh(result.queue);

    const message = i18n.__mf("dashboardPlay.playlist", { count: added, title: truncate(collection.name || "Collection", 80) });
    return { ok: true, message, queue: result.queue, data: { position: result.position, added } };
  }

  /**
   * Where a dashboard or bus command goes. With `preferMember` (join without
   * a picked channel): the requester's own voice channel first. Otherwise the
   * channel the request names, else the channel the bot is already in, else
   * the requester's. Never some other channel. Returns the channel or a message.
   */
  private async dashboardVoiceChannel(
    guild: Guild,
    member: GuildMember | null,
    requestedId: string | undefined,
    preferMember = true
  ): Promise<VoiceBasedChannel | string> {
    if (preferMember && member?.voice.channel) return member.voice.channel;

    const queue = this.playerService?.getQueue(guild.id);
    const sessionId = (queue && !queue.deleted ? queue.channel?.id : null) ?? guild.members.me?.voice.channelId ?? null;
    const channelId = requestedId || sessionId;
    if (!channelId) return member?.voice.channel ?? i18n.__("dashboardPlay.noVoiceChannel");

    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isVoiceBased()) return i18n.__("dashboardPlay.channelGone");

    // A dashboard manager can only send music where they could listen to it.
    if (member && !channel.permissionsFor(member).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
      return i18n.__mf("dashboardPlay.memberCantJoin", { channel: channelName(channel.id, channel.name) });
    }
    return channel;
  }

  /**
   * Text channel for the player panel when this starts a session: the
   * running session's channel, else the channel the request came from (fleet
   * dispatch), else the 24/7 or first allowed text channel from the server
   * settings, else the system channel.
   */
  private async panelChannel(guild: Guild, preferredId?: string): Promise<TextChannel | null> {
    const queue = this.playerService?.getQueue(guild.id);
    const current = queue && !queue.deleted ? ((queue.metadata || {}) as QueueMetadata).channel : undefined;
    if (current) return current;

    const me = guild.members.me;
    const usable = (id: string | null | undefined): TextChannel | null => {
      const channel = id ? guild.channels.cache.get(id) : null;
      if (!channel || (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement)) return null;
      if (me && !channel.permissionsFor(me).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) return null;
      return channel as TextChannel;
    };

    const settings = await GuildSettingsService.getInstance().getSettings(guild.id).catch(() => null);
    for (const id of [preferredId, stay247Of(settings)?.textChannelId, ...(settings?.allowedTextChannels ?? [])]) {
      const channel = usable(id);
      if (channel) return channel;
    }
    return usable(guild.systemChannelId);
  }

  /** "Now playing: …" / "Added to the queue (#3): …" in plain text. */
  private describePlay(result: EnqueueResult): string {
    const { track, playlist, added, position } = result;
    if (playlist && added > 1) {
      return i18n.__mf("dashboardPlay.playlist", { count: added, title: truncate(playlist.title || "Playlist", 100) });
    }
    const title = truncate(track.author ? `${track.title} — ${track.author}` : track.title, 140);
    if (position === 0) return i18n.__mf("dashboardPlay.nowPlaying", { title });
    return i18n.__mf("dashboardPlay.added", { title, position });
  }

  /**
   * Stop the dashboard sync service
   */
  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    console.log("[DashboardSync] 🛑 Dashboard sync service stopped");
  }
}

export default DashboardSyncService;
