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
    .setName("removekeyword")
    .setDescription(i18n.__("removekeyword.description"))
    .addStringOption(option =>
      option
        .setName("keyword")
        .setDescription("Keyword to search for in track titles")
        .setRequired(true)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("removekeyword.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || queue.tracks.size === 0) {
      return interaction.reply({
        content: i18n.__("removekeyword.noQueue"),
        ephemeral: true
      });
    }

    const keyword = interaction.options.getString("keyword", true).toLowerCase();
    
    // Find tracks matching keyword
    const tracksToRemove: number[] = [];
    const tracks = queue.tracks.toArray();
    const removedTitles: string[] = [];
    
    for (let i = tracks.length - 1; i >= 0; i--) {
      const track = tracks[i];
      if (track.title.toLowerCase().includes(keyword) || 
          track.author.toLowerCase().includes(keyword)) {
        tracksToRemove.push(i);
        removedTitles.unshift(track.title);
      }
    }

    if (tracksToRemove.length === 0) {
      return interaction.reply({
        content: i18n.__mf("removekeyword.noMatches", { keyword }),
        ephemeral: true
      });
    }

    // Remove tracks (in reverse order to maintain correct indices)
    for (const index of tracksToRemove) {
      queue.removeTrack(index);
    }

    const embed = new EmbedBuilder()
      .setTitle(i18n.__("removekeyword.title"))
      .setDescription(i18n.__mf("removekeyword.success", { 
        count: tracksToRemove.length,
        keyword 
      }))
      .setColor("#F8AA2A")
      .addFields({
        name: i18n.__("removekeyword.removedField"),
        value: removedTitles.slice(0, 10).join("\n") + 
          (removedTitles.length > 10 ? `\n... and ${removedTitles.length - 10} more` : "")
      });

    return interaction.reply({ embeds: [embed] });
  }
};
