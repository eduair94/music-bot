import "dotenv/config";
import { Config } from "../interfaces/Config";

// Load all config from environment variables (.env file)
const config: Config = {
  TOKEN: process.env.TOKEN || "",
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/music-bot",
  REDIS_URL: process.env.REDIS_URL || "",
  MAX_PLAYLIST_SIZE: parseInt(process.env.MAX_PLAYLIST_SIZE!) || 10,
  PRUNING: process.env.PRUNING === "true",
  STAY_TIME: parseInt(process.env.STAY_TIME!) || 30,
  DEFAULT_VOLUME: parseInt(process.env.DEFAULT_VOLUME!) || 100,
  LOCALE: process.env.LOCALE || "en",
  OWNER_ID: process.env.OWNER_ID || "",
  // Patreon integration
  PATREON_CLIENT_ID: process.env.PATREON_CLIENT_ID || "",
  PATREON_CLIENT_SECRET: process.env.PATREON_CLIENT_SECRET || "",
  PATREON_CREATOR_ACCESS_TOKEN: process.env.PATREON_CREATOR_ACCESS_TOKEN || "",
  PATREON_CAMPAIGN_ID: process.env.PATREON_CAMPAIGN_ID || "",
  PATREON_WEBHOOK_SECRET: process.env.PATREON_WEBHOOK_SECRET || "",
  PATREON_FOUNDER_TIER_ID: process.env.PATREON_FOUNDER_TIER_ID || "",
  // Bot encryption key for linked bots
  BOT_ENCRYPTION_KEY: process.env.BOT_ENCRYPTION_KEY || "",
};

console.log("[Config] ✅ Loaded config from environment variables");

export { config };

