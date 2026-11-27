import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageComponentInteraction,
  MessageFlags
} from "discord.js";
import { GuildSettingsService } from "../../services/guildSettings";
import { i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

export async function handleReset({ interaction }: SettingsHandlerContext) {
  const confirmButton = new ButtonBuilder()
    .setCustomId("settings:reset:confirm")
    .setLabel(i18n.__("settings.reset.confirm"))
    .setStyle(ButtonStyle.Danger);

  const cancelButton = new ButtonBuilder()
    .setCustomId("settings:reset:cancel")
    .setLabel(i18n.__("settings.reset.cancel"))
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  return interaction.reply({
    content: i18n.__("settings.reset.prompt"),
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

export async function onResetComponent(interaction: MessageComponentInteraction<"cached">, action: string | undefined) {
  if (action === "confirm") {
    await GuildSettingsService.getInstance().resetSettings(interaction.guildId);
    return interaction.update({ content: i18n.__("settings.reset.done"), components: [] });
  }
  return interaction.update({ content: i18n.__("settings.reset.cancelled"), components: [] });
}

export async function handleStats({ interaction, settings }: SettingsHandlerContext) {
  const hours = Math.floor(settings.totalPlaytime / 3600);
  const minutes = Math.floor((settings.totalPlaytime % 3600) / 60);

  const embed = new EmbedBuilder()
    .setTitle(i18n.__("settings.stats.title"))
    .setColor(settings.embedColor as `#${string}`)
    .addFields(
      {
        name: i18n.__("settings.stats.songsPlayed"),
        value: settings.totalSongsPlayed.toLocaleString(),
        inline: true,
      },
      {
        name: i18n.__("settings.stats.playtime"),
        value: i18n.__mf("settings.stats.playtimeValue", { hours, minutes }),
        inline: true,
      }
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}
