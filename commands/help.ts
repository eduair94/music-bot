import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { buildHelp } from "../services/helpMenu";
import { i18n } from "../utils/i18n";

/** /help — categories in a menu; every command is a clickable mention. */
export default {
  data: new SlashCommandBuilder().setName("help").setDescription(i18n.__("help.description")),
  cooldown: 3,
  category: "other",
  userInstallable: true,
  async execute(interaction: ChatInputCommandInteraction) {
    return interaction.reply({
      ...buildHelp(interaction.client.user.username),
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    });
  }
};
