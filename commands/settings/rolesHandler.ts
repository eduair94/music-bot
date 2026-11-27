import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageComponentInteraction,
  MessageFlags,
  RoleSelectMenuBuilder
} from "discord.js";
import { GuildSettingsService } from "../../services/guildSettings";
import { i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

export async function handleDJRole({ interaction }: SettingsHandlerContext) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("settings:djrole")
    .setPlaceholder(i18n.__("settings.djrole.placeholder"))
    .setMinValues(0)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("settings:djrole:clear")
    .setLabel(i18n.__("settings.djrole.clear"))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  return interaction.reply({
    content: i18n.__("settings.djrole.prompt"),
    components: [row1, row2],
    flags: MessageFlags.Ephemeral
  });
}

export async function onDJRoleComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  const settingsService = GuildSettingsService.getInstance();
  if (action === "clear") {
    await settingsService.updateSettings(interaction.guildId, { djRoleId: null });
    return interaction.update({ content: i18n.__("settings.djrole.clearedEveryone"), components: [] });
  }
  if (!interaction.isRoleSelectMenu()) return;
  const roleId = interaction.values[0] || null;
  await settingsService.updateSettings(interaction.guildId, { djRoleId: roleId });
  return interaction.update({
    content: roleId ? i18n.__mf("settings.djrole.set", { role: "<@&" + roleId + ">" }) : i18n.__("settings.djrole.cleared"),
    components: [],
    allowedMentions: { parse: [] }
  });
}

export async function handleAdminRole({ interaction }: SettingsHandlerContext) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("settings:adminrole")
    .setPlaceholder(i18n.__("settings.adminrole.placeholder"))
    .setMinValues(0)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("settings:adminrole:clear")
    .setLabel(i18n.__("settings.adminrole.clear"))
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  return interaction.reply({
    content: i18n.__("settings.adminrole.prompt"),
    components: [row1, row2],
    flags: MessageFlags.Ephemeral
  });
}

export async function onAdminRoleComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  const settingsService = GuildSettingsService.getInstance();
  if (action === "clear") {
    await settingsService.updateSettings(interaction.guildId, { adminRoleId: null });
    return interaction.update({ content: i18n.__("settings.adminrole.clearedAdmins"), components: [] });
  }
  if (!interaction.isRoleSelectMenu()) return;
  const roleId = interaction.values[0] || null;
  await settingsService.updateSettings(interaction.guildId, { adminRoleId: roleId });
  return interaction.update({
    content: roleId ? i18n.__mf("settings.adminrole.set", { role: "<@&" + roleId + ">" }) : i18n.__("settings.adminrole.cleared"),
    components: [],
    allowedMentions: { parse: [] }
  });
}
