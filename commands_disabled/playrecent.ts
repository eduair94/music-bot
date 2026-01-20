import { 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  GuildMember, 
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder 
} from "discord.js";
import { useQueue, useHistory } from "discord-player";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("playrecent")
    .setDescription(i18n.__("playrecent.description"))
    .addIntegerOption(option =>
      option
        .setName("count")
        .setDescription("Number of recent tracks to queue (1-25)")
        .setMinValue(1)
        .setMaxValue(25)
    ),
  
  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    const voiceChannel = member.voice.channel;

    if (!voiceChannel) {
      return interaction.reply({
        content: i18n.__("playrecent.notInVoice"),
        ephemeral: true
      });
    }

    const history = useHistory(interaction.guildId!);
    
    if (!history || history.tracks.size === 0) {
      return interaction.reply({
        content: i18n.__("playrecent.noHistory"),
        ephemeral: true
      });
    }

    const count = interaction.options.getInteger("count") || 5;
    const recentTracks = history.tracks.toArray().slice(0, Math.min(count, 25));

    if (recentTracks.length === 0) {
      return interaction.reply({
        content: i18n.__("playrecent.noHistory"),
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      const playerService = DiscordPlayerService.getInstance();
      const textChannel = interaction.channel as any;
      let addedCount = 0;

      for (const track of recentTracks) {
        try {
          await playerService.play(voiceChannel, track.url, textChannel);
          addedCount++;
        } catch (e) {
          console.error(`Failed to add track ${track.title}:`, e);
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(i18n.__("playrecent.title"))
        .setDescription(i18n.__mf("playrecent.success", { count: addedCount }))
        .setColor("#F8AA2A")
        .addFields({
          name: i18n.__("playrecent.tracksField"),
          value: recentTracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`).join("\n")
        });

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("[playrecent] Error:", error);
      return interaction.editReply({
        content: i18n.__("playrecent.error")
      });
    }
  }
};
