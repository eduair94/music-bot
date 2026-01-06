import { useQueue } from "discord-player";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    SlashCommandBuilder,
    TextChannel
} from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("playnow")
    .setDescription(i18n.__("playnow.description"))
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
        content: i18n.__("playnow.notInVoice"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const query = interaction.options.getString("query", true);
    const playerService = DiscordPlayerService.getInstance();
    const textChannel = interaction.channel as TextChannel;
    
    try {
      const queue = useQueue(interaction.guildId!);
      
      // First search for the track
      const searchResult = await playerService.search(query);
      
      if (!searchResult || searchResult.tracks.length === 0) {
        return interaction.editReply({
          content: i18n.__("playnow.noResults")
        });
      }

      const track = searchResult.tracks[0];
      
      if (queue && queue.currentTrack) {
        // Insert at position 0 and skip to it
        queue.insertTrack(track, 0);
        queue.node.skip();
        
        const embed = new EmbedBuilder()
          .setTitle(i18n.__("playnow.title"))
          .setDescription(i18n.__mf("playnow.success", { 
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
            content: i18n.__("playnow.error")
          });
        }

        const embed = new EmbedBuilder()
          .setTitle(i18n.__("playnow.title"))
          .setDescription(i18n.__mf("playnow.playing", { 
            title: result.track.title,
            author: result.track.author
          }))
          .setThumbnail(result.track.thumbnail)
          .setColor("#F8AA2A");

        return interaction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      console.error("Error in playnow:", error);
      return interaction.editReply({
        content: i18n.__("playnow.error")
      });
    }
  }
};
