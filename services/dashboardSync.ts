import { GuildQueue, Player, Track } from "discord-player";
import { Client, VoiceChannel, ChannelType } from "discord.js";
import { PlaybackState, ITrack } from "../models/PlaybackState";
import { BotCommand, IBotCommand } from "../models/BotCommand";
import { DiscordPlayerService, QueueMetadata } from "./discordPlayer";

/**
 * DashboardSyncService - Syncs bot state with the dashboard via MongoDB
 * 
 * This service handles:
 * 1. Writing playback state to MongoDB when player events occur
 * 2. Polling for commands from the dashboard and executing them
 */
export class DashboardSyncService {
  private static instance: DashboardSyncService;
  private client: Client | null = null;
  private player: Player | null = null;
  private playerService: DiscordPlayerService | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
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

    console.log("[DashboardSync] ��� Initializing dashboard sync service...");

    this.client = client;
    this.playerService = DiscordPlayerService.getInstance();
    this.player = this.playerService.getPlayer();

    if (!this.player) {
      console.warn("[DashboardSync] ⚠️ Player not initialized yet, will retry after events are set up");
    }

    // Set up player event listeners for state sync
    this.setupPlayerEventListeners();

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

  /**
   * Update playback state in MongoDB
   */
  private async updatePlaybackState(queue: GuildQueue): Promise<void> {
    if (!queue.guild) return;

    try {
      const guildId = queue.guild.id;
      const metadata = (queue.metadata || {}) as QueueMetadata;
      const voiceChannel = queue.channel as VoiceChannel | null;
      
      // Get current track from metadata workaround or queue.currentTrack
      const currentTrack = metadata.currentTrack || queue.currentTrack;

      // Build the playback state
      const state = {
        guildId,
        isConnected: !!voiceChannel,
        voiceChannelId: voiceChannel?.id || null,
        voiceChannelName: voiceChannel?.name || null,
        textChannelId: metadata.channel?.id || null,
        isPlaying: queue.node.isPlaying(),
        isPaused: queue.node.isPaused(),
        volume: queue.node.volume,
        currentTrack: currentTrack ? this.formatTrack(currentTrack) : null,
        currentPosition: queue.node.streamTime || 0,
        queue: queue.tracks.toArray().slice(0, 50).map(t => this.formatTrack(t)),
        queueSize: queue.tracks.size,
        loopMode: this.getLoopMode(queue),
        audioBitrate: metadata.audioBitrate || 96,
        playbackStartedAt: currentTrack ? new Date() : null,
        lastUpdated: new Date(),
      };

      // Upsert the state
      await PlaybackState.findOneAndUpdate(
        { guildId },
        state,
        { upsert: true, new: true }
      );

      console.log(`[DashboardSync] ��� Updated playback state for guild ${guildId}`);
    } catch (error) {
      console.error("[DashboardSync] ❌ Failed to update playback state:", error);
    }
  }

  /**
   * Clear playback state from MongoDB
   */
  private async clearPlaybackState(guildId?: string): Promise<void> {
    if (!guildId) return;

    try {
      await PlaybackState.deleteOne({ guildId });
      console.log(`[DashboardSync] ���️ Cleared playback state for guild ${guildId}`);
    } catch (error) {
      console.error("[DashboardSync] ❌ Failed to clear playback state:", error);
    }
  }

  /**
   * Format a track for the playback state
   */
  private formatTrack(track: Track): ITrack {
    return {
      title: track.title,
      author: track.author,
      url: track.url,
      thumbnail: track.thumbnail || "",
      duration: track.durationMS,
      requestedBy: {
        id: track.requestedBy?.id || "unknown",
        username: track.requestedBy?.username || "Unknown",
        avatar: track.requestedBy?.avatar || null,
      },
      source: this.getTrackSource(track.source),
    };
  }

  /**
   * Get the loop mode string
   */
  private getLoopMode(queue: GuildQueue): "off" | "track" | "queue" {
    switch (queue.repeatMode) {
      case 1: return "track";
      case 2: return "queue";
      default: return "off";
    }
  }

  /**
   * Get the track source
   */
  private getTrackSource(source: string): "youtube" | "spotify" | "soundcloud" | "file" | "unknown" {
    const s = source.toLowerCase();
    if (s.includes("youtube")) return "youtube";
    if (s.includes("spotify")) return "spotify";
    if (s.includes("soundcloud")) return "soundcloud";
    if (s.includes("attachment") || s.includes("file")) return "file";
    return "unknown";
  }

  /**
   * Start polling for dashboard commands
   */
  private startCommandPolling(): void {
    this.pollInterval = setInterval(async () => {
      await this.processCommands();
    }, 500);

    console.log("[DashboardSync] ��� Started command polling");
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
        type: { $in: ["linked_bot_start", "linked_bot_stop", "linked_bot_restart"] }
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
   * Execute a linked bot command (start/stop/restart)
   */
  private async executeLinkedBotCommand(command: IBotCommand): Promise<void> {
    const { type, botId, _id } = command;

    if (!_id || !botId || !type) return;

    try {
      // Mark as processing
      await BotCommand.updateOne(
        { _id },
        { status: "processing" }
      );

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

  /**
   * Execute a single command from the dashboard
   */
  private async executeCommand(command: IBotCommand): Promise<void> {
    const { guildId, command: cmd, params, userId, _id } = command;

    if (!_id || !guildId || !cmd) return;

    try {
      // Mark as processing
      await BotCommand.updateOne(
        { _id },
        { status: "processing" }
      );

      console.log(`[DashboardSync] 🎵 Executing command: ${cmd} for guild ${guildId}`);

      const guild = this.client?.guilds.cache.get(guildId);
      if (!guild) {
        throw new Error("Guild not found");
      }

      const player = this.playerService?.getPlayer();
      if (!player) {
        throw new Error("Player not initialized");
      }

      let result: string = "Command executed";

      switch (cmd) {
        case "play": {
          if (!params?.query) throw new Error("No query provided");
          
          let voiceChannel: VoiceChannel | null = null;
          
          if (params?.voiceChannelId) {
            const channel = guild.channels.cache.get(params.voiceChannelId);
            if (channel?.type === ChannelType.GuildVoice) {
              voiceChannel = channel as VoiceChannel;
            }
          }
          
          if (!voiceChannel) {
            voiceChannel = guild.channels.cache.find(
              c => c.type === ChannelType.GuildVoice
            ) as VoiceChannel | undefined || null;
          }
          
          if (!voiceChannel) {
            throw new Error("No voice channel available");
          }

          const searchResult = await player.search(params!.query!, {
            requestedBy: undefined,
          });

          if (!searchResult.hasTracks()) {
            throw new Error("No tracks found");
          }

          await player.play(voiceChannel, searchResult, {
            nodeOptions: {
              metadata: {} as QueueMetadata,
            },
          });

          result = `Added: ${searchResult.tracks[0].title}`;
          break;
        }

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
   * Stop the dashboard sync service
   */
  public stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log("[DashboardSync] ��� Dashboard sync service stopped");
  }
}

export default DashboardSyncService;
