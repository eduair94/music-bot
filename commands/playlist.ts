import { Track } from "discord-player";
import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    GuildMember,
    PermissionsBitField,
    SlashCommandBuilder,
    TextChannel
} from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { getPlaybackSettings, getQualityBadge } from "../utils/audioSettings";
import { i18n } from "../utils/i18n";

export default {
  data: new SlashCommandBuilder()
    .setName("playlist")
    .setDescription(i18n.__("playlist.description"))
    .addStringOption((option) => option.setName("playlist").setDescription("Playlist URL").setRequired(true)),
  cooldown: 5,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  async execute(interaction: ChatInputCommandInteraction) {
    const playlistUrl = interaction.options.getString("playlist");
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;
    const guildId = interaction.guild!.id;

    if (!voiceChannel) {
      return interaction.reply({ content: i18n.__("playlist.errorNotChannel"), ephemeral: true }).catch(console.error);
    }

    if (!playlistUrl) {
      return interaction.reply({ content: "Please provide a playlist URL.", ephemeral: true }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();
    
    if (!playerService.isInitialized()) {
      return interaction.reply({ 
        content: "❌ Music player is still initializing. Please try again in a few seconds.", 
        ephemeral: true 
      }).catch(console.error);
    }

    await interaction.deferReply();

    try {
      const textChannel = interaction.channel as TextChannel;
      
      // Get audio settings using centralized utility
      const { quality, identity } = await getPlaybackSettings(interaction.user.id, guildId);
      const audioBitrate = quality.bitrate;

      const result = await playerService.play(voiceChannel, playlistUrl, textChannel, audioBitrate);

      if (!result) {
        return interaction.editReply({ content: i18n.__("playlist.errorNotFoundPlaylist") }).catch(console.error);
      }

      const { track, queue } = result;
      const tracks = queue.tracks.toArray();
      
      // Use centralized quality badge and bot identity
      const qualityBadge = quality.qualityBadge;
      const botIdentity = identity.displayName;
      
      const embed = new EmbedBuilder()
        .setTitle("📋 Playlist Added")
        .setDescription(
          tracks.slice(0, 20)
            .map((t: Track, index: number) => `${index + 1}. ${t.title}`)
            .join("\n")
            .slice(0, 4095) + (tracks.length > 20 ? `\n... and ${tracks.length - 20} more` : "")
        )
        .setColor("#F8AA2A")
        .addFields({ name: "Total Tracks", value: `${tracks.length + 1}`, inline: true })
        .setFooter({ text: `${qualityBadge} • ${botIdentity} • Requested by ${interaction.user.username}` })
        .setTimestamp();

      return interaction.editReply({
        content: i18n.__mf("playlist.startedPlaylist", { author: interaction.user.id }),
        embeds: [embed]
      });
    } catch (error) {
      console.error("[playlist] Error:", error);
      return interaction.editReply({ content: i18n.__("playlist.errorNotFoundPlaylist") }).catch(console.error);
    }
  }
};
