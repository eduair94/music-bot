import { DiscordGatewayAdapterCreator, joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { bot } from "../index";
import { MusicQueue } from "../structs/MusicQueue";
import { Song } from "../structs/Song";
import { i18n } from "../utils/i18n";
import { detectSpotifyType, isSpotifyUrl, playlistPattern } from "../utils/patterns";
import { getPlatformInfo } from "../utils/platformDetector";

export default {
  data: new SlashCommandBuilder()
    .setName("play_old")
    .setDescription("🐢 Legacy player (yt-dlp) - Use /play for faster playback")
    .addStringOption((option) => option.setName("song").setDescription("The song you want to play").setRequired(true)),
  cooldown: 3,
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  async execute(interaction: ChatInputCommandInteraction, input: string) {
    let argSongName = interaction.options.getString("song");
    if (!argSongName) argSongName = input;

    const guildMember = interaction.guild!.members.cache.get(interaction.user.id);
    const { channel } = guildMember!.voice;

    if (!channel)
      return interaction.reply({ content: i18n.__("play.errorNotChannel"), ephemeral: true }).catch(console.error);

    const queue = bot.queues.get(interaction.guild!.id);

    if (queue && channel.id !== queue.connection.joinConfig.channelId)
      return interaction
        .reply({
          content: i18n.__mf("play.errorNotInSameChannel", { user: bot.client.user!.username }),
          ephemeral: true
        })
        .catch(console.error);

    if (!argSongName)
      return interaction
        .reply({ content: i18n.__mf("play.usageReply", { prefix: bot.prefix }), ephemeral: true })
        .catch(console.error);

    const url = argSongName;

    if (interaction.replied) await interaction.editReply("⏳ Loading...").catch(console.error);
    else await interaction.reply("⏳ Loading...");

    // Start the playlist if playlist url was provided
    if (playlistPattern.test(url)) {
      await interaction.editReply("🔗 Link is playlist").catch(console.error);

      return bot.slashCommandsMap.get("playlist")!.execute(interaction, "song");
    }

    let song;

    try {
      const result = await Song.from(url, url);
      
      // Handle Spotify playlists/albums (multiple songs)
      if (Array.isArray(result)) {
        const songs = result as Song[];
        
        if (songs.length === 0) {
          return interaction
            .reply({ content: "❌ No songs found from Spotify URL", ephemeral: true })
            .catch(console.error);
        }

        // Determine if it's playlist or album
        const spotifyType = isSpotifyUrl(url) ? detectSpotifyType(url) : 'unknown';
        const contentType = spotifyType === 'album' ? 'album' : 'playlist';
        
        console.log(`Adding ${songs.length} songs from Spotify ${contentType}`);

        // Create or get queue
        const queue = bot.queues.get(interaction.guild!.id);
        
        if (queue) {
          // Add all songs to existing queue
          songs.forEach(s => queue.enqueue(s));
          
          return interaction
            .editReply({ 
              content: `🎧 Added **${songs.length}** songs from Spotify ${contentType} to the queue!` 
            })
            .catch(console.error);
        } else {
          // Create new queue
          const newQueue = new MusicQueue({
            interaction,
            textChannel: interaction.channel! as TextChannel,
            connection: joinVoiceChannel({
              channelId: channel!.id,
              guildId: channel!.guild.id,
              adapterCreator: channel!.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
            })
          });

          bot.queues.set(interaction.guild!.id, newQueue);

          // Add all songs
          songs.forEach(s => newQueue.enqueue(s));
          
          interaction
            .editReply({ 
              content: `🎧 Added **${songs.length}** songs from Spotify ${contentType}!` 
            })
            .catch(console.error);
          
          return;
        }
      }
      
      // Single song
      song = result as Song;
      
      // Log platform information
      const platformInfo = getPlatformInfo(song.url);
      console.log(`Playing from ${platformInfo.platform}: ${song.title}`);
    } catch (error: any) {
      console.error(error);

      if (error.name == "NoResults")
        return interaction
          .editReply({ content: i18n.__mf("play.errorNoResults", { url: `<${url}>` }) })
          .catch(console.error);

      if (error.name == "InvalidURL") {
        // Provide more helpful error message with supported platforms
        const errorMsg = error.message || i18n.__mf("play.errorInvalidURL", { url: `<${url}>` });
        return interaction
          .editReply({ 
            content: `❌ ${errorMsg}\n\n**Supported platforms:** YouTube, SoundCloud, Bandcamp, Spotify, Audiomack, Mixcloud`
          })
          .catch(console.error);
      }

      if (error.name == "SpotifyNotConfigured") {
        return interaction
          .editReply({ 
            content: `❌ ${error.message}`
          })
          .catch(console.error);
      }

      if (error.name == "NoYouTubeMatch") {
        return interaction
          .editReply({ 
            content: `❌ ${error.message}`
          })
          .catch(console.error);
      }

      // Check if it's a yt-dlp signature/format error
      if (error.stderr && (error.stderr.includes('Signature solving failed') || 
                          error.stderr.includes('Requested format is not available') ||
                          error.stderr.includes('n challenge solving failed'))) {
        return interaction
          .editReply({ 
            content: `❌ Failed to extract video information. YouTube may be blocking the request. Please try again in a moment.\n\n**Technical details:** Signature solving failed. The bot is attempting to resolve this automatically.`
          })
          .catch(console.error);
      }

      if (interaction.replied)
        return await interaction.editReply({ content: i18n.__("common.errorCommand") }).catch(console.error);
      else return interaction.reply({ content: i18n.__("common.errorCommand"), ephemeral: true }).catch(console.error);
    }

    if (queue) {
      queue.enqueue(song);

      return (interaction.channel as TextChannel)
        .send({ content: i18n.__mf("play.queueAdded", { title: song.title, author: interaction.user.id }) })
        .catch(console.error);
    }

    const newQueue = new MusicQueue({
      interaction,
      textChannel: interaction.channel! as TextChannel,
      connection: joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator as DiscordGatewayAdapterCreator
      })
    });

    bot.queues.set(interaction.guild!.id, newQueue);

    newQueue.enqueue(song);
    interaction.deleteReply().catch(console.error);
  }
};
