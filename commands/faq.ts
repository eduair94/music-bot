import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { i18n } from "../utils/i18n";
import { safeReply } from "../utils/safeReply";

export default {
  data: new SlashCommandBuilder()
    .setName("faq")
    .setDescription(i18n.__("faq.description")),

  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("faq.title"))
      .setColor("#0099ff")
      .addFields(
        {
          name: i18n.__("faq.q1.question"),
          value: i18n.__("faq.q1.answer"),
        },
        {
          name: i18n.__("faq.q2.question"),
          value: i18n.__("faq.q2.answer"),
        },
        {
          name: i18n.__("faq.q3.question"),
          value: i18n.__("faq.q3.answer"),
        },
        {
          name: i18n.__("faq.q4.question"),
          value: i18n.__("faq.q4.answer"),
        },
        {
          name: i18n.__("faq.q5.question"),
          value: i18n.__("faq.q5.answer"),
        },
        {
          name: i18n.__("faq.q6.question"),
          value: i18n.__("faq.q6.answer"),
        }
      )
      .setFooter({
        text: i18n.__("faq.footer"),
      });

    return safeReply(interaction, { embeds: [embed] });
  },
};
