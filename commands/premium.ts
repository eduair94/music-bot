import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import { PatreonService } from "../services/patreon";

export default {
  data: new SlashCommandBuilder()
    .setName("premium")
    .setDescription("Check your premium status and features"),

  cooldown: 5,

  async execute(interaction: ChatInputCommandInteraction) {
    const patreonService = PatreonService.getInstance();
    const userId = interaction.user.id;

    // Get premium status
    const premiumInfo = await patreonService.getPremiumFeatures(userId);
    const patron = await patreonService.getPatronByDiscordId(userId);

    if (premiumInfo.isPremium) {
      // User has premium
      const featureList = premiumInfo.features.map((f) => {
        const featureNames: Record<string, string> = {
          audio_filters: "Audio Filters (bass boost, nightcore, etc.)",
          stay_24_7: "24/7 Mode - Bot stays in channel",
          max_quality: "Maximum Audio Quality",
          priority_queue: "Priority Queue",
          unlimited_playlists: "Unlimited Saved Playlists",
          longer_songs: "No Song Duration Limit",
          vote_features: "Vote on New Features",
          founder_role: "Exclusive Founder Role",
          direct_support: "Direct Support Channel Access",
        };
        return "- " + (featureNames[f] || f);
      });

      const embed = new EmbedBuilder()
        .setTitle("Premium Status")
        .setColor(premiumInfo.isFounder ? "#FFD700" : "#00FF00")
        .setThumbnail(interaction.user.displayAvatarURL())
        .addFields(
          {
            name: "Status",
            value: premiumInfo.isFounder 
              ? "**Founder / Beta Tester**" 
              : "**Premium Member**",
            inline: true,
          },
          {
            name: "Tier",
            value: premiumInfo.tier || "Premium",
            inline: true,
          },
          {
            name: "Lifetime Support",
            value: patron 
              ? "$" + (patron.lifetimeSupportCents / 100).toFixed(2)
              : "N/A",
            inline: true,
          },
          {
            name: "Your Premium Features",
            value: featureList.join("\n"),
            inline: false,
          }
        )
        .setFooter({ text: "Thank you for supporting us!" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    } else {
      // User doesn't have premium
      const embed = new EmbedBuilder()
        .setTitle("Premium Features")
        .setColor("#F96854")
        .setDescription(
          "Unlock exclusive features by becoming a patron!\n\n" +
          "**Founder / Beta Tester - $1.50/month**\n" +
          "Get access to ALL premium features:\n\n" +
          "- Audio Filters (bass boost, nightcore, etc.)\n" +
          "- 24/7 Mode - Bot stays in channel\n" +
          "- Maximum Audio Quality\n" +
          "- Priority Queue\n" +
          "- Unlimited Saved Playlists\n" +
          "- No Song Duration Limit\n" +
          "- Vote on New Features\n" +
          "- Exclusive Founder Role\n" +
          "- Direct Support Channel Access\n\n" +
          "**Limited Time:** This price is only for the first 50 subscribers!"
        )
        .setFooter({ text: "Make sure to link your Discord on Patreon!" });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel("Become a Patron")
          .setStyle(ButtonStyle.Link)
          .setURL("https://www.patreon.com/your_campaign"),
        new ButtonBuilder()
          .setCustomId("premium_refresh")
          .setLabel("Refresh Status")
          .setStyle(ButtonStyle.Secondary)
      );

      const response = await interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true,
      });

      // Handle refresh button
      const collector = response.createMessageComponentCollector({
        time: 60000,
      });

      collector.on("collect", async (i) => {
        if (i.customId === "premium_refresh") {
          // Clear cache and re-check
          patreonService.clearCache(userId);
          const newInfo = await patreonService.getPremiumFeatures(userId);

          if (newInfo.isPremium) {
            await i.update({
              content: "Your premium status has been verified! Use /premium again to see your features.",
              embeds: [],
              components: [],
            });
          } else {
            await i.update({
              content: "Premium status not found. Make sure you:\n" +
                "1. Have an active Patreon subscription\n" +
                "2. Connected your Discord account on Patreon\n" +
                "3. Wait a few minutes for sync",
              embeds: [embed],
              components: [row],
            });
          }
        }
      });
    }
  },
};
