import Redis from "ioredis";
import { FleetEvent, fleetKeys, LivePlaybackState, idlePlaybackState } from "../fleet";

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
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379";
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
 * Write one instance's playback state: `playback:<guildId>:<n>` (contract
 * shape), plus the legacy `playback:<guildId>` key for instance 1 (old
 * shape, for readers that predate the fleet), and publish it on
 * `bypass:events:<guildId>` for the dashboard's live stream.
 */
export async function setPlaybackState(
  guildId: string,
  instance: number,
  state: LivePlaybackState,
  legacyState?: object
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.set(fleetKeys.playback(guildId, instance), JSON.stringify(state), "EX", REDIS_TTL.PLAYBACK_STATE);
  if (instance === 1 && legacyState) {
    pipeline.set(REDIS_KEYS.PLAYBACK_STATE(guildId), JSON.stringify(legacyState), "EX", REDIS_TTL.PLAYBACK_STATE);
    pipeline.publish(
      REDIS_KEYS.EVENTS_CHANNEL,
      JSON.stringify({ type: "playback_update", guildId, timestamp: Date.now() })
    );
  }
  pipeline.publish(fleetKeys.events(guildId), JSON.stringify({ type: "playback", instance, state } satisfies FleetEvent));
  await pipeline.exec();
}

/**
 * Get playback state for a guild (legacy key, instance 1)
 */
export async function getPlaybackState(guildId: string): Promise<object | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.PLAYBACK_STATE(guildId));
  return data ? JSON.parse(data) : null;
}

/** One instance's playback state, or null when it has none in this server. */
export async function getInstancePlaybackState(guildId: string, instance: number): Promise<LivePlaybackState | null> {
  const data = await getRedis().get(fleetKeys.playback(guildId, instance));
  if (!data) return null;
  try {
    return JSON.parse(data) as LivePlaybackState;
  } catch {
    return null;
  }
}

/**
 * Clear one instance's playback state and tell live dashboards it is idle.
 */
export async function clearPlaybackState(guildId: string, instance = 1): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.del(fleetKeys.playback(guildId, instance));
  if (instance === 1) pipeline.del(REDIS_KEYS.PLAYBACK_STATE(guildId));
  pipeline.publish(
    fleetKeys.events(guildId),
    JSON.stringify({ type: "playback", instance, state: idlePlaybackState(guildId, instance) } satisfies FleetEvent)
  );
  await pipeline.exec();
}

// ============ Bot Status ============

/**
 * Set an instance's online status (`bot:status:<n>`; instance 1 also keeps
 * the legacy `bot:status` the admin console reads).
 */
export async function setBotStatus(status: object, instance = 1): Promise<void> {
  const redis = getRedis();
  const json = JSON.stringify({ ...status, instance });
  const pipeline = redis.pipeline();
  pipeline.set(fleetKeys.status(instance), json, "EX", REDIS_TTL.BOT_STATUS);
  if (instance === 1) pipeline.set(REDIS_KEYS.BOT_STATUS, json, "EX", REDIS_TTL.BOT_STATUS);
  await pipeline.exec();
}

/**
 * Get bot status (legacy key, instance 1)
 */
export async function getBotStatus(): Promise<object | null> {
  const redis = getRedis();
  const data = await redis.get(REDIS_KEYS.BOT_STATUS);
  return data ? JSON.parse(data) : null;
}

/** An instance's heartbeat, or null when it is not running. */
export async function getInstanceStatus(instance: number): Promise<{ online?: boolean } | null> {
  const data = await getRedis().get(fleetKeys.status(instance));
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ============ Fleet presence ============

/** Seconds the per-instance guild set survives without a refresh (refreshed every 3 min). */
const INSTANCE_GUILDS_TTL = 10 * 60;

/** Replace the set of guilds an instance is in (`bot:guilds:<n>`). */
export async function syncInstanceGuilds(instance: number, guildIds: string[]): Promise<void> {
  const key = fleetKeys.guilds(instance);
  const pipeline = getRedis().pipeline();
  pipeline.del(key);
  if (guildIds.length > 0) {
    pipeline.sadd(key, ...guildIds);
    pipeline.expire(key, INSTANCE_GUILDS_TTL);
  }
  await pipeline.exec();
}

export async function addInstanceGuild(instance: number, guildId: string): Promise<void> {
  const key = fleetKeys.guilds(instance);
  await getRedis().pipeline().sadd(key, guildId).expire(key, INSTANCE_GUILDS_TTL).exec();
}

export async function removeInstanceGuild(instance: number, guildId: string): Promise<void> {
  await getRedis().srem(fleetKeys.guilds(instance), guildId);
}

export async function isInstanceInGuild(instance: number, guildId: string): Promise<boolean> {
  return (await getRedis().sismember(fleetKeys.guilds(instance), guildId)) === 1;
}

/** Publish a fleet event to a guild's live stream (`bypass:events:<guildId>`). */
export async function publishGuildEvent(guildId: string, event: FleetEvent): Promise<void> {
  await getRedis().publish(fleetKeys.events(guildId), JSON.stringify(event));
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
