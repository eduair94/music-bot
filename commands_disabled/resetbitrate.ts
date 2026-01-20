import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { PatreonUser } from "../models/PatreonUser";
import { PremiumGuild } from "../models/PremiumGuild";
import { config } from "../utils/config";

/**
 * /resetbitrate command - Owner-only command to reset audio bitrate to default
 * Can reset bitrate for:
 * - A specific user (deletes PatreonUser entry)
 * - A specific guild (deletes or deactivates PremiumGuild entry)
 */
export default {
  data: new SlashCommandBuilder()
    .setName("resetbitrate")
    .setDescription("(Owner Only) Reset audio bitrate to default/Patreon settings")
    .addStringOption((option) =>
      option
        .setName("target")
        .setDescription("Reset for 'user' or 'guild'")
        .setRequired(false)
        .addChoices(
          { name: "User", value: "user" },
          { name: "Guild (Server)", value: "guild" }
        )
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to reset (when target is 'user')")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("guild_id")
        .setDescription("Guild ID to reset (when target is 'guild', defaults to current)")
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

    const target = interaction.options.getString("target") || "user";

    await interaction.deferReply({ ephemeral: true });

    try {
      if (target === "guild") {
        // Reset guild-level premium settings
        const guildIdInput = interaction.options.getString("guild_id");
        const targetGuildId = guildIdInput || interaction.guildId;

        if (!targetGuildId) {
          return interaction.editReply({
            content: "❌ No guild specified and command not used in a server."
          }).catch(console.error);
        }

        // Delete the premium guild entry
        const result = await PremiumGuild.findOneAndDelete({ guildId: targetGuildId });

        if (!result) {
          return interaction.editReply({
            content: `ℹ️ Guild \`${targetGuildId}\` already has default settings (no premium active).`
          }).catch(console.error);
        }

        return interaction.editReply({
          content: `✅ **Guild Premium Settings Reset**\n\n` +
                   `**Server:** ${result.guildName || "Unknown"}\n` +
                   `**Guild ID:** \`${targetGuildId}\`\n\n` +
                   `Premium features have been removed. Server now uses default quality (128kbps).`
        }).catch(console.error);

      } else {
        // Reset user-level settings (original behavior)
        const targetUser = interaction.options.getUser("user") || interaction.user;

        // Delete the patron entry to reset to default
        const result = await PatreonUser.findOneAndDelete({ discordId: targetUser.id });

        if (!result) {
          return interaction.editReply({
            content: `ℹ️ ${targetUser.username} already has default settings (no custom bitrate set).`
          }).catch(console.error);
        }

        return interaction.editReply({
          content: `✅ **User Audio Settings Reset**\n\n` +
                   `**User:** ${targetUser.username} (\`${targetUser.id}\`)\n\n` +
                   `**Quality:** 🎵 128kbps (Free/Default)\n` +
                   `**Identity:** Default (Bypass)\n\n` +
                   `Settings will now be determined by Patreon tier if applicable.`
        }).catch(console.error);
      }

    } catch (error: any) {
      console.error("[resetbitrate] Error:", error);
      return interaction.editReply({
        content: `❌ Error resetting settings: ${error.message || "Unknown error"}`
      }).catch(console.error);
    }
  }
};
