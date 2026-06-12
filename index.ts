import { Client, GatewayIntentBits } from "discord.js";
import { Bot } from "./structs/Bot";

// Keep the bot alive on stray async errors (stream teardown, extractor failures, etc.)
process.on("unhandledRejection", (reason) => {
  console.error("[Process] ❌ Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Process] ❌ Uncaught exception:", error);
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
