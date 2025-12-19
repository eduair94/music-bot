import { Client, GuildMember, TextChannel } from "discord.js";
import { Player, GuildQueue, Track, SearchResult } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { SpotifyExtractor, SoundCloudExtractor } from "@discord-player/extractor";
import fs from "fs";

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

    console.log("[DiscordPlayer]  Initializing discord-player...");

    // Create the player instance
    this.player = new Player(client, {
      skipFFmpeg: false, // We need FFmpeg for transcoding
    });

    // Check for cookies file
    let cookieString: string | undefined;
    try {
      if (fs.existsSync("./cookies.txt")) {
        cookieString = fs.readFileSync("./cookies.txt", "utf-8");
        console.log("[DiscordPlayer]  Found cookies.txt, will use for YouTube authentication");
      }
    } catch (e) {
      console.log("[DiscordPlayer] No cookies file found");
    }

    // Register YoutubeiExtractor for fast YouTube streaming
    try {
      await this.player.extractors.register(YoutubeiExtractor, {
        // Use cookies if available for better reliability
        cookie: cookieString,
        // Stream options for best performance
        streamOptions: {
          useClient: "ANDROID", // ANDROID client is fastest and most reliable
          highWaterMark: 1024 * 1024 * 32, // 32MB buffer for smooth playback
        },
        // Override bridge mode to prefer YouTube Music for better audio quality
        overrideBridgeMode: "ytmusic",
      });
      console.log("[DiscordPlayer] ✅ YoutubeiExtractor registered (YouTube support)");
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
      
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
        const emoji = this.getPlatformEmoji(track.source);
        channel.send(`${emoji} Now playing: **${track.title}** by ${track.author}`).catch(console.error);
      }
    });

    // Track added to queue
    this.player.events.on("audioTrackAdd", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ➕ Added to queue: ${track.title}`);
    });

    // Queue ended
    this.player.events.on("emptyQueue", (queue: GuildQueue) => {
      console.log("[DiscordPlayer]  Queue ended");
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
        channel.send(" Queue finished! Add more songs to keep the music going.").catch(console.error);
      }
    });

    // Error handling
    this.player.events.on("error", (queue: GuildQueue, error: Error) => {
      console.error("[DiscordPlayer] ❌ Player error:", error);
    });

    this.player.events.on("playerError", (queue: GuildQueue, error: Error) => {
      console.error("[DiscordPlayer] ❌ Player error:", error);
      const channel = queue.metadata as TextChannel;
      if (channel && typeof channel.send === "function") {
        channel.send(`❌ Error playing track: ${error.message}`).catch(console.error);
      }
    });

    // Connection events
    this.player.events.on("connection", (queue: GuildQueue) => {
      console.log("[DiscordPlayer]  Connected to voice channel");
    });

    this.player.events.on("disconnect", (queue: GuildQueue) => {
      console.log("[DiscordPlayer]  Disconnected from voice channel");
    });

    // Debug event for troubleshooting
    this.player.events.on("debug", (queue: GuildQueue, message: string) => {
      // Only log important debug messages
      if (message.includes("error") || message.includes("Error")) {
        console.log(`[DiscordPlayer]  Debug: ${message}`);
      }
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

    try {
      console.log(`[DiscordPlayer]  Searching: ${query}`);
      const startTime = Date.now();

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
