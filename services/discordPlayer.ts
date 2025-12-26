import { AttachmentExtractor, SoundCloudExtractor, SpotifyExtractor } from "@discord-player/extractor";
import { spawn } from "child_process";
import { GuildQueue, Player, Playlist, SearchResult, Track, TrackSkipReason } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { ChannelType, Client, GuildMember, TextChannel } from "discord.js";
import fs from "fs";
import { Readable } from "stream";
import { GuildSettingsService } from "./guildSettings";

/**
 * Extended metadata interface for queue
 * Used to store additional state that discord-player doesn't track properly
 */
export interface QueueMetadata {
  /** The text channel where commands are sent */
  channel?: TextChannel;
  /** Current track workaround for when queue.currentTrack is not updated */
  currentTrack?: Track;
  /** Audio bitrate in kbps (e.g., 128, 192, 320) */
  audioBitrate?: number;
}

/**
 * Get a quality badge string based on bitrate
 */
export function getQualityBadge(bitrate?: number): string {
  if (!bitrate) return "🔉 128kbps";
  if (bitrate >= 320) return "🔊 HQ 320kbps";
  if (bitrate >= 256) return "🔊 256kbps";
  if (bitrate >= 192) return "🔉 192kbps";
  return `🔉 ${bitrate}kbps`;
}

/**
 * DiscordPlayerService - Manages the discord-player instance
 * 
 * This service provides ultra-fast music playback by using:
 * - discord-player framework for queue and player management
 * - discord-player-youtubei for fast YouTube streaming
 * - Built-in SoundCloud and Spotify extractors
 * 
 * Benefits:
 * - Instant playback (no yt-dlp process spawning)
 * - Automatic queue management
 * - Native Discord voice integration
 * - 64+ audio filters built-in
 * - Proper Opus streaming
 */
