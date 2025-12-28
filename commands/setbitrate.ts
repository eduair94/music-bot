import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { PatreonUser } from "../models/PatreonUser";
import { PremiumGuild } from "../models/PremiumGuild";
import { config } from "../utils/config";
import { getQualityBadge } from "../utils/audioSettings";

/**
 * /setbitrate command - Owner-only command to set custom audio bitrate for testing
 * Can set bitrate for:
 * - A specific user (creates/updates PatreonUser entry)
 * - A specific guild (creates/updates PremiumGuild entry)
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
        .setName("target")
        .setDescription("Set for 'user' or 'guild'")
        .setRequired(false)
        .addChoices(
          { name: "User", value: "user" },
          { name: "Guild (Server)", value: "guild" }
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
        .setDescription("User to set bitrate for (when target is 'user')")
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName("guild_id")
        .setDescription("Guild ID to set bitrate for (when target is 'guild', defaults to current)")
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
    const target = interaction.options.getString("target") || "user";

    await interaction.deferReply({ ephemeral: true });

    try {
      if (target === "guild") {
        // Set guild-level premium settings
        const guildIdInput = interaction.options.getString("guild_id");
        const targetGuildId = guildIdInput || interaction.guildId;

        if (!targetGuildId) {
          return interaction.editReply({
            content: "❌ No guild specified and command not used in a server."
          }).catch(console.error);
        }

        // Fetch guild info if possible
        let guildName = "Unknown Server";
        try {
          const guild = await interaction.client.guilds.fetch(targetGuildId);
          guildName = guild.name;
        } catch {
          // Guild not accessible, use ID
          guildName = `Server ${targetGuildId}`;
        }

        // Create or update premium guild entry
        const premiumGuild = await PremiumGuild.findOneAndUpdate(
          { guildId: targetGuildId },
          {
            $set: {
              audioBitrate: bitrate,
              customBotName: customIdentity || undefined,
              guildName: guildName,
              discordId: config.OWNER_ID, // Owner as the sponsor
              isActive: true,
              linkedAt: new Date(),
            },
          },
          { upsert: true, new: true }
        );

        if (!premiumGuild) {
          return interaction.editReply({
            content: "❌ Failed to update guild premium settings."
          }).catch(console.error);
        }

        const qualityBadge = getQualityBadge(bitrate);
        const identityLabel = customIdentity 
          ? customIdentity === "indie" 
            ? "🎸 Indie Music Bot" 
            : customIdentity
          : "Default (Bypass)";

        return interaction.editReply({
          content: `✅ **Guild Premium Settings Updated**\n\n` +
                   `**Server:** ${guildName}\n` +
                   `**Guild ID:** \`${targetGuildId}\`\n` +
                   `**Quality:** ${qualityBadge}\n` +
                   `**Identity:** ${identityLabel}\n` +
                   `**Status:** Active\n\n` +
                   `All users in this server will now use these quality settings.`
        }).catch(console.error);

      } else {
        // Set user-level bitrate (original behavior)
        const targetUser = interaction.options.getUser("user") || interaction.user;

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
            content: "❌ Failed to update user bitrate settings."
          }).catch(console.error);
        }

        const qualityBadge = getQualityBadge(bitrate);
        const identityLabel = customIdentity 
          ? customIdentity === "indie" 
            ? "🎸 Indie Music Bot" 
            : customIdentity
          : "Default (Bypass)";

        return interaction.editReply({
          content: `✅ **User Audio Settings Updated**\n\n` +
                   `**User:** ${targetUser.username} (\`${targetUser.id}\`)\n` +
                   `**Quality:** ${qualityBadge}\n` +
                   `**Identity:** ${identityLabel}\n\n` +
                   `These settings will be used for all music playback commands by this user.`
        }).catch(console.error);
      }

    } catch (error: any) {
      console.error("[setbitrate] Error:", error);
      return interaction.editReply({
        content: `❌ Error updating settings: ${error.message || "Unknown error"}`
      }).catch(console.error);
    }
  }
};
