import { BaseInteraction } from "discord.js";
import type { PermissionResult } from "../../shared/permissions";
import { canUse } from "../../utils/permissions";

/**
 * The server's "settings" rule for the member behind an interaction: Manage
 * Server, the admin role configured with /settings adminrole, or whoever the
 * rule allows. Checked on every command and on every settings button/menu
 * press, since an old menu can be pressed by anyone who can see it.
 */
export function settingsVerdict(interaction: BaseInteraction<"cached">): Promise<PermissionResult> {
  return canUse(interaction, "settings");
}

/** Whether the member behind an interaction may change bot settings. */
export async function canManageSettings(interaction: BaseInteraction<"cached">): Promise<boolean> {
  return (await settingsVerdict(interaction)).ok;
}
