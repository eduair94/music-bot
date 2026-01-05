import Redis from "ioredis";
import path from "path";

// Try to load REDIS_URL from config.json if not in environment
let configRedisUrl: string | undefined;
try {
  // When compiled, we're in dist/shared/services/, so we need to go up to project root
  // When running with ts-node, we're in shared/services/
  // Use process.cwd() which should be the project root when running with pm2/npm
  const configPath = path.join(process.cwd(), "config.json");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require(configPath);
  configRedisUrl = config.REDIS_URL;
} catch {
  // config.json not found, will use env vars
}

// Redis key prefixes for organization
export const REDIS_KEYS = {
  // Bot guild presence - which guilds the bot is in
  BOT_GUILDS: "bot:guilds",
  BOT_GUILD: (guildId: string) => `bot:guild:${guildId}`,
  
  // Playback state - real-time player info
  PLAYBACK_STATE: (guildId: string) => `playback:${guildId}`,
  
  // User guilds cache
  USER_GUILDS: (userId: string) => `user:guilds:${userId}`,
  
  // Bot status
  BOT_STATUS: "bot:status",
  BOT_STATS: "bot:stats",
  
  // Command queue (dashboard -> bot)
  COMMAND_QUEUE: (guildId: string) => `commands:${guildId}`,
  
  // Events (bot -> dashboard)
  EVENTS_CHANNEL: "events",
} as const;

// Default TTLs in seconds
export const REDIS_TTL = {
  BOT_GUILDS: 60 * 5, // 5 minutes
  PLAYBACK_STATE: 30, // 30 seconds (refreshed frequently)
  USER_GUILDS: 60 * 2, // 2 minutes
  BOT_STATUS: 60, // 1 minute
} as const;

// Singleton Redis instance
let redisInstance: Redis | null = null;
let subscriberInstance: Redis | null = null;

/**
 * Get or create Redis connection
 */
export function getRedis(): Redis {
  if (!redisInstance) {
    const redisUrl = configRedisUrl || process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379";
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    
    redisInstance.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
    
    redisInstance.on("connect", () => {
      console.log("[Redis] Connected successfully");
    });
  }
  return redisInstance;
}

/**
 * Get Redis subscriber instance for pub/sub
 */
export function getRedisSubscriber(): Redis {
  if (!subscriberInstance) {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379";
    subscriberInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }
  return subscriberInstance;
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const redis = getRedis();
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Close Redis connections
 */
export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
  if (subscriberInstance) {
    await subscriberInstance.quit();
    subscriberInstance = null;
  }
}

// ============ Bot Guild Management ============

/**
 * Register that the bot is in a guild
 */
export async function setBotInGuild(guildId: string, guildData?: object): Promise<void> {
  const redis = getRedis();
  const key = REDIS_KEYS.BOT_GUILD(guildId);
  
  // Store guild data or just a marker
  await redis.set(key, JSON.stringify(guildData || { joined: Date.now() }), "EX", REDIS_TTL.BOT_GUILDS);
  
  // Also add to the set of all guilds
  await redis.sadd(REDIS_KEYS.BOT_GUILDS, guildId);
}

/**
 * Remove bot from guild
 */
export async function removeBotFromGuild(guildId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(REDIS_KEYS.BOT_GUILD(guildId));
  await redis.srem(REDIS_KEYS.BOT_GUILDS, guildId);
}

/**
 * Check if bot is in a guild
 */
export async function isBotInGuildRedis(guildId: string): Promise<boolean> {
  const redis = getRedis();
  const exists = await redis.exists(REDIS_KEYS.BOT_GUILD(guildId));
  return exists === 1;
}

/**
 * Get all guild IDs the bot is in
 */
export async function getBotGuildIds(): Promise<string[]> {
  const redis = getRedis();
  return redis.smembers(REDIS_KEYS.BOT_GUILDS);
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
 * Sync all bot guilds to Redis with detailed data (call on bot startup)
 */
export async function syncBotGuildsWithData(guilds: GuildData[]): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  
  // Clear existing and add all current guilds
  pipeline.del(REDIS_KEYS.BOT_GUILDS);
  if (guilds.length > 0) {
    pipeline.sadd(REDIS_KEYS.BOT_GUILDS, ...guilds.map(g => g.id));
  }
  
  // Set individual guild keys with detailed data
  for (const guild of guilds) {
    pipeline.set(
      REDIS_KEYS.BOT_GUILD(guild.id), 
      JSON.stringify(guild), 
      "EX", 
      REDIS_TTL.BOT_GUILDS
    );
  }
  
  await pipeline.exec();
  console.log(`[Redis] Synced ${guilds.length} guilds with detailed data`);
}

