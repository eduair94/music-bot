/**
 * Test script: actual voice playback in a real Discord channel.
 *
 * Usage:  npx ts-node tests/testPlayback.ts
 *
 * Approach matrix (set APPROACH env var, default "A"):
 *   A – Native IOS streaming (no yt-dlp, youtube.js handles everything)
 *   B – Built-in useYoutubeDL via youtube-dl-exec (experimental flag)
 *   C – Custom createStream returning direct URL string (yt-dlp -g)
 *   D – Custom createStream returning raw stdout (like built-in, no waiting)
 */

import { Player, Track } from "discord-player";
import { YoutubeiExtractor } from "discord-player-youtubei";
import { getVoiceConnection } from "discord-voip";
import { ChannelType, Client, GatewayIntentBits, TextChannel } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import { spawn } from "child_process";

// Load .env
dotenv.config();

// ──── Configuration ──────────────────────────────────────────
const VOICE_CHANNEL_ID = "1356745876474957855";
const QUERY = "Mi nombre es Ricardo";
const PLAYBACK_SECONDS = 30;
const APPROACH = (process.env.APPROACH || "A").toUpperCase();
// ─────────────────────────────────────────────────────────────

// Load token
let TOKEN = process.env.TOKEN || "";
if (!TOKEN) {
  try {
    const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"));
    TOKEN = config.TOKEN;
  } catch {}
}
if (!TOKEN) {
  console.error("❌ No TOKEN found in .env or config.json");
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────
function ts() {
  return `[${new Date().toISOString().slice(11, 23)}]`;
}

const hasCookies =
  fs.existsSync("./cookies.txt") &&
  fs.statSync("./cookies.txt").isFile() &&
  fs.statSync("./cookies.txt").size > 0;

// ── Approach C: createStream that returns a direct URL string ──
const createStreamURL = async (track: Track): Promise<string> => {
  console.log(`${ts()} 🔗 [C] Extracting direct URL via yt-dlp -g for: ${track.url}`);
  return new Promise((resolve, reject) => {
    const args = [
      "--format", "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio*/bestaudio/best",
      "--get-url",
      "--no-playlist",
      "--no-check-certificates",
      "--force-ipv4",
      "--geo-bypass",
      "--js-runtimes", "node",
      ...(hasCookies ? ["--cookies", "./cookies.txt"] : []),
      track.url,
    ];
    const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`yt-dlp -g failed (${code}): ${err.trim().slice(0, 300)}`));
      const url = out.trim().split("\n")[0];
      console.log(`${ts()} 🔗 [C] Got URL: ${url.slice(0, 120)}…`);
      resolve(url);
    });
  });
};

// ── Approach D: createStream that returns stdout immediately (like built-in) ──
const createStreamRawStdout = async (track: Track): Promise<Readable> => {
  console.log(`${ts()} 🎧 [D] Spawning yt-dlp raw stdout for: ${track.url}`);
  const args = [
    "--format", "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio[ext=opus]/bestaudio*/bestaudio/best",
    "--no-playlist",
    "--no-check-certificates",
    "--no-warnings",
    "--force-ipv4",
    "--geo-bypass",
    "--js-runtimes", "node",
    "--output", "-",
    ...(hasCookies ? ["--cookies", "./cookies.txt"] : []),
    track.url,
  ];
  const proc = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) console.log(`${ts()} ⚠️  [D] yt-dlp stderr: ${msg}`);
  });
  proc.on("error", (e) => console.error(`${ts()} ❌ [D] yt-dlp error:`, e.message));
  proc.on("exit", (code, sig) => console.log(`${ts()} 🔚 [D] yt-dlp exit code=${code} signal=${sig}`));

  // Return stdout immediately — no waiting, no PassThrough.
  // This matches how discord-player-youtubei's built-in useYoutubeDL works.
  return proc.stdout as unknown as Readable;
};

