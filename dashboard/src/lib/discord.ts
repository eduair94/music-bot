import { DiscordGuild, GuildWithBot, DiscordChannel, DiscordRole } from "@/types/discord";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const MANAGE_GUILD_PERMISSION = 0x20; // MANAGE_GUILD permission bit

/**
 * Fetch user's guilds from Discord API
 */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetch(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch guilds: ${response.statusText}`);
  }

  return response.json();
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
    if (response.status === 403) {
      throw new Error("Bot is not in this guild");
    }
    throw new Error(`Failed to fetch channels: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch guild roles using bot token
 */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
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
    if (response.status === 403) {
      throw new Error("Bot is not in this guild");
    }
    throw new Error(`Failed to fetch roles: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check if bot is in a specific guild
 */
export async function isBotInGuild(guildId: string): Promise<boolean> {
  try {
    await fetchGuildChannels(guildId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get bot invite URL
 */
export function getBotInviteUrl(guildId?: string): string {
  const clientId = process.env.DISCORD_BOT_CLIENT_ID;
  const permissions = "3147776"; // Required permissions for music bot
  const scopes = "bot%20applications.commands";
  
  let url = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scopes}`;
  
  if (guildId) {
    url += `&guild_id=${guildId}&disable_guild_select=true`;
  }
  
  return url;
}

/**
 * Enhance guilds with bot presence info
 */
export async function enhanceGuildsWithBotInfo(guilds: DiscordGuild[]): Promise<GuildWithBot[]> {
  const enhancedGuilds = await Promise.all(
    guilds.map(async (guild) => {
      const botInGuild = await isBotInGuild(guild.id);
      return {
        ...guild,
        botInGuild,
        hasManagePermission: hasManagePermission(guild.permissions),
      };
    })
  );
  
  return enhancedGuilds;
}
