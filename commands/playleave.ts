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
    .setName("playleave")
    .setDescription(i18n.__("playleave.description"))
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
        content: i18n.__("playleave.notInVoice"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const query = interaction.options.getString("query", true);
    const playerService = DiscordPlayerService.getInstance();
    const textChannel = interaction.channel as TextChannel;
    
    try {
      const result = await playerService.play(
        member.voice.channel,
        query,
        textChannel,
        128
      );

      if (!result) {
        return interaction.editReply({
          content: i18n.__("playleave.error")
        });
      }

      const queue = useQueue(interaction.guildId!);
      
      // Set up leave on end
      if (queue) {
        queue.setRepeatMode(0); // No repeat
        // Mark queue for leave after this track (handled by event listener)
        (queue.metadata as Record<string, boolean>).leaveAfterTrack = true;
      }

      const embed = new EmbedBuilder()
        .setTitle(i18n.__("playleave.title"))
        .setDescription(i18n.__mf("playleave.success", { 
          title: result.track.title,
          author: result.track.author
        }))
        .setThumbnail(result.track.thumbnail)
        .setColor("#F8AA2A")
        .setFooter({ text: i18n.__("playleave.footer") });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error in playleave:", error);
      return interaction.editReply({
        content: i18n.__("playleave.error")
      });
    }
  }
};
