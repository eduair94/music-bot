import { GuildMember, PermissionsBitField } from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";

/**
 * Check if a user has DJ permission
 * 
 * DJ permission is granted if:
 * 1. User is a server admin (ManageGuild permission)
 * 2. No DJ role is configured (everyone has DJ access)
 * 3. User has the configured DJ role
 * 
 * @param member The guild member to check
 * @returns Promise<boolean> Whether the user has DJ permission
 */
export async function hasDJPermission(member: GuildMember): Promise<boolean> {
  const guildId = member.guild.id;
  const settingsService = GuildSettingsService.getInstance();
  
  // Server admins always have DJ permission
  const isAdmin = member.permissions.has(PermissionsBitField.Flags.ManageGuild);
  
  // Get user roles as array of IDs
  const userRoles = member.roles.cache.map((r) => r.id);
  
  return settingsService.hasDJPermission(guildId, userRoles, isAdmin);
}

/**
 * Commands that require DJ permission
 */
export const DJ_COMMANDS = [
  "skip",
  "stop", 
  "pause",
  "resume",
  "shuffle",
  "remove",
  "skipto",
  "move",
  "loop",
  "volume"
];
