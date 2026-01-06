import { CommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("support")
    .setDescription(i18n.__("support.description")),
  cooldown: 5,
  async execute(interaction: CommandInteraction) {
    const supportUrl = process.env.SUPPORT_SERVER || "https://discord.gg/your-server";
    
    const embed = new EmbedBuilder()
      .setTitle("í²¬ Support Server")
      .setDescription(i18n.__mf("support.embedDescription", { url: supportUrl }))
      .setColor("#F8AA2A")
      .addFields({
        name: "Need Help?",
        value: `Join our support server for assistance, bug reports, and feature requests!\n\n**[Click here to join](${supportUrl})**`,
        inline: false
      })
      .setFooter({ text: i18n.__("support.footer") })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }
};
