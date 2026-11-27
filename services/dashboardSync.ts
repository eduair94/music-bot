import { GuildQueue, Player, Track } from "discord-player";
import {
    ChannelType,
    Client,
    Guild,
    GuildMember,
    PermissionFlagsBits,
    TextChannel,
    VoiceBasedChannel,
    VoiceChannel
} from "discord.js";
import { Types } from "mongoose";
import { BotCommand, IBotCommand } from "../models/BotCommand";
import { truncate } from "../utils/format";
import { localeForGuild } from "../utils/guildLocale";
import { i18n, runWithLocale } from "../utils/i18n";
import { stay247Of } from "../utils/instance";
import {
    ChannelLabel,
    enqueue,
    EnqueueResult,
    playErrorMessage,
    playGate,
    PlayRejection,
    playRejectionMessage
} from "../utils/playFlow";
import { DiscordPlayerService, isGuessGameQueue, PlayError, QueueMetadata } from "./discordPlayer";
import { clearPlayback, ensurePlaybackIndexes, publishPlayback, startPlaybackRefresher } from "./fleet/playbackState";
import { GuildSettingsService } from "./guildSettings";

/** Outcome of a dashboard play request, already in the server's language. */
type DashboardPlayOutcome = { ok: true; message: string; queue: GuildQueue } | { ok: false; message: string };

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

  /**
   * Process pending commands from the dashboard
   */
  private async processCommands(): Promise<void> {
    try {
      // Process regular player commands
      const commands = await BotCommand.find({ 
        status: "pending",
        guildId: { $exists: true }  // Regular commands have guildId
      })
        .sort({ createdAt: 1 })
        .limit(10);

      for (const command of commands) {
        await this.executeCommand(command as IBotCommand);
      }

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
   * Execute a single command from the dashboard
   */
  private async executeCommand(command: IBotCommand): Promise<void> {
    const { guildId, command: cmd, params, userId, _id } = command;

    if (!_id || !guildId || !cmd) return;

    try {
      // Mark as processing
      if (!(await this.claim(_id))) return;

      console.log(`[DashboardSync] 🎵 Executing command: ${cmd} for guild ${guildId}`);

      const guild = this.client?.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error("Guild not found");
      }

      // Same pipeline, limits and requester as /play.
      if (cmd === "play") {
        await this.executePlay(command, guild);
        return;
      }

      const player = this.playerService?.getPlayer();
      if (!player) {
        throw new Error("Player not initialized");
      }

      // A guess-the-song round owns the player: skip/pause/seek/previous from
      // the web would silence or end it. /guess stop ends the game.
      if (isGuessGameQueue(player.nodes.get(guildId))) {
        const locale = await localeForGuild(guild);
        throw new Error(runWithLocale(locale, () => i18n.__mf("guess.blockedDuringGame", { stop: "/guess stop" })));
      }

      let result: string = "Command executed";

      switch (cmd) {
        case "pause": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.node.pause();
            result = "Paused";
          }
          break;
        }

        case "resume": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.node.resume();
            result = "Resumed";
          }
          break;
        }

        case "skip": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.node.skip();
            result = "Skipped";
          }
          break;
        }

        case "stop": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.delete();
            result = "Stopped";
          }
          break;
        }

        case "volume": {
          const queue = player.nodes.get(guildId);
          if (queue && typeof params?.volume === "number") {
            queue.node.setVolume(Math.min(100, Math.max(0, params.volume)));
            result = `Volume set to ${params.volume}%`;
          }
          break;
        }

        case "shuffle": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.tracks.shuffle();
            result = "Queue shuffled";
          }
          break;
        }

        case "loop": {
          const queue = player.nodes.get(guildId);
          if (queue && params?.loopMode) {
            const mode = params.loopMode === "track" ? 1 : params.loopMode === "queue" ? 2 : 0;
            queue.setRepeatMode(mode);
            result = `Loop mode: ${params.loopMode}`;
          }
          break;
        }

        case "remove": {
          const queue = player.nodes.get(guildId);
          if (queue && typeof params?.position === "number") {
            const tracks = queue.tracks.toArray();
            if (params.position >= 0 && params.position < tracks.length) {
              const track = tracks[params.position];
              queue.tracks.removeOne(t => t.url === track.url);
              result = `Removed: ${track.title}`;
            } else {
              result = "Track not found";
            }
          }
          break;
        }

        case "skipto": {
          const queue = player.nodes.get(guildId);
          if (queue && typeof params?.position === "number") {
            queue.node.skipTo(params.position);
            result = `Skipped to position ${params.position}`;
          }
          break;
        }

        case "move": {
          const queue = player.nodes.get(guildId);
          if (queue && typeof params?.from === "number" && typeof params?.to === "number") {
            const tracks = queue.tracks.toArray();
            if (params.from >= 0 && params.from < tracks.length) {
              const [track] = tracks.splice(params.from, 1);
              tracks.splice(params.to, 0, track);
              queue.tracks.clear();
              tracks.forEach(t => queue.tracks.add(t));
              result = `Moved track from ${params.from} to ${params.to}`;
            }
          }
          break;
        }

        case "clear": {
          const queue = player.nodes.get(guildId);
          if (queue) {
            queue.tracks.clear();
            result = "Queue cleared";
          }
          break;
        }

        case "seek": {
          const queue = player.nodes.get(guildId);
          if (queue && typeof params?.seconds === "number") {
            await queue.node.seek(params.seconds * 1000);
            result = `Seeked to ${params.seconds}s`;
          }
          break;
        }

        case "previous": {
          const queue = player.nodes.get(guildId);
          if (queue && !queue.history.isEmpty()) {
            await queue.history.previous();
            result = "Playing previous track";
          } else {
            result = "No previous track in history";
          }
          break;
        }

        default:
          throw new Error(`Unknown command: ${cmd}`);
      }

      // Mark as completed
      await BotCommand.updateOne(
        { _id },
        { status: "completed", result, processedAt: new Date() }
      );

      // Update playback state after command
      const queue = player.nodes.get(guildId);
      if (queue) {
        await this.updatePlaybackState(queue);
      }

      console.log(`[DashboardSync] ✅ Command completed: ${cmd} - ${result}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[DashboardSync] ❌ Command failed: ${cmd} - ${errorMessage}`);

      await BotCommand.updateOne(
        { _id },
        { status: "failed", error: errorMessage, processedAt: new Date() }
      );
    }
  }

  /**
   * "play" from the dashboard: the same pipeline as /play (limits, quality,
   * requester), with the outcome written back in the server's language.
   */
  private async executePlay(command: IBotCommand, guild: Guild): Promise<void> {
    const locale = await localeForGuild(guild);
    const outcome = await runWithLocale(locale, () => this.dashboardPlay(command, guild));

    if (outcome.ok) {
      await BotCommand.updateOne(
        { _id: command._id },
        { status: "completed", result: outcome.message, processedAt: new Date() }
      );
      await this.updatePlaybackState(outcome.queue);
      console.log(`[DashboardSync] ✅ Command completed: play - ${outcome.message}`);
    } else {
      await BotCommand.updateOne(
        { _id: command._id },
        { status: "failed", error: outcome.message, processedAt: new Date() }
      );
      console.log(`[DashboardSync] ⛔ play refused in guild ${guild.id}: ${outcome.message}`);
    }
  }

  private async dashboardPlay(command: IBotCommand, guild: Guild): Promise<DashboardPlayOutcome> {
    const query = command.params?.query?.trim() ?? "";
    const fail = (message: string): DashboardPlayOutcome => ({ ok: false, message: plainText(message) });

    try {
      if (!query) return fail(i18n.__("dashboardPlay.noQuery"));

      const userId = command.userId ?? "";
      const member = /^\d{15,25}$/.test(userId) ? await guild.members.fetch(userId).catch(() => null) : null;
      if (!member) return fail(i18n.__("dashboardPlay.notMember"));

      const gate = await playGate(guild.id, member);
      if (gate) return fail(playRejectionMessage(gate, query, channelName));

      const target = await this.dashboardVoiceChannel(guild, member, command.params?.voiceChannelId);
      if (typeof target === "string") return fail(target);

      const result = await enqueue({
        guild,
        member,
        voiceChannel: target,
        textChannel: await this.panelChannel(guild),
        query
      });
      return { ok: true, message: this.describePlay(result), queue: result.queue };
    } catch (error) {
      if (error instanceof PlayRejection) return fail(playRejectionMessage(error, query, channelName));
      if (!(error instanceof PlayError)) console.error("[DashboardSync] ❌ Dashboard play failed:", error);
      return fail(playErrorMessage(error, query));
    }
  }

  /**
   * Where a dashboard play goes: the requester's own voice channel, else the
   * channel picked in the dashboard, else the channel the bot is already
   * playing in. Never some other channel. Returns the channel or a message.
   */
  private async dashboardVoiceChannel(
    guild: Guild,
    member: GuildMember,
    requestedId: string | undefined
  ): Promise<VoiceBasedChannel | string> {
    if (member.voice.channel) return member.voice.channel;

    const queue = this.playerService?.getQueue(guild.id);
    const sessionId = (queue && !queue.deleted ? queue.channel?.id : null) ?? guild.members.me?.voice.channelId ?? null;
    const channelId = requestedId || sessionId;
    if (!channelId) return i18n.__("dashboardPlay.noVoiceChannel");

    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isVoiceBased()) return i18n.__("dashboardPlay.channelGone");

    // A dashboard manager can only send music where they could listen to it.
    if (!channel.permissionsFor(member).has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
      return i18n.__mf("dashboardPlay.memberCantJoin", { channel: channelName(channel.id, channel.name) });
    }
    return channel;
  }

  /**
   * Text channel for the player panel when this starts a session: the
   * running session's channel, else the 24/7 or first allowed text channel
   * from the server settings, else the system channel.
   */
  private async panelChannel(guild: Guild): Promise<TextChannel | null> {
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
    for (const id of [stay247Of(settings)?.textChannelId, ...(settings?.allowedTextChannels ?? [])]) {
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
