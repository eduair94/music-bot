import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { GuildSettingsService } from "../services/guildSettings";
import { dispatchPlay } from "../services/fleet/dispatcher";
import { SpotifyService } from "../services/spotify";
import { getPlaybackSettings } from "../utils/audioSettings";
import { SPOTIFY_PROVIDER_HOST } from "../shared/links";
import { i18n } from "../utils/i18n";
import { listenersElsewhere } from "../utils/playFlow";

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
    .setDescription(i18n.__("play_spotify.description"))
    .addStringOption((option) => 
      option
        .setName("query")
        .setDescription(i18n.__("play_spotify.optionQuery"))
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
        content: `❌ ${i18n.__("common.voiceChannelNotAllowed")}`,
        ephemeral: true
      }).catch(console.error);
    }

    // Fleet: another Bypass instance may serve the member's channel.
    if (interaction.inCachedGuild() && (await dispatchPlay({ interaction, query }))) return;

    const playerService = DiscordPlayerService.getInstance();

    if (!playerService.isInitialized()) {
      return interaction.reply({ 
        content: `❌ ${i18n.__("common.playerInitializing")}`, 
        ephemeral: true 
      }).catch(console.error);
    }

    // Get settings for queue size check and volume
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
        console.log(`[play] 🔄 Moving bot to ${voiceChannel.id}`);
      } catch (error) {
        console.error("[play] Error moving to new channel:", error);
      }
    }

    await interaction.deferReply();
    const textChannel = interaction.channel as TextChannel;

    try {
      // Get audio settings using centralized utility
      const { quality, identity } = await getPlaybackSettings(interaction.user.id, guildId);
      const audioBitrate = quality.bitrate;

      // If it's a direct Spotify URL, use it directly
      if (query.includes("spotify.com")) {
        console.log(`[play_spotify] 🔗 Using direct Spotify URL: "${query}" @ ${audioBitrate}kbps`);
        const result = await playerService.play(voiceChannel, query, textChannel, audioBitrate);

        if (!result) {
          return interaction.editReply({ 
            content: `❌ ${i18n.__mf("play_spotify.cantPlayLink", { query: `**${query}**` })}`
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

        // Build quality badge from centralized utility
        const qualityBadge = quality.qualityBadge;
        const botIdentity = identity.displayName;

        let embed: EmbedBuilder;

        if (isPlaylist) {
          const playlistTitle = playlist?.title || i18n.__("play_spotify.playlistFallback");
          const playlistUrl = playlist?.url || query;
          const playlistThumbnail = playlist?.thumbnail || track.thumbnail || null;

          embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(`📋 ${i18n.__("play_spotify.playlistAdded")}`)
            .setDescription(`**[${playlistTitle}](${playlistUrl})**`)
            .addFields(
              { name: i18n.__("common.field.tracks"), value: i18n.__mf("play_spotify.songs", { count: totalTracks }), inline: true },
              { name: i18n.__("common.field.source"), value: "🎵 Spotify", inline: true },
              { name: i18n.__("common.field.loadTime"), value: `${loadTime}ms`, inline: true }
            )
            .setThumbnail(playlistThumbnail)
            .setFooter({ text: `${qualityBadge} • ${botIdentity} • ${i18n.__mf("common.requestedBy", { user: interaction.user.username })} • ${i18n.__mf("common.poweredBy", { provider: SPOTIFY_PROVIDER_HOST })}` });

          embed.addFields({ 
            name: `▶️ ${i18n.__("play_spotify.nowPlaying")}`, 
            value: i18n.__mf("play_spotify.trackBy", { title: `**${track.title}**`, author: track.author || i18n.__("common.unknown") }), 
            inline: false 
          });
        } else {
          const isFirstTrack = queue.size === 0;
          embed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle(isFirstTrack ? `🎵 ${i18n.__("play_spotify.nowPlayingTitle")}` : `➕ ${i18n.__("play_spotify.addedTitle")}`)
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
              { name: i18n.__("common.field.artist"), value: track.author || i18n.__("common.unknown"), inline: true },
              { name: i18n.__("common.field.duration"), value: track.duration || i18n.__("common.unknown"), inline: true },
              { name: i18n.__("common.field.loadTime"), value: `${loadTime}ms`, inline: true }
            )
            .setThumbnail(track.thumbnail || null)
            .setFooter({ text: `${qualityBadge} • ${botIdentity} • ${i18n.__mf("common.requestedBy", { user: interaction.user.username })} • ${i18n.__mf("common.poweredBy", { provider: SPOTIFY_PROVIDER_HOST })}` });

          if (!isFirstTrack) {
            embed.addFields({ name: i18n.__("common.field.positionInQueue"), value: `#${queue.size}`, inline: true });
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
          content: `❌ ${i18n.__mf("play_spotify.noResults", { query: `**${query}**` })}`
        }).catch(console.error);
      }

      console.log(`[play_spotify] ✅ Found: "${trackResult.name}" by ${trackResult.artist}`);

      // Build YouTube search query from Spotify track info
      const youtubeSearchQuery = `${trackResult.name} ${trackResult.artist}`;
      console.log(`[play_spotify] 🎬 Searching YouTube for: "${youtubeSearchQuery}"`);

      // Play using YouTube search (discord-player will find the best match)
      const result = await playerService.play(voiceChannel, youtubeSearchQuery, textChannel, audioBitrate);

      if (!result) {
        return interaction.editReply({ 
          content: `❌ ${i18n.__mf("play_spotify.notOnYoutube", { title: `**${trackResult.name}**`, artist: trackResult.artist })}`
        }).catch(console.error);
      }

      const loadTime = Date.now() - startTime;
      const { track, queue } = result;

      // Increment song played counter
      await settingsService.incrementSongPlayed(guildId);

      const embedColor = 0x1DB954; // Spotify green
      const isFirstTrack = queue.size === 0;

      // Use centralized quality badge and bot identity
      const qualityBadge = quality.qualityBadge;
      const botIdentity = identity.displayName;

      const embed = new EmbedBuilder()
        .setColor(embedColor)
        .setTitle(isFirstTrack ? `🎵 ${i18n.__("play_spotify.nowPlayingTitle")}` : `➕ ${i18n.__("play_spotify.addedTitle")}`)
        .setDescription(`**${trackResult.name}**`)
        .addFields(
          { name: i18n.__("common.field.artist"), value: trackResult.artist, inline: true },
          { name: i18n.__("common.field.duration"), value: trackResult.durationFormatted, inline: true },
          { name: i18n.__("common.field.loadTime"), value: `${loadTime}ms`, inline: true }
        )
        .setThumbnail(trackResult.albumArt)
        .setFooter({ text: `${qualityBadge} • ${botIdentity} • ${i18n.__mf("common.requestedBy", { user: interaction.user.username })} • ${i18n.__mf("common.poweredBy", { provider: SPOTIFY_PROVIDER_HOST })}` });

      if (!isFirstTrack) {
        embed.addFields({ name: i18n.__("common.field.positionInQueue"), value: `#${queue.size}`, inline: true });
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
    return `❌ ${i18n.__("play_spotify.error.auth")}`;
  }
  if (message.includes("premium") || message.includes("subscription")) {
    return `❌ ${i18n.__("play_spotify.error.premium")}`;
  }
  if (message.includes("private")) {
    return `❌ ${i18n.__("play_spotify.error.private")}`;
  }
  if (message.includes("unavailable") || message.includes("not available")) {
    return `❌ ${i18n.__("play_spotify.error.region")}`;
  }
  
  return error.message ? `❌ ${error.message}` : `❌ ${i18n.__("play_spotify.error.generic")}`;
}