// ── main ─────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log(`  🧪 PLAYBACK TEST — "${QUERY}" — Approach ${APPROACH}`);
  console.log("═══════════════════════════════════════════════════\n");

  const approaches: Record<string, string> = {
    A: "Native IOS streaming (youtube.js, no yt-dlp)",
    B: "Built-in useYoutubeDL (youtube-dl-exec)",
    C: "Custom createStream → direct URL string (yt-dlp -g)",
    D: "Custom createStream → raw stdout (like built-in)",
  };
  console.log(`${ts()} 📋 Approach ${APPROACH}: ${approaches[APPROACH] || "UNKNOWN"}\n`);

  const t0 = Date.now();

  // 1. Create client & login
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
    ],
  });

  console.log(`${ts()} 🔑 Logging in…`);
  await client.login(TOKEN);

  await new Promise<void>((res) => {
    if (client.isReady()) return res();
    client.once("ready", () => res());
  });
  console.log(`${ts()} ✅ Logged in as ${client.user?.username}  (${Date.now() - t0}ms)`);

  // 2. Resolve the voice channel
  const voiceChannel = await client.channels.fetch(VOICE_CHANNEL_ID);
  if (!voiceChannel || voiceChannel.type !== ChannelType.GuildVoice) {
    console.error("❌ Could not find voice channel", VOICE_CHANNEL_ID);
    process.exit(1);
  }
  console.log(`${ts()} 🔊 Target VC: #${voiceChannel.name} in ${voiceChannel.guild.name}`);

  const textChannel = voiceChannel.guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText
  ) as TextChannel | undefined;
  if (!textChannel) {
    console.error("❌ No text channel found in guild");
    process.exit(1);
  }

  // 3. Create Player with debug enabled
  const player = new Player(client, { skipFFmpeg: false });

  // Enable debug logging from discord-player internals
  player.on("debug", (msg) => console.log(`${ts()} [dp-debug] ${msg}`));
  player.events.on("debug", (_queue, msg) => console.log(`${ts()} [dp-queue-debug] ${msg}`));

  // 4. Register extractor based on approach
  const extractorOpts: any = {
    streamOptions: {
      useClient: "IOS",
      highWaterMark: 1024 * 1024 * 10,
    },
  };

  switch (APPROACH) {
    case "A":
      // Pure native — no custom stream, no yt-dlp
      break;
    case "B":
      // Built-in experimental yt-dlp via youtube-dl-exec
      extractorOpts.useYoutubeDL = true;
      break;
    case "C":
      // Return a URL string — FFmpeg downloads it directly
      extractorOpts.createStream = createStreamURL;
      break;
    case "D":
      // Return raw stdout immediately — matches built-in pattern
      extractorOpts.createStream = createStreamRawStdout;
      break;
    default:
      console.error(`❌ Unknown APPROACH "${APPROACH}". Use A, B, C, or D.`);
      process.exit(1);
  }

  await player.extractors.register(YoutubeiExtractor, extractorOpts);
  console.log(`${ts()} � Extractor registered  (${Date.now() - t0}ms)`);

  // 5. Play the track — let discord-player handle voice connection internally
  console.log(`${ts()} 🔍 Searching & playing: "${QUERY}"…`);
  const playStart = Date.now();

  // Listen for events
  player.events.on("playerStart", (queue, track) => {
    console.log(`\n${ts()} 🎶 ✅ NOW PLAYING: ${track.title} — ${track.author}`);
    console.log(`${ts()} ⏱️  Login → audio: ${Date.now() - t0}ms`);
    console.log(`${ts()} ⏱️  play() → audio: ${Date.now() - playStart}ms`);
    console.log(`\n${ts()} 🔊 Listening for ${PLAYBACK_SECONDS}s then exiting…\n`);
  });

  player.events.on("playerSkip", (_queue, track, reason, description) => {
    console.error(`${ts()} ⏭️ SKIPPED: ${track.title} reason=${reason} desc=${description}`);
  });

  player.events.on("playerError", (_queue, error) => {
    console.error(`${ts()} ❌ Player error:`, error.message);
    console.error(error.stack);
  });

  player.events.on("error", (_queue, error) => {
    console.error(`${ts()} ❌ Queue error:`, error.message);
    console.error(error.stack);
  });

  player.events.on("connection", (queue) => {
    console.log(`${ts()} 🔌 Voice connection established for guild: ${queue.guild.name}`);
  });

  try {
    const result = await player.play(voiceChannel, QUERY, {
      nodeOptions: {
        metadata: { channel: textChannel },
        leaveOnEmpty: false,
        leaveOnEnd: false,
        selfDeaf: true,
        volume: 80,
        // Use discord-player defaults (120s connection, 1s buffering)
        bufferingTimeout: 1_000,
        connectionTimeout: 120_000,
      },
      requestedBy: client.user!,
      searchEngine: "youtube",
    });

    const loadTime = Date.now() - playStart;
    console.log(`${ts()} ⚡ player.play() resolved in ${loadTime}ms`);
    console.log(`${ts()} 🎵 Track: ${result.track.title} — ${result.track.author} (${result.track.duration})`);
  } catch (error: any) {
    console.error(`${ts()} ❌ Play failed:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }

  // 6. Let it play for a while then exit
  setTimeout(async () => {
    console.log(`\n${ts()} ⏹️  Test complete — stopping playback`);
    try {
      const conn = getVoiceConnection(voiceChannel.guild.id);
      conn?.destroy();
      await player.destroy();
    } catch { /* ignore */ }
    console.log(`${ts()} 👋 Exiting`);
    process.exit(0);
  }, PLAYBACK_SECONDS * 1000);
}

main().catch((err) => {
  console.error("💥 Unhandled:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("💥 UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  console.error("💥 UNHANDLED REJECTION:", err);
  process.exit(1);
});
