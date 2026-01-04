import { DiscordChannel, DiscordGuild, DiscordRole, GuildWithBot } from "@/types/discord";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MANAGE_GUILD_PERMISSION = 0x20; // MANAGE_GUILD permission bit

// Use global cache to persist across hot reloads in development
const globalForCache = globalThis as unknown as {
  discordCache: Map<string, { data: unknown; expires: number; staleData?: unknown }> | undefined;
};

const cache = globalForCache.discordCache ?? new Map<string, { data: unknown; expires: number; staleData?: unknown }>();
if (process.env.NODE_ENV !== "production") {
  globalForCache.discordCache = cache;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
const STALE_TTL = 15 * 60 * 1000; // 15 minutes for stale data fallback

function getCached<T>(key: string, allowStale = false): T | null {
  const cached = cache.get(key);
  if (!cached) return null;
  
  if (cached.expires > Date.now()) {
    return cached.data as T;
  }
  
  // Return stale data if allowed and within stale window
  if (allowStale && cached.staleData) {
    return cached.staleData as T;
  }
  
  cache.delete(key);
  return null;
}

function setCache(key: string, data: unknown, ttl = CACHE_TTL): void {
  cache.set(key, { 
    data, 
    expires: Date.now() + ttl,
    staleData: data // Keep as stale fallback
  });
}

/**
 * Fetch user's guilds from Discord API
 */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const cacheKey = `guilds:${accessToken.slice(-10)}`;
  const cached = getCached<DiscordGuild[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - try to return stale data if available
      const staleData = getCached<DiscordGuild[]>(cacheKey, true);
      if (staleData) {
        console.warn("Rate limited by Discord, using stale cache");
        return staleData;
      }
      const retryAfter = response.headers.get("Retry-After");
      throw new Error(`Rate limited by Discord. Please try again in ${retryAfter || "a few"} seconds.`);
    }
    throw new Error(`Failed to fetch guilds: ${response.statusText}`);
  }

  const guilds = await response.json();
  setCache(cacheKey, guilds); // Use default 5 minute cache
  return guilds;
}

/**
 * Check if user has manage permission for a guild
 */
export function hasManagePermission(permissions: string): boolean {
  const perms = BigInt(permissions);
  return (perms & BigInt(MANAGE_GUILD_PERMISSION)) === BigInt(MANAGE_GUILD_PERMISSION);
}

/**
 * Filter guilds where user can manage
 */
export function filterManageableGuilds(guilds: DiscordGuild[]): DiscordGuild[] {
  return guilds.filter((guild) => hasManagePermission(guild.permissions));
}

/**
 * Get guild icon URL
 */
export function getGuildIconUrl(guild: DiscordGuild, size = 128): string | null {
  if (!guild.icon) return null;
  const format = guild.icon.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${format}?size=${size}`;
}

/**
 * Get guild initials for avatar placeholder
 */
export function getGuildInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Fetch guild channels using bot token
 */
export async function fetchGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  const cacheKey = `channels:${guildId}`;
  const cached = getCached<DiscordChannel[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("Bot token not configured");
  }

  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - try stale cache
      const staleData = getCached<DiscordChannel[]>(cacheKey, true);
      if (staleData) {
        console.warn("Rate limited by Discord for channels, using stale cache");
        return staleData;
      }
      throw new Error("Rate limited by Discord");
    }
    if (response.status === 403) {
      throw new Error("Bot is not in this guild");
    }
    throw new Error(`Failed to fetch channels: ${response.statusText}`);
  }

  const channels = await response.json();
  setCache(cacheKey, channels);
  return channels;
}

/**
 * Fetch guild roles using bot token
 */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const cacheKey = `roles:${guildId}`;
  const cached = getCached<DiscordRole[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("Bot token not configured");
  }

  const response = await fetch(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 429) {
      // Rate limited - try stale cache
      const staleData = getCached<DiscordRole[]>(cacheKey, true);
      if (staleData) {
        console.warn("Rate limited by Discord for roles, using stale cache");
        return staleData;
      }
      throw new Error("Rate limited by Discord");
    }
    if (response.status === 403) {
      throw new Error("Bot is not in this guild");
    }
    throw new Error(`Failed to fetch roles: ${response.statusText}`);
  }

  const roles = await response.json();
  setCache(cacheKey, roles);
  return roles;
}

/**
 * Check if bot is in a specific guild (with caching)
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  const cacheKey = `botInGuild:${guildId}`;
  const cached = getCached<boolean>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  try {
    await fetchGuildChannels(guildId);
    setCache(cacheKey, true, CACHE_TTL * 5); // Cache for 5 minutes
    return true;
  } catch {
    setCache(cacheKey, false, CACHE_TTL); // Cache failures for 1 minute
    return false;
  }
}

/**
 * Get bot invite URL
 * @param clientId - Bot client ID (pass from server or API)
 * @param guildId - Optional guild ID to pre-select
 */
export function getBotInviteUrl(clientId: string, guildId?: string): string {
  const permissions = "3147776"; // Required permissions for music bot
  const scopes = "bot%20applications.commands";
  
  let url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
  
  if (guildId) {
    url += `&guild_id=${guildId}&disable_guild_select=true`;
  }
  
  return url;
}

/**
 * Get bot invite URL (server-side only)
 * Uses environment variable directly - only call from server components/API routes
 */
export function getServerBotInviteUrl(guildId?: string): string {
  const clientId = process.env.DISCORD_BOT_CLIENT_ID || "";
  return getBotInviteUrl(clientId, guildId);
}

/**
 * Enhance guilds with bot presence info (with rate limit protection)
 */
export async function enhanceGuildsWithBotInfo(guilds: DiscordGuild[]): Promise<GuildWithBot[]> {
  // Process guilds in batches of 5 to avoid rate limiting
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
