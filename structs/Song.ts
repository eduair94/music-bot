import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import { exec, spawn } from "child_process";
import fs from 'fs';
import { promisify } from "util";
import youtube from "youtube-sr";
import { MusicPlatform } from "../interfaces/MusicPlatform";
import { SpotifyService } from "../services/spotify";
import { i18n } from "../utils/i18n";
import { isSpotifyUrl, isURL } from "../utils/patterns";
import {
  getExtractorArgs,
  getPlatformInfo,
  validateMusicUrl
} from "../utils/platformDetector";

const execAsync = promisify(exec);

export interface SongData {
  url: string;
  title: string;
  duration: number;
  platform?: MusicPlatform;
  thumbnail?: string;
  artist?: string;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;
  public readonly platform: MusicPlatform;
  public readonly thumbnail?: string;
  public readonly artist?: string;

  public static hasCookies = false;

  public constructor({ url, title, duration, platform, thumbnail, artist }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
    this.platform = platform || MusicPlatform.YouTube;
    this.thumbnail = thumbnail;
    this.artist = artist;
  }

  public static checkCookies() {
    if (this.hasCookies) return true;
    
    try {
      // Check if cookies.txt exists
      if (fs.existsSync("./cookies.txt")) {
        this.hasCookies = true;
        console.log("Cookies file found");
        return true;
      }
    } catch (e) {
      console.log("No cookies file found");
    }
    return false;
  }

  public static async from(url: string = "", search: string = "") {
    this.checkCookies();

    // Check if it's a direct URL
    if (isURL.test(url)) {
      // Special handling for Spotify URLs
      if (isSpotifyUrl(url)) {
        return await this.fromSpotifyUrl(url);
      }

      // Validate the platform
      const validation = validateMusicUrl(url);
      
      if (!validation.valid) {
        let err = new Error(validation.error || "Unsupported URL");
        err.name = "InvalidURL";
        throw err;
      }

      // Get platform information
      const platformInfo = getPlatformInfo(url);
      
      // Handle different platforms
      return await this.fromPlatformUrl(url, platformInfo.platform);
    }

    // If not a URL, search YouTube
    const result = await youtube.searchOne(search);

    if (!result) {
      let err = new Error(`No search results found for ${search}`);
      err.name = "NoResults";
      throw err;
    }

    const videoUrl = `https://youtube.com/watch?v=${result.id}`;
    
    // Get info from yt-dlp for YouTube
    return await this.fromPlatformUrl(videoUrl, MusicPlatform.YouTube);
  }

  /**
   * Create Song from a platform-specific URL
   */
  private static async fromPlatformUrl(url: string, platform: MusicPlatform) {
    try {
      const cookieArg = this.hasCookies ? '--cookies ./cookies.txt' : '';
      const extractorArgs = getExtractorArgs(url);
      
      // Build yt-dlp command with platform-specific args
      const extractorArgsStr = extractorArgs.length > 0 
        ? extractorArgs.join(' ') 
        : '';
      
      // Use tv client - it's not impacted by SABR issues and doesn't require n-challenge solving
      // tv client works with cookies unlike android client
      const youtubeArgs = platform === MusicPlatform.YouTube || platform === MusicPlatform.Spotify
        ? '--extractor-args youtube:player_client=tv,ios'
        : '';
      
      // Performance optimizations:
      // - flat-playlist: Don't resolve playlist items
      // - no-warnings: Skip warning output
      // - skip-download: Only get metadata, don't download
      // - socket-timeout 10: Faster timeout for metadata
      // - extractor-retries 2: Fewer retries for speed
      const perfArgs = '--no-check-certificates --no-warnings --socket-timeout 10 --extractor-retries 2';
      
      const cmd = `yt-dlp --dump-json --no-playlist ${perfArgs} ${youtubeArgs} ${extractorArgsStr} ${cookieArg} "${url}"`;
      
      console.log(`[Song] Running yt-dlp command for: ${url}`);
      
      const { stdout } = await execAsync(cmd, { 
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 60000 // 60 second timeout (reduced from 120)
      });
      const info = JSON.parse(stdout);

      console.log(`[Song] ✅ Got metadata: ${info.title} (${info.duration}s)`);
      return new this({
        url: url,
        title: info.title || "Unknown",
        duration: info.duration || 0,
        platform: platform,
        thumbnail: info.thumbnail || info.thumbnails?.[0]?.url,
        artist: info.uploader || info.artist || info.creator
      });
    } catch (error: any) {
      console.error(`yt-dlp info error for ${platform}:`, error);
      console.error(`Error stderr:`, error.stderr);
      console.error(`Error stdout:`, error.stdout);
      
      // Re-throw the error instead of falling back to Unknown
      // This will allow the error to be properly handled in the play command
      throw error;
    }
  }

