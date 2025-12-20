import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
} from "discord.js";
import { SettingsHandlerContext } from "./types";

export async function handleDJRole({ interaction, guildId, settingsService }: SettingsHandlerContext) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("djrole_select")
    .setPlaceholder("Select DJ role")
    .setMinValues(0)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("djrole_clear")
    .setLabel("Clear DJ Role (Everyone can DJ)")
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const response = await interaction.reply({
    content: "Select the DJ role. Users with this role can control music playback.",
    components: [row1, row2],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "djrole_select" && i.isRoleSelectMenu()) {
      const roleId = i.values[0] || null;
      await settingsService.updateSettings(guildId, { djRoleId: roleId });
      await i.update({
        content: roleId ? "DJ role set to <@&" + roleId + ">" : "DJ role cleared.",
        components: [],
      });
    } else if (i.customId === "djrole_clear") {
      await settingsService.updateSettings(guildId, { djRoleId: null });
      await i.update({
        content: "DJ role cleared. Everyone can now use DJ commands.",
        components: [],
      });
    }
  });
}

export async function handleAdminRole({ interaction, guildId, settingsService }: SettingsHandlerContext) {
  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId("adminrole_select")
    .setPlaceholder("Select Admin role")
    .setMinValues(0)
    .setMaxValues(1);

  const clearButton = new ButtonBuilder()
    .setCustomId("adminrole_clear")
    .setLabel("Clear Admin Role (Server admins only)")
    .setStyle(ButtonStyle.Secondary);

  const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(clearButton);

  const response = await interaction.reply({
    content: "Select the Admin role. Users with this role can change bot settings.",
    components: [row1, row2],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    time: 60000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "adminrole_select" && i.isRoleSelectMenu()) {
      const roleId = i.values[0] || null;
      await settingsService.updateSettings(guildId, { adminRoleId: roleId });
      await i.update({
        content: roleId ? "Admin role set to <@&" + roleId + ">" : "Admin role cleared.",
        components: [],
      });
    } else if (i.customId === "adminrole_clear") {
      await settingsService.updateSettings(guildId, { adminRoleId: null });
      await i.update({
        content: "Admin role cleared. Only server administrators can change settings.",
        components: [],
      });
    }
  });
}
