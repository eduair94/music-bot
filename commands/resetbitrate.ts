import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { PatreonUser } from "../models/PatreonUser";
import { config } from "../utils/config";

/**
 * /resetbitrate command - Owner-only command to reset audio bitrate to default
 */
export default {
  data: new SlashCommandBuilder()
    .setName("resetbitrate")
    .setDescription("(Owner Only) Reset audio bitrate to default/Patreon settings")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to reset (defaults to yourself)")
        .setRequired(false)
    ),
  cooldown: 3,

  async execute(interaction: ChatInputCommandInteraction) {
    // Check if user is the bot owner
    if (!config.OWNER_ID || interaction.user.id !== config.OWNER_ID) {
      return interaction.reply({
        content: "❌ This command is only available to the bot owner.",
        ephemeral: true
      }).catch(console.error);
    }

    const targetUser = interaction.options.getUser("user") || interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Delete the patron entry to reset to default
      const result = await PatreonUser.findOneAndDelete({ discordId: targetUser.id });

      if (!result) {
        return interaction.editReply({
          content: `ℹ️ ${targetUser.username} already has default settings (no custom bitrate set).`
        }).catch(console.error);
      }

      return interaction.editReply({
        content: `✅ **Audio settings reset for ${targetUser.username}**\n\n` +
                 `**Quality:** ��� 128kbps (Free/Default)\n` +
                 `**Identity:** Bypass (default)\n\n` +
                 `Settings will now be determined by Patreon tier if applicable.`
      }).catch(console.error);

    } catch (error: any) {
      console.error("[resetbitrate] Error:", error);
      return interaction.editReply({
        content: `❌ Error resetting bitrate: ${error.message || "Unknown error"}`
      }).catch(console.error);
    }
  }
};
