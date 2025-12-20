import { SettingsHandlerContext } from "./types";

export async function handleBlacklist({ interaction, guildId, settings, settingsService }: SettingsHandlerContext) {
  const addUser = interaction.options.getUser("add");
  const removeUser = interaction.options.getUser("remove");

  if (!addUser && !removeUser) {
    return interaction.reply({
      content: settings.blacklistedUsers.length > 0
        ? "**Blacklisted Users:**\n" + settings.blacklistedUsers.map((u) => "<@" + u + ">").join("\n")
        : "No users are blacklisted.",
      ephemeral: true,
    });
  }

  if (addUser) {
    if (settings.blacklistedUsers.includes(addUser.id)) {
      return interaction.reply({
        content: addUser.username + " is already blacklisted.",
        ephemeral: true,
      });
    }
    await settingsService.updateSettings(guildId, {
      blacklistedUsers: [...settings.blacklistedUsers, addUser.id],
    });
    return interaction.reply({
      content: addUser.username + " has been blacklisted from using the bot.",
      ephemeral: true,
    });
  }

  if (removeUser) {
    if (!settings.blacklistedUsers.includes(removeUser.id)) {
      return interaction.reply({
        content: removeUser.username + " is not blacklisted.",
        ephemeral: true,
      });
    }
    await settingsService.updateSettings(guildId, {
      blacklistedUsers: settings.blacklistedUsers.filter((u) => u !== removeUser.id),
    });
    return interaction.reply({
      content: removeUser.username + " has been removed from the blacklist.",
      ephemeral: true,
    });
  }
}
