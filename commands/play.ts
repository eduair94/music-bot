import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { i18n } from "../utils/i18n";

/**
 * /play command - Music playback using discord-player
 * 
 * Features:
 * - Fast playback via discord-player with yt-dlp streaming
 * - Built-in queue management
 * - Native Opus streaming for Discord
 * - Support for YouTube, SoundCloud, Spotify, and direct audio URLs
 * - Voice channel restrictions based on guild settings
 */
export default {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription(i18n.__("play.description"))
    .addStringOption((option) => 
      option
        .setName("song")
        .setDescription("Song name, YouTube URL, SoundCloud URL, or Spotify URL")
        .setRequired(true)
    ),
  cooldown: 1,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  
  async execute(interaction: ChatInputCommandInteraction, input?: string) {
    const startTime = Date.now();
    const query = interaction.options.getString("song") || input;
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

    if (!query) {
      return interaction.reply({ 
        content: i18n.__mf("play.usageReply", { prefix: "/" }), 
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

    const playerService = DiscordPlayerService.getInstance();
    
    if (!playerService.isInitialized()) {
      return interaction.reply({ 
        content: "❌ Music player is still initializing. Please try again in a few seconds.", 
        ephemeral: true 
      }).catch(console.error);
    }

    // Get settings for queue size check and volume
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
        console.log(`[play] 🔄 Moving bot to ${voiceChannel.id}`);
      } catch (error) {
        console.error("[play] Error moving to new channel:", error);
      }
    }

    await interaction.deferReply();
    const textChannel = interaction.channel as TextChannel;

    try {
      console.log(`[play] ⚡ Playing: "${query}"`);
      const result = await playerService.play(voiceChannel, query, textChannel);

      if (!result) {
        return interaction.editReply({ 
          content: i18n.__mf("play.errorNoResults", { url: `<${query}>` })
        }).catch(console.error);
      }

      const loadTime = Date.now() - startTime;
      const { track, queue, playlist, searchResult } = result;

      // Increment song played counter
      await settingsService.incrementSongPlayed(guildId);

      // Get embed color from settings
      const embedColor = parseInt(settings.embedColor.replace("#", ""), 16);

      // Check if this is a playlist
      const isPlaylist = playlist !== null;
      const totalTracks = searchResult.tracks.length;

      let embed: EmbedBuilder;

      if (isPlaylist && playlist) {
        // Playlist embed - show playlist info
        embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle("📋 Playlist Added to Queue")
          .setDescription(`**[${playlist.title}](${playlist.url})**`)
          .addFields(
            { name: "Tracks", value: `${totalTracks} songs`, inline: true },
            { name: "Source", value: track.source || "Unknown", inline: true },
            { name: "Load Time", value: `${loadTime}ms`, inline: true }
          )
          .setThumbnail(playlist.thumbnail || track.thumbnail || null)
          .setFooter({ text: `Requested by ${interaction.user.username}` });

        // Show first track that will play
        embed.addFields({ 
          name: "▶️ Now Playing", 
          value: `**${track.title}** by ${track.author || "Unknown"}`, 
          inline: false 
        });
      } else {
        // Single track embed
        const isFirstTrack = queue.size === 0;
        embed = new EmbedBuilder()
          .setColor(embedColor)
          .setTitle(isFirstTrack ? "▶️ Now Playing" : "➕ Added to Queue")
          .setDescription(`**[${track.title}](${track.url})**`)
          .addFields(
            { name: "Artist", value: track.author || "Unknown", inline: true },
            { name: "Duration", value: track.duration || "Unknown", inline: true },
            { name: "Load Time", value: `${loadTime}ms`, inline: true }
          )
          .setThumbnail(track.thumbnail || null)
          .setFooter({ text: `Source: ${track.source} • Requested by ${interaction.user.username}` });

        if (!isFirstTrack) {
          embed.addFields({ name: "Position in Queue", value: `#${queue.size}`, inline: true });
        }
      }

      return interaction.editReply({ embeds: [embed] }).catch(console.error);

    } catch (error: any) {
      console.error("[play] ❌ Error:", error);
      const errorMessage = getErrorMessage(error, query);

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
function getErrorMessage(error: any, query: string): string {
  const message = error.message?.toLowerCase() || '';
  
  if (message.includes("no results")) {
    return i18n.__mf("play.errorNoResults", { url: `<${query}>` });
  }
  if (message.includes("sign in")) {
    return "❌ This video requires sign-in. Try a different video.";
  }
  if (message.includes("age")) {
    return "❌ This video is age-restricted.";
  }
  if (message.includes("private")) {
    return "❌ This video is private and cannot be played.";
  }
  if (message.includes("unavailable")) {
    return "❌ This video is unavailable in your region.";
  }
  
  return error.message ? `❌ ${error.message}` : "❌ An error occurred while playing the track.";
}