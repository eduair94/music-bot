import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";
import { premiumFeatureName } from "../utils/premiumFeatures";

interface UserProfile {
  discordId: string;
  visibility?: "public" | "private";
  serverVisibility?: boolean;
}

// Simple in-memory cache (in production, use database)
const userProfiles: Map<string, UserProfile> = new Map();

export default {
  data: new SlashCommandBuilder()
    .setName("user")
    .setDescription(i18n.__("user.description"))
    // Visibility/leaderboard/settings/reset were in-memory only (lost on
    // restart, read by nothing) and were removed 2026-11.
    .addSubcommand(sub => sub
      .setName("profile")
      .setDescription(i18n.__("user.profile.description"))
      .addUserOption(opt => opt.setName("target").setDescription(i18n.__("user.profile.optionTarget")))),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    switch (subcommand) {
      case "profile": {
        const targetUser = interaction.options.getUser("target") || interaction.user;
        
        await interaction.deferReply();

        const patreonService = PatreonService.getInstance();
        const premiumInfo = await patreonService.getPremiumFeatures(targetUser.id);

        const embed = new EmbedBuilder()
          .setTitle(i18n.__mf("profile.title", { user: targetUser.username }))
          .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
          .setColor("#F8AA2A")
          .addFields(
            { name: i18n.__("profile.username"), value: targetUser.tag, inline: true },
            { name: i18n.__("profile.id"), value: targetUser.id, inline: true },
            { name: i18n.__("profile.created"), value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
            { 
              name: i18n.__("profile.premium"), 
              value: premiumInfo.tier && premiumInfo.tier !== "free" 
                ? `⭐ ${premiumInfo.tier.charAt(0).toUpperCase() + premiumInfo.tier.slice(1)}` 
                : i18n.__("user.profile.free"), 
              inline: true 
            }
          );

        if (premiumInfo.features.length > 0) {
          embed.addFields({
            name: i18n.__("profile.features"),
            value: premiumInfo.features.map(f => `✨ ${premiumFeatureName(f)}`).join("\n")
          });
        }

        return interaction.editReply({ embeds: [embed] });
      }

      case "visibility": {
        const level = interaction.options.getString("level", true) as "public" | "private";
        const profile = userProfiles.get(userId) || { discordId: userId };
        profile.visibility = level;
        userProfiles.set(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle("👤 Visibility Updated")
          .setColor(0x2ecc71)
          .setDescription(`Profile visibility set to: **${level}**`);

        return interaction.reply({ embeds: [embed] });
      }

      case "leaderboard": {
        const visible = interaction.options.getBoolean("visible", true);
        const profile = userProfiles.get(userId) || { discordId: userId };
        profile.serverVisibility = visible;
        userProfiles.set(userId, profile);

        const embed = new EmbedBuilder()
          .setTitle("📊 Leaderboard Visibility")
          .setColor(visible ? 0x2ecc71 : 0xe74c3c)
          .setDescription(visible 
            ? "You will now appear on server leaderboards."
            : "You will no longer appear on server leaderboards.");

        return interaction.reply({ embeds: [embed] });
      }

      case "settings": {
        const profile = userProfiles.get(userId) || { discordId: userId };

        const embed = new EmbedBuilder()
          .setTitle("⚙️ Your Settings")
          .setColor("#3498db")
          .addFields(
            { name: "Profile Visibility", value: profile.visibility || "public", inline: true },
            { name: "Leaderboard", value: profile.serverVisibility !== false ? "Visible" : "Hidden", inline: true }
          );

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      case "reset": {
        userProfiles.delete(userId);

        const embed = new EmbedBuilder()
          .setTitle("🔄 Profile Reset")
          .setColor(0xf39c12)
          .setDescription("Your profile has been reset to defaults.");

        return interaction.reply({ embeds: [embed] });
      }

      default:
        return interaction.reply({ content: `❌ ${i18n.__("common.unknownSubcommand")}`, ephemeral: true });
    }
  }
};
