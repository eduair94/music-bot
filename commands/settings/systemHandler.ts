import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from "discord.js";
import { SettingsHandlerContext } from "./types";

export async function handleReset({ interaction, guildId, settingsService }: SettingsHandlerContext) {
  const confirmButton = new ButtonBuilder()
    .setCustomId("reset_confirm")
    .setLabel("Yes, Reset All Settings")
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("reset_cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  const response = await interaction.reply({
    content: "Are you sure you want to reset ALL settings to default? This cannot be undone.",
    components: [row],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 30000,
  });

  collector.on("collect", async (i) => {
    if (i.customId === "reset_confirm") {
      await settingsService.resetSettings(guildId);
      await i.update({
        content: "All settings have been reset to default.",
        components: [],
      });
    } else {
      await i.update({
        content: "Reset cancelled.",
        components: [],
      });
    }
  });
}

export async function handleStats({ interaction, settings }: SettingsHandlerContext) {
  const hours = Math.floor(settings.totalPlaytime / 3600);
  const minutes = Math.floor((settings.totalPlaytime % 3600) / 60);

  const embed = new EmbedBuilder()
    .setTitle("Music Statistics")
    .setColor(settings.embedColor as `#${string}`)
    .addFields(
      {
        name: "Total Songs Played",
        value: settings.totalSongsPlayed.toLocaleString(),
        inline: true,
      },
      {
        name: "Total Playtime",
        value: hours + "h " + minutes + "m",
        inline: true,
      }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
