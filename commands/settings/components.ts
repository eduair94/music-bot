import { MessageComponentInteraction, MessageFlags } from "discord.js";
import { registerComponentHandler } from "../../structs/componentRouter";
import { i18n } from "../../utils/i18n";
import { onLogChannelComponent, onTextChannelsComponent, onVoiceChannelsComponent } from "./channelsHandler";
import { onLanguageComponent } from "./customizationHandler";
import { denialMessage } from "../../utils/permissions";
import { settingsVerdict } from "./permissions";
import { onAdminRoleComponent, onDJRoleComponent } from "./rolesHandler";
import { onResetComponent } from "./systemHandler";

/**
 * Persistent handlers for every /settings menu (`settings:<menu>[:<action>]`).
 * They hold no state: the guild comes from the interaction and the choice
 * from the component, so a menu answers after any restart, for as long as
 * the message exists. Each press re-checks the presser's permission.
 */
export type SettingsComponentHandler = (
  interaction: MessageComponentInteraction<"cached">,
  action: string | undefined
) => Promise<unknown>;

const MENUS: Record<string, SettingsComponentHandler> = {
  djrole: onDJRoleComponent,
  adminrole: onAdminRoleComponent,
  voice: onVoiceChannelsComponent,
  text: onTextChannelsComponent,
  log: onLogChannelComponent,
  language: onLanguageComponent,
  reset: onResetComponent
};

registerComponentHandler("settings", async (interaction, args) => {
  if (!interaction.inCachedGuild() || !interaction.isMessageComponent()) return;
  const [menu, action] = args;
  const handler = MENUS[menu];
  if (!handler) return interaction.reply({ content: i18n.__("router.expired"), flags: MessageFlags.Ephemeral });

  const verdict = await settingsVerdict(interaction);
  if (!verdict.ok) return interaction.reply({ content: denialMessage(verdict), flags: MessageFlags.Ephemeral });
  return handler(interaction, action);
});
