import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  User
} from "discord.js";
import { i18n } from "../utils/i18n";
import { PatreonService } from "../services/patreon";

export default {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription(i18n.__("profile.description"))
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("User to view profile for (defaults to yourself)")
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    
    await interaction.deferReply();

    // Get premium info
    const patreonService = PatreonService.getInstance();
    const premiumInfo = await patreonService.getPremiumFeatures(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(i18n.__mf("profile.title", { user: targetUser.username }))
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("profile.username"), 
          value: targetUser.tag, 
          inline: true 
        },
        { 
          name: i18n.__("profile.id"), 
          value: targetUser.id, 
          inline: true 
        },
        { 
          name: i18n.__("profile.created"), 
          value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, 
          inline: true 
        },
        { 
          name: i18n.__("profile.premium"), 
          value: premiumInfo.tier && premiumInfo.tier !== "free" 
            ? `⭐ ${premiumInfo.tier.charAt(0).toUpperCase() + premiumInfo.tier.slice(1)}` 
            : "Free", 
          inline: true 
        }
      );

    if (premiumInfo.features.length > 0) {
      embed.addFields({
        name: i18n.__("profile.features"),
        value: premiumInfo.features.map(f => `✨ ${f}`).join("\n")
      });
    }

    return interaction.editReply({ embeds: [embed] });
  }
};
