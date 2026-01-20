import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder 
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("reverse")
    .setDescription(i18n.__("reverse.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("reverse.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size < 2) {
      return interaction.reply({
        content: i18n.__("reverse.noQueue"),
        ephemeral: true
      });
    }

    // Get all tracks and reverse them
    const tracks = queue.tracks.toArray();
    queue.tracks.clear();
    
    for (const track of tracks.reverse()) {
      queue.tracks.add(track);
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("reverse.title"))
      .setDescription(i18n.__mf("reverse.success", { 
        count: tracks.length 
      }))
      .setColor("#F8AA2A");

    return interaction.reply({ embeds: [embed] });
  }
};
