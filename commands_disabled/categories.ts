import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  SlashCommandBuilder 
} from "discord.js";
import { i18n } from "../utils/i18n";

const categories = [
  {
    emoji: "í¾µ",
    name: "Playback",
    commands: ["play", "playnow", "playnext", "pause", "resume", "stop", "join", "leave"]
  },
  {
    emoji: "í³‹",
    name: "Queue",
    commands: ["queue", "clear", "shuffle", "skip", "skipto", "remove", "move", "swap", "sort", "reverse"]
  },
  {
    emoji: "í´Š",
    name: "Audio",
    commands: ["volume", "bassboost", "nightcore", "speed", "setbitrate", "resetbitrate"]
  },
  {
    emoji: "í´„",
    name: "Loop & Repeat",
    commands: ["loop", "loopqueue", "autoplay", "replay"]
  },
  {
    emoji: "â„¹ï¸",
    name: "Information",
    commands: ["nowplaying", "queue", "history", "lyrics", "upcoming", "length"]
  },
  {
    emoji: "í²¾",
    name: "Collections",
    commands: ["collections"]
  },
  {
    emoji: "âš™ï¸",
    name: "Settings",
    commands: ["settings"]
  },
  {
    emoji: "í´–",
    name: "Bot",
    commands: ["help", "ping", "invite", "support", "about", "vote", "premium"]
  }
];

export default {
  data: new SlashCommandBuilder()
    .setName("categories")
    .setDescription(i18n.__("categories.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const categoryList = categories
      .map(cat => `${cat.emoji} **${cat.name}**\n${cat.commands.map(c => "\`/" + c + "\`").join(", ")}`)
      .join("\n\n");

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("categories.title"))
      .setDescription(categoryList)
      .setColor("#F8AA2A")
      .setFooter({ text: i18n.__("categories.footer") });

    return interaction.reply({ embeds: [embed] });
  }
};
