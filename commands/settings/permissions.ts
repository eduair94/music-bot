import { BaseInteraction, PermissionFlagsBits } from "discord.js";
import { GuildSettingsService } from "../../services/guildSettings";

/**
 * Whether the member behind an interaction may change bot settings: Manage
 * Server, or the admin role configured with /settings adminrole. Checked on
 * every command and on every settings button/menu press, since an old menu
 * can be pressed by anyone who can see it.
 */
export async function canManageSettings(interaction: BaseInteraction<"cached">): Promise<boolean> {
  const member = interaction.member;
  const isServerAdmin = member?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;
  const roles = member?.roles.cache.map((role) => role.id) ?? [];
  return GuildSettingsService.getInstance().canManageSettings(interaction.guildId, roles, isServerAdmin);
}
