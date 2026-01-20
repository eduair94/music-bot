import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { i18n } from "../utils/i18n";

const tips = [
  "Use `/collections create` to save your favorite playlists!",
  "You can use `/playnext` to add a song right after the current one.",
  "Use `/shuffle` to mix up your queue!",
  "Try `/radio` to discover similar music based on what's playing.",
  "Use `/grab` to save the current song to your DMs.",
  "You can use `/voteskip` for democratic skipping!",
  "Use `/search` to find specific songs before adding them.",
  "Try `/sort` to organize your queue by title, author, or duration.",
  "Use `/swap` to switch the position of two songs.",
  "You can use `/reverse` to flip your queue order!",
  "Use `/length` to see how long your queue will last.",
  "Try `/history` to see what songs were played before.",
  "Use `/removedupes` to clean up duplicate songs in your queue.",
  "You can use `/lyrics` to see the lyrics of the current song!",
  "Use `/bassboost` and `/nightcore` for audio effects!",
  "Try `/24/7` mode to keep the bot in your channel (Premium).",
  "Use `/autoplay` to automatically add similar songs when the queue ends."
];

export default {
  data: new SlashCommandBuilder()
    .setName("tip")
    .setDescription(i18n.__("tip.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("tip.title"))
      .setDescription(`í²¡ ${randomTip}`)
      .setColor("#F8AA2A")
      .setFooter({ text: i18n.__("tip.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};
