/**
 * Offline check of /collections, without logging in to Discord:
 *  - renders the collection view and list (Components V2) with mock data and
 *    validates Discord's limits (components, text length, custom ids);
 *  - resolves real playlist links through the same resolver /collections
 *    import uses (registered discord-player extractors, yt-dlp, linkBridge)
 *    and shows what each stored track becomes when the collection is loaded;
 *  - with --stream, asks yt-dlp to resolve the first stored tracks of each
 *    playlist exactly as playback would (no audio is downloaded).
 *
 * Usage: npx ts-node --transpile-only scripts/testCollections.ts [--stream] [url ...]
 */
import { spawnSync } from "child_process";
import { Client, GatewayIntentBits } from "discord.js";

process.env.TOKEN ||= "dry-run";

const DEFAULT_URLS = [
  "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M", // Today's Top Hits (public)
  "https://open.spotify.com/album/4aawyAB9vmqN3uQ7FjRGTy", // Pitbull - Global Warming
  "https://www.deezer.com/en/playlist/3155776842", // Deezer editorial playlist
  "https://music.apple.com/us/album/a-night-at-the-opera/6781023399", // Queen
  "https://www.youtube.com/playlist?list=PLFgquLnL59alCl_2TQvOiD5Vgm1hCaGSI" // YouTube "Top hits"
];

const problems: string[] = [];

function validate(label: string, components: any[]) {
  const json = components.map((c) => (typeof c.toJSON === "function" ? c.toJSON() : c));
  const ids: string[] = [];
  let text = 0;
  const walk = (nodes: any[]): number =>
    nodes.reduce((n, c) => {
      if (c.custom_id) ids.push(c.custom_id);
      if (typeof c.content === "string") text += c.content.length;
      return n + 1 + walk(c.components ?? []) + (c.accessory ? 1 : 0);
    }, 0);
  const total = walk(json);
  if (total > 40) problems.push(`${label}: ${total} components (max 40)`);
  if (text > 4000) problems.push(`${label}: ${text} characters of text (max 4000)`);
  for (const id of ids) if (id.length > 100) problems.push(`${label}: custom id too long: ${id}`);
  if (new Set(ids).size !== ids.length) problems.push(`${label}: duplicate custom ids ${ids.join(", ")}`);
  console.log(`✓ ${label}: ${total} components, ${text} chars, ids: ${ids.join(" ") || "-"}`);
}

async function renders() {
  const { buildCollectionView, buildCollectionList } = await import("../services/collectionView");
  const { streamUrlFor, playQueryFor } = await import("../services/collectionPlayback");
  const { runWithLocale } = await import("../utils/i18n");

  const mkTrack = (i: number) => ({
    title: `Song number ${i} [Official Video] *bold* @everyone ${"x".repeat(i % 3 === 0 ? 120 : 0)}`,
    author: `Artist ${i}`,
    url: i % 3 === 0 ? `https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQ${i % 10}` : i % 3 === 1 ? `https://www.youtube.com/watch?v=dQw4w9WgXc${i % 10}` : `ytsearch1:Artist ${i} - Song ${i} audio`,
    duration: 180 + i,
    thumbnail: undefined,
    addedAt: new Date()
  });
  const collection: any = {
    _id: "65a1b2c3d4e5f6a7b8c9d0e1",
    userId: "1066182746399055993",
    name: "Road trip *mix* with a very long name that goes on and on and on and on and on and on and on and on",
    description: "Songs for the drive",
    tracks: Array.from({ length: 37 }, (_, i) => mkTrack(i + 1)),
    shareCode: "AbCdEf1234",
    sourceUrl: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"
  };

  for (const locale of ["en", "es"] as const) {
    runWithLocale(locale, () => {
      validate(`view p1 (${locale})`, [buildCollectionView(collection, 0, "📥 Imported **37** tracks from Spotify into **Road trip**.\n-# 3 skipped")]);
      validate(`view p4 (${locale})`, [buildCollectionView(collection, 3)]);
      validate(`view out of range (${locale})`, [buildCollectionView(collection, 99)]);
      validate(`view empty (${locale})`, [buildCollectionView({ ...collection, tracks: [], shareCode: undefined, sourceUrl: undefined }, 0)]);
      const summaries = Array.from({ length: 30 }, (_, i) => ({ id: `65a1b2c3d4e5f6a7b8c9d0${String(i).padStart(2, "0")}`, name: `Collection ${i} ${"y".repeat(80)}`, count: i * 7, shared: i % 4 === 0 }));
      validate(`list 30 (${locale})`, [buildCollectionList("1066182746399055993", summaries)]);
      validate(`list empty (${locale})`, [buildCollectionList("1066182746399055993", [])]);
    });
  }

  const samples = [
    { title: "One More Time", author: "Daft Punk", url: "https://www.youtube.com/watch?v=FGBhQbmPwH8", duration: 320 },
    { title: "Housewife", author: "Tate McRae", url: "https://open.spotify.com/track/2sFepQNyl1WjpROruP8bJ0", duration: 208 },
    { title: "Housewife", author: "Tate McRae", url: "https://open.spotify.com/tracks/33345a6b58796e51557934", duration: 208 },
    { title: "Bohemian Rhapsody", author: "Queen", url: "ytsearch1:Queen - Bohemian Rhapsody audio", duration: 354 },
    { title: "Flickermood", author: "Forss", url: "https://soundcloud.com/forss/flickermood", duration: 213 },
    { title: "No artist song", author: "Unknown", url: "", duration: 0 }
  ] as any[];
  console.log("\nstored url → streamed by yt-dlp → first-song query");
  for (const t of samples) console.log(`  ${t.url || "(empty)"}\n    → ${streamUrlFor(t)}\n    → ${playQueryFor(t)}`);
}

