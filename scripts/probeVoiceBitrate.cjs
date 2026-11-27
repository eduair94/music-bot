/**
 * Measure what Discord actually delivers from a bot in a voice channel.
 *
 * Joins the channel as a second bot (a fleet instance), listens to the target
 * bot's audio exactly as a listener's client receives it (after transport and
 * DAVE decryption) and reports the Opus payload bitrate, packets per second
 * and packet sizes. If Discord capped or re-encoded the stream to the channel
 * bitrate, `kbps` shows it.
 *
 * Plain CommonJS, run in a throwaway container next to the bot (the bot's
 * own voice library, discord-voip, cannot receive audio):
 *   mkdir -p /tmp/probe && cp probeVoiceBitrate.cjs /tmp/probe/probe.cjs
 *   docker run --rm -v /tmp/probe:/w -w /w node:22-slim \
 *     npm i --no-audit --no-fund discord.js@14 @discordjs/voice@0.19.2
 *   docker run --rm -v /tmp/probe:/w -w /w -e PROBE_TOKEN=... node:22-slim \
 *     node probe.cjs <guildId> <channelId> <targetBotId> [seconds]
 * Stop the fleet instance that owns PROBE_TOKEN first so the two sessions
 * don't both act on its voice state.
 */
const { Client, GatewayIntentBits } = require("discord.js");
// discord-voip (discord-player's fork) has no receiver; @discordjs/voice does.
const { joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState } = require("@discordjs/voice");

const [guildId, channelId, targetId, secondsArg] = process.argv.slice(2);
const seconds = Number(secondsArg || 20);
if (!guildId || !channelId || !targetId || !process.env.PROBE_TOKEN) {
  console.error("usage: PROBE_TOKEN=... node probe.cjs <guildId> <channelId> <targetBotId> [seconds]");
  process.exit(2);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const fail = (message) => {
  console.log(JSON.stringify({ error: message }));
  process.exit(1);
};
setTimeout(() => fail("timed out"), (seconds + 60) * 1000).unref();

client.once("clientReady", async () => {
  try {
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId);
    const connection = joinVoiceChannel({
      guildId,
      channelId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: true,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

    const stream = connection.receiver.subscribe(targetId, { end: { behavior: EndBehaviorType.Manual } });
    const sizes = [];
    const gaps = [];
    let first = 0;
    let last = 0;
    stream.on("data", (packet) => {
      const now = Date.now();
      if (!first) first = now;
      // A packet is due every 20 ms; anything over 60 ms means frames went missing.
      else if (now - last > 60) gaps.push(now - last);
      last = now;
      sizes.push(packet.length);
    });
    stream.on("error", (error) => fail(`receive: ${error.message}`));

    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    connection.destroy();

    const span = (last - first) / 1000;
    const bytes = sizes.reduce((a, b) => a + b, 0);
    const sorted = [...sizes].sort((a, b) => a - b);
    const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
    console.log(
      JSON.stringify({
        channel: channel?.name,
        channelBitrateKbps: channel?.bitrate ? channel.bitrate / 1000 : null,
        seconds: Number(span.toFixed(1)),
        packets: sizes.length,
        packetsPerSecond: span > 0 ? Number((sizes.length / span).toFixed(1)) : 0,
        kbps: span > 0 ? Number(((bytes * 8) / span / 1000).toFixed(1)) : 0,
        packetBytes: { p10: pct(10), median: pct(50), p90: pct(90), max: sorted[sorted.length - 1] ?? 0 },
        expectedPackets: Math.round(span * 50),
        gaps: { count: gaps.length, longestMs: gaps.length ? Math.max(...gaps) : 0, missingMs: gaps.reduce((a, g) => a + g - 20, 0) },
      })
    );
    client.destroy();
    process.exit(0);
  } catch (error) {
    fail(error.message);
  }
});

client.login(process.env.PROBE_TOKEN).catch((error) => fail(`login: ${error.message}`));
