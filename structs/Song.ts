import { AudioResource, createAudioResource } from "@discordjs/voice";
import ytdl from "@distube/ytdl-core"; // ESM
import { stream, video_basic_info } from "play-dl"; // Everything
import youtube from "youtube-sr";
import { i18n } from "../utils/i18n";
import { isURL, videoPattern } from "../utils/patterns";

export interface SongData {
  url: string;
  title: string;
  duration: number;
}

export class Song {
  public readonly url: string;
  public readonly title: string;
  public readonly duration: number;

  public constructor({ url, title, duration }: SongData) {
    this.url = url;
    this.title = title;
    this.duration = duration;
  }

  public static async from(url: string = "", search: string = "") {
    const isYoutubeUrl = videoPattern.test(url);

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

    const source = this.url.includes("youtube") ? "youtube" : "soundcloud";

    if (source === "youtube") {
      playStream = ytdl(this.url, { filter: "audioonly", highWaterMark: 1 << 25 });
    }

    if (!playStream || !stream) return;

    return createAudioResource(playStream, { metadata: this });
  }

  public startMessage() {
    return i18n.__mf("play.startedPlaying", { title: this.title, url: this.url });
  }
}
