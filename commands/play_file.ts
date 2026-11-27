import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { dispatchPlay } from "../services/fleet/dispatcher";
import { getPlaybackSettings } from "../utils/audioSettings";
import { i18n } from "../utils/i18n";
import { listenersElsewhere } from "../utils/playFlow";

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
    .setDescription(i18n.__("play_file.description"))
    .addAttachmentOption((option) =>
      option
        .setName("file")
        .setDescription(i18n.__("play_file.optionFile"))
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("title")
        .setDescription(i18n.__("play_file.optionTitle"))
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
        content: `❌ ${i18n.__("common.voiceChannelNotAllowed")}`,
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
        content: `❌ ${i18n.__mf("common.invalidFileType", { formats: `\n\`\`\`\n${audioExtensions.join(', ')}\n\`\`\`` })}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Check file size (Discord limit is 25MB for non-boosted servers)
    const maxSize = 25 * 1024 * 1024; // 25MB in bytes
    if (attachment.size > maxSize) {
      return interaction.reply({
        content: `❌ ${i18n.__mf("common.fileTooLarge", { size: (attachment.size / 1024 / 1024).toFixed(2), max: 25 })}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Fleet: another Bypass instance may serve the member's channel.
    if (interaction.inCachedGuild() && (await dispatchPlay({ interaction, query: attachment.url }))) return;

    const playerService = DiscordPlayerService.getInstance();

    if (!playerService.isInitialized()) {
      return interaction.reply({
        content: `❌ ${i18n.__("common.playerInitializing")}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Get settings for queue size check
    const settings = await settingsService.getSettings(guildId);

    // Check queue size limit
    const existingQueue = playerService.getQueue(guildId);
    if (existingQueue && existingQueue.size >= settings.maxQueueSize) {
      return interaction.reply({
        content: `❌ ${i18n.__mf("common.queueFull", { max: settings.maxQueueSize })}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Never pull the bot away from people listening in another channel.
    const busyIn = listenersElsewhere(interaction.guild!, voiceChannel.id);
    if (busyIn) {
      return interaction.reply({
        content: `🎧 ${i18n.__mf("play.botNotInChannel", { channel: `<#${busyIn.id}>` })}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Move bot to user's channel if in different channel (nobody is listening there)
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
          content: `❌ ${i18n.__mf("play_file.cantPlay", { name: `**${attachment.name}**` })}`
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
        .setTitle(isFirstTrack ? `🎵 ${i18n.__("play_file.nowPlayingTitle")}` : `📎 ${i18n.__("play_file.addedTitle")}`)
        .setDescription(`**${customTitle || attachment.name}**`)
        .addFields(
          { name: i18n.__("play_file.format"), value: fileExt, inline: true },
          { name: i18n.__("play_file.size"), value: `${fileSizeMB} MB`, inline: true },
          { name: i18n.__("common.field.duration"), value: track.duration || i18n.__("common.unknown"), inline: true }
        )
        .setFooter({ text: `${quality.qualityBadge} • ${identity.displayName} • ${i18n.__mf("common.requestedBy", { user: interaction.user.username })}` });

      if (!isFirstTrack) {
        embed.addFields({ name: i18n.__("common.field.positionInQueue"), value: `#${queue.size}`, inline: true });
      }

      // Add load time
      embed.addFields({ name: i18n.__("common.field.loadTime"), value: `${loadTime}ms`, inline: true });

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
    return `❌ ${i18n.__mf("play_file.error.load", { name: `**${fileName}**` })}`;
  }
  if (message.includes("timeout")) {
    return `❌ ${i18n.__("play_file.error.timeout")}`;
  }
  if (message.includes("403") || message.includes("forbidden")) {
    return `❌ ${i18n.__("play_file.error.forbidden")}`;
  }
  if (message.includes("404")) {
    return `❌ ${i18n.__("play_file.error.notFound")}`;
  }

  return error.message ? `❌ ${error.message}` : `❌ ${i18n.__("play_file.error.generic")}`;
}
