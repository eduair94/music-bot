import "dotenv/config";
import path from "path";
import { Config } from "../interfaces/Config";

let config: Config;

try {
  // Load from project root config.json
  // Use process.cwd() which is the project root when running with pm2/npm
  const configPath = path.join(process.cwd(), "config.json");
  config = require(configPath);
  console.log("[Config] ✅ Loaded config from config.json");
} catch (error) {
  console.log("[Config] ⚠️ config.json not found, using environment variables");
  config = {
    TOKEN: process.env.TOKEN || "",
    MONGODB_URI: process.env.MONGODB_URI || "",
    REDIS_URL: process.env.REDIS_URL || "",
    MAX_PLAYLIST_SIZE: parseInt(process.env.MAX_PLAYLIST_SIZE!) || 10,
    PRUNING: process.env.PRUNING === "true" ? true : false,
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
}

if (!config.MONGODB_URI) {
  console.log("[Config] ⚠️ MONGODB_URI is not set. Using default local MongoDB.");
  config.MONGODB_URI = "mongodb://localhost:27017/music-bot";
}

export { config };

