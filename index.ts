import { Client, GatewayIntentBits } from "discord.js";
import { Bot } from "./structs/Bot";

// Keep the bot alive on stray async errors (stream teardown, extractor failures, etc.)
process.on("unhandledRejection", (reason) => {
  console.error("[Process] ❌ Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] ❌ Uncaught exception:", error);
});

// Graceful shutdown: stop voice connections and close connections cleanly
// so restarts (pm2/docker) don't leave the bot lingering in voice channels.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[Process] 🛑 ${signal} received, shutting down...`);

  const timeout = setTimeout(() => {
    console.error("[Process] ⏱️ Shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);

  try {
    const { DiscordPlayerService } = await import("./services/discordPlayer");
    await DiscordPlayerService.getInstance().getPlayer()?.destroy();
  } catch (error) {
    console.error("[Process] Player teardown failed:", error);
  }

  try {
    const { DatabaseService } = await import("./services/database");
    await DatabaseService.getInstance().disconnect();
  } catch (error) {
    console.error("[Process] Database disconnect failed:", error);
  }

  try {
    await bot.client.destroy();
  } catch (error) {
    console.error("[Process] Client destroy failed:", error);
  }

  clearTimeout(timeout);
  console.log("[Process] 👋 Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
// pm2 on Windows signals shutdown via IPC message instead of POSIX signals
process.on("message", (msg) => {
  if (msg === "shutdown") void shutdown("pm2 shutdown");
});

export const bot = new Bot(
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages
    ]
  })
);
