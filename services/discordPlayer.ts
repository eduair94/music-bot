import { AttachmentExtractor, SoundCloudExtractor, SpotifyExtractor } from "@discord-player/extractor";
import { spawn } from "child_process";
import { GuildQueue, Player, Playlist, QueryType, SearchResult, Track, TrackSkipReason } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { ChannelType, Client, GuildMember, TextChannel, User } from "discord.js";
import fs from "fs";
import { PassThrough, Readable } from "stream";
import { normalizeYouTubeQuery } from "../utils/youtubeUrl";
import { GuildSettingsService } from "./guildSettings";

/**
 * Extended metadata interface for queue
 * Used to store additional state that discord-player doesn't track properly
 */
/**
 * In-memory headroom between yt-dlp and FFmpeg, in bytes.  8MB is roughly
 * eight minutes of the ~130kbps Opus stream we select, so most tracks are
 * downloaded in full before playback ever reaches for the tail.  Costs at
 * most this much per concurrently playing guild.  Override with
 * YTDLP_BUFFER_MB.
 */
const YTDLP_BUFFER_BYTES = Math.max(1, Number(process.env.YTDLP_BUFFER_MB) || 8) * 1024 * 1024;

/** One entry of a yt-dlp --flat-playlist listing. */
interface PlaylistEntry {
  id: string;
  title: string;
  duration: number | null;
  uploader: string | null;
}

export interface QueueMetadata {
  /** The text channel where commands are sent */
  channel?: TextChannel;
  /** Current track workaround for when queue.currentTrack is not updated */
  currentTrack?: Track;
  /** Audio bitrate in kbps (e.g., 128, 192, 320) */
  audioBitrate?: number;
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

    // Check if cookies file exists and is a real non-empty file
    const hasCookies = fs.existsSync("./cookies.txt") 
      && fs.statSync("./cookies.txt").isFile() 
      && fs.statSync("./cookies.txt").size > 0;
    if (hasCookies) {
      console.log("[DiscordPlayer] 🍪 Found cookies.txt, will use for YouTube authentication");
    } else {
      console.log("[DiscordPlayer] ⚠️ No cookies.txt found – YouTube may throttle requests (slow loading / AbortError)");
    }

