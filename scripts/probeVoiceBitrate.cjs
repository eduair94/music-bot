/**
 * Measure what Discord actually delivers from a bot in a voice channel.
 *
 * Joins the channel as a second bot (a fleet instance), listens to the target
 * bot's audio exactly as a listener's client receives it (after transport and
 * DAVE decryption) and reports the Opus payload bitrate, packets per second
 * and packet sizes. If Discord capped or re-encoded the stream to the channel
 * bitrate, `kbps` shows it.
 *
 * Plain CommonJS so it runs inside the production image, which ships no
 * TypeScript sources:
 *   docker cp scripts/probeVoiceBitrate.cjs music-bot:/app/probe.cjs
 *   docker exec -e PROBE_TOKEN=... music-bot node probe.cjs <guildId> <channelId> <targetBotId> [seconds]
 */
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, EndBehaviorType, VoiceConnectionStatus, entersState } = require("discord-voip");

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
    let first = 0;
    let last = 0;
    stream.on("data", (packet) => {
      const now = Date.now();
      if (!first) first = now;
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
      })
    );
    client.destroy();
    process.exit(0);
  } catch (error) {
    fail(error.message);
  }
});

client.login(process.env.PROBE_TOKEN).catch((error) => fail(`login: ${error.message}`));
