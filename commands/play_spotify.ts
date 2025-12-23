import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { SpotifyService } from "../services/spotify";
import { i18n } from "../utils/i18n";

/**
 * /play_spotify command - Search and play music from Spotify
 * 
 * Features:
 * - Search directly on Spotify using query
 * - Plays the best match from Spotify
 * - Supports Spotify tracks, albums, and playlists
 * - Uses discord-player's Spotify integration
 */
export default {
  data: new SlashCommandBuilder()
    .setName("play_spotify")
    .setDescription("Search and play a song from Spotify")
    .addStringOption((option) => 
      option
        .setName("query")
        .setDescription("Song name, artist, or Spotify URL to search for")
        .setRequired(true)
    ),
  cooldown: 1,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  
  async execute(interaction: ChatInputCommandInteraction, input?: string) {
    const startTime = Date.now();
    const query = interaction.options.getString("query") || input;
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
      // If it's a direct Spotify URL, use it directly
      if (query.includes("spotify.com")) {
        console.log(`[play_spotify] 🔗 Using direct Spotify URL: "${query}"`);
        const result = await playerService.play(voiceChannel, query, textChannel);

        if (!result) {
          return interaction.editReply({ 
            content: `❌ Could not play the Spotify link: **${query}**`
          }).catch(console.error);
        }

        const loadTime = Date.now() - startTime;
        const { track, queue, playlist, searchResult } = result;

        // Increment song played counter
        await settingsService.incrementSongPlayed(guildId);

        const embedColor = 0x1DB954; // Spotify green

        // Check if this is a playlist
        const isSpotifyPlaylist = query.includes("spotify.com") && query.includes("/playlist/");
        const isPlaylist = playlist !== null && isSpotifyPlaylist;
        const totalTracks = isPlaylist ? searchResult.tracks.length : 1;

        let embed: EmbedBuilder;

        if (isPlaylist) {
          const playlistTitle = playlist?.title || "Spotify Playlist";
          const playlistUrl = playlist?.url || query;
          const playlistThumbnail = playlist?.thumbnail || track.thumbnail || null;

          embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle("📋 Spotify Playlist Added")
            .setDescription(`**[${playlistTitle}](${playlistUrl})**`)
            .addFields(
              { name: "Tracks", value: `${totalTracks} songs`, inline: true },
              { name: "Source", value: "🎵 Spotify", inline: true },
              { name: "Load Time", value: `${loadTime}ms`, inline: true }
            )
            .setThumbnail(playlistThumbnail)
            .setFooter({ text: `Requested by ${interaction.user.username}` });

          embed.addFields({ 
            name: "▶️ Now Playing", 
            value: `**${track.title}** by ${track.author || "Unknown"}`, 
            inline: false 
          });
        } else {
          const isFirstTrack = queue.size === 0;
          embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(isFirstTrack ? "🎵 Now Playing from Spotify" : "➕ Added to Queue from Spotify")
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
              { name: "Artist", value: track.author || "Unknown", inline: true },
              { name: "Duration", value: track.duration || "Unknown", inline: true },
              { name: "Load Time", value: `${loadTime}ms`, inline: true }
            )
            .setThumbnail(track.thumbnail || null)
            .setFooter({ text: `Source: Spotify • Requested by ${interaction.user.username}` });

          if (!isFirstTrack) {
            embed.addFields({ name: "Position in Queue", value: `#${queue.size}`, inline: true });
          }
        }

        return interaction.editReply({ embeds: [embed] }).catch(console.error);
      }

      // Otherwise, search using custom Spotify API
      console.log(`[play_spotify] 🔍 Searching Spotify for: "${query}"`);
      
      const spotifyService = SpotifyService.getInstance();
      const trackResult = await spotifyService.searchTrack(query);
      
      if (!trackResult) {
        return interaction.editReply({ 
          content: `❌ No results found on Spotify for: **${query}**\n\nTry:\n• Different keywords\n• Adding the artist name\n• Using a direct Spotify link`
        }).catch(console.error);
      }

      console.log(`[play_spotify] ✅ Found: "${trackResult.name}" by ${trackResult.artist} (${trackResult.uri})`);

      // Play using the Spotify URI
      const result = await playerService.play(voiceChannel, trackResult.uri, textChannel);

      if (!result) {
        return interaction.editReply({ 
          content: `❌ Could not play: **${trackResult.name}** by ${trackResult.artist}`
        }).catch(console.error);
      }

      const loadTime = Date.now() - startTime;
      const { track, queue } = result;

      // Increment song played counter
      await settingsService.incrementSongPlayed(guildId);

      const embedColor = 0x1DB954; // Spotify green
      const isFirstTrack = queue.size === 0;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isFirstTrack ? "🎵 Now Playing from Spotify" : "➕ Added to Queue from Spotify")
        .setDescription(`**${trackResult.name}**`)
        .addFields(
          { name: "Artist", value: trackResult.artist, inline: true },
          { name: "Duration", value: trackResult.durationFormatted, inline: true },
          { name: "Load Time", value: `${loadTime}ms`, inline: true }
        )
        .setThumbnail(trackResult.albumArt)
        .setFooter({ text: `Source: Spotify • Requested by ${interaction.user.username}` });

      if (!isFirstTrack) {
        embed.addFields({ name: "Position in Queue", value: `#${queue.size}`, inline: true });
      }

      return interaction.editReply({ embeds: [embed] }).catch(console.error);

    } catch (error: any) {
      console.error("[play_spotify] ❌ Error:", error);
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
  if (message.includes("sign in") || message.includes("login")) {
    return "❌ This Spotify track requires authentication. Try a different track.";
  }
  if (message.includes("premium") || message.includes("subscription")) {
    return "❌ This track requires Spotify Premium.";
  }
  if (message.includes("private")) {
    return "❌ This Spotify track is private and cannot be played.";
  }
  if (message.includes("unavailable") || message.includes("not available")) {
    return "❌ This track is unavailable in your region.";
  }
  
  return error.message ? `❌ ${error.message}` : "❌ An error occurred while playing the Spotify track.";
}