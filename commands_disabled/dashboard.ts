import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("dashboard")
    .setDescription(i18n.__("dashboard.description")),
  cooldown: 5,
  async execute(interaction: CommandInteraction) {
    const dashboardUrl = process.env.DASHBOARD_URL || "https://music-bot.checkleaked.com";
    
    const embed = new EmbedBuilder()
      .setTitle("🎛️ Bot Dashboard")
      .setDescription(i18n.__("dashboard.embedDescription"))
      .setColor("#F8AA2A")
      .addFields(
        {
          name: "✨ Features",
          value: [
            "• Configure server settings",
            "• View queue and playback controls",
            "• Manage playlists and collections",
            "• View listening statistics",
            "• Premium features management"
          ].join("\n"),
          inline: false
        }
      )
      .setFooter({ text: i18n.__("dashboard.footer") })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Open Dashboard")
        .setStyle(ButtonStyle.Link)
        .setURL(dashboardUrl)
        .setEmoji("🌐")
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
