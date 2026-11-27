import { GuildMember } from "discord.js";
import { isServerAdmin, permissionConfigFor } from "../utils/permissions";
import { GuildSettingsService } from "./guildSettings";

/**
 * Server playlists: collections owned by a server instead of a person, run
 * by its DJs (/playlists). They are ordinary collection documents whose
 * owner key is "guild:<guildId>", so the collection service, views and the
 * Play / Add to queue buttons work on them unchanged.
 *
 * Anyone in the server can list, view, play and copy them. Creating,
 * editing and deleting needs a DJ role from the server's permission rules,
 * or server admin rights (owner, Manage Server, or the admin role in
 * /settings).
 */

const PREFIX = "guild:";

export function serverOwnerKey(guildId: string): string {
  return `${PREFIX}${guildId}`;
}

export function isServerOwnerKey(ownerKey: string): boolean {
  return ownerKey.startsWith(PREFIX);
}

/** The guild id behind a server owner key, or null for a personal collection. */
export function guildOfOwnerKey(ownerKey: string): string | null {
  return isServerOwnerKey(ownerKey) ? ownerKey.slice(PREFIX.length) : null;
}

/** May this member create, edit or delete the server's playlists? */
export async function canManageServerPlaylists(member: GuildMember): Promise<boolean> {
  const settings = await GuildSettingsService.getInstance().getSettings(member.guild.id);
  if (isServerAdmin(member, settings.adminRoleId)) return true;
  const config = await permissionConfigFor(member.guild.id);
  return config.djRoles.some((roleId) => member.roles.cache.has(roleId));
}
