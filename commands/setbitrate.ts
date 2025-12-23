import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { PatreonUser } from "../models/PatreonUser";
import { config } from "../utils/config";

/**
 * /setbitrate command - Owner-only command to set custom audio bitrate for testing
 */
export default {
  data: new SlashCommandBuilder()
    .setName("setbitrate")
    .setDescription("(Owner Only) Set custom audio bitrate for testing")
    .addIntegerOption((option) =>
      option
        .setName("bitrate")
        .setDescription("Audio bitrate in kbps (128, 192, 256, 320)")
        .setRequired(true)
        .addChoices(
          { name: "128 kbps (Free)", value: 128 },
          { name: "192 kbps (Mid)", value: 192 },
          { name: "256 kbps (High)", value: 256 },
          { name: "320 kbps (Premium)", value: 320 }
        )
    )
    .addStringOption((option) =>
      option
        .setName("identity")
        .setDescription("Custom bot identity (optional)")
        .setRequired(false)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("User to set bitrate for (defaults to yourself)")
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

    const bitrate = interaction.options.getInteger("bitrate", true);
    const customIdentity = interaction.options.getString("identity");
    const targetUser = interaction.options.getUser("user") || interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
      // Find or create patron user entry
      const patron = await PatreonUser.findOneAndUpdate(
        { discordId: targetUser.id },
        {
          $set: {
            audioBitrate: bitrate,
            customBotName: customIdentity || undefined,
            fullName: targetUser.username,
            patronStatus: "test_user",
          },
        },
        { upsert: true, new: true }
      );

      if (!patron) {
        return interaction.editReply({
          content: "❌ Failed to update bitrate settings."
        }).catch(console.error);
      }

      // Build response message
      const qualityLabel = 
        bitrate >= 320 ? "🎵 HQ 320kbps (Premium)" :
        bitrate >= 256 ? "🎵 256kbps (High)" :
        bitrate >= 192 ? "🎵 192kbps (Mid)" :
        "🎵 128kbps (Free)";

      const identityLabel = customIdentity 
        ? customIdentity === "indie" 
          ? "🎸 Indie Music Bot" 
          : customIdentity
        : "Bypass (default)";

      return interaction.editReply({
        content: `✅ **Audio settings updated for ${targetUser.username}**\n\n` +
                 `**Quality:** ${qualityLabel}\n` +
                 `**Identity:** ${identityLabel}\n\n` +
                 `These settings will be used for all music playback commands.`
      }).catch(console.error);

    } catch (error: any) {
      console.error("[setbitrate] Error:", error);
      return interaction.editReply({
        content: `❌ Error updating bitrate: ${error.message || "Unknown error"}`
      }).catch(console.error);
    }
  }
};
