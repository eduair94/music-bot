import { escapeMarkdown, MessageFlags } from "discord.js";
import { i18n } from "../../utils/i18n";
import { SettingsHandlerContext } from "./types";

export async function handleBlacklist({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const addUser = interaction.options.getUser("add");
  const removeUser = interaction.options.getUser("remove");

  if (!addUser && !removeUser) {
    return interaction.reply({
      content: settings.blacklistedUsers.length > 0
        ? `**${i18n.__("settings.blacklist.title")}:**\n` + settings.blacklistedUsers.map((u) => "<@" + u + ">").join("\n")
        : i18n.__("settings.blacklist.none"),
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  }

  if (addUser) {
    const user = escapeMarkdown(addUser.username);
    if (settings.blacklistedUsers.includes(addUser.id)) {
      return interaction.reply({
        content: i18n.__mf("settings.blacklist.already", { user }),
        flags: MessageFlags.Ephemeral,
      });
    }
    await settingsService.updateSettings(guildId, {
      blacklistedUsers: [...settings.blacklistedUsers, addUser.id],
    });
    return interaction.reply({
      content: i18n.__mf("settings.blacklist.added", { user }),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (removeUser) {
    const user = escapeMarkdown(removeUser.username);
    if (!settings.blacklistedUsers.includes(removeUser.id)) {
      return interaction.reply({
        content: i18n.__mf("settings.blacklist.notListed", { user }),
        flags: MessageFlags.Ephemeral,
      });
    }
    await settingsService.updateSettings(guildId, {
      blacklistedUsers: settings.blacklistedUsers.filter((u) => u !== removeUser.id),
    });
    return interaction.reply({
      content: i18n.__mf("settings.blacklist.removed", { user }),
      flags: MessageFlags.Ephemeral,
    });
  }
}
