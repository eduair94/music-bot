import {
  ActionRowBuilder,
  MessageComponentInteraction,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js";
import { GuildSettingsService } from "../../services/guildSettings";
import { mention } from "../../structs/commandRegistry";
import { BOT_LOCALES, BotLocale, LOCALE_NAMES, i18n, runWithLocale } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

/** The languages offered in the menu (all of them are on /language). */
const MENU_LANGUAGES: BotLocale[] = ["en", "es", "fr", "de", "pt_br", "ru", "ja", "ko", "zh_cn", "it"];

function languageName(value: string): string {
  if (value === "auto") return i18n.__("language.auto");
  return LOCALE_NAMES[value as BotLocale] ?? value;
}

export async function handleLanguage({ interaction, settings }: SettingsHandlerContext) {
  const options = [
    { label: languageName("auto"), value: "auto" },
    ...MENU_LANGUAGES.map((code) => ({ label: LOCALE_NAMES[code], value: code }))
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("settings:language")
    .setPlaceholder(i18n.__("settings.language.placeholder"))
    .addOptions(
      options.map((lang) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(lang.label)
          .setValue(lang.value)
          .setDefault(lang.value === settings.language)
      )
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return interaction.reply({
    content: [
      i18n.__("settings.language.prompt"),
      i18n.__mf("settings.current", { value: languageName(settings.language) }),
      `-# ${i18n.__mf("settings.language.more", { command: mention("language") })}`
    ].join("\n"),
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

export async function onLanguageComponent(interaction: MessageComponentInteraction<"cached">) {
  if (!interaction.isStringSelectMenu()) return;
  const selectedLanguage = interaction.values[0];
  if (selectedLanguage !== "auto" && !(BOT_LOCALES as readonly string[]).includes(selectedLanguage)) return;
  await GuildSettingsService.getInstance().updateSettings(interaction.guildId, { language: selectedLanguage });

  // Confirm in the language just chosen.
  const confirm = () => `🌐 ${i18n.__mf("language.set", { language: languageName(selectedLanguage) })}`;
  const content = selectedLanguage === "auto" ? confirm() : runWithLocale(selectedLanguage as BotLocale, confirm);
  return interaction.update({ content, components: [] });
}

export async function handleEmbedColor({ interaction, guildId, settingsService }: SettingsHandlerContext) {
  const color = interaction.options.getString("color", true);

  // Validate hex color
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return interaction.reply({
      content: i18n.__("settings.embedcolor.invalid"),
      flags: MessageFlags.Ephemeral
    });
  }

  await settingsService.updateSettings(guildId, { embedColor: color.toUpperCase() });
  return interaction.reply({
    content: i18n.__mf("settings.embedcolor.set", { color: color.toUpperCase() }),
    flags: MessageFlags.Ephemeral
  });
}
