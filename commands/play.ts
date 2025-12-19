import { ChatInputCommandInteraction, EmbedBuilder, GuildMember, PermissionsBitField, SlashCommandBuilder, TextChannel } from "discord.js";
import { DiscordPlayerService } from "../services/discordPlayer";
import { i18n } from "../utils/i18n";

/**
 * /play command - Ultra-fast music playback using discord-player
 * 
 * This command uses discord-player with discord-player-youtubei for:
 * - Instant playback (typically < 500ms)
 * - No process spawning (native Node.js streaming)
 * - Built-in queue management
 * - Native Opus streaming for Discord
 * - Support for YouTube, SoundCloud, Spotify, and more
 * 
 * For legacy yt-dlp based playback, use /play_old
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
  cooldown: 1, // Very fast cooldown since discord-player is quick
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  
  async execute(interaction: ChatInputCommandInteraction, input?: string) {
    const startTime = Date.now();
    let argSongName: string | null = interaction.options.getString("song");
    if (!argSongName) argSongName = input || null;

    const guildMember = interaction.member as GuildMember;
    const voiceChannel = guildMember?.voice?.channel;

    // Check if user is in a voice channel
    if (!voiceChannel) {
      return interaction.reply({ 
        content: i18n.__("play.errorNotChannel"), 
        ephemeral: true 
      }).catch(console.error);
    }

    // Check if song name was provided
    if (!argSongName) {
      return interaction.reply({ 
        content: i18n.__mf("play.usageReply", { prefix: "/" }), 
        ephemeral: true 
      }).catch(console.error);
    }

    // Get the discord-player service
    const playerService = DiscordPlayerService.getInstance();
    
    if (!playerService.isInitialized()) {
      return interaction.reply({ 
        content: "❌ Music player is still initializing. Please try again in a few seconds.", 
        ephemeral: true 
      }).catch(console.error);
    }

    // Check if bot is already in a different voice channel
    const existingQueue = playerService.getQueue(interaction.guild!.id);
    if (existingQueue && existingQueue.channel && existingQueue.channel.id !== voiceChannel.id) {
      return interaction.reply({
        content: i18n.__mf("play.errorNotInSameChannel", { user: interaction.client.user!.username }),
        ephemeral: true
      }).catch(console.error);
    }

    // Defer reply for loading indicator
    await interaction.deferReply();

    const query = argSongName;
    const textChannel = interaction.channel as TextChannel;

    try {
      console.log(`[play] ⚡ Fast play request: "${query}"`);

      // Use discord-player's built-in play method for instant playback
      const result = await playerService.play(voiceChannel, query, textChannel);

      if (!result) {
        return interaction.editReply({ 
          content: i18n.__mf("play.errorNoResults", { url: `<${query}>` })
        }).catch(console.error);
      }

      const loadTime = Date.now() - startTime;
      const { track, queue } = result;

      // Create a nice embed response
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle(queue.size > 0 ? "➕ Added to Queue" : "▶️ Now Playing")
        .setDescription(`**[${track.title}](${track.url})**`)
        .addFields(
          { name: "Artist", value: track.author || "Unknown", inline: true },
          { name: "Duration", value: track.duration || "Unknown", inline: true },
          { name: "Load Time", value: `${loadTime}ms`, inline: true }
        )
        .setThumbnail(track.thumbnail || null)
        .setFooter({ text: `Source: ${track.source} • Requested by ${interaction.user.username}` });

      // Show queue position if added to queue
      if (queue.size > 0) {
        embed.addFields({ name: "Position in Queue", value: `#${queue.size}`, inline: true });
      }

      return interaction.editReply({ embeds: [embed] }).catch(console.error);

    } catch (error: any) {
      console.error("[play] ❌ Error:", error);

      // Handle specific error types
      let errorMessage = "❌ An error occurred while playing the track.";

      if (error.message?.includes("No results")) {
        errorMessage = i18n.__mf("play.errorNoResults", { url: `<${query}>` });
      } else if (error.message?.includes("Sign in")) {
        errorMessage = "❌ This video requires sign-in. Try a different video or use /play_old with cookies.";
      } else if (error.message?.includes("age")) {
        errorMessage = "❌ This video is age-restricted. Try using /play_old with cookies.";
      } else if (error.message?.includes("private")) {
        errorMessage = "❌ This video is private and cannot be played.";
      } else if (error.message?.includes("unavailable")) {
        errorMessage = "❌ This video is unavailable in your region.";
      } else if (error.message) {
        errorMessage = `❌ ${error.message}`;
      }

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({ content: errorMessage }).catch(console.error);
      } else {
        return interaction.reply({ content: errorMessage, ephemeral: true }).catch(console.error);
      }
    }
  }
};
