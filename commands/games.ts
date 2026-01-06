import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder
} from "discord.js";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("games")
    .setDescription(i18n.__("games.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle(i18n.__("games.title"))
      .setDescription(i18n.__("games.info"))
      .setColor("#F8AA2A")
      .addFields(
        {
          name: "í¾µ " + i18n.__("games.guessTheSong.title"),
          value: i18n.__("games.guessTheSong.description") + "\n`/guesssong start`"
        }
      )
      .setFooter({ text: i18n.__("games.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};
