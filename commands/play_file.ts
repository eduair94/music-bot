import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { getPlaybackSettings } from "../utils/audioSettings";
import { i18n } from "../utils/i18n";

/**
 * /play_file command - Play an attached audio file
 * 
 * Supported formats (via FFmpeg):
 * - MP3, M4A, AAC, WAV, FLAC, OGG, OPUS
 * - WMA, AIFF, APE, AC3, DTS
 * - And many more audio formats supported by FFmpeg
 */
export default {
  data: new SlashCommandBuilder()
    .setName("play_file")
    .setDescription("Play an audio file from attachment")
    .addAttachmentOption((option) =>
      option
        .setName("file")
        .setDescription("Audio file to play (MP3, WAV, FLAC, M4A, OGG, etc.)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription("Optional custom title for the track")
        .setRequired(false)
    ),
  cooldown: 3,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],

  async execute(interaction: ChatInputCommandInteraction) {
    const startTime = Date.now();
    const attachment = interaction.options.getAttachment("file", true);
    const customTitle = interaction.options.getString("title");
    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;
    const guildId = interaction.guild!.id;

    // Validation checks
    if (!voiceChannel) {
      return interaction.reply({
        content: i18n.__("play.errorNotChannel"),
        ephemeral: true
      }).catch(console.error);
    }

    // Check guild settings for voice channel restriction
    const settingsService = GuildSettingsService.getInstance();
    const isVoiceChannelAllowed = await settingsService.isVoiceChannelAllowed(guildId, voiceChannel.id);

    if (!isVoiceChannelAllowed) {
      return interaction.reply({
        content: "❌ The bot is not allowed to play in this voice channel. Please use an allowed channel.",
        ephemeral: true
      }).catch(console.error);
    }

    // Validate attachment is an audio file
    const audioExtensions = [
      '.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus',
      '.wma', '.aiff', '.ape', '.ac3', '.dts', '.alac', '.oga',
      '.webm', '.3gp', '.amr', '.tta', '.mka', '.wv', '.m4b'
    ];

    const fileName = attachment.name.toLowerCase();
    const isAudioFile = audioExtensions.some(ext => fileName.endsWith(ext));

    if (!isAudioFile) {
      return interaction.reply({
        content: `❌ Invalid file type. Supported formats:\n\`\`\`\n${audioExtensions.join(', ')}\n\`\`\``,
        ephemeral: true
      }).catch(console.error);
    }

    // Check file size (Discord limit is 25MB for non-boosted servers)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (attachment.size > maxSize) {
      return interaction.reply({
        content: `❌ File is too large (${(attachment.size / 1024 / 1024).toFixed(2)}MB). Maximum size is 25MB.`,
        ephemeral: true
      }).catch(console.error);
    }

    const playerService = DiscordPlayerService.getInstance();

    if (!playerService.isInitialized()) {
      return interaction.reply({
        content: "❌ Music player is still initializing. Please try again in a few seconds.",
        ephemeral: true
      }).catch(console.error);
    }

    // Get settings for queue size check
    const settings = await settingsService.getSettings(guildId);

    // Check queue size limit
    const existingQueue = playerService.getQueue(guildId);
    if (existingQueue && existingQueue.size >= settings.maxQueueSize) {
      return interaction.reply({
        content: `❌ Queue is full! Maximum ${settings.maxQueueSize} songs allowed.`,
        ephemeral: true
      }).catch(console.error);
    }

    // Move bot to user's channel if in different channel
    if (existingQueue?.channel && existingQueue.channel.id !== voiceChannel.id) {
      try {
        existingQueue.delete();
        console.log(`[play_file]  Moving bot to ${voiceChannel.id}`);
      } catch (error) {
        console.error("[play_file] Error moving to new channel:", error);
      }
    }

    await interaction.deferReply();
    const textChannel = interaction.channel as TextChannel;

    try {
      console.log(`[play_file] 🎵 Playing file: "${attachment.name}" from ${attachment.url}`);

      // Get audio settings using centralized utility (owner > user patreon > guild premium > default)
      const { quality, identity } = await getPlaybackSettings(interaction.user.id, guildId);

      // Play the attachment URL directly
      const result = await playerService.play(voiceChannel, attachment.url, textChannel, quality.bitrate);

      if (!result) {
        return interaction.editReply({
          content: `❌ Could not play the file: **${attachment.name}**`
        }).catch(console.error);
      }

      const loadTime = Date.now() - startTime;
      const { track, queue } = result;

      // Increment song played counter
      await settingsService.incrementSongPlayed(guildId);

      const embedColor = parseInt(settings.embedColor.replace("#", ""), 16);
      const isFirstTrack = queue.size === 0;

      // Format file size
      const fileSizeMB = (attachment.size / 1024 / 1024).toFixed(2);

      // Get file extension for icon
      const fileExt = fileName.substring(fileName.lastIndexOf('.')).toUpperCase();

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isFirstTrack ? "🎵 Now Playing File" : "📎 File Added to Queue")
        .setDescription(`**${customTitle || attachment.name}**`)
        .addFields(
          { name: "Format", value: fileExt, inline: true },
          { name: "Size", value: `${fileSizeMB} MB`, inline: true },
          { name: "Duration", value: track.duration || "Unknown", inline: true }
        )
        .setFooter({ text: `${quality.qualityBadge} • ${identity.displayName} • Requested by ${interaction.user.username}` });

      if (!isFirstTrack) {
        embed.addFields({ name: "Position in Queue", value: `#${queue.size}`, inline: true });
      }

      // Add load time
      embed.addFields({ name: "Load Time", value: `${loadTime}ms`, inline: true });

      return interaction.editReply({ embeds: [embed] }).catch(console.error);

    } catch (error: any) {
      console.error("[play_file] ❌ Error:", error);
      const errorMessage = getErrorMessage(error, attachment.name);

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: errorMessage }).catch(console.error);
      }
      return interaction.reply({ content: errorMessage, ephemeral: true }).catch(console.error);
    }
  }
};

/**
 * Get user-friendly error message based on error type
 */
function getErrorMessage(error: any, fileName: string): string {
  const message = error.message?.toLowerCase() || '';

  if (message.includes("no results") || message.includes("not found")) {
    return `❌ Could not load the file: **${fileName}**\n\nPossible reasons:\n• File format not supported\n• File is corrupted\n• File URL expired`;
  }
  if (message.includes("timeout")) {
    return `❌ File download timed out. The file might be too large or the connection is slow.`;
  }
  if (message.includes("403") || message.includes("forbidden")) {
    return `❌ Access denied to the file. Please re-upload and try again.`;
  }
  if (message.includes("404")) {
    return `❌ File not found. The attachment URL may have expired.`;
  }

  return error.message ? `❌ ${error.message}` : `❌ An error occurred while playing the file.`;
}
