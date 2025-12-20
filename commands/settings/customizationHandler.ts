import {
  ActionRowBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from "discord.js";
import { SettingsHandlerContext } from "./types";

export async function handleLanguage({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const languages = [
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Portuguese (BR)", value: "pt_br" },
    { label: "Russian", value: "ru" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },
    { label: "Chinese (Simplified)", value: "zh_cn" },
    { label: "Italian", value: "it" },
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("language_select")
    .setPlaceholder("Select a language")
    .addOptions(
      languages.map((lang) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(lang.label)
          .setValue(lang.value)
          .setDefault(lang.value === settings.language)
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.reply({
    content: "Select the bot language for this server.\n**Current:** " + settings.language,
    components: [row],
    ephemeral: true,
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000,
  });

  collector.on("collect", async (i) => {
    const selectedLanguage = i.values[0];
    await settingsService.updateSettings(guildId, { language: selectedLanguage });
    await i.update({
      content: "Language set to: " + selectedLanguage,
      components: [],
    });
  });
}

export async function handleEmbedColor({ interaction, guildId, settingsService }: SettingsHandlerContext) {
  const color = interaction.options.getString("color", true);
  
  // Validate hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return interaction.reply({
      content: "Invalid hex color. Please use format: #RRGGBB (e.g., #FF5500)",
      ephemeral: true,
    });
  }

  await settingsService.updateSettings(guildId, { embedColor: color.toUpperCase() });
  return interaction.reply({
    content: "Embed color set to: " + color.toUpperCase(),
    ephemeral: true,
  });
}
