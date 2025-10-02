import { AudioResource, createAudioResource, StreamType } from "@discordjs/voice";
import { exec, spawn } from "child_process";
import fs from 'fs';
import { promisify } from "util";
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n";
import { isURL, videoPattern } from "../utils/patterns";

const execAsync = promisify(exec);

export interface SongData {
  url: string;
  title: string;
  duration: number;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;

  public static hasCookies = false;

  public constructor({ url, title, duration }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
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
    const isYoutubeUrl = videoPattern.test(url);
    this.checkCookies();

    let videoUrl = url;
    let title = "";
    let duration = 0;

    if (!isYoutubeUrl) {
      // Search for the video
      const result = await youtube.searchOne(search);

      if (!result) {
        let err = new Error(`No search results found for ${search}`);
        err.name = "NoResults";
        if (isURL.test(url)) err.name = "InvalidURL";
        throw err;
      }

      videoUrl = `https://youtube.com/watch?v=${result.id}`;
      title = result.title || "";
      duration = result.duration || 0;
    }

    // Use yt-dlp to get video info with better options
    try {
      const cookieArg = this.hasCookies ? '--cookies ./cookies.txt' : '';
      // Add extractor args to handle YouTube's new restrictions
      const cmd = `yt-dlp --dump-json --no-playlist --extractor-args "youtube:player_client=android" ${cookieArg} "${videoUrl}"`;
      
      const { stdout } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
      const info = JSON.parse(stdout);

      return new this({
        url: videoUrl,
        title: info.title || title || "Unknown",
        duration: info.duration || duration || 0
      });
    } catch (error) {
      console.error("yt-dlp info error:", error);
      // Fallback if yt-dlp fails
      return new this({
        url: videoUrl,
        title: title || "Unknown",
        duration: duration || 0
      });
    }
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    Song.checkCookies();

    try {
      const cookieArg = Song.hasCookies ? ['--cookies', './cookies.txt'] : [];
      
      // Stream audio directly from yt-dlp using spawn
      // Use android client with audio extraction to bypass YouTube's restrictions
      const ytdlpArgs = [
        '--format', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extract-audio', // Extract audio only
        '--audio-format', 'best',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=android;formats=missing_pot', // Allow formats even without PO token
        '--output', '-', // Output to stdout
        '--quiet', // Reduce verbose output
        '--no-warnings', // Suppress warnings in stderr
        ...cookieArg,
        this.url
      ];

      console.log("Starting yt-dlp audio stream with android client...");
      const ytdlpProcess = spawn('yt-dlp', ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Log errors from stderr (only important ones now)
      ytdlpProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        // Only log actual errors, not warnings
        if (msg.includes('ERROR')) {
          console.error(`yt-dlp error: ${msg}`);
        }
      });

      ytdlpProcess.on('error', (error) => {
        console.error('yt-dlp process error:', error);
      });

      // Create audio resource from the stdout stream
      return createAudioResource(ytdlpProcess.stdout, {
        metadata: this,
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });
    } catch (error) {
      console.error("yt-dlp streaming error:", error);
      return;
    }
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
