import { AudioResource, createAudioResource } from "@discordjs/voice";
import ytdl from "@distube/ytdl-core"; // ESM
import fs from 'fs';
import { setToken, video_basic_info } from "play-dl"; // Everything
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n";
import { isURL, videoPattern } from "../utils/patterns";

// Cookie parsing function for Netscape cookie format
function parseCookies(cookieString: string): ytdl.Cookie[] {
  const cookies: ytdl.Cookie[] = [];
  
  cookieString.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#') && line.includes('\t')) {
      const parts = line.split('\t');
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0],
          httpOnly: parts[1] === 'TRUE',
          path: parts[2],
          secure: parts[3] === 'TRUE',
          expirationDate: parts[4] !== '0' ? parseInt(parts[4]) : undefined,
          name: parts[5],
          value: parts[6]
        });
      }
    }
  });
  
  return cookies;
}

export interface SongData {
  url: string;
  title: string;
  duration: number;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;

  public static setCookies = false

  public static ytdl: ytdl.Agent

  public constructor({ url, title, duration }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
  }


  public static async set_cookies() {
    if(this.setCookies) return;
    console.log("Set cookies");
    // read cookies.txt file
    try {
      const cookies = fs.readFileSync("./cookies.txt", "utf-8");
      console.log("cookies", cookies);
      const parsedCookies = parseCookies(cookies);
      Song.ytdl = ytdl.createAgent(parsedCookies);
      // pass them to play-dl
      setToken({
        youtube: {
          cookie: cookies
        }
      })

      this.setCookies = true;
    } catch (e) {
      console.error("Error setting cookies:", e);
    }
  }

  public static async from(url: string = "", search: string = "") {
    const isYoutubeUrl = videoPattern.test(url);
    await Song.set_cookies();

    let songInfo;

    if (isYoutubeUrl) {
      songInfo = await video_basic_info(url);

      return new this({
        url: songInfo.video_details.url,
        title: songInfo.video_details.title as string,
        duration: parseInt(songInfo.video_details.durationInSec.toString()) as number
      });
    } else {
      const result = await youtube.searchOne(search);

      result ? null : console.log(`No results found for ${search}`);

      if (!result) {
        let err = new Error(`No search results found for ${search}`);

        err.name = "NoResults";

        if (isURL.test(url)) err.name = "InvalidURL";

        throw err;
      }

      songInfo = await video_basic_info(`https://youtube.com/watch?v=${result.id}`);

      return new this({
        url: songInfo.video_details.url,
        title: songInfo.video_details.title as string,
        duration: parseInt(songInfo.video_details.durationInSec.toString())
      });
    }
  }

  public async makeResource(): Promise<AudioResource<Song> | void> {
    let playStream;
    await Song.set_cookies();

    const source = this.url.includes("youtube") ? "youtube" : "soundcloud";

    if (source === "youtube") {
      if (Song.ytdl) {
        console.log("Use song ytdl");
        // Use the agent to create the stream
        playStream = ytdl(this.url, { 
          filter: "audioonly", 
          highWaterMark: 1 << 25,
          agent: Song.ytdl
        });
      } else {
        // Fallback to regular ytdl if no agent is set
        playStream = ytdl(this.url, { filter: "audioonly", highWaterMark: 1 << 25 });
      }
    }

    if (!playStream) return;

    return createAudioResource(playStream, { metadata: this });
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
