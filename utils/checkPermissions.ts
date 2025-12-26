import { ChatInputCommandInteraction, PermissionResolvable } from "discord.js";
import { Command } from "../interfaces/Command";

export interface PermissionResult {
  result: boolean;
  missing: string[];
}

export async function checkPermissions(
  command: Command,
  interaction: ChatInputCommandInteraction
): Promise<PermissionResult> {
  if (!command.permissions) return { result: true, missing: [] };

  // Try to get from cache first, only fetch if needed
  const botId = interaction.client.user!.id;
  const member = interaction.guild!.members.cache.get(botId) 
    ?? await interaction.guild!.members.fetch({ user: botId });
  
  const requiredPermissions = command.permissions as PermissionResolvable[];
  const missing = member.permissions.missing(requiredPermissions);

  return { result: !Boolean(missing.length), missing };
}
