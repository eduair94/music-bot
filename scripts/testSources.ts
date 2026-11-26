/**
 * Resolve one link per source with the same extractors the bot registers,
 * without logging in to Discord. Usage: npx ts-node --transpile-only scripts/testSources.ts
 */
import { AppleMusicExtractor, SoundCloudExtractor, SpotifyExtractor, VimeoExtractor } from "@discord-player/extractor";
import { Player, QueryType } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { Client } from "discord.js";

const QUERIES: [string, string][] = [
  ["youtube search", "daft punk one more time"],
  ["youtube link", "https://www.youtube.com/watch?v=fJ9rUzIMcZQ"],
  ["spotify track", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],
  ["spotify playlist", "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"],
  ["apple music", "https://music.apple.com/us/album/bohemian-rhapsody/1440650428?i=1440650711"],
  ["soundcloud", "https://soundcloud.com/forss/flickermood"],
  ["soundcloud search", "lofi chill"]
];

async function main() {
  const client = new Client({ intents: [] });
  const player = new Player(client as any);
  await player.extractors.register(YoutubeiExtractor, {});
  await player.extractors.register(SoundCloudExtractor, {});
  await player.extractors.register(SpotifyExtractor, {});
  await player.extractors.register(AppleMusicExtractor, {});
  await player.extractors.register(VimeoExtractor, {});

  for (const [label, query] of QUERIES) {
    const started = Date.now();
    try {
      const engine = label === "soundcloud search" ? QueryType.SOUNDCLOUD_SEARCH : query.startsWith("http") ? QueryType.AUTO : QueryType.YOUTUBE_SEARCH;
      const result = await player.search(query, { searchEngine: engine });
      const first = result.tracks[0];
      console.log(
        `${result.isEmpty() ? "✗" : "✓"} ${label.padEnd(17)} ${String(Date.now() - started).padStart(5)}ms ` +
          `${result.tracks.length} tracks ${result.playlist ? `(playlist "${result.playlist.title}") ` : ""}` +
          `${first ? `→ ${first.title} — ${first.author} [${first.duration}] via ${first.extractor?.identifier}` : ""}`
      );
    } catch (error) {
      console.log(`✗ ${label.padEnd(17)} ERROR ${(error as Error).message.slice(0, 160)}`);
    }
  }
  process.exit(0);
}

main();