function ytDlpResolves(url: string): string | null {
  const res = spawnSync("yt-dlp", ["--simulate", "--no-warnings", "--no-playlist", "--print", "%(title)s [%(id)s]", url], {
    encoding: "utf8",
    timeout: 60_000
  });
  return res.status === 0 ? res.stdout.trim().split("\n")[0] : null;
}

async function imports(urls: string[], stream: boolean) {
  const { DiscordPlayerService } = await import("../services/discordPlayer");
  const { resolvePlaylist, PLATFORM_NAMES } = await import("../services/collectionImport");
  const { MAX_COLLECTION_TRACKS } = await import("../services/collection");
  const { streamUrlFor, playQueryFor } = await import("../services/collectionPlayback");

  // Same extractors as the bot, on a client that never logs in.
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  await DiscordPlayerService.getInstance().initialize(client);

  for (const url of urls) {
    const started = Date.now();
    try {
      const playlist = await resolvePlaylist(url, null, MAX_COLLECTION_TRACKS);
      console.log(
        `\n✓ ${PLATFORM_NAMES[playlist.platform]} "${playlist.title}": ${playlist.tracks.length} tracks, ${playlist.invalid} invalid, ${Date.now() - started}ms\n  ${url}`
      );
      if (playlist.tracks.length === 0) problems.push(`${url}: no tracks`);
      for (const t of playlist.tracks.slice(0, 3)) {
        console.log(`  • ${t.title} — ${t.author} (${t.duration}s)\n      stored: ${t.url}\n      plays:  ${streamUrlFor(t as any)}  |  first-song query: ${playQueryFor(t as any)}`);
        if (!t.url || !t.title || !t.author || typeof t.duration !== "number") problems.push(`${url}: incomplete track ${JSON.stringify(t)}`);
        if (/open\.spotify\.com\/tracks\//.test(t.url)) problems.push(`${url}: stored a dead Spotify link ${t.url}`);
      }
      if (stream) {
        for (const t of playlist.tracks.slice(0, 2)) {
          const target = streamUrlFor(t as any);
          const found = ytDlpResolves(target);
          console.log(`  ${found ? "▶" : "✗"} yt-dlp ${target} → ${found ?? "FAILED"}`);
          if (!found) problems.push(`${url}: yt-dlp could not resolve ${target}`);
        }
      }
    } catch (error) {
      console.log(`\n✗ ${url}: ${(error as Error).message}`);
      problems.push(`${url}: ${(error as Error).message}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const stream = args.includes("--stream");
  const urls = args.filter((a) => a.startsWith("http"));
  await renders();
  await imports(urls.length ? urls : DEFAULT_URLS, stream);

  if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):\n - ${problems.join("\n - ")}`);
    process.exit(1);
  }
  console.log("\nAll checks passed.");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
