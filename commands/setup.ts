import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder,
  PermissionFlagsBits
} from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription(i18n.__("setup.description"))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("setup.title"))
      .setDescription(i18n.__("setup.welcome"))
      .setColor("#F8AA2A")
      .addFields(
        {
          name: "1️⃣ " + i18n.__("setup.step1.title"),
          value: i18n.__("setup.step1.desc")
        },
        {
          name: "2️⃣ " + i18n.__("setup.step2.title"),
          value: i18n.__("setup.step2.desc")
        },
        {
          name: "3️⃣ " + i18n.__("setup.step3.title"),
          value: i18n.__("setup.step3.desc")
        },
        {
          name: "4️⃣ " + i18n.__("setup.step4.title"),
          value: i18n.__("setup.step4.desc")
        },
        {
          name: "��� " + i18n.__("setup.commands.title"),
          value: i18n.__("setup.commands.desc")
        }
      )
      .setFooter({ text: i18n.__("setup.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};
