import { ChatInputCommandInteraction, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { GuildSettingsService } from "../services/guildSettings";
import { BOT_LOCALES, BotLocale, LOCALE_NAMES, i18n, runWithLocale } from "../utils/i18n";

/** /language — server language, or "auto" (each member's Discord language). */
const builder = new SlashCommandBuilder()
  .setName("language")
  .setDescription(i18n.__("language.description"))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription(i18n.__("language.optionLanguage"))
      .setRequired(true)
      .setAutocomplete(true)
  );

export default {
  data: builder,
  category: "settings",
  cooldown: 3,
  async autocomplete(interaction: import("discord.js").AutocompleteInteraction) {
    const typed = interaction.options.getFocused().toLowerCase();
    const options = [
      { name: `🌐 ${i18n.__("language.auto")}`, value: "auto" },
      ...BOT_LOCALES.map((code) => ({ name: `${LOCALE_NAMES[code]} (${code})`, value: code }))
    ];
    return interaction.respond(
      options.filter((o) => !typed || o.name.toLowerCase().includes(typed) || o.value.includes(typed)).slice(0, 25)
    );
  },
  async execute(interaction: ChatInputCommandInteraction<"cached">) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: `🔒 ${i18n.__("language.needManage")}`, flags: MessageFlags.Ephemeral });
    }
    const value = interaction.options.getString("language", true);
    const valid = value === "auto" || (BOT_LOCALES as readonly string[]).includes(value);
    if (!valid) {
      return interaction.reply({ content: `❌ ${i18n.__("language.unknown")}`, flags: MessageFlags.Ephemeral });
    }
    await GuildSettingsService.getInstance().updateSettings(interaction.guildId, { language: value });

    // Confirm in the new language.
    const reply = (locale: BotLocale | null) => {
      const name = value === "auto" ? i18n.__("language.auto") : LOCALE_NAMES[value as BotLocale];
      return `🌐 ${i18n.__mf("language.set", { language: name })}`;
    };
    const content = value === "auto" ? reply(null) : runWithLocale(value as BotLocale, () => reply(value as BotLocale));
    return interaction.reply({ content });
  }
};
