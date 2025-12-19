import { SoundCloudExtractor, SpotifyExtractor } from "@discord-player/extractor";
import { spawn } from "child_process";
import { GuildQueue, Player, SearchResult, Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Client, GuildMember, TextChannel } from "discord.js";
import fs from "fs";
import { Readable } from "stream";

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
      
      // Build yt-dlp arguments - use tv client for best compatibility
      const ytdlpArgs = [
        '--format', 'bestaudio/best',
        '--no-playlist',
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-retries', '3',
        '--socket-timeout', '30',
        '--extractor-args', 'youtube:player_client=tv,ios',
        '--output', '-',
        ...cookieArgs,
        track.url
      ];

      const ytdlpProcess = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Log any errors from yt-dlp
      ytdlpProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('ERROR') || msg.includes('error')) {
          console.error(`[DiscordPlayer] ⚠️ yt-dlp: ${msg}`);
        }
      });

      ytdlpProcess.on('error', (error) => {
        console.error('[DiscordPlayer] ❌ yt-dlp process error:', error);
      });

      return ytdlpProcess.stdout;
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
   * Set up event listeners for the player
   */
  private setupEventListeners(): void {
    if (!this.player) return;

    // Track start event
    this.player.events.on("playerStart", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ▶️ Now playing: ${track.title}`);
      console.log(`[DiscordPlayer] 📋 Track info: source=${track.source}, duration=${track.duration}, url=${track.url}`);
      
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
        const emoji = this.getPlatformEmoji(track.source);
        channel.send(`${emoji} Now playing: **${track.title}** by ${track.author}`).catch(console.error);
      }
    });

    // Player finish - track finished playing
    this.player.events.on("playerFinish", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ✅ Finished playing: ${track.title}`);
    });

    // Player skip - track was skipped
    this.player.events.on("playerSkip", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ⏭️ Skipped: ${track.title}`);
    });

    // Audio track add
    this.player.events.on("audioTrackAdd", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ➕ Added to queue: ${track.title}`);
    });

    // Queue ended
    this.player.events.on("emptyQueue", (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 🏁 Queue ended");
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
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

    this.player.events.on("playerError", (queue: GuildQueue, error: Error, track: Track) => {
      console.error(`[DiscordPlayer] ❌ Player error on track: ${track?.title || 'unknown'}`);
      console.error("[DiscordPlayer] ❌ Error:", error.message);
      console.error("[DiscordPlayer] ❌ Stack:", error.stack);
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
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

    // Debug event - log ALL debug messages to catch issues
    this.player.events.on("debug", (queue: GuildQueue, message: string) => {
      console.log(`[DiscordPlayer] 🐛 Debug: ${message}`);
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
    textChannel: TextChannel
  ): Promise<{ track: Track; queue: GuildQueue } | null> {
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

    try {
      console.log(`[DiscordPlayer] 🔍 Searching: ${query}`);
      const startTime = Date.now();

      // Determine if query is a URL or search term
      const isUrl = query.startsWith('http://') || query.startsWith('https://');
      
      const result = await this.player.play(voiceChannel, query, {
        nodeOptions: {
          metadata: textChannel, // Store text channel for event messages
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, // 5 minutes
          leaveOnEnd: false,
          leaveOnEndCooldown: 300000, // 5 minutes
          selfDeaf: true,
          volume: 80,
          bufferingTimeout: 3000, // 3 second buffering timeout for fast start
        },
        requestedBy: textChannel.client.user,
        connectionOptions: {
          deaf: true,
        },
        // Force YouTube search for non-URL queries
        searchEngine: isUrl ? undefined : "youtube",
      });

      const loadTime = Date.now() - startTime;
      console.log(`[DiscordPlayer] ⚡ Loaded in ${loadTime}ms: ${result.track.title}`);

      return {
        track: result.track,
        queue: result.queue,
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
