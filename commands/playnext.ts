import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder,
  TextChannel
} from "discord.js";
import { useQueue } from "discord-player";
import { i18n } from "../utils/i18n";
import { DiscordPlayerService } from "../services/discordPlayer";

export default {
  data: new SlashCommandBuilder()
    .setName("playnext")
    .setDescription(i18n.__("playnext.description"))
    .addStringOption(option =>
      option
        .setName("query")
        .setDescription("Song name or URL")
        .setRequired(true)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.voice.channel) {
      return interaction.reply({
        content: i18n.__("playnext.notInVoice"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const query = interaction.options.getString("query", true);
    const playerService = DiscordPlayerService.getInstance();
    const textChannel = interaction.channel as TextChannel;
    
    try {
      // First search for the track
      const searchResult = await playerService.search(query);
      
      if (!searchResult || searchResult.tracks.length === 0) {
        return interaction.editReply({
          content: i18n.__("playnext.noResults")
        });
      }

      const track = searchResult.tracks[0];
      const queue = useQueue(interaction.guildId!);
      
      if (queue && queue.currentTrack) {
        // Insert at position 0 (next in queue)
        queue.insertTrack(track, 0);
        
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("playnext.title"))
          .setDescription(i18n.__mf("playnext.success", { 
            title: track.title,
            author: track.author
          }))
          .setThumbnail(track.thumbnail)
          .setColor("#F8AA2A");

        return interaction.editReply({ embeds: [embed] });
      } else {
        // No queue, just play normally
        const result = await playerService.play(
          member.voice.channel,
          query,
          textChannel,
          128 // Default bitrate
        );

        if (!result) {
          return interaction.editReply({
            content: i18n.__("playnext.error")
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("playnext.title"))
          .setDescription(i18n.__mf("playnext.playing", { 
            title: result.track.title,
            author: result.track.author
          }))
          .setThumbnail(result.track.thumbnail)
          .setColor("#F8AA2A");

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in playnext:", error);
      return interaction.editReply({
        content: i18n.__("playnext.error")
      });
    }
  }
};