/**
 * Sync all bot guilds to Redis (call on bot startup) - simple version
 */
export async function syncBotGuilds(guildIds: string[]): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  
  // Clear existing and add all current guilds
  pipeline.del(REDIS_KEYS.BOT_GUILDS);
  if (guildIds.length > 0) {
    pipeline.sadd(REDIS_KEYS.BOT_GUILDS, ...guildIds);
  }
  
  // Set individual guild keys
  for (const guildId of guildIds) {
    pipeline.set(
      REDIS_KEYS.BOT_GUILD(guildId), 
      JSON.stringify({ joined: Date.now() }), 
      "EX", 
      REDIS_TTL.BOT_GUILDS
    );
  }
  
  await pipeline.exec();
  console.log(`[Redis] Synced ${guildIds.length} guilds`);
}

/**
 * Get detailed data for a guild
 */
export async function getBotGuildData(guildId: string): Promise<GuildData | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.BOT_GUILD(guildId));
  return data ? JSON.parse(data) : null;
}

/**
 * Get all guilds with their detailed data
 */
export async function getAllBotGuildsData(): Promise<GuildData[]> {
  const redis = getRedis();
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
}

// ============ Playback State ============

/**
 * Update playback state for a guild
 */
export async function setPlaybackState(guildId: string, state: object): Promise<void> {
  const redis = getRedis();
  await redis.set(
    REDIS_KEYS.PLAYBACK_STATE(guildId),
    JSON.stringify(state),
    "EX",
    REDIS_TTL.PLAYBACK_STATE
  );
  
  // Publish event for real-time subscribers
  await redis.publish(REDIS_KEYS.EVENTS_CHANNEL, JSON.stringify({
    type: "playback_update",
    guildId,
    timestamp: Date.now(),
  }));
}

/**
 * Get playback state for a guild
 */
export async function getPlaybackState(guildId: string): Promise<object | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.PLAYBACK_STATE(guildId));
  return data ? JSON.parse(data) : null;
}

/**
 * Clear playback state for a guild
 */
export async function clearPlaybackState(guildId: string): Promise<void> {
  const redis = getRedis();
  await redis.del(REDIS_KEYS.PLAYBACK_STATE(guildId));
}

// ============ Bot Status ============

/**
 * Set bot online status
 */
export async function setBotStatus(status: object): Promise<void> {
  const redis = getRedis();
  await redis.set(REDIS_KEYS.BOT_STATUS, JSON.stringify(status), "EX", REDIS_TTL.BOT_STATUS);
}

/**
 * Get bot status
 */
export async function getBotStatus(): Promise<object | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.BOT_STATUS);
  return data ? JSON.parse(data) : null;
}

// ============ Pub/Sub Events ============

export interface RedisEvent {
  type: string;
  guildId?: string;
  data?: unknown;
  timestamp: number;
}

/**
 * Publish an event
 */
export async function publishEvent(event: RedisEvent): Promise<void> {
  const redis = getRedis();
  await redis.publish(REDIS_KEYS.EVENTS_CHANNEL, JSON.stringify(event));
}

/**
 * Subscribe to events
 */
export function subscribeToEvents(callback: (event: RedisEvent) => void): () => void {
  const subscriber = getRedisSubscriber();
  
  subscriber.subscribe(REDIS_KEYS.EVENTS_CHANNEL);
  
  let isSubscribed = true;
  
  const handler = (channel: string, message: string) => {
    if (!isSubscribed) return;
    if (channel === REDIS_KEYS.EVENTS_CHANNEL) {
      try {
        const event = JSON.parse(message) as RedisEvent;
        callback(event);
      } catch (e) {
        console.error("[Redis] Failed to parse event:", e);
      }
    }
  };
  
  subscriber.on("message", handler);
  
  // Return unsubscribe function
  return () => {
    isSubscribed = false;
    subscriber.unsubscribe(REDIS_KEYS.EVENTS_CHANNEL);
  };
}