  /**
   * Create Song from Spotify URL by bridging to YouTube
   */
  private static async fromSpotifyUrl(url: string): Promise<Song | Song[]> {
    try {
      const spotifyService = SpotifyService.getInstance();

      console.log(`Processing Spotify URL: ${url}`);
      
      // Get YouTube URLs from Spotify
      const youtubeUrls = await spotifyService.processSpotifyUrl(url);
      
      if (!youtubeUrls || youtubeUrls.length === 0) {
        let err = new Error("Could not find matching songs on YouTube for the Spotify track. The song might not be available on YouTube or the search failed.");
        err.name = "NoYouTubeMatch";
        throw err;
      }

      // If multiple tracks (album/playlist), return array
      if (youtubeUrls.length > 1) {
        console.log(`Found ${youtubeUrls.length} tracks from Spotify`);
        const songs: Song[] = [];
        
        for (const ytUrl of youtubeUrls) {
          try {
            const song = await this.fromPlatformUrl(ytUrl, MusicPlatform.Spotify);
            songs.push(song);
          } catch (error) {
            console.error(`Failed to process YouTube URL ${ytUrl}:`, error);
          }
        }
        
        return songs.length > 0 ? songs : songs[0];
      }

      // Single track
      return await this.fromPlatformUrl(youtubeUrls[0], MusicPlatform.Spotify);
    } catch (error) {
      console.error("Spotify processing error:", error);
      throw error;
    }
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    Song.checkCookies();

    try {
      const cookieArg = Song.hasCookies ? ['--cookies', './cookies.txt'] : [];
      const extractorArgs = getExtractorArgs(this.url);
      
      // Use tv client - it's not impacted by SABR issues and doesn't require n-challenge solving
      // tv client works with cookies unlike android client
      const youtubeArgs = (this.platform === MusicPlatform.YouTube || this.platform === MusicPlatform.Spotify)
        ? ['--extractor-args', 'youtube:player_client=tv,ios']
        : [];
      
      // Build yt-dlp arguments based on platform - optimized for speed
      const ytdlpArgs = [
        '--format', this.getFormatString(),
        '--no-playlist',
        '--no-check-certificates',
        '--no-warnings',
        '--extractor-retries', '2',
        '--socket-timeout', '10',
        ...youtubeArgs,
        ...extractorArgs,
        '--output', '-',
        ...cookieArg,
        this.url
      ];

      console.log(`[Song] 🎧 Starting stream: ${this.title}`);
      
      const ytdlpProcess = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Only log errors, not all stderr (reduces noise)
      ytdlpProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('ERROR') || msg.includes('error')) {
          console.error(`[Song] ⚠️ yt-dlp: ${msg}`);
        }
      });

      ytdlpProcess.on('error', (error) => {
        console.error('[Song] ❌ yt-dlp process error:', error);
      });

      // Create audio resource from the stdout stream
      return createAudioResource(ytdlpProcess.stdout, {
        metadata: this,
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });
    } catch (error) {
      console.error("[Song] ❌ yt-dlp streaming error:", error);
      return;
    }
  }

  /**
   * Get the optimal format string for yt-dlp based on platform
   */
  private getFormatString(): string {
    switch (this.platform) {
      case MusicPlatform.SoundCloud:
        // Prefer opus/aac for SoundCloud
        return 'bestaudio[ext=opus]/bestaudio[ext=aac]/bestaudio/best';
      
      case MusicPlatform.Bandcamp:
        // Bandcamp typically has high-quality MP3
        return 'bestaudio[ext=mp3]/bestaudio/best';
      
      case MusicPlatform.YouTube:
      default:
        // YouTube: prefer opus for efficiency
        return 'bestaudio/best';
    }
  }

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
