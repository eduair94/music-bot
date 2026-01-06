import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder
} from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription(i18n.__("vote.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("vote.title"))
      .setDescription(i18n.__("vote.message"))
      .setColor("#F8AA2A")
      .addFields(
        { 
          name: i18n.__("vote.rewards"), 
          value: i18n.__("vote.rewardsList")
        }
      )
      .setFooter({ text: i18n.__("vote.footer") });

    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setLabel("Vote on Top.gg")
          .setStyle(ButtonStyle.Link)
          .setURL("https://top.gg/bot/YOUR_BOT_ID/vote")
          .setEmoji("🗳️"),
        new ButtonBuilder()
          .setLabel("Vote on Discord Bot List")
          .setStyle(ButtonStyle.Link)
          .setURL("https://discordbotlist.com/bots/YOUR_BOT_ID/upvote")
          .setEmoji("⬆️")
      );

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
