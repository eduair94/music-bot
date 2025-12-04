import { DiscordGatewayAdapterCreator, joinVoiceChannel } from "@discordjs/voice";
import { ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { bot } from "../index";
import { MusicQueue } from "../structs/MusicQueue";
import { SongFast } from "../structs/SongFast";
import { i18n } from "../utils/i18n";
import { detectSpotifyType, isSpotifyUrl, playlistPattern } from "../utils/patterns";

/**
 * /play_new command - Optimized music playback using play-dl
 * 
 * This command uses play-dl instead of yt-dlp for:
 * - Much faster song loading (no process spawning)
 * - Native Node.js streaming
 * - Better WebM/Opus handling for Discord
 * - Reduced CPU and memory usage
 * 
 * Supports: YouTube, SoundCloud, Spotify (via YouTube bridge)
 */
export default {
  data: new SlashCommandBuilder()
    .setName("play_new")
    .setDescription("⚡ Fast music playback (optimized) - YouTube, SoundCloud, Spotify")
    .addStringOption((option) => 
      option
        .setName("song")
        .setDescription("Song name, YouTube URL, SoundCloud URL, or Spotify URL")
        .setRequired(true)
    ),
  cooldown: 2, // Faster cooldown since this command is quicker
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  
  async execute(interaction: ChatInputCommandInteraction, input?: string) {
    let argSongName: string | null = interaction.options.getString("song");
    if (!argSongName) argSongName = input || null;

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

    // Defer reply for faster response
    if (interaction.replied) {
      await interaction.editReply("⚡ Loading with fast engine...").catch(console.error);
    } else {
      await interaction.deferReply();
      await interaction.editReply("⚡ Loading with fast engine...");
    }

    // Start the playlist if playlist url was provided
    if (playlistPattern.test(url)) {
      await interaction.editReply("🔗 Link is a playlist - use /playlist command for playlists").catch(console.error);
      return;
    }

    let song: SongFast | SongFast[];

    try {
      const startTime = Date.now();
      const result = await SongFast.from(url, url);
      const loadTime = Date.now() - startTime;
      
      console.log(`[play_new] ⚡ Loaded in ${loadTime}ms`);
      
      // Handle Spotify playlists/albums (multiple songs)
      if (Array.isArray(result)) {
        const songs = result as SongFast[];
        
        if (songs.length === 0) {
          return interaction
            .editReply({ content: "❌ No songs found from Spotify URL" })
            .catch(console.error);
        }

        // Determine if it's playlist or album
        const spotifyType = isSpotifyUrl(url) ? detectSpotifyType(url) : 'unknown';
        const contentType = spotifyType === 'album' ? 'album' : 'playlist';
        
        console.log(`[play_new] Adding ${songs.length} songs from Spotify ${contentType}`);

        // Create or get queue
        const existingQueue = bot.queues.get(interaction.guild!.id);
        
        if (existingQueue) {
          // Add all songs to existing queue (cast to any to allow SongFast)
          songs.forEach(s => existingQueue.enqueue(s as any));
          
          return interaction
            .editReply({ 
              content: `🎧 Added **${songs.length}** songs from Spotify ${contentType} to the queue! (loaded in ${loadTime}ms)` 
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

          // Add all songs (cast to any to allow SongFast)
          songs.forEach(s => newQueue.enqueue(s as any));
          
          interaction
            .editReply({ 
              content: `🎧 Added **${songs.length}** songs from Spotify ${contentType}! (loaded in ${loadTime}ms)` 
            })
            .catch(console.error);
          
          return;
        }
      }
      
      // Single song
      song = result as SongFast;
      
      console.log(`[play_new] ⚡ Playing: ${song.title} (${song.platform})`);
      
    } catch (error: any) {
      console.error("[play_new] Error:", error);

      if (error.name === "NoResults")
        return interaction
          .editReply({ content: i18n.__mf("play.errorNoResults", { url: `<${url}>` }) })
          .catch(console.error);

      if (error.name === "InvalidURL") {
        return interaction
          .editReply({ 
            content: `❌ ${error.message || i18n.__mf("play.errorInvalidURL", { url: `<${url}>` })}\n\n**Supported platforms:** YouTube, SoundCloud, Spotify`
          })
          .catch(console.error);
      }

      if (error.name === "UsePlaylistCommand") {
        return interaction
          .editReply({ 
            content: `📋 ${error.message}\n\nUse **/playlist** for YouTube/SoundCloud playlists.`
          })
          .catch(console.error);
      }

      if (error.name === "SpotifyNotConfigured") {
        return interaction
          .editReply({ 
            content: `❌ ${error.message}`
          })
          .catch(console.error);
      }

      if (error.name === "NoYouTubeMatch") {
        return interaction
          .editReply({ 
            content: `❌ ${error.message}`
          })
          .catch(console.error);
      }

      if (error.name === "NoQuery") {
        return interaction
          .editReply({ 
            content: `❌ Please provide a song name or URL to play.`
          })
          .catch(console.error);
      }

      // Generic error
      return interaction
        .editReply({ content: `❌ An error occurred: ${error.message || "Unknown error"}` })
        .catch(console.error);
    }

    // Add to existing queue or create new one
    if (queue) {
      // Cast to any to allow SongFast to be used with Song-based queue
      queue.enqueue(song as any);

      const loadTime = Date.now() - Date.now(); // placeholder
      return (interaction.channel as TextChannel)
        .send({ 
          content: `⚡ ${i18n.__mf("play.queueAdded", { title: song.title, author: interaction.user.id })}` 
        })
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

    // Cast to any to allow SongFast to be used with Song-based queue
    newQueue.enqueue(song as any);
    interaction.deleteReply().catch(console.error);
  }
};
