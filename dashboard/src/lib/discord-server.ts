import "server-only";
import { DiscordGuild, GuildWithBot } from "@/types/discord";
import { getBotGuildIds, isBotInGuildRedis } from "./redis";
import { fetchGuildChannels, hasManagePermission } from "./discord";

// Cache for server-side operations
const serverCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const cached = serverCache.get(key);
  if (!cached) return null;
  if (cached.expires > Date.now()) {
    return cached.data as T;
  }
  serverCache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL): void {
  serverCache.set(key, { data, expires: Date.now() + ttl });
}

/**
 * Check if bot is in a specific guild (server-side only)
 * First checks Redis (fast), then falls back to Discord API (slow)
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  // Try Redis first (much faster, no rate limits)
  const redisResult = await isBotInGuildRedis(guildId);
  if (redisResult !== null) {
    return redisResult;
  }

  // Fall back to Discord API with caching
  const cacheKey = `botInGuild:${guildId}`;
  const cached = getCached<boolean>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    await fetchGuildChannels(guildId);
    setCache(cacheKey, true, CACHE_TTL * 5);
    return true;
  } catch {
    setCache(cacheKey, false, CACHE_TTL);
    return false;
  }
}

/**
 * Enhance guilds with bot presence info (server-side only)
 * Uses Redis for fast bulk lookup when available
 */
export async function enhanceGuildsWithBotInfo(guilds: DiscordGuild[]): Promise<GuildWithBot[]> {
  // Try to get all bot guild IDs from Redis first (fastest)
  const botGuildIds = await getBotGuildIds();
  
  if (botGuildIds !== null) {
    // Fast path: use Redis data
    const botGuildSet = new Set(botGuildIds);
    return guilds.map((guild) => ({
      ...guild,
      botInGuild: botGuildSet.has(guild.id),
      hasManagePermission: hasManagePermission(guild.permissions),
    }));
  }
  
  // Fallback: Process guilds in batches of 5 to avoid rate limiting
  const BATCH_SIZE = 5;
  const results: GuildWithBot[] = [];
  
  for (let i = 0; i < guilds.length; i += BATCH_SIZE) {
    const batch = guilds.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (guild) => {
        const botInGuild = await isBotInGuild(guild.id);
        return {
          ...guild,
          botInGuild,
          hasManagePermission: hasManagePermission(guild.permissions),
        };
      })
    );
    results.push(...batchResults);
    
    // Small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < guilds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}
