import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import play, { YouTubeStream, SoundCloudStream, video_basic_info, search, validate, InfoData, SoundCloudTrack } from "play-dl";
import { MusicPlatform } from "../interfaces/MusicPlatform";
import { i18n } from "../utils/i18n";
import { isSpotifyUrl } from "../utils/patterns";
import { SpotifyService } from "../services/spotify";

export interface SongFastData {
  url: string;
  title: string;
  duration: number;
  platform?: MusicPlatform;
  thumbnail?: string;
  artist?: string;
}

/**
 * SongFast class - Uses play-dl for significantly faster streaming
 * This is an optimized alternative to the yt-dlp based Song class
 * 
 * Benefits over yt-dlp:
 * - No process spawning overhead
 * - Native Node.js streaming
 * - Built-in caching and optimization
 * - Proper Opus/WebM handling for Discord
 * - Faster startup time
 */
export class SongFast {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public readonly platform: MusicPlatform;
  public readonly thumbnail?: string;
  public readonly artist?: string;

  // Cache for video info to avoid re-fetching
  private static infoCache = new Map<string, { info: InfoData; timestamp: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

  public constructor({ url, title, duration, platform, thumbnail, artist }: SongFastData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
    this.platform = platform || MusicPlatform.YouTube;
    this.thumbnail = thumbnail;
    this.artist = artist;
  }

  /**
   * Clean up expired cache entries
   */
  private static cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.infoCache) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.infoCache.delete(key);
      }
    }
  }

  /**
   * Create a SongFast from URL or search query using play-dl
   * Much faster than yt-dlp approach
   */
  public static async from(url: string = "", searchQuery: string = ""): Promise<SongFast | SongFast[]> {
    // Clean cache periodically
    this.cleanCache();

    // Handle Spotify URLs
    if (isSpotifyUrl(url)) {
      return await this.fromSpotifyUrl(url);
    }

    // Check if it's a valid URL
    const validationType = await validate(url).catch(() => false as const);

    if (validationType === "yt_video") {
      return await this.fromYouTubeUrl(url);
    }

    if (validationType === "so_track") {
      return await this.fromSoundCloudUrl(url);
    }

    if (validationType === "yt_playlist") {
      // For playlists, return error - should use playlist command
      let err = new Error("YouTube playlists should be handled by the /playlist command");
      err.name = "UsePlaylistCommand";
      throw err;
    }

    if (validationType === "so_playlist") {
      let err = new Error("SoundCloud playlists should be handled by the /playlist command");
      err.name = "UsePlaylistCommand";
      throw err;
    }

    // Not a valid URL - treat as search query
    const query = url || searchQuery;
    if (!query) {
      let err = new Error("No search query provided");
      err.name = "NoQuery";
      throw err;
    }

    return await this.fromSearch(query);
  }

  /**
   * Search YouTube and create a SongFast from the first result
   */
  private static async fromSearch(query: string): Promise<SongFast> {
    console.log(`[SongFast] 🔍 Searching YouTube for: ${query}`);
    
    const searchResults = await search(query, {
      limit: 1,
      source: { youtube: "video" }
    });

    if (!searchResults || searchResults.length === 0) {
      let err = new Error(`No search results found for: ${query}`);
      err.name = "NoResults";
      throw err;
    }

    const video = searchResults[0];
    
    console.log(`[SongFast] ✅ Found: ${video.title} (${video.durationInSec}s)`);

    return new this({
      url: video.url,
      title: video.title || "Unknown",
      duration: video.durationInSec || 0,
      platform: MusicPlatform.YouTube,
      thumbnail: video.thumbnails?.[0]?.url,
      artist: video.channel?.name
    });
  }

  /**
   * Create a SongFast from a YouTube URL
   */
  private static async fromYouTubeUrl(url: string): Promise<SongFast> {
    console.log(`[SongFast] 📺 Processing YouTube URL: ${url}`);

    // Check cache first
    const cached = this.infoCache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[SongFast] 💾 Using cached info for: ${cached.info.video_details.title}`);
      return new this({
        url: cached.info.video_details.url,
        title: cached.info.video_details.title || "Unknown",
        duration: cached.info.video_details.durationInSec || 0,
        platform: MusicPlatform.YouTube,
        thumbnail: cached.info.video_details.thumbnails?.[0]?.url,
        artist: cached.info.video_details.channel?.name
      });
    }

    const info = await video_basic_info(url);
    
    // Cache the info
    this.infoCache.set(url, { info, timestamp: Date.now() });

    console.log(`[SongFast] ✅ Got metadata: ${info.video_details.title} (${info.video_details.durationInSec}s)`);

    return new this({
      url: info.video_details.url,
      title: info.video_details.title || "Unknown",
      duration: info.video_details.durationInSec || 0,
      platform: MusicPlatform.YouTube,
      thumbnail: info.video_details.thumbnails?.[0]?.url,
      artist: info.video_details.channel?.name
    });
  }

  /**
   * Create a SongFast from a SoundCloud URL
   */
  private static async fromSoundCloudUrl(url: string): Promise<SongFast> {
    console.log(`[SongFast] 🔊 Processing SoundCloud URL: ${url}`);

    const info = await play.soundcloud(url);

    if (info.type === "playlist") {
      let err = new Error("SoundCloud playlists should be handled by the /playlist command");
      err.name = "UsePlaylistCommand";
      throw err;
    }

    const track = info as SoundCloudTrack;
    console.log(`[SongFast] ✅ Got metadata: ${track.name} (${track.durationInSec}s)`);

    return new this({
      url: track.url,
      title: track.name || "Unknown",
      duration: track.durationInSec || 0,
      platform: MusicPlatform.SoundCloud,
      thumbnail: track.thumbnail,
      artist: track.user?.name
    });
  }

  /**
   * Create SongFast from Spotify URL by bridging to YouTube
   */
  private static async fromSpotifyUrl(url: string): Promise<SongFast | SongFast[]> {
    console.log(`[SongFast] 🎧 Processing Spotify URL: ${url}`);

    try {
      const spotifyService = SpotifyService.getInstance();
      
      // Get YouTube URLs from Spotify
      const youtubeUrls = await spotifyService.processSpotifyUrl(url);
      
      if (!youtubeUrls || youtubeUrls.length === 0) {
        let err = new Error("Could not find matching songs on YouTube for the Spotify track");
        err.name = "NoYouTubeMatch";
        throw err;
      }

      // If multiple tracks (album/playlist), return array
      if (youtubeUrls.length > 1) {
        console.log(`[SongFast] Found ${youtubeUrls.length} tracks from Spotify`);
        const songs: SongFast[] = [];
        
        for (const ytUrl of youtubeUrls) {
          try {
            const song = await this.fromYouTubeUrl(ytUrl);
            // Mark as Spotify platform for proper emoji
            (song as any).platform = MusicPlatform.Spotify;
            songs.push(song);
          } catch (error) {
            console.error(`Failed to process YouTube URL ${ytUrl}:`, error);
          }
        }
        
        return songs.length > 0 ? songs : songs[0];
      }

      // Single track
      const song = await this.fromYouTubeUrl(youtubeUrls[0]);
      // Mark as Spotify platform for proper emoji
      (song as any).platform = MusicPlatform.Spotify;
      return song;
    } catch (error) {
      console.error("Spotify processing error:", error);
      throw error;
    }
  }

  /**
   * Create an audio resource using play-dl's optimized streaming
   * This is MUCH faster than spawning yt-dlp processes
   */
  public async makeResource(): Promise<AudioResource<SongFast> | void> {
    try {
      console.log(`[SongFast] 🎧 Starting fast stream: ${this.title}`);

      let streamData: YouTubeStream | SoundCloudStream;

      if (this.platform === MusicPlatform.SoundCloud) {
        // SoundCloud streaming
        streamData = await play.stream(this.url);
      } else {
        // YouTube streaming (including Spotify which bridges to YouTube)
        streamData = await play.stream(this.url, {
          quality: 2, // Highest quality
        });
      }

      console.log(`[SongFast] ✅ Stream ready (type: ${streamData.type})`);

      // Create audio resource with proper stream type
      const resource = createAudioResource(streamData.stream, {
        metadata: this,
        inputType: this.mapStreamType(streamData.type),
        inlineVolume: true
      });

      return resource;
    } catch (error) {
      console.error("[SongFast] ❌ Streaming error:", error);
      return;
    }
  }

  /**
   * Map play-dl stream types to @discordjs/voice StreamType
   */
  private mapStreamType(playDlType: string): StreamType {
    switch (playDlType) {
      case "opus":
        return StreamType.Opus;
      case "ogg/opus":
        return StreamType.OggOpus;
      case "webm/opus":
        return StreamType.WebmOpus;
      default:
        return StreamType.Arbitrary;
    }
  }

  /**
   * Get the start message for this song
   */
  public startMessage() {
    const platformEmoji = this.getPlatformEmoji();
    const artistInfo = this.artist ? ` by ${this.artist}` : '';
    return `${platformEmoji} ${i18n.__mf("play.startedPlaying", { title: this.title, url: this.url })}${artistInfo}`;
  }

  /**
   * Get emoji representation for the platform
   */
  private getPlatformEmoji(): string {
    switch (this.platform) {
      case MusicPlatform.YouTube:
        return '▶️';
      case MusicPlatform.SoundCloud:
        return '🔊';
      case MusicPlatform.Bandcamp:
        return '🎵';
      case MusicPlatform.Spotify:
        return '🎧';
      case MusicPlatform.Audiomack:
        return '🎶';
      case MusicPlatform.Mixcloud:
        return '☁️';
      default:
        return '🎵';
    }
  }
}
