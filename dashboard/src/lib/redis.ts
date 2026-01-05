import "server-only";
import Redis from "ioredis";

// Redis key prefixes - must match the bot's shared/services/redis.ts
export const REDIS_KEYS = {
  BOT_GUILDS: "bot:guilds",
  BOT_GUILD: (guildId: string) => `bot:guild:${guildId}`,
  PLAYBACK_STATE: (guildId: string) => `playback:${guildId}`,
  USER_GUILDS: (userId: string) => `user:guilds:${userId}`,
  BOT_STATUS: "bot:status",
  BOT_STATS: "bot:stats",
  EVENTS_CHANNEL: "events",
} as const;

// Singleton Redis instance (using globalThis for Next.js hot reload)
const globalForRedis = globalThis as unknown as {
  redisClient: Redis | undefined;
};

function getRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI;
  
  if (!redisUrl) {
    console.log("[Redis] No REDIS_URL configured, Redis features disabled");
    return null;
  }

  if (!globalForRedis.redisClient) {
    globalForRedis.redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    globalForRedis.redisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });

    globalForRedis.redisClient.on("connect", () => {
      console.log("[Redis] Dashboard connected to Redis");
    });
  }

  return globalForRedis.redisClient;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedis();
    if (!redis) return false;
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if bot is in a guild (via Redis)
 */
export async function isBotInGuildRedis(guildId: string): Promise<boolean | null> {
  try {
    const redis = getRedis();
    if (!redis) return null; // Redis not configured
    
    const exists = await redis.exists(REDIS_KEYS.BOT_GUILD(guildId));
    return exists === 1;
  } catch (error) {
    console.error("[Redis] Error checking bot guild:", error);
    return null; // Return null to fall back to Discord API
  }
}

/**
 * Get all guild IDs the bot is in
 */
export async function getBotGuildIds(): Promise<string[] | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    
    return await redis.smembers(REDIS_KEYS.BOT_GUILDS);
  } catch (error) {
    console.error("[Redis] Error getting bot guilds:", error);
    return null;
  }
}

/**
 * Get playback state for a guild
 */
export async function getPlaybackState(guildId: string): Promise<Record<string, unknown> | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    
    const data = await redis.get(REDIS_KEYS.PLAYBACK_STATE(guildId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Redis] Error getting playback state:", error);
    return null;
  }
}

/**
 * Get bot status
 */
export async function getBotStatus(): Promise<Record<string, unknown> | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    
    const data = await redis.get(REDIS_KEYS.BOT_STATUS);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Redis] Error getting bot status:", error);
    return null;
  }
}

/**
 * Guild data interface for admin analytics
 */
export interface GuildData {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
  ownerId: string;
  joinedAt: number;
  isPlaying?: boolean;
}

/**
 * Get detailed data for a specific guild
 */
export async function getBotGuildData(guildId: string): Promise<GuildData | null> {
  try {
    const redis = getRedis();
    if (!redis) return null;
    
    const data = await redis.get(REDIS_KEYS.BOT_GUILD(guildId));
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("[Redis] Error getting guild data:", error);
    return null;
  }
}

/**
 * Get all guilds with their detailed data (for admin page)
 */
export async function getAllBotGuildsData(): Promise<GuildData[]> {
  try {
    const redis = getRedis();
    if (!redis) return [];
    
    const guildIds = await redis.smembers(REDIS_KEYS.BOT_GUILDS);
    
    if (guildIds.length === 0) return [];
    
    const pipeline = redis.pipeline();
    for (const guildId of guildIds) {
      pipeline.get(REDIS_KEYS.BOT_GUILD(guildId));
    }
    
    const results = await pipeline.exec();
    const guilds: GuildData[] = [];
    
    if (results) {
      for (const [err, data] of results) {
        if (!err && data) {
          try {
            guilds.push(JSON.parse(data as string));
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
    
    return guilds;
  } catch (error) {
    console.error("[Redis] Error getting all guilds data:", error);
    return [];
  }
}