    // Custom stream function that uses yt-dlp for reliable streaming.
    // KEY INSIGHT: return a stream IMMEDIATELY — never await the first data
    // event.  discord-player pipes the returned stream into FFmpeg →
    // AudioResource → AudioPlayer in parallel while the voice connection is
    // being established, so any wait here lets connectionTimeout fire before
    // audio arrives.  Wrapping in a PassThrough is fine (it returns at once);
    // waiting on one is what breaks.
    const createYtDlpStream = async (track: Track): Promise<Readable> => {
      console.log(`[DiscordPlayer] 🎧 Creating yt-dlp stream for: ${track.title}`);
      console.log(`[DiscordPlayer] 🔗 Track URL: ${track.url}`);
      
      if (!track.url) {
        throw new Error(`Track has no URL: ${track.title}`);
      }
      
      const cookieArgs = hasCookies ? ['--cookies', './cookies.txt'] : [];
      
      const ytdlpArgs = [
        '--format', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio*/bestaudio/best',
        '--no-playlist',
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-retries', '3',
        '--socket-timeout', '15',
        '--retries', '3',
        '--fragment-retries', '3',
        '--force-ipv4',
        '--geo-bypass',
        '--js-runtimes', 'node',
        '--output', '-',
        ...cookieArgs,
        track.url,
      ];
      
      if (process.env.PLAYER_DEBUG) {
        console.log(`[DiscordPlayer] 🛠️ yt-dlp args: ${ytdlpArgs.join(' ')}`);
      }

      const proc = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrOutput = '';

      // Buffer yt-dlp's output in memory rather than handing FFmpeg the raw
      // OS pipe.  A pipe only holds ~64KB, so FFmpeg's real-time reads
      // backpressure yt-dlp within a fraction of a second and its HTTP
      // connection then sits idle for minutes at a time.  YouTube drops
      // those idle connections, yt-dlp reconnects (--retries/--fragment-
      // retries), and every reconnect is an audible gap — choppy, robotic
      // playback.  With headroom yt-dlp runs flat out (measured 8-11Mbit/s
      // against the ~130kbps we actually consume) and usually finishes the
      // whole track before playback needs the tail, so the network drops
      // out of the real-time path entirely.
      const buffered = new PassThrough({ highWaterMark: YTDLP_BUFFER_BYTES });
      proc.stdout.pipe(buffered);

      // Log stderr for diagnostics (but don't block on it)
      proc.stderr.on('data', (data: Buffer) => {
        const msg = data.toString().trim();
        stderrOutput += msg + '\n';
        if (msg.includes('ERROR') || msg.includes('error')) {
          console.error(`[DiscordPlayer] ⚠️ yt-dlp stderr: ${msg}`);
        }
      });

      // Failures must reach the buffer, not just stdout: discord-player is
      // reading `buffered`, so destroying stdout alone would look like a
      // clean end-of-stream and play silence instead of skipping the track.
      proc.stdout.on('error', (err) => buffered.destroy(err));

      proc.on('error', (err) => {
        console.error(`[DiscordPlayer] ❌ yt-dlp spawn error:`, err);
        buffered.destroy(err);
      });

      proc.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          const errorLine = stderrOutput.split('\n').find(l => l.includes('ERROR'))?.trim()
            || `yt-dlp exited with code ${code}`;
          console.error(`[DiscordPlayer] ❌ yt-dlp failed for: ${track.title} — ${errorLine}`);
          buffered.destroy(new Error(errorLine));
        }
      });

      // Return the buffer immediately — discord-player's FFmpeg pipeline
      // pulls from it as soon as data lands, so nothing here delays the
      // voice connection handshake.
      return buffered;
    };

    // Register YoutubeiExtractor with custom stream function using yt-dlp
    try {
      await this.player.extractors.register(YoutubeiExtractor, {
        // Stream options for metadata fetching
        // NOTE: these apply to the extractor's own streaming path, which
        // createStream below replaces — the buffer that matters for
        // playback is YTDLP_BUFFER_BYTES inside createYtDlpStream.
        streamOptions: {
          useClient: "IOS",
          highWaterMark: 1024 * 1024 * 10,
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

    const debug = process.env.PLAYER_DEBUG
      ? (...args: unknown[]) => console.log("[DiscordPlayer] [DEBUG]", ...args)
      : () => {};

    // Track start event
    this.player.events.on("playerStart", async (queue: GuildQueue, track: Track) => {
      // Workaround: store current track in queue.metadata using QueueMetadata interface
      const metadata = (queue.metadata || {}) as QueueMetadata;
      metadata.currentTrack = track;
      queue.metadata = metadata;

      console.log(`[DiscordPlayer] ▶️ Now playing: ${track.title} (${track.source}, ${track.duration})`);
      debug("url:", track.url);

      const channel = await this.getLogChannel(queue);
      if (channel) {
        const emoji = this.getPlatformEmoji(track.source);
        channel.send(`${emoji} Now playing: **${track.title}** by ${track.author}`).catch(console.error);
      }
    });

    // Player finish - track finished playing
    this.player.events.on("playerFinish", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ✅ Finished: ${track.title} (${queue.tracks.size} left)`);
      debug("next:", queue.tracks.at(0)?.title || "none", "deleted:", queue.deleted);
    });

    // Player skip - track was skipped
    this.player.events.on("playerSkip", (queue: GuildQueue, track: Track, reason: TrackSkipReason, description: string) => {
      console.log(`[DiscordPlayer] ⏭️ Skipped: ${track.title} (${reason})`);
      debug("description:", description, "queue size:", queue.tracks.size, "playing:", queue.node.isPlaying(), "idle:", queue.node.isIdle());

      // If skip reason is NoStream (ERR_NO_STREAM), the stream extraction failed
      if (reason === TrackSkipReason.NoStream) {
        console.error(`[DiscordPlayer] ❌ Stream extraction failed for: ${track.title}`);
        console.error(`[DiscordPlayer] ❌ Reason: ${description}`);
      }
    });

    // Audio track add
    this.player.events.on("audioTrackAdd", (queue: GuildQueue, track: Track) => {
      console.log(`[DiscordPlayer] ➕ Added to queue: ${track.title} (#${queue.tracks.size})`);
    });

    // Queue ended
    this.player.events.on("emptyQueue", async (queue: GuildQueue) => {
      console.log("[DiscordPlayer] 🏁 Queue ended");
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

    // Debug event - very noisy, enable only with PLAYER_DEBUG=1
    if (process.env.PLAYER_DEBUG) {
      this.player.events.on("debug", (queue: GuildQueue, message: string) => {
        console.log(`[DiscordPlayer] 🐛 Debug: ${message}`);
      });
    }

    // Player trigger - fires when player is about to play a track
    this.player.events.on("playerTrigger", (queue: GuildQueue, track: Track, reason: string) => {
      debug(`trigger: ${track.title} (${reason}, ${queue.tracks.size} remaining)`);
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
      const result = await this.player.search(normalizeYouTubeQuery(query));
      return result;
    } catch (error) {
      console.error("[DiscordPlayer] Search error:", error);
      return null;
    }
  }

  /**
   * Is this a bare YouTube playlist page (post-normalisation)?
   */
  private static isYouTubePlaylistUrl(query: string): boolean {
    try {
      const url = new URL(query);
      return url.host === "www.youtube.com" && url.pathname === "/playlist" && url.searchParams.has("list");
    } catch {
      return false;
    }
  }

  /** Seconds to mm:ss / h:mm:ss, the format discord-player displays. */
  private static formatDuration(seconds: number | null): string {
    if (!seconds || seconds < 0) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const pad = (n: number) => String(n).padStart(2, "0");
    return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
  }

  /**
   * Expand a YouTube / YouTube Music playlist into its entries with yt-dlp.
   *
   * discord-player-youtubei@2 pins youtubei.js ^16, whose parser no longer
   * understands YouTube playlist pages - it returns the playlist title with
   * zero tracks, which reaches the user as "No results found". yt-dlp already
   * streams every track we play and now self-updates on boot, so it is the
   * more durable source for the track list too.
   */
  private expandYouTubePlaylist(
    url: string,
    limit: number
  ): Promise<{ title: string; entries: PlaylistEntry[] } | null> {
    return new Promise((resolve) => {
      const args = [
        "--flat-playlist",
        "--dump-single-json",
        "--no-warnings",
        "--ignore-errors",
        "--playlist-end", String(Math.max(1, limit)),
        "--socket-timeout", "15",
        "--force-ipv4",
        "--geo-bypass",
        "--js-runtimes", "node",
        url,
      ];

      const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";

      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on("error", (err) => {
        console.error("[DiscordPlayer] ❌ yt-dlp playlist spawn error:", err);
        resolve(null);
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          const line = stderr.split("\n").find((l) => l.includes("ERROR"))?.trim() || `exit code ${code}`;
          console.error(`[DiscordPlayer] ❌ Playlist expansion failed: ${line}`);
          return resolve(null);
        }
        try {
          const json = JSON.parse(stdout);
          const entries: PlaylistEntry[] = (json.entries || [])
            .filter((entry: any) => entry && entry.id)
            .map((entry: any) => ({
              id: String(entry.id),
              title: entry.title || "Unknown title",
              duration: typeof entry.duration === "number" ? entry.duration : null,
              uploader: entry.uploader || entry.channel || null,
            }));
          resolve({ title: json.title || "YouTube Playlist", entries });
        } catch (error) {
          console.error("[DiscordPlayer] ❌ Could not parse yt-dlp playlist JSON:", (error as Error).message);
          resolve(null);
        }
      });
    });
  }

  /**
   * Start the first entry through the normal path, then attach the rest of the
   * playlist to the queue as tracks that stream via the same yt-dlp hook.
   */
  private async playExpandedPlaylist(
    voiceChannel: NonNullable<GuildMember["voice"]["channel"]>,
    playlistUrl: string,
    expanded: { title: string; entries: PlaylistEntry[] },
    playOptions: Parameters<Player["play"]>[2],
    requestedBy: User | null,
    audioBitrate: number,
    startTime: number
  ): Promise<{ track: Track; queue: GuildQueue; searchResult: SearchResult; playlist: Playlist | null }> {
    const player = this.player!;
    const [first, ...rest] = expanded.entries;

    const result = await player.play(voiceChannel, `https://www.youtube.com/watch?v=${first.id}`, playOptions);

    // Reuse the extractor discord-player picked for the first track so the
    // remaining ones stream through our yt-dlp createStream hook too.
    const extractor = result.track.extractor;

    const queued = rest.map((entry) => {
      const track = new Track(player, {
        title: entry.title,
        description: "",
        author: entry.uploader || "Unknown",
        url: `https://www.youtube.com/watch?v=${entry.id}`,
        thumbnail: `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
        duration: DiscordPlayerService.formatDuration(entry.duration),
        views: 0,
        requestedBy: requestedBy ?? undefined,
        source: "youtube",
        queryType: QueryType.YOUTUBE_VIDEO,
        raw: entry,
      });
      track.extractor = extractor;
      return track;
    });

    if (queued.length > 0) result.queue.addTrack(queued);

    const allTracks = [result.track, ...queued];
    const playlist = new Playlist(player, {
      title: expanded.title,
      description: "",
      thumbnail: result.track.thumbnail,
      type: "playlist",
      source: "youtube",
      author: { name: first.uploader || "YouTube", url: "" },
      tracks: allTracks,
      id: new URL(playlistUrl).searchParams.get("list") || "",
      url: playlistUrl,
      rawPlaylist: expanded,
    });

    for (const track of allTracks) track.playlist = playlist;
    result.searchResult.setTracks(allTracks).setPlaylist(playlist);

    console.log(
      `[DiscordPlayer] ⚡ Loaded playlist in ${Date.now() - startTime}ms via yt-dlp: ${playlist.title} (${allTracks.length} tracks) @ ${audioBitrate}kbps`
    );

    return { track: result.track, queue: result.queue, searchResult: result.searchResult, playlist };
  }

  /**
   * Play a track in a voice channel
   * This is the main method for instant playback
   */
  public async play(
    voiceChannel: GuildMember["voice"]["channel"],
    query: string,
    textChannel: TextChannel,
    audioBitrate: number = 128, // Default 128kbps for free users
    playlistLimit: number = 100 // Cap on how many playlist entries to enqueue
  ): Promise<{ track: Track; queue: GuildQueue; searchResult: SearchResult; playlist: Playlist | null } | null> {
    if (!this.player || !voiceChannel) {
      console.error("[DiscordPlayer] Player not initialized or no voice channel");
      return null;
    }

    if (this.player.extractors.store.size === 0) {
      console.error("[DiscordPlayer] ❌ No extractors available! Cannot play.");
      throw new Error("No extractors registered. Please restart the bot.");
    }

    try {
      // Drop share/tracking params (YouTube Music always adds &si=).
      // QueryResolver rebuilds any multi-param YouTube link as /watch, which
      // without a video id resolves to nothing — playlists silently vanish.
      query = normalizeYouTubeQuery(query);

      console.log(`[DiscordPlayer] 🔍 Searching: ${query}`);
      const startTime = Date.now();

      // Determine if query is a URL, a local audio file (e.g. generated TTS), or a search term
      const isUrl = query.startsWith('http://') || query.startsWith('https://');
      const isLocalFile = !isUrl && fs.existsSync(query) && fs.statSync(query).isFile();

      // Create metadata object with audio quality info
      const queueMetadata: QueueMetadata = {
        channel: textChannel,
        audioBitrate: audioBitrate,
      };

      // discord-player handles voice connection internally via player.play().
      // With a proper connectionTimeout (120s) there is no need to pre-connect.
      const playOptions: Parameters<Player["play"]>[2] = {
        nodeOptions: {
          metadata: queueMetadata,
          leaveOnEmpty: true,
          leaveOnEmptyCooldown: 300000, // 5 minutes
          leaveOnEnd: false,
          leaveOnEndCooldown: 300000, // 5 minutes
          selfDeaf: true,
          volume: 80,
          bufferingTimeout: 3_000,     // 3s — start with headroom in the buffer, not on the first bytes
          connectionTimeout: 120_000,  // 120s — default; voice DAVE handshake needs time
        },
        requestedBy: textChannel.client.user,
        connectionOptions: {
          deaf: true,
        },
        // Local files go to AttachmentExtractor; non-URL queries are YouTube searches
        searchEngine: isUrl ? undefined : isLocalFile ? QueryType.FILE : "youtube",
      };

      // YouTube playlists never reach the extractor: youtubei.js can no longer
      // parse them, so yt-dlp supplies the track list instead.
      if (DiscordPlayerService.isYouTubePlaylistUrl(query)) {
        const expanded = await this.expandYouTubePlaylist(query, playlistLimit);
        if (expanded && expanded.entries.length > 0) {
          return await this.playExpandedPlaylist(
            voiceChannel,
            query,
            expanded,
            playOptions,
            textChannel.client.user,
            audioBitrate,
            startTime
          );
        }
        console.warn("[DiscordPlayer] ⚠️ yt-dlp found no playlist entries, falling back to the extractor");
      }

      const result = await this.player.play(voiceChannel, query, playOptions);

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
