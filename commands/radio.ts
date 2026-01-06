import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";
import { useQueue } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("radio")
    .setDescription(i18n.__("radio.description")),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: i18n.__("radio.notInVoice"),
        ephemeral: true
      });
    }

    const queue = useQueue(interaction.guildId!);
    
    if (!queue || !queue.currentTrack) {
      return interaction.reply({
        content: i18n.__("radio.noTrack"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const currentTrack = queue.currentTrack;
    const searchQuery = `${currentTrack.title} ${currentTrack.author} similar songs`;

    try {
      const playerService = DiscordPlayerService.getInstance();
      const textChannel = interaction.channel as any;
      
      // Search for similar songs
      const result = await playerService.play(voiceChannel, searchQuery, textChannel);
      
      if (!result) {
        return interaction.editReply({
          content: i18n.__("radio.noResults")
        });
      }

      const embed = new EmbedBuilder()
        .setTitle(i18n.__("radio.title"))
        .setDescription(i18n.__mf("radio.started", { 
          track: currentTrack.title,
          added: result.track.title
        }))
        .setColor("#F8AA2A")
        .setThumbnail(result.track.thumbnail || null);

      // Enable autoplay for radio mode
      queue.setRepeatMode(0); // Disable repeat
      
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[radio] Error:", error);
      return interaction.editReply({
        content: i18n.__("radio.error")
      });
    }
  }
};