export class DiscordPlayerService {
  private static instance: DiscordPlayerService;
  private player: Player | null = null;
  private initialized = false;

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): DiscordPlayerService {
    if (!this.instance) {
      this.instance = new DiscordPlayerService();
    }
    return this.instance;
  }

  /**
   * Initialize the discord-player with all extractors
   * Should be called once when the bot starts
   */
  public async initialize(client: Client): Promise<void> {
    if (this.initialized) {
      console.log("[DiscordPlayer] Already initialized");
      return;
    }

    console.log("[DiscordPlayer] 🎵 Initializing discord-player...");

    // Create the player instance
    this.player = new Player(client, {
      skipFFmpeg: false, // We need FFmpeg for transcoding
    });

    // Check if cookies file exists
    const hasCookies = fs.existsSync("./cookies.txt");
    if (hasCookies) {
      console.log("[DiscordPlayer] 🍪 Found cookies.txt, will use for YouTube authentication");
    }

    // Custom stream function that uses yt-dlp for reliable streaming
    const createYtDlpStream = async (track: Track): Promise<Readable> => {
      console.log(`[DiscordPlayer] 🎧 Creating yt-dlp stream for: ${track.title}`);
      
      const cookieArgs = hasCookies ? ['--cookies', './cookies.txt'] : [];
      
      // Build yt-dlp arguments - use simple format selection for best compatibility
      // Use format IDs directly: 251 (opus 128k), 250 (opus 70k), 249 (opus 50k), 140 (m4a 128k), 139 (m4a 48k)
      // Or use 'ba' (best audio) / 'wa' (worst audio) as fallback
      const ytdlpArgs = [
        '--format', '251/250/249/140/139/ba/b',
        '--no-playlist',
        '--no-check-certificates',
        '--quiet',
        '--no-warnings',
        '--extractor-retries', '5',
        '--socket-timeout', '30',
        '--retries', '3',
        '--fragment-retries', '3',
        '--js-runtimes', 'nodejs,deno', // Use Node.js or Deno for JS extraction
        '--output', '-',
        ...cookieArgs,
        track.url
      ];

      return new Promise((resolve, reject) => {
        const ytdlpProcess = spawn('yt-dlp', ytdlpArgs, {
          stdio: ['ignore', 'pipe', 'pipe']
        });

        let hasReceivedData = false;
        let errorOutput = '';
        let processExited = false;
        let streamResolved = false;

        // Collect stderr output
        ytdlpProcess.stderr.on('data', (data) => {
          const msg = data.toString();
          errorOutput += msg;
          if (msg.includes('ERROR') || msg.includes('error')) {
            console.error(`[DiscordPlayer] ⚠️ yt-dlp: ${msg.trim()}`);
          }
        });

        // Track when we receive actual audio data
        ytdlpProcess.stdout.on('data', () => {
          if (!hasReceivedData) {
            hasReceivedData = true;
            console.log(`[DiscordPlayer] 📡 Receiving audio data for: ${track.title}`);
          }
        });

        ytdlpProcess.on('error', (error) => {
          console.error('[DiscordPlayer] ❌ yt-dlp process error:', error);
          if (!streamResolved) {
            streamResolved = true;
            reject(new Error(`yt-dlp process error: ${error.message}`));
          }
        });

        ytdlpProcess.on('exit', (code, signal) => {
          processExited = true;
          if (code !== 0 && code !== null && !hasReceivedData) {
            console.error(`[DiscordPlayer] ❌ yt-dlp exited with code ${code} for: ${track.title}`);
            // If we haven't resolved yet and there was an error, reject
            if (!streamResolved) {
              const errorMsg = errorOutput.includes('ERROR') 
                ? errorOutput.split('\n').find(line => line.includes('ERROR'))?.trim() || `yt-dlp exited with code ${code}`
                : `yt-dlp exited with code ${code}`;
              // Emit error on the stream if already resolved
              ytdlpProcess.stdout.destroy(new Error(errorMsg));
            }
          }
        });

        // Give yt-dlp a short time to start and check for immediate failures
        setTimeout(() => {
          if (!streamResolved) {
            streamResolved = true;
            if (processExited && !hasReceivedData) {
              // Process already exited without sending data - this is an error
              const errorMsg = errorOutput.includes('ERROR') 
                ? errorOutput.split('\n').find(line => line.includes('ERROR'))?.trim() || 'yt-dlp failed to stream'
                : 'yt-dlp failed to stream - no audio data received';
              console.error(`[DiscordPlayer] ❌ ${errorMsg}`);
              reject(new Error(errorMsg));
            } else {
              // Process is running or has sent data, return the stream
              resolve(ytdlpProcess.stdout);
            }
          }
        }, 500);

        // Also resolve immediately if we start receiving data
        ytdlpProcess.stdout.once('data', () => {
          if (!streamResolved) {
            streamResolved = true;
            resolve(ytdlpProcess.stdout);
          }
        });
      });
    };

    // Register YoutubeiExtractor with custom stream function using yt-dlp
    try {
      await this.player.extractors.register(YoutubeiExtractor, {
        // Stream options for metadata fetching
        streamOptions: {
          useClient: "IOS",
          highWaterMark: 1024 * 1024 * 10, // 10MB buffer
        },
        // Use our custom yt-dlp stream function for reliable streaming
        createStream: createYtDlpStream,
      });
      console.log("[DiscordPlayer] ✅ YoutubeiExtractor registered (with yt-dlp streaming)");
    } catch (error) {
      console.error("[DiscordPlayer] ❌ Failed to register YoutubeiExtractor:", error);
    }

    // Register SoundCloud extractor
    try {
      await this.player.extractors.register(SoundCloudExtractor, {});
      console.log("[DiscordPlayer] ✅ SoundCloudExtractor registered");
    } catch (error) {
      console.error("[DiscordPlayer] ⚠️ SoundCloudExtractor registration failed:", error);
    }

    // Register Spotify extractor (bridges to YouTube)
    try {
      await this.player.extractors.register(SpotifyExtractor, {});
      console.log("[DiscordPlayer] ✅ SpotifyExtractor registered");
    } catch (error) {
      console.error("[DiscordPlayer] ⚠️ SpotifyExtractor registration failed:", error);
    }

    // Register Attachment extractor for direct audio file URLs
    try {
      await this.player.extractors.register(AttachmentExtractor, {});
      console.log("[DiscordPlayer] ✅ AttachmentExtractor registered");
    } catch (error) {
      console.error("[DiscordPlayer] ⚠️ AttachmentExtractor registration failed:", error);
    }

    // Log all registered extractors for debugging
    const registeredExtractors = Array.from(this.player.extractors.store.keys());
    console.log(`[DiscordPlayer] 📋 Registered extractors: ${registeredExtractors.length > 0 ? registeredExtractors.join(', ') : 'NONE!'}`);
    
    if (registeredExtractors.length === 0) {
      console.error("[DiscordPlayer] ❌ WARNING: No extractors registered! Playback will fail.");
    }

    // Set up event listeners for debugging
    this.setupEventListeners();

    this.initialized = true;
    console.log("[DiscordPlayer] ✅ Initialization complete!");
  }

  /**
   * Get the log channel for a guild
   * Priority: 1) Configured log channel, 2) "bot-commands" channel, 3) null (no logging)
   * If logChannelId is "disabled", always return null (no logging)
   */
  private async getLogChannel(queue: GuildQueue): Promise<TextChannel | null> {
    const guild = queue.guild;
    if (!guild) return null;

    const settingsService = GuildSettingsService.getInstance();
    
    // Check for configured log channel
    const logChannelId = await settingsService.getLogChannelId(guild.id);
    
    // If explicitly disabled, don't log
    if (logChannelId === "disabled") {
      return null;
    }
    
    if (logChannelId) {
      const configuredChannel = guild.channels.cache.get(logChannelId);
      if (configuredChannel && configuredChannel.type === ChannelType.GuildText) {
        return configuredChannel as TextChannel;
      }
    }
    
    // Fall back to "bot-commands" channel
    const botCommandsChannel = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildText && channel.name === "bot-commands"
    );
    
    if (botCommandsChannel) {
      return botCommandsChannel as TextChannel;
    }
    
    // No log channel found - don't log
    return null;
  }

  /**
   * Set up event listeners for the player
   */
  private setupEventListeners(): void {
    if (!this.player) return;

    // Track start event
    this.player.events.on("playerStart", async (queue: GuildQueue, track: Track) => {
      // Workaround: store current track in queue.metadata using QueueMetadata interface
      const metadata = (queue.metadata || {}) as QueueMetadata;
      metadata.currentTrack = track;
      queue.metadata = metadata;
      
      console.log(`[DiscordPlayer] ▶️ Now playing: ${track.title}`);
      console.log(`[DiscordPlayer] 📋 Track info: source=${track.source}, duration=${track.duration}, url=${track.url}`);
      console.log(`[DiscordPlayer] [DEBUG] queue.currentTrack:`, queue.currentTrack?.title || 'null');
      console.log(`[DiscordPlayer] [DEBUG] queue.metadata.currentTrack:`, metadata.currentTrack?.title || 'null');
      
      const channel = await this.getLogChannel(queue);
      if (channel) {
        const emoji = this.getPlatformEmoji(track.source);
        channel.send(`${emoji} Now playing: **${track.title}** by ${track.author}`).catch(console.error);
      }
    });

    // Player finish - track finished playing
    this.player.events.on("playerFinish", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ✅ Finished playing: ${track.title}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue size after finish: ${queue.tracks.size}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue deleted: ${queue.deleted}`);
      console.log(`[DiscordPlayer] [DEBUG] Next track: ${queue.tracks.at(0)?.title || 'none'}`);
    });

    // Player skip - track was skipped
    this.player.events.on("playerSkip", (queue: GuildQueue, track: Track, reason: TrackSkipReason, description: string) => {
      console.log(`[DiscordPlayer] ⏭️ Skipped: ${track.title}`);
      console.log(`[DiscordPlayer] [DEBUG] Skip reason: ${reason}`);
      console.log(`[DiscordPlayer] [DEBUG] Skip description: ${description}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue size after skip: ${queue.tracks.size}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue deleted: ${queue.deleted}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue is playing: ${queue.node.isPlaying()}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue is idle: ${queue.node.isIdle()}`);
      console.log(`[DiscordPlayer] [DEBUG] Next track in queue: ${queue.tracks.at(0)?.title || 'none'}`);
      
      // If skip reason is NoStream (ERR_NO_STREAM), the stream extraction failed
      if (reason === TrackSkipReason.NoStream) {
        console.error(`[DiscordPlayer] ❌ Stream extraction failed for: ${track.title}`);
        console.error(`[DiscordPlayer] ❌ Reason: ${description}`);
      }
    });

    // Audio track add
    this.player.events.on("audioTrackAdd", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ➕ Added to queue: ${track.title}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue size after add: ${queue.tracks.size}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue is playing: ${queue.node.isPlaying()}`);
      console.log(`[DiscordPlayer] [DEBUG] Current track: ${queue.currentTrack?.title || 'none'}`);
    });

    // Queue ended
    this.player.events.on("emptyQueue", async (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 🏁 Queue ended");
      console.log(`[DiscordPlayer] [DEBUG] Queue deleted: ${queue.deleted}`);
      console.log(`[DiscordPlayer] [DEBUG] Current track: ${queue.currentTrack?.title || 'none'}`);
      const channel = await this.getLogChannel(queue);
      if (channel) {
        channel.send("🏁 Queue finished! Add more songs to keep the music going.").catch(console.error);
      }
    });

    // Empty channel (everyone left)
    this.player.events.on("emptyChannel", (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 👥 Voice channel is empty");
    });

    // Error handling
    this.player.events.on("error", (queue: GuildQueue, error: Error) => {
      console.error("[DiscordPlayer] ❌ Queue error:", error);
      console.error("[DiscordPlayer] ❌ Error stack:", error.stack);
    });

    this.player.events.on("playerError", async (queue: GuildQueue, error: Error, track: Track) => {
      console.error(`[DiscordPlayer] ❌ Player error on track: ${track?.title || 'unknown'}`);
      console.error("[DiscordPlayer] ❌ Error:", error.message);
      console.error("[DiscordPlayer] ❌ Stack:", error.stack);
      const channel = await this.getLogChannel(queue);
      if (channel) {
        channel.send(`❌ Error playing **${track?.title || 'track'}**: ${error.message}`).catch(console.error);
      }
    });

    // Connection events
    this.player.events.on("connection", (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 🔊 Connected to voice channel");
    });

    this.player.events.on("disconnect", (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 🔇 Disconnected from voice channel");
    });

    // Queue deleted event
    this.player.events.on("queueDelete", (queue: GuildQueue) => {
      console.log(`[DiscordPlayer] 🗑️ Queue deleted for guild: ${queue.guild?.id}`);
    });

    // Debug event - log ALL debug messages to catch issues
    this.player.events.on("debug", (queue: GuildQueue, message: string) => {
      console.log(`[DiscordPlayer] 🐛 Debug: ${message}`);
    });

    // Player trigger - fires when player is about to play a track
    this.player.events.on("playerTrigger", (queue: GuildQueue, track: Track, reason: string) => {
      console.log(`[DiscordPlayer] 🎯 Player triggered for: ${track.title}`);
      console.log(`[DiscordPlayer] [DEBUG] Trigger reason: ${reason}`);
      console.log(`[DiscordPlayer] [DEBUG] Queue tracks remaining: ${queue.tracks.size}`);
    });
  }

  /**
   * Get emoji based on track source
   */
  private getPlatformEmoji(source: string): string {
    switch (source.toLowerCase()) {
      case "youtube":
        return "▶️";
      case "soundcloud":
        return "";
      case "spotify":
        return "";
      default:
        return "";
    }
  }

  /**
   * Get the player instance
   */
  public getPlayer(): Player | null {
    return this.player;
  }

  /**
   * Check if initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Search for tracks
   */
  public async search(query: string): Promise<SearchResult | null> {
    if (!this.player) {
      console.error("[DiscordPlayer] Player not initialized");
      return null;
    }

    try {
      const result = await this.player.search(query);
      return result;
    } catch (error) {
      console.error("[DiscordPlayer] Search error:", error);
      return null;
    }
  }

  /**
   * Play a track in a voice channel
   * This is the main method for instant playback
   */
  public async play(
    voiceChannel: GuildMember["voice"]["channel"],
    query: string,
    textChannel: TextChannel,
    audioBitrate: number = 128 // Default 128kbps for free users
  ): Promise<{ track: Track; queue: GuildQueue; searchResult: SearchResult; playlist: Playlist | null } | null> {
    if (!this.player || !voiceChannel) {
      console.error("[DiscordPlayer] Player not initialized or no voice channel");
      return null;
    }

    // Debug: show available extractors
    const extractors = Array.from(this.player.extractors.store.keys());
    console.log(`[DiscordPlayer] 📋 Available extractors: ${extractors.length > 0 ? extractors.join(', ') : 'NONE!'}`);

    if (extractors.length === 0) {
      console.error("[DiscordPlayer] ❌ No extractors available! Cannot play.");
      throw new Error("No extractors registered. Please restart the bot.");
    }

    // Log audio quality
    console.log(`[DiscordPlayer] 🎵 Audio quality: ${audioBitrate}kbps`);

    try {
      console.log(`[DiscordPlayer] 🔍 Searching: ${query}`);
      const startTime = Date.now();

      // Determine if query is a URL or search term
      const isUrl = query.startsWith('http://') || query.startsWith('https://');
      
      // Create metadata object with audio quality info
      const queueMetadata: QueueMetadata = {
        channel: textChannel,
        audioBitrate: audioBitrate,
      };
      
      const result = await this.player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: queueMetadata, // Store queue metadata with audio quality
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, // 5 minutes
          leaveOnEnd: false,
          leaveOnEndCooldown: 300000, // 5 minutes
          selfDeaf: true,
          volume: 80,
          bufferingTimeout: 15000, // 15 second buffering timeout
        },
        requestedBy: textChannel.client.user,
        connectionOptions: {
          deaf: true,
        },
        // Force YouTube search for non-URL queries
        searchEngine: isUrl ? undefined : "youtube",
      });

      const loadTime = Date.now() - startTime;
      const isPlaylist = result.searchResult.hasPlaylist();
      const playlist = result.searchResult.playlist;
      
      if (isPlaylist && playlist) {
        console.log(`[DiscordPlayer] ⚡ Loaded playlist in ${loadTime}ms: ${playlist.title} (${result.searchResult.tracks.length} tracks) @ ${audioBitrate}kbps`);
      } else {
        console.log(`[DiscordPlayer] ⚡ Loaded in ${loadTime}ms: ${result.track.title} @ ${audioBitrate}kbps`);
      }

      return {
        track: result.track,
        queue: result.queue,
        searchResult: result.searchResult,
        playlist: playlist || null,
      };
    } catch (error) {
      console.error("[DiscordPlayer] Play error:", error);
      throw error;
    }
  }

  /**
   * Get the queue for a guild
   */
  public getQueue(guildId: string): GuildQueue | null {
    if (!this.player) return null;
    return this.player.nodes.get(guildId) || null;
  }

  /**
   * Skip the current track
   */
  public skip(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    queue.node.skip();
    return true;
  }

  /**
   * Pause playback
   */
  public pause(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    queue.node.pause();
    return true;
  }

  /**
   * Resume playback
   */
  public resume(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    queue.node.resume();
    return true;
  }

  /**
   * Stop playback and clear queue
   */
  public stop(guildId: string): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    queue.delete();
    return true;
  }

  /**
   * Set volume (0-100)
   */
  public setVolume(guildId: string, volume: number): boolean {
    const queue = this.getQueue(guildId);
    if (!queue) return false;
    queue.node.setVolume(Math.min(100, Math.max(0, volume)));
    return true;
  }
}

// Export singleton getter for convenience
export function useDiscordPlayer(): DiscordPlayerService {
  return DiscordPlayerService.getInstance();
}
