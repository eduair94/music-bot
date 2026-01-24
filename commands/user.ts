import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { PatreonService } from "../services/patreon";
import { i18n } from "../utils/i18n";

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
    .setDescription("User profile and preferences")
    // View profile
    .addSubcommand(sub => sub
      .setName("profile")
      .setDescription("View user profile")
      .addUserOption(opt => opt.setName("target").setDescription("User to view")))
    // Set visibility
    .addSubcommand(sub => sub
      .setName("visibility")
      .setDescription("Set profile visibility")
      .addStringOption(opt => opt.setName("level").setDescription("Visibility").setRequired(true)
        .addChoices(
          { name: "Public", value: "public" },
          { name: "Private", value: "private" }
        )))
    // Leaderboard visibility
    .addSubcommand(sub => sub
      .setName("leaderboard")
      .setDescription("Show on server leaderboards")
      .addBooleanOption(opt => opt.setName("visible").setDescription("Show on leaderboards").setRequired(true)))
    // View settings
    .addSubcommand(sub => sub
      .setName("settings")
      .setDescription("View your current settings"))
    // Reset
    .addSubcommand(sub => sub
      .setName("reset")
      .setDescription("Reset profile to defaults")),

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
            { name: "Username", value: targetUser.tag, inline: true },
            { name: "ID", value: targetUser.id, inline: true },
            { name: "Created", value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
            { 
              name: "Premium", 
              value: premiumInfo.tier && premiumInfo.tier !== "free" 
                ? `⭐ ${premiumInfo.tier.charAt(0).toUpperCase() + premiumInfo.tier.slice(1)}` 
                : "Free", 
              inline: true 
            }
          );

        if (premiumInfo.features.length > 0) {
          embed.addFields({
            name: "Features",
            value: premiumInfo.features.map(f => `✨ ${f}`).join("\n")
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
        return interaction.reply({ content: "❌ Unknown subcommand.", ephemeral: true });
    }
  }
};